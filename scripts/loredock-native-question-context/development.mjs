import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { receiptFixture } from '../loredock-receipt-fixture.mjs';
import { services } from '../loredock-native-qualification/services.mjs';
import { retrieveAnswerContext } from '../../apps/loredock/dist/answer-context.js';
import { decodeNativeReceipt } from '../../apps/loredock/dist/native-receipt.js';
import { hash } from '../../apps/loredock/dist/native-receipt-json.js';
import { CodePathsV2 } from './candidate-paths.mjs';
import { NativeQuestionContext } from './prepare.mjs';
import { pathSupport } from './compact.mjs';

// Reusable ordinary development inputs, deliberately unrelated to the reserved library.
export function developmentCorpus() {
  const corpus = corpusFactory();
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  return corpus;
}
export const developmentQuestion = 'How does apply call requestPermit and reach PermitWriter.onMessage through permit.granted.v3?';
export const rehash = context => { const { inputHash: _, ...value } = context; return { ...value, inputHash: hash(JSON.stringify(value)) }; };

export async function runDevelopment(directory) {
  assert(path.isAbsolute(directory)); await mkdir(directory);
  const checks = [], owners = [];
  const raw = (name, value) => writeFile(path.join(directory, name + '.json'), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  await raw('start', { corpus: 'ordinary permit development only', reservedCorpusImported: false, date: new Date().toISOString() });
  const fixture = await receiptFixture(directory, developmentCorpus(), services);
  const owner = options => { const candidate = new NativeQuestionContext(fixture.analysis, options); owners.push(candidate); return candidate; };
  let failure;
  try {
    const inventoryId = await fixture.analyze(), request = { buildId: fixture.buildId };
    const baseline = retrieveAnswerContext(fixture.catalog, developmentQuestion, fixture.buildId);
    const control = await fixture.paths.read(request), copied = new CodePathsV2(fixture.analysis);
    try { assert.deepEqual(await copied.read(request), control); checks.push('Unselected candidate is exactly equal to the public control.'); } finally { await copied.stop(); }
    await raw('baseline', baseline); await raw('default', control);
    const candidate = owner(), before = fixture.counters(), legacy = fixture.legacyRows();
    const result = await candidate.prepare(developmentQuestion, request);
    await raw('positive', result); await raw('positive-metrics', candidate.observation);
    assert.deepEqual(result.baseline, baseline); assert.deepEqual(result.context, baseline);
    assert.equal(result.compact.reason, null); assert(result.compact.item); assert.equal(result.projection.graph.flows.length, 1);
    const budget = new services.OperationBudget();
    try { assert.equal(decodeNativeReceipt(Buffer.from(result.receipt), fixture.store.receipts.catalogId, budget).receipt.receiptHash, result.compact.item.receiptHash); } finally { budget.close(); }
    const after = fixture.counters(); for (const key of ['gitCalls', 'writeCalls', 'changedRows']) assert.equal(after[key], before[key]);
    assert.equal(fixture.legacyRows(), legacy); assert.equal(candidate.observation.lexical.sqlRows + candidate.observation.lexical.originalBytes, candidate.observation.phases.lexical);
    assert(candidate.observation.budget.pathWork > 0); assert(candidate.observation.lexical.originalReads > 0);
    checks.push('Actual retrieval, one native path, strict codec, complete originals and no writes.');
    const root = result.projection.graph.nodes.find(row => row.id === result.projection.selection.rootId);
    const missing = pathSupport(result.projection).find(id => !root.evidenceIds.includes(id)); assert(missing);
    const unsupported = owner({ controlledContext: context => rehash({ ...context, spans: context.spans.filter(row => row.id !== missing),
      textBytes: context.spans.filter(row => row.id !== missing).reduce((sum, row) => sum + Buffer.byteLength(row.text), 0) }) });
    const omitted = await unsupported.prepare(developmentQuestion, request); await raw('missing-original', omitted);
    assert.equal(omitted.compact.reason, 'incomplete-original-support'); assert.equal(omitted.compact.item, null);
    checks.push('A missing issued original omits the whole path.');
    const unrelated = await owner().prepare('What is the production broker retention?', request); await raw('unrelated', unrelated);
    assert.equal(unrelated.compact.reason, 'QUESTION_INSUFFICIENT_CONTEXT');
    checks.push('No exact supported question anchor means no selected path.');
    for (const stage of ['lexical', 'metadata', 'read', 'resolve', 'admit', 'originals', 'handoff']) {
      const controller = new AbortController(); let reached = false;
      const cancelled = owner({ checkpoint: info => { if (info.stage === stage && !reached) { reached = true; controller.abort(); } } });
      await assert.rejects(cancelled.prepare(developmentQuestion, request, controller.signal), error => error.code === 'CANCELLED'); assert(reached);
      await raw('cancel-' + stage, cancelled.observation);
    }
    checks.push('Cancellation at all seven real preparation stages refuses output.');
    for (const [key, code] of [['work', 'CAPTURE_WORK_LIMIT'], ['wallMs', 'CAPTURE_TIME_LIMIT']]) {
      const reduced = owner({ limits: { [key]: 0 } }); await assert.rejects(reduced.prepare(developmentQuestion, request), error => error.code === code);
    }
    checks.push('Zero internal work/time budgets release ownership.');
    let release, entered; const gate = new Promise(resolve => { release = resolve; }), ready = new Promise(resolve => { entered = resolve; });
    const occupied = owner({ checkpoint: async info => { if (info.stage === 'lexical') { entered(); await gate; } } });
    const active = occupied.prepare(developmentQuestion, request), outcome = active.then(value => ({ value }), error => ({ code: error.code })); await ready;
    await assert.rejects(owner().prepare(developmentQuestion, request), error => error.code === 'QUESTION_BUSY');
    const stopped = occupied.stop(); release(); assert.equal((await outcome).code, 'CANCELLED'); await stopped;
    await assert.rejects(occupied.prepare(developmentQuestion, request), error => error.code === 'SERVICE_STOPPED');
    checks.push('A separate instance cannot bypass ownership; shutdown cancels and releases.');
    await raw('inventory', { inventoryId });
  } catch (error) { failure = error; await raw('failure', { name: error.name, message: error.message, code: error.code ?? null, stack: error.stack }); }
  finally {
    for (const candidate of owners) await candidate.stop();
    await fixture.close(); await raw('result', { checks, pass: !failure, cleanup: 'All owners stopped; disposable fixture source/catalog removed by receiptFixture.close(). Raw evidence remains.' });
  }
  if (failure) throw failure;
  return checks;
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const checks = await runDevelopment(process.env.LOREDOCK_QUESTION_DEVELOPMENT_OUTPUT);
  console.log(JSON.stringify({ pass: true, checks: checks.length }));
}
