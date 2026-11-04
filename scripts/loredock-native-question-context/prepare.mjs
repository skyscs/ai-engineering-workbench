import { setImmediate as yieldTurn } from 'node:timers/promises';
import { OperationBudget } from '../../apps/loredock/dist/operation-budget.js';
import { CaptureWork } from '../../apps/loredock/dist/native-capture-work.js';
import { retrieveAnswerContext } from '../../apps/loredock/dist/answer-context.js';
import { assertAnswerReviewCurrent } from '../../apps/loredock/dist/answer-review.js';
import { decodeProjection } from '../../apps/loredock/dist/native-receipt-projection.js';
import { encodeNativeReceipt } from '../../apps/loredock/dist/native-receipt.js';
import { bytes, hash, same, requireReceipt } from '../../apps/loredock/dist/native-receipt-json.js';
import { CodePathsV2 } from './candidate-paths.mjs';
import { chooseQuestionRoot, SelectionUnavailable } from './selection.mjs';
import { compactPath, inputSpan, experimentalPrompt, promptVersion } from './compact.mjs';

const owners = new WeakSet();
export class NativeQuestionContext {
  constructor(analysis, options = {}) { this.analysis = analysis; this.options = options; this.stopping = false; }
  async prepare(question, request, signal) {
    requireReceipt(!this.stopping, 'SERVICE_STOPPED');
    const catalog = this.analysis.catalog, store = catalog.store;
    requireReceipt(!owners.has(store), 'QUESTION_BUSY');
    const controller = new AbortController(), combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    let finish, paths, budget; const done = new Promise(resolve => { finish = resolve; });
    owners.add(store); this.active = { controller, done };
    const began = performance.now(), samples = [], phases = {}, lexical = { sqlRows: 0, originalBytes: 0, originalReads: 0 };
    let phase = 'start', last = began, maxIntervalMs = 0, selection = null;
    const sample = () => { const now = performance.now(); maxIntervalMs = Math.max(maxIntervalMs, now - last); last = now;
      const { rss, heapUsed } = process.memoryUsage(); samples.push({ elapsedMs: now - began, rss, heapUsed }); };
    const timer = setInterval(sample, 5); sample();
    try {
      budget = new OperationBudget({ signal: combined, limits: this.options.limits, observe: ({ units }) => { phases[phase] = (phases[phase] ?? 0) + units; } });
      const checkpoint = async info => { phase = info.stage; await this.options.checkpoint?.(info); };
      const work = new CaptureWork(catalog, budget, combined, { checkpoint });
      const current = context => {
        work.check(); const project = store.project(), build = catalog.readBuildHeader(request.buildId);
        requireReceipt(project.publishedBuildId === request.buildId && build.sourceSetVersion === project.sourceSetVersion, 'QUESTION_STALE');
        if (context) { requireReceipt(context.buildId === request.buildId && context.policyVersion === project.policyVersion
          && context.registryVersion === project.sourceSetVersion && !context.stale, 'QUESTION_STALE'); assertAnswerReviewCurrent(catalog, context.review); }
      };
      current(); phase = 'lexical'; await yieldTurn(); await checkpoint({ stage: 'lexical' }); work.check();
      // Synchronous, exception-safe instrumentation of the actual retrieval phase only.
      // The row charge runs after each completed SQL call; nested original reads count too.
      const methods = { all: store.all, one: store.one, evidence: catalog.evidence };
      let baseline;
      try {
        for (const method of ['all', 'one']) store[method] = function (...args) {
          const result = methods[method].apply(this, args), rows = method === 'all' ? result.length : result ? 1 : 0;
          lexical.sqlRows += rows; budget.charge('receipt', rows); return result;
        };
        catalog.evidence = function (...args) { const row = methods.evidence.apply(this, args), count = bytes(row.text);
          lexical.originalReads++; lexical.originalBytes += count; budget.charge('receipt', count); return row; };
        baseline = retrieveAnswerContext(catalog, question, request.buildId);
      } finally { store.all = methods.all; store.one = methods.one; catalog.evidence = methods.evidence; }
      work.check(); current(baseline);
      // Trusted boundary harness only. It is not a retrieval extension or client input.
      const context = this.options.controlledContext ? this.options.controlledContext(structuredClone(baseline)) : baseline;
      const { inputHash, ...content } = context;
      requireReceipt(hash(JSON.stringify(content)) === inputHash, 'QUESTION_CONTEXT_HASH'); current(context);
      const { dependencies } = work.dependencies(request.buildId);
      paths = new CodePathsV2(this.analysis, { checkpoint, selectQuestionRoot: async (resolution, pathWork) => {
        const chosen = await chooseQuestionRoot(resolution, context, pathWork); selection = chosen.observation; return chosen.rootId;
      } });
      let projection = null, encoded = null, compact = { item: null, reason: null };
      try {
        projection = await paths.read(request, 'paths', combined, budget);
        if (projection.status !== 'available') compact = { item: null, reason: projection.reason.code };
        else {
          await work.step('projection'); const projectionJson = JSON.stringify(projection);
          const decoded = decodeProjection(projectionJson, work.context); work.authorized(decoded.value, dependencies);
          const originals = [];
          for (const id of [...decoded.evidence.keys()].sort()) { await work.step('originals'); originals.push(work.original(id)); }
          encoded = encodeNativeReceipt({ schemaVersion: 'loredock-code-path-receipt/1', catalogId: store.receipts.catalogId,
            projectionJson, originals, dependencies }, store.receipts.catalogId, budget);
          phase = 'compact'; compact = compactPath(context, encoded, budget);
        }
      } catch (error) {
        if (!(error instanceof SelectionUnavailable)) throw error;
        selection = error.observation; compact = { item: null, reason: error.code };
      }
      // Reopen every original, including README and engineer-note support outside the path.
      for (const span of context.spans) { await work.step('originals'); const original = work.original(span.id);
        requireReceipt(original.buildId === context.buildId && same(inputSpan(original), span), 'QUESTION_ORIGINAL_MISMATCH'); }
      const serializedContext = JSON.stringify(context), prompt = experimentalPrompt(context, compact.item);
      budget.charge('receipt', bytes(serializedContext));
      await work.step('handoff');
      // No await after the last hook: all identity checks and handoff share this continuation.
      current(context); work.authorized({ identity: { buildId: context.buildId, policyVersion: context.policyVersion, sourceSetVersion: context.sourceSetVersion } }, dependencies);
      if (encoded) {
        const identity = encoded.projection.identity, snapshot = this.analysis.snapshot(identity.inventoryId); work.charge(snapshot.summary.candidates);
        requireReceipt(snapshot.manifestHash === identity.manifestHash && snapshot.summary.fingerprint === identity.fingerprint
          && snapshot.policyVersion === identity.policyVersion && snapshot.registryVersion === identity.registryVersion
          && same(snapshot.summary.limits, identity.analysisLimits), 'QUESTION_INVENTORY_FENCED');
      }
      work.check();
      return { schemaVersion: 'offline-native-question-context/1', promptVersion, catalogId: store.receipts.catalogId,
        baseline, context, controlled: Boolean(this.options.controlledContext), selection, projection,
        receipt: encoded?.serialized ?? null, compact, prompt, dependencies,
        witnessHash: hash(JSON.stringify({ catalogId: store.receipts.catalogId, lexicalInputHash: context.inputHash,
          receiptHash: encoded?.receipt.receiptHash ?? null, itemHash: compact.itemHash ?? null, question: context.question, dependencies })) };
    } finally {
      clearInterval(timer); sample(); budget?.close();
      this.observation = { outerWallMs: performance.now() - began, maxIntervalMs, samples, lexical, phases, budget: budget?.stats() ?? null,
        maxRss: Math.max(...samples.map(row => row.rss)), maxHeapUsed: Math.max(...samples.map(row => row.heapUsed)) };
      // read() has already released the actual path owner, including on exceptional exits.
      // stop() is synchronous up to that completed owner's wait; no caller can reuse this instance early.
      if (paths) void paths.stop();
      owners.delete(store); this.active = undefined; finish();
    }
  }
  stop() { this.stopping = true; this.active?.controller.abort(); return this.active?.done ?? Promise.resolve(); }
}
