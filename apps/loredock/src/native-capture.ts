import type { CatalogStore } from './store.js';
import type { CodeAnalysis } from './code-analysis.js';
import { CodePathsV2 } from './code-paths-v2.js';
import type { CodePathRequest } from './code-paths-types.js';
import { OperationBudget } from './operation-budget.js';
import { CaptureWork, type CaptureOptions } from './native-capture-work.js';
import { bytes, hex, record, requireReceipt, same, uuid, NativeReceiptError } from './native-receipt-json.js';
import { decodeProjection } from './native-receipt-projection.js';
import { encodeNativeReceipt } from './native-receipt.js';
import type { ReceiptOriginal } from './native-receipt-types.js';

const activeStores = new WeakSet<CatalogStore>();
interface ServiceOptions extends CaptureOptions { paths?: CodePathsV2 }
function captureRequest(value: CodePathRequest): CodePathRequest {
  requireReceipt(record(value) && Object.keys(value).every(key => ['buildId', 'inventoryId', 'generationId', 'rootId'].includes(key))
    && uuid(value.buildId) && (value.inventoryId === undefined || uuid(value.inventoryId)) && (value.generationId === undefined || hex(value.generationId))
    && (value.rootId === undefined || hex(value.rootId)) && (value.inventoryId === undefined) === (value.generationId === undefined)
    && (value.rootId === undefined || value.generationId !== undefined), 'INVALID_RECEIPT_SELECTION');
  return { ...value };
}

