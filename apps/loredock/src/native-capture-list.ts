import type { CatalogStore } from './store.js';
import type { OperationBudget } from './operation-budget.js';
import type { ReceiptDependency } from './native-receipt-types.js';
import { bytes, hash, hex, record, requireReceipt } from './native-receipt-json.js';

export const captureListBytes = 64 * 1024;
export interface CaptureListRequest { pageSize?: 1 | 4; generationId?: string; offset?: number }
export interface CaptureListItem {
  receiptId: string; buildId: string; rootId: string | null; titles: string[];
  originalCount: number; dependencies: ReceiptDependency[]; stale: boolean; currentApplicability: 'not-checked';
}

export function captureListRequest(input: CaptureListRequest) {
  requireReceipt(record(input) && Object.keys(input).every(key => ['pageSize', 'generationId', 'offset'].includes(key)), 'INVALID_CAPTURE_LIST');
  const pageSize = input.pageSize ?? 4, offset = input.offset ?? 0, generationId = input.generationId;
  requireReceipt((pageSize === 1 || pageSize === 4) && (generationId === undefined) === (input.offset === undefined)
    && (generationId === undefined || typeof generationId === 'string' && hex(generationId))
    && typeof offset === 'number' && Number.isSafeInteger(offset) && offset >= 0 && offset < 64 && offset % pageSize === 0, 'INVALID_CAPTURE_LIST');
  return { pageSize, offset, generationId };
}

export function captureListGeneration(catalogId: string, ids: string[],
  project: Pick<ReturnType<CatalogStore['project']>, 'policyVersion' | 'sourceSetVersion' | 'publishedBuildId'>, budget: OperationBudget) {
  const text = JSON.stringify({ catalogId, ids, policyVersion: project.policyVersion,
    sourceSetVersion: project.sourceSetVersion, publishedBuildId: project.publishedBuildId });
  budget.charge('receipt', bytes(text)); return hash(text);
}
