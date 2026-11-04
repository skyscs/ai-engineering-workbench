import { setImmediate as yieldTurn } from 'node:timers/promises';
import type { Catalog } from './catalog.js';
import { OperationBudget } from './operation-budget.js';
import { bytes, receiptContext, requireReceipt, same, type ReceiptLimits } from './native-receipt-json.js';
import type { ReceiptDependency, ReceiptOriginal, ReceiptProjection } from './native-receipt-types.js';

export type CaptureStage = 'start' | 'projection' | 'originals' | 'prepared' | 'handoff';
export interface CaptureOptions {
  limits?: Partial<ReceiptLimits>;
  budget?: Pick<NonNullable<ConstructorParameters<typeof OperationBudget>[0]>, 'limits' | 'observe'>;
  checkpoint?: (info: { stage: CaptureStage; checkpoints: number; work: number }) => unknown | Promise<unknown>;
  insideFence?: () => unknown;
}
const epoch = (catalog: Catalog) => ({ changes: catalog.store.one<{ n: number }>('SELECT total_changes() n')!.n,
  version: catalog.store.one<{ data_version: number }>('PRAGMA data_version')!.data_version,
  policy: catalog.store.project().policyVersion, registry: catalog.store.project().sourceSetVersion });

export class CaptureWork {
  readonly context: ReturnType<typeof receiptContext>;
  private readonly initial: ReturnType<typeof epoch>;
  checkpoints = 0;
  constructor(readonly catalog: Catalog, readonly budget: OperationBudget, private readonly signal: AbortSignal, readonly options: CaptureOptions) {
    this.context = receiptContext(budget, options.limits); this.initial = epoch(catalog); this.check();
  }
  check() {
    requireReceipt(!this.signal.aborted, 'CANCELLED'); this.budget.check();
    requireReceipt(same(epoch(this.catalog), this.initial), 'RECEIPT_FENCED');
  }
  charge(units = 1) { this.budget.charge('receipt', units); this.check(); }
  async step(stage: CaptureStage) {
    this.charge(); await yieldTurn(); this.checkpoints++;
    await this.options.checkpoint?.({ stage, checkpoints: this.checkpoints, work: this.budget.stats().totalWork }); this.check();
  }
  dependencies(buildId: string) {
    this.check(); const build = this.catalog.readBuildHeader(buildId), rows = this.catalog.store.buildSources(buildId);
    requireReceipt(rows.length <= this.context.limits.sources, 'RECEIPT_SOURCE_LIMIT');
    const dependencies: ReceiptDependency[] = rows.map(({ sourceId, name, revision, tree, status, omitted }) => {
      this.charge(); requireReceipt(this.catalog.store.source(sourceId).status === 'active', 'RECEIPT_SCOPE_FENCED');
      return { sourceId, name, revision, tree, status, omitted };
    });
    dependencies.sort((a, b) => a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0); return { build, dependencies };
  }
  authorized(projection: ReceiptProjection, saved: ReceiptDependency[]) {
    const current = this.dependencies(projection.identity.buildId);
    requireReceipt(current.build.policyVersion === projection.identity.policyVersion && current.build.sourceSetVersion === projection.identity.sourceSetVersion
      && same(current.dependencies, saved), 'RECEIPT_SCOPE_FENCED'); return current;
  }
  original(id: string): ReceiptOriginal {
    this.check(); const row = this.catalog.evidence(id); this.charge(bytes(row.text));
    return { id: row.id, buildId: row.buildId, sourceId: row.sourceId, sourceName: row.sourceName, revision: row.revision,
      path: row.path, startLine: row.startLine, endLine: row.endLine, contentHash: row.contentHash, spanHash: row.spanHash, blobId: row.blobId, text: row.text };
  }
  insideFence() {
    const result = this.options.insideFence?.();
    requireReceipt(!(result !== null && (typeof result === 'object' || typeof result === 'function') && 'then' in result && result.then), 'INVALID_RECEIPT_HOOK'); this.check();
  }
  metrics(projectionJson: string, serialized: string, originals: ReceiptOriginal[], dependencies: ReceiptDependency[], publicationLocks: number) {
    return { ...this.budget.stats(), work: this.budget.stats().totalWork, checkpoints: this.checkpoints,
      projectionBytes: bytes(projectionJson), receiptBytes: bytes(serialized), textBytes: originals.reduce((sum, row) => sum + bytes(row.text), 0),
      spans: originals.length, sources: dependencies.length, publicationLocks };
  }
}
