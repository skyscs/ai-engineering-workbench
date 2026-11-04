import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { prepareState, closePrepared } from './setup.mjs';
import { NativeQuestionContext } from './prepare.mjs';
import { revalidateWitness } from './witness.mjs';
import { paddingCorpus, saveBoundaryNotes, controlledPadding, rehash } from './boundary-inputs.mjs';
import { inputSpan } from './compact.mjs';
import { retrieveAnswerContext } from '../../apps/loredock/dist/answer-context.js';
import { codeAnalysisFingerprint } from '../../apps/loredock/dist/code-analysis-facts.js';
import { loadPriorRuntime } from '../../apps/loredock/tests/fixtures/native-before-analysis-writes/load.mjs';
import { openNativeState } from '../loredock-native-qualification/state.mjs';
import { services } from '../loredock-native-qualification/services.mjs';
import { prepareSources, dataHashes } from '../loredock-capture-memory/fixture.mjs';
import { assessMatrix } from './assessment.mjs';

const errorRecord = error => ({ name: error.name, code: error.code ?? null, message: error.message, stack: error.stack });
const delta = (after, before) => Object.fromEntries(Object.keys(after).map(key => [key, after[key] - before[key]]));
const injectionScope = new AsyncLocalStorage();
async function observed(state, candidate, question, request, { signal, hook } = {}) {
  let sqlMutations = 0, networkAttempts = 0; const injected = {}, injections = [];
  const exec = state.store.db.exec, connect = net.Socket.prototype.connect, fetch = globalThis.fetch;
  state.store.db.exec = function (sql, ...args) { if (!/^\s*(SELECT|PRAGMA)\b/i.test(sql)) sqlMutations++; return exec.call(this, sql, ...args); };
  const counters = () => ({ ...state.counters(), sqlMutations });
  const before = counters(), legacyBefore = state.legacy(); let result = null, error = null;
  const injectedAction = async action => {
    const start = counters(); await injectionScope.run({ fixtureMutation: true }, action); const changes = delta(counters(), start);
    injections.push({ context: 'fixtureMutation', changes }); for (const [key, value] of Object.entries(changes)) injected[key] = (injected[key] ?? 0) + value;
  };
  const originalCheckpoint = candidate.options.checkpoint;
  candidate.options.checkpoint = async info => { await originalCheckpoint?.(info); await hook?.(info, injectedAction); };
  net.Socket.prototype.connect = function () { networkAttempts++; throw new Error('Network access is forbidden in this owned offline operation.'); };
  globalThis.fetch = async () => { networkAttempts++; throw new Error('Network access is forbidden in this owned offline operation.'); };
  try { result = await candidate.prepare(question, request, signal); } catch (caught) { error = errorRecord(caught); }
  finally { state.store.db.exec = exec; net.Socket.prototype.connect = connect; globalThis.fetch = fetch; candidate.options.checkpoint = originalCheckpoint; }
  const metrics = candidate.observation;
  return { result, error, metrics, nativeReads: metrics?.nativeReads ?? 0, before, after: counters(), injected, injections,
    legacyBefore, legacyAfter: state.legacy(), networkAttempts };
}
async function analyze(state, buildId, name) { const id = state.analysis.start(name, buildId).id; await state.analysis.idle(); return id; }
const index = async (state, name) => { const p = state.catalog.state(), id = state.catalog.start(name, p.sourceSetVersion, p.policyVersion).id; await state.catalog.idle(); return id; };