/** Internal authorized operation owner. No HTTP consumer, model or background work. */
export class NativeCaptures {
  private readonly paths: CodePathsV2; private readonly ownsPaths: boolean;
  private stopping = false; private stopPromise: Promise<void> | undefined;
  private active: { controller: AbortController; done: Promise<void> } | undefined;
  constructor(private readonly analysis: CodeAnalysis, private readonly options: ServiceOptions = {}) {
    requireReceipt(options.paths === undefined || options.paths instanceof CodePathsV2, 'INVALID_CAPTURE_PRODUCER');
    requireReceipt((options.checkpoint === undefined || typeof options.checkpoint === 'function')
      && (options.insideFence === undefined || typeof options.insideFence === 'function'), 'INVALID_RECEIPT_HOOK');
    this.ownsPaths = options.paths === undefined; this.paths = options.paths ?? new CodePathsV2(analysis);
  }
  private async run<T>(prepare: (work: CaptureWork) => Promise<() => T>, signal?: AbortSignal, supplied?: OperationBudget): Promise<T> {
    requireReceipt(!this.stopping, 'SERVICE_STOPPED');
    requireReceipt(signal === undefined || signal instanceof AbortSignal, 'INVALID_CAPTURE_SIGNAL');
    requireReceipt(supplied === undefined || supplied instanceof OperationBudget, 'INVALID_CAPTURE_BUDGET');
    const store = this.analysis.catalog.store; requireReceipt(!activeStores.has(store), 'CAPTURE_BUSY');
    const controller = new AbortController(), combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    const budget = supplied ?? new OperationBudget({ ...this.options.budget, signal: combined }); budget.check();
    let finish!: () => void; const done = new Promise<void>(resolve => { finish = resolve; });
    this.active = { controller, done }; activeStores.add(store);
    try {
      const work = new CaptureWork(this.analysis.catalog, budget, combined, this.options);
      const finalize = await prepare(work); work.check();
      // No await after this point: source guard, publication/output, budget and
      // operation-owner release finish in one synchronous continuation.
      return finalize();
    } finally { if (supplied === undefined) budget.close(); this.active = undefined; activeStores.delete(store); finish(); }
  }
  capture(input: CodePathRequest, signal?: AbortSignal, budget?: OperationBudget) {
    const request = captureRequest(input);
    return this.run(async work => {
      await work.step('start'); const { dependencies } = work.dependencies(request.buildId);
      const response = await this.paths.read(request, 'paths', signal ? AbortSignal.any([signal, this.active!.controller.signal]) : this.active!.controller.signal, work.budget);
      requireReceipt(response.status === 'available', 'RECEIPT_UNAVAILABLE'); await work.step('projection');
      const projectionJson = JSON.stringify(response), { value, evidence } = decodeProjection(projectionJson, work.context);
      work.authorized(value, dependencies); const originals: ReceiptOriginal[] = []; let textBytes = 0;
      for (const id of [...evidence.keys()].sort()) {
        await work.step('originals'); const original = work.original(id); textBytes += bytes(original.text);
        requireReceipt(textBytes <= work.context.limits.textBytes, 'RECEIPT_TEXT_LIMIT'); originals.push(original);
      }
      await work.step('prepared'); const store = work.catalog.store;
      const encoded = encodeNativeReceipt({ schemaVersion: 'loredock-code-path-receipt/1', catalogId: store.receipts.catalogId,
        projectionJson, originals, dependencies }, store.receipts.catalogId, work.budget, work.context.limits);
      await work.step('handoff');
      return () => {
        let locked = false, metrics!: ReturnType<CaptureWork['metrics']>;
        const release = () => { store.db.exec('ROLLBACK'); locked = false; };
        try {
          store.db.exec('BEGIN IMMEDIATE'); locked = true; work.insideFence(); work.authorized(value, dependencies);
          const snapshot = this.analysis.snapshot(value.identity.inventoryId); work.charge(snapshot.summary.candidates);
          requireReceipt(snapshot.manifestHash === value.identity.manifestHash && snapshot.summary.fingerprint === value.identity.fingerprint
            && snapshot.policyVersion === value.identity.policyVersion && snapshot.registryVersion === value.identity.registryVersion
            && same(snapshot.summary.limits, value.identity.analysisLimits), 'RECEIPT_FENCED');
          const saved = store.receipts.publish(Buffer.from(encoded.serialized), work.budget, () => work.check(), () => {
            release(); metrics = work.metrics(projectionJson, encoded.serialized, originals, dependencies, 1);
          });
          return { status: 'captured' as const, receiptId: saved.receiptHash, created: saved.created, metrics };
        } catch (error) {
          if (locked) try { release(); } catch (cleanupError) {
            const failure = new NativeReceiptError('CAPTURE_GUARD_RELEASE_FAILED', 'Capture failed and the source guard could not be released.');
            failure.cause = new AggregateError([error, cleanupError]); throw failure;
          }
          throw error;
        }
      };
    }, signal, budget);
  }
  history(receiptId: string, signal?: AbortSignal, budget?: OperationBudget) {
    requireReceipt(hex(receiptId), 'INVALID_RECEIPT_ID');
    return this.run(async work => {
      await work.step('start'); const { receipt, projection, serialized } = work.catalog.store.receipts.read(receiptId, work.budget, work.context.limits);
      await work.step('projection'); work.authorized(projection, receipt.dependencies);
      for (const saved of receipt.originals) { await work.step('originals'); requireReceipt(same(work.original(saved.id), saved)); }
      await work.step('handoff');
      return () => {
        const store = work.catalog.store; work.authorized(projection, receipt.dependencies);
        work.check(); const project = store.project();
        const result = { status: 'recorded' as const, receiptId, currentApplicability: 'not-checked' as const,
          stale: projection.identity.buildId !== project.publishedBuildId || projection.identity.registryVersion !== project.sourceSetVersion,
          projection, originals: receipt.originals, dependencies: receipt.dependencies,
          metrics: work.metrics(receipt.projectionJson, serialized, receipt.originals, receipt.dependencies, 0) };
        requireReceipt(bytes(JSON.stringify(result)) <= work.context.limits.receiptBytes, 'RECEIPT_BYTES_LIMIT'); work.check(); return result;
      };
    }, signal, budget);
  }
  stop() {
    this.stopPromise ??= (async () => { this.stopping = true; this.active?.controller.abort(); await this.active?.done;
      if (this.ownsPaths) await this.paths.stop(); })(); return this.stopPromise;
  }
}
