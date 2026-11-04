import { OperationBudget } from './operation-budget.js';
import { decodeProjection, locatorFields } from './native-receipt-projection.js';
import { array, bytes, canonical, gitId, hash, hex, integer, nullable, oneOf, parseJson, receiptContext,
  requireReceipt, same, shape, sortedUnique, string, uuid, NativeReceiptError, type ReceiptLimits } from './native-receipt-json.js';
import type { DecodedNativeReceipt, NativeReceipt, NativeReceiptContent } from './native-receipt-types.js';

export { NativeReceiptError, receiptLimits } from './native-receipt-json.js';
export type { NativeReceipt, NativeReceiptContent, DecodedNativeReceipt, ReceiptOriginal, ReceiptDependency } from './native-receipt-types.js';

const originalShape = shape({ id: uuid, buildId: uuid, sourceId: uuid, ...locatorFields, contentHash: hex, spanHash: hex, blobId: gitId, text: string(64 * 1024) });
const dependencyShape = shape({ sourceId: uuid, name: string(512, 1), revision: nullable(gitId), tree: nullable(gitId),
  status: oneOf('pending', 'ready', 'failed'), omitted: integer() });
const receiptShape = shape({ schemaVersion: oneOf('loredock-code-path-receipt/1'), catalogId: uuid, projectionJson: string(512 * 1024),
  originals: array(originalShape, 30), dependencies: array(dependencyShape, 20), receiptHash: hex });

/** No I/O or authorization. The expected identity comes from the owning catalog. */
export function decodeNativeReceipt(input: Uint8Array, catalogId: string, budget: OperationBudget, reductions?: Partial<ReceiptLimits>): DecodedNativeReceipt {
  const context = receiptContext(budget, reductions), { limits } = context;
  requireReceipt(uuid(catalogId), 'INVALID_CATALOG_ID');
  requireReceipt(input instanceof Uint8Array && input.byteLength <= limits.receiptBytes, 'RECEIPT_BYTES_LIMIT');
  let serialized: string;
  try { serialized = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(input); }
  catch { throw new NativeReceiptError('CORRUPT_RECEIPT'); }
  const parsed = parseJson(serialized, limits.receiptBytes, context);
  requireReceipt(receiptShape(parsed));
  const receipt = parsed as NativeReceipt, { receiptHash, ...content } = receipt;
  requireReceipt(receipt.catalogId === catalogId, 'RECEIPT_CATALOG_MISMATCH');
  requireReceipt(serialized === canonical(receipt, limits.receiptBytes, limits.depth, budget)
    && hash(canonical(content, limits.receiptBytes, limits.depth, budget)) === receiptHash);
  const { value: projection, evidence } = decodeProjection(receipt.projectionJson, context);
  requireReceipt(receipt.dependencies.length <= limits.sources, 'RECEIPT_SOURCE_LIMIT');
  requireReceipt(receipt.originals.length <= limits.spans, 'RECEIPT_SPAN_LIMIT');
  requireReceipt(sortedUnique(receipt.dependencies.map(row => row.sourceId)) && sortedUnique(receipt.originals.map(row => row.id)));
  const dependencies = new Map(receipt.dependencies.map(item => [item.sourceId, item]));
  requireReceipt(same([...dependencies.keys()], projection.coverage.sources.map(item => item.sourceId).sort()));
  for (const item of receipt.dependencies) {
    budget.charge('receipt'); const coverage = projection.coverage.sources.find(row => row.sourceId === item.sourceId)!;
    requireReceipt(coverage.status === item.status && coverage.omittedPaths === item.omitted
      && (item.status !== 'ready' || (item.revision !== null && item.tree !== null)) && (!coverage.treeVerified || item.tree !== null));
  }
  const originals = new Map(receipt.originals.map(item => [item.id, item])), files = new Map<string, { contentHash: string; blobId: string }>();
  requireReceipt(originals.size === evidence.size);
  let textBytes = 0;
  for (const item of receipt.originals) {
    budget.charge('receipt'); const ref = evidence.get(item.id), dep = dependencies.get(item.sourceId);
    requireReceipt(ref && dep && dep.status === 'ready' && item.buildId === projection.identity.buildId
      && item.sourceName === dep.name && item.revision === dep.revision && item.sourceName === ref.sourceName
      && item.path === ref.path && item.revision === ref.revision && item.startLine === ref.startLine && item.endLine === ref.endLine
      && item.startLine <= item.endLine && item.text.split('\n').length === item.endLine - item.startLine + 1 && hash(item.text) === item.spanHash);
    textBytes += bytes(item.text); requireReceipt(textBytes <= limits.textBytes, 'RECEIPT_TEXT_LIMIT'); budget.charge('receipt', bytes(item.text));
    const fileKey = JSON.stringify([item.sourceId, item.path]), prior = files.get(fileKey);
    requireReceipt(!prior || (prior.contentHash === item.contentHash && prior.blobId === item.blobId)); files.set(fileKey, item);
  }
  // Every node/card must be supported by originals from its own source and file,
  // with a continuous range covering the displayed code. Edge support may add
  // other files (for example a contract) and is checked by the projection decoder.
  for (const item of [...projection.graph.nodes, ...projection.roots.items.filter(row => row.status === 'available')]) {
    budget.charge('receipt'); const spans = item.evidenceIds.map(id => originals.get(id)!);
    requireReceipt(spans.every(span => span && span.sourceId === item.sourceId && span.sourceName === item.sourceName
      && span.path === item.path && span.revision === item.revision));
    let covered = item.startLine - 1;
    for (const span of spans.slice().sort((a, b) => a.startLine - b.startLine)) {
      if (span.startLine <= covered + 1) covered = Math.max(covered, span.endLine);
    }
    requireReceipt(covered >= item.endLine);
  }
  for (const edge of projection.graph.edges) if (edge.topicCheck) for (const endpoint of [edge.topicCheck.publisher, edge.topicCheck.subscriber])
    requireReceipt(endpoint.evidenceIds.some(id => originals.get(id)!.text.includes(endpoint.expression)));
  budget.check(); return { receipt, projection, serialized };
}

/** Internal records only. Encode and validate a detached copy under the same budget. */
export function encodeNativeReceipt(content: NativeReceiptContent, catalogId: string, budget: OperationBudget, reductions?: Partial<ReceiptLimits>): DecodedNativeReceipt {
  const { limits } = receiptContext(budget, reductions);
  const encoded = canonical(content, limits.receiptBytes, limits.depth, budget);
  const detached: unknown = JSON.parse(encoded);
  requireReceipt(detached !== null && typeof detached === 'object' && !Array.isArray(detached) && !Object.hasOwn(detached, 'receiptHash'));
  const serialized = canonical({ ...detached, receiptHash: hash(encoded) }, limits.receiptBytes, limits.depth, budget);
  return decodeNativeReceipt(Buffer.from(serialized), catalogId, budget, reductions);
}