export async function runMatrix(directory, corpusFactory, oracle, ledger) {
  const records = [], preparedVariants = new Map(), cleanup = [], errors = [];
  const raw = (name, value) => writeFile(path.join(directory, name + '.json'), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  const record = async value => { await raw(value.id, value); records.push(value); };
  const initialize = async (name, corpus, options) => {
    const prepared = await prepareState(path.join(directory, name), corpus, options);
    const { state, buildId, inventoryId } = prepared;
    await raw(name + '-setup', { catalogId: state.store.receipts.catalogId, buildId, inventoryId, revisions: prepared.revisions,
      files: state.store.one('SELECT count(*) n FROM files WHERE buildId=?', buildId).n,
      sources: state.store.buildSources(buildId), inventory: inventoryId ? state.analysis.get(inventoryId) : null,
      sourceHashes: await dataHashes(path.join(prepared.root, 'sources')) });
    return prepared;
  };
  try {
    for (const variant of new Set(oracle.cases.map(row => row.variant))) {
      try { preparedVariants.set(variant, await initialize('variant-' + variant, corpusFactory(variant))); }
      catch (error) { preparedVariants.set(variant, { error: errorRecord(error) }); }
    }
    for (const item of ledger.cases) {
      if (item.group === 'question') {
        const question = oracle.cases.find(row => 'question.' + row.id === item.id), prepared = preparedVariants.get(item.variant);
        if (prepared.error) { await record({ id: item.id, setupError: prepared.error }); continue; }
        const { state, buildId } = prepared, candidate = new NativeQuestionContext(state.analysis);
        const value = { id: item.id };
        try {
          // The baseline/default are independent warmed controls, never candidate choices.
          try { value.baseline = retrieveAnswerContext(state.catalog, question.question, buildId); } catch (error) { value.baselineError = errorRecord(error); }
          try { value.default = await state.paths.read({ buildId }); } catch (error) { value.defaultError = errorRecord(error); }
          value.operation = await observed(state, candidate, question.question, { buildId });
        } finally { await candidate.stop(); }
        await record(value); continue;
      }
      const value = { id: item.id }; let prepared, candidate;
      try {
        const base = corpusFactory('base'), names = Object.keys(base), firstSource = names[0], hiddenSource = names.at(-1);
        const question = oracle.cases[0].question;
        let corpus = item.group === 'budget' ? paddingCorpus(base, item.id.slice(7)) : base;
        const firstTs = Object.keys(base[firstSource]).find(file => file.endsWith('.ts'));
        if (item.id === 'identity.foreign-source') corpus = { ...base, [hiddenSource]: { ...base[hiddenSource], 'foreign/same.md': base[firstSource][firstTs] } };
        if (item.id === 'inventory.incompatible') {
          const prior = await loadPriorRuntime(); value.priorFingerprint = prior.manifest.fingerprint;
          prepared = await initialize(item.id + '-fixture', corpus, { services: prior.services });
          const old = await prepared.state.paths.read({ buildId: prepared.buildId });
          value.pinned = { buildId: prepared.buildId, inventoryId: old.identity.inventoryId, generationId: old.generationId };
          await prepared.state.close(); prepared.state = openNativeState(path.join(prepared.root, 'data'), services);
          value.currentFingerprint = codeAnalysisFingerprint(); assert.notEqual(value.priorFingerprint, value.currentFingerprint);
        } else prepared = await initialize(item.id + '-fixture', corpus, { analyze: item.id !== 'inventory.missing' });
        const { state } = prepared; let buildId = prepared.buildId, request = value.pinned ?? { buildId }, controlled;
        if (item.id === 'inventory.evicted') {
          const old = await state.paths.read(request); request = { buildId, inventoryId: old.identity.inventoryId, generationId: old.generationId };
          await analyze(state, buildId, 'replace-one'); await analyze(state, buildId, 'replace-two');
          assert.throws(() => state.analysis.get(request.inventoryId), { code: 'NOT_FOUND' });
        } else if (item.id === 'freshness.registry') {
          await prepareSources(prepared.root, { 'boundary-extra-source': { 'README.md': '# Explicit registry change\n' } }, state);
        } else if (item.id === 'freshness.published') {
          value.newBuildId = await index(state, 'replacement-build'); assert.notEqual(value.newBuildId, buildId);
        } else if (item.id === 'identity.foreign-build') {
          const previous = retrieveAnswerContext(state.catalog, question, buildId);
          value.foreignOriginal = state.catalog.evidence(previous.spans.find(row => row.sourceName === firstSource && row.path === firstTs).id);
          buildId = await index(state, 'foreign-build'); await analyze(state, buildId, 'foreign-build-facts'); request = { buildId };
          const current = retrieveAnswerContext(state.catalog, question, buildId);
          controlled = rehash({ ...current, spans: current.spans.map(row => row.sourceName === firstSource && row.path === firstTs ? inputSpan(value.foreignOriginal) : row) });
        } else if (item.id === 'identity.foreign-source') {
          const current = retrieveAnswerContext(state.catalog, question, buildId);
          const row = state.store.one("SELECT s.id FROM spans s JOIN files f ON f.id=s.fileId WHERE f.buildId=? AND f.path='foreign/same.md' ORDER BY s.startLine LIMIT 1", buildId);
          value.foreignOriginal = state.catalog.evidence(row.id);
          controlled = rehash({ ...current, spans: current.spans.filter(row => row.id !== value.foreignOriginal.id)
            .map(row => row.sourceName === firstSource && row.path === firstTs ? inputSpan(value.foreignOriginal) : row) });
          controlled = rehash({ ...controlled, textBytes: controlled.spans.reduce((sum, row) => sum + Buffer.byteLength(row.text), 0) });
        } else if (item.id === 'support.missing-original') {
          const current = retrieveAnswerContext(state.catalog, question, buildId), target = current.spans.find(row => row.sourceName === firstSource && row.path === firstTs);
          assert(target); value.removed = target;
          const spans = current.spans.filter(row => row.id !== target.id);
          controlled = rehash({ ...current, spans, textBytes: spans.reduce((sum, row) => sum + Buffer.byteLength(row.text), 0) });
        } else if (item.group === 'budget') {
          value.notes = saveBoundaryNotes(state.catalog, buildId);
          value.controlled = controlledPadding(state.catalog, retrieveAnswerContext(state.catalog, question, buildId), item.id.slice(7));
          controlled = value.controlled.context;
        }
        const controller = new AbortController(), options = controlled ? { controlledContext: () => structuredClone(controlled) } : {};
        if (item.id === 'lifecycle.work-zero') options.limits = { work: 0 };
        if (item.id === 'lifecycle.time-zero') options.limits = { wallMs: 0 };
        candidate = new NativeQuestionContext(state.analysis, options);
        let stopPromise;
        const hook = async (info, inject) => {
          if (info.stage !== item.stage || value.reached) return; value.reached = true;
          if (item.group === 'policy') await inject(() => state.catalog.updatePolicy(['boundary-private']));
          else if (item.group === 'revoke') await inject(() => state.catalog.revoke(state.catalog.state().sources.find(row => row.name === hiddenSource).id));
          else if (item.group === 'cancel') controller.abort();
        };
        if (item.id === 'lifecycle.busy' || item.id === 'lifecycle.shutdown') {
          options.checkpoint = async info => {
            if (info.stage !== 'lexical' || value.reached) return; value.reached = true;
            if (item.id === 'lifecycle.busy') {
              const other = new NativeQuestionContext(state.analysis);
              try { await other.prepare(question, request); } catch (error) { value.busyError = errorRecord(error); } finally { await other.stop(); }
              controller.abort();
            } else stopPromise = candidate.stop();
          };
        }
        value.operation = await observed(state, candidate, question, request, { signal: controller.signal, hook });
        if (stopPromise) await stopPromise;
        if (item.id === 'lifecycle.shutdown') try { await candidate.prepare(question, request); } catch (error) { value.afterStopError = errorRecord(error); }
        if (item.id === 'lifecycle.shutdown' || item.id === 'lifecycle.busy') {
          const other = new NativeQuestionContext(state.analysis, { limits: { work: 0 } });
          try { await other.prepare(question, request); } catch (error) { value.released = error.code === 'CAPTURE_WORK_LIMIT'; } finally { await other.stop(); }
        }
        if (item.group === 'witness') {
          const issued = value.operation.result; assert(issued?.compact.item, 'The required issued witness is unavailable.');
          const beforeText = JSON.stringify(issued); await analyze(state, buildId, 'replace-one'); await analyze(state, buildId, 'replace-two');
          value.evicted = !state.analysis.list().some(row => row.id === issued.projection.identity.inventoryId);
          value.witnessBefore = state.counters(); value.legacyBefore = state.legacy();
          value.revalidated = await revalidateWitness(state.catalog, issued);
          value.witnessAfter = state.counters(); value.legacyAfter = state.legacy(); value.contextUnchanged = JSON.stringify(issued) === beforeText;
        }
      } catch (error) { value.setupError = errorRecord(error); }
      finally {
        await candidate?.stop();
        if (prepared) try { value.closed = await closePrepared(prepared); } catch (error) { value.cleanupError = errorRecord(error); errors.push(value.cleanupError); }
      }
      await record(value);
    }
  } finally {
    for (const [variant, prepared] of preparedVariants) if (!prepared.error) try {
      const closed = await closePrepared(prepared); await raw('variant-' + variant + '-closed', closed); cleanup.push({ variant, closed: true });
    } catch (error) { errors.push(errorRecord(error)); cleanup.push({ variant, closed: false }); }
  }
  await raw('matrix-raw', { records, cleanup, errors });
  // All raw observations are durable before any oracle judgments are made.
  const assessment = assessMatrix(ledger, records, oracle); if (errors.length) assessment.pass = false;
  await raw('assessment', assessment); return { assessment, cleanup, errors };
}
