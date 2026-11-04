import { CodePathsV2 } from './code-paths-v2.js';
import { OperationBudget } from './operation-budget.js';
import { CaptureWork } from './native-capture-work.js';
import { bytes, hex, record, requireReceipt, same, uuid, NativeReceiptError } from './native-receipt-json.js';
import { decodeProjection } from './native-receipt-projection.js';
import { encodeNativeReceipt } from './native-receipt.js';
const activeStores = new WeakSet();
function captureRequest(value) {
    requireReceipt(record(value) && Object.keys(value).every(key => ['buildId', 'inventoryId', 'generationId', 'rootId'].includes(key))
        && uuid(value.buildId) && (value.inventoryId === undefined || uuid(value.inventoryId)) && (value.generationId === undefined || hex(value.generationId))
        && (value.rootId === undefined || hex(value.rootId)) && (value.inventoryId === undefined) === (value.generationId === undefined)
        && (value.rootId === undefined || value.generationId !== undefined), 'INVALID_RECEIPT_SELECTION');
    return { ...value };
}
/** Internal authorized operation owner. No HTTP consumer, model or background work. */
export class NativeCaptures {
    analysis;
    options;
    paths;
    ownsPaths;
    stopping = false;
    stopPromise;
    active;
    constructor(analysis, options = {}) {
        this.analysis = analysis;
        this.options = options;
        requireReceipt(options.paths === undefined || options.paths instanceof CodePathsV2, 'INVALID_CAPTURE_PRODUCER');
        requireReceipt((options.checkpoint === undefined || typeof options.checkpoint === 'function')
            && (options.insideFence === undefined || typeof options.insideFence === 'function'), 'INVALID_RECEIPT_HOOK');
        this.ownsPaths = options.paths === undefined;
        this.paths = options.paths ?? new CodePathsV2(analysis);
    }
    async run(prepare, signal, supplied) {
        requireReceipt(!this.stopping, 'SERVICE_STOPPED');
        requireReceipt(signal === undefined || signal instanceof AbortSignal, 'INVALID_CAPTURE_SIGNAL');
        requireReceipt(supplied === undefined || supplied instanceof OperationBudget, 'INVALID_CAPTURE_BUDGET');
        const store = this.analysis.catalog.store;
        requireReceipt(!activeStores.has(store), 'CAPTURE_BUSY');
        const controller = new AbortController(), combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
        const budget = supplied ?? new OperationBudget({ ...this.options.budget, signal: combined });
        budget.check();
        let finish;
        const done = new Promise(resolve => { finish = resolve; });
        this.active = { controller, done };
        activeStores.add(store);
        try {
            const work = new CaptureWork(this.analysis.catalog, budget, combined, this.options);
            const finalize = await prepare(work);
            work.check();
            // No await after this point: source guard, publication/output, budget and
            // operation-owner release finish in one synchronous continuation.
            return finalize();
        }
        finally {
            if (supplied === undefined)
                budget.close();
            this.active = undefined;
            activeStores.delete(store);
            finish();
        }
    }
    capture(input, signal, budget) {
        const request = captureRequest(input);
        return this.run(async (work) => {
            await work.step('start');
            const { dependencies } = work.dependencies(request.buildId);
            const response = await this.paths.read(request, 'paths', signal ? AbortSignal.any([signal, this.active.controller.signal]) : this.active.controller.signal, work.budget);
            requireReceipt(response.status === 'available', 'RECEIPT_UNAVAILABLE');
            await work.step('projection');
            const projectionJson = JSON.stringify(response), { value, evidence } = decodeProjection(projectionJson, work.context);
            work.authorized(value, dependencies);
            const originals = [];
            let textBytes = 0;
            for (const id of [...evidence.keys()].sort()) {
                await work.step('originals');
                const original = work.original(id);
                textBytes += bytes(original.text);
                requireReceipt(textBytes <= work.context.limits.textBytes, 'RECEIPT_TEXT_LIMIT');
                originals.push(original);
            }
            await work.step('prepared');
            const store = work.catalog.store;
            const encoded = encodeNativeReceipt({ schemaVersion: 'loredock-code-path-receipt/1', catalogId: store.receipts.catalogId,
                projectionJson, originals, dependencies }, store.receipts.catalogId, work.budget, work.context.limits);
            await work.step('handoff');
            return () => {
                let locked = false, metrics;
                const release = () => { store.db.exec('ROLLBACK'); locked = false; };
                try {
                    store.db.exec('BEGIN IMMEDIATE');
                    locked = true;
                    work.insideFence();
                    work.authorized(value, dependencies);
                    const snapshot = this.analysis.snapshot(value.identity.inventoryId);
                    work.charge(snapshot.summary.candidates);
                    requireReceipt(snapshot.manifestHash === value.identity.manifestHash && snapshot.summary.fingerprint === value.identity.fingerprint
                        && snapshot.policyVersion === value.identity.policyVersion && snapshot.registryVersion === value.identity.registryVersion
                        && same(snapshot.summary.limits, value.identity.analysisLimits), 'RECEIPT_FENCED');
                    const saved = store.receipts.publish(Buffer.from(encoded.serialized), work.budget, () => work.check(), () => {
                        release();
                        metrics = work.metrics(projectionJson, encoded.serialized, originals, dependencies, 1);
                    });
                    return { status: 'captured', receiptId: saved.receiptHash, created: saved.created, metrics };
                }
                catch (error) {
                    if (locked)
                        try {
                            release();
                        }
                        catch (cleanupError) {
                            this.stopping = true;
                            store.receipts.close();
                            const failure = new NativeReceiptError('CAPTURE_GUARD_RELEASE_FAILED', 'Capture failed and the source guard could not be released. Close and reopen the catalog.');
                            failure.cause = new AggregateError([error, cleanupError]);
                            throw failure;
                        }
                    throw error;
                }
            };
        }, signal, budget);
    }
    history(receiptId, signal, budget) {
        requireReceipt(hex(receiptId), 'INVALID_RECEIPT_ID');
        return this.run(async (work) => {
            await work.step('start');
            const { receipt, projection, serialized } = work.catalog.store.receipts.read(receiptId, work.budget, work.context.limits);
            await work.step('projection');
            work.authorized(projection, receipt.dependencies);
            for (const saved of receipt.originals) {
                await work.step('originals');
                requireReceipt(same(work.original(saved.id), saved));
            }
            await work.step('handoff');
            return () => {
                const store = work.catalog.store;
                work.authorized(projection, receipt.dependencies);
                work.check();
                const project = store.project();
                const result = { status: 'recorded', receiptId, currentApplicability: 'not-checked',
                    stale: projection.identity.buildId !== project.publishedBuildId || projection.identity.registryVersion !== project.sourceSetVersion,
                    projection, originals: receipt.originals, dependencies: receipt.dependencies,
                    metrics: work.metrics(receipt.projectionJson, serialized, receipt.originals, receipt.dependencies, 0) };
                requireReceipt(bytes(JSON.stringify(result)) <= work.context.limits.receiptBytes, 'RECEIPT_BYTES_LIMIT');
                work.check();
                return result;
            };
        }, signal, budget);
    }
    stop() {
        this.stopPromise ??= (async () => {
            this.stopping = true;
            this.active?.controller.abort();
            await this.active?.done;
            if (this.ownsPaths)
                await this.paths.stop();
        })();
        return this.stopPromise;
    }
}
