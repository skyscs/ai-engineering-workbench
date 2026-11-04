import { createHash } from 'node:crypto';
import type { NativeReceiptContent } from '../../src/native-receipt-types.js';
import type { ReceiptProjection } from '../../src/native-receipt-types.js';

// Independently authored transport fixture; no production encoder or producer.
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const catalogId = '11111111-1111-4111-8111-111111111111';
export const sourceId = '22222222-2222-4222-8222-222222222222';
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => JSON.stringify(key) + ':' + canonicalJson(item)).join(',') + '}';
  return JSON.stringify(value);
}
export function sealProjection(value: ReceiptProjection) {
  value.generationId = digest(JSON.stringify(value.identity));
  const changed = new Map<string, string>();
  for (const edge of value.graph.edges) {
    const next = digest(JSON.stringify([value.generationId, 'connected-paths-v2', 'edge', edge.kind, edge.from, edge.to, edge.environment]));
    changed.set(edge.id, next); edge.id = next;
  }
  for (const flow of value.graph.flows) {
    flow.edgeIds = flow.edgeIds.map(id => changed.get(id) ?? id);
    flow.id = digest(JSON.stringify([value.identity.buildId, 'connected-paths-v2', flow.nodeIds[0], flow.edgeIds]));
  }
  const { inputHash: _graph, ...g } = value.graph; value.graph.inputHash = digest(JSON.stringify(g));
  const { projectionId: _projection, ...p } = value; value.projectionId = digest(JSON.stringify(p)); return value;
}
export function serialized(content: NativeReceiptContent) {
  return Buffer.from(canonicalJson({ ...content, receiptHash: digest(canonicalJson(content)) }));
}
export function recordFixture(): NativeReceiptContent {
  const buildId = '33333333-3333-4333-8333-333333333333', id = '44444444-4444-4444-8444-444444444444';
  const revision = 'a'.repeat(40), text = 'export function inspect() { return "雪"; }\n';
  const nodeId = 'b'.repeat(64), ref = { id, sourceName: 'client', path: 'inspect.ts', revision, startLine: 1, endLine: 2 };
  const limits = { files: 10000, facts: 10000, wallMs: 5000, work: 1000000, metadataEntries: 10000, metadataBytes: 8388608,
    resolutionNodes: 12000, resolutionEdges: 12000, bindingRecords: 12000, alternativeReferences: 12000,
    nodes: 160, edges: 240, flows: 2, steps: 20, traversals: 1000, pendingPaths: 1000, comparisons: 2000, outputBytes: 524288 };
  const versions = { buildId, policyVersion: 1, sourceSetVersion: 1, registryVersion: 1 };
  const resolution = { candidateDocuments: 1, examinedDocuments: 1, parsedBytes: Buffer.byteLength(text), comparisons: 0, alternativeReferences: 0 };
  const node = { id: nodeId, kind: 'symbol' as const, label: 'inspect', sourceId, sourceName: 'client', path: 'inspect.ts', revision,
    startLine: 1, endLine: 1, properties: { role: 'exported-function' }, evidenceIds: [id] };
  const projection: ReceiptProjection = { schemaVersion: 'loredock-code-paths/2', status: 'available', kind: 'paths', generationId: '', projectionId: '',
    identity: { ...versions, inventoryId: '55555555-5555-4555-8555-555555555555', fingerprint: 'c'.repeat(64),
      analysisLimits: { documents: 10000, fileBytes: 32768, fileSpans: 8, textBytes: 52428800, filePayloadBytes: 131072, payloadBytes: 16777216, wallMs: 300000 },
      manifestHash: 'd'.repeat(64), metadataDigest: 'e'.repeat(64), declarationAdapter: 'json-declarations-v2', declarationInputHash: 'f'.repeat(64),
      adapter: 'connected-paths-v2', topicRule: { version: 'direct-java-topic-literal/1', maxUtf8Bytes: 256 },
      accounting: { version: 'shared-capture-work/1', work: 1000000, wallMs: 5000 }, limits },
    coverage: { scannedFiles: 1, retainedFiles: 1, scanComplete: true, factEntries: 1, consumedHash: '0'.repeat(64), inventoryCounts: { parsed: 1 },
      metadataEntries: 1, metadataBytes: 100, sources: [{ sourceId, knownPaths: 1, status: 'ready', omittedPaths: 0, treeVerified: true,
        opaquePaths: 0, unsafePaths: false, filesWithGaps: 0, javaFiles: 0, javaComplete: true }], incompleteBindings: 0, bindingReasons: {},
      resolution: { ...resolution, nodes: 1, edges: 0, roots: 1 }, omissions: {}, declarationOmissions: {} },
    graph: { schemaVersion: 'loredock-connected-display/2', adapterVersion: 'connected-paths-v2', ...versions, stale: false, partial: true,
      deploymentCoherence: 'unknown', nodes: [node], edges: [], flows: [{ id: '', title: 'HTTP client · inspect.ts', status: 'partial', environment: null,
        nodeIds: [nodeId], edgeIds: [], evidenceIds: [id], gaps: ['The path has no evidenced document write.'] }], evidence: { [id]: ref },
      gaps: ['Static syntax only.'], omissions: {}, declarationOmissions: {}, limits,
      coverage: { ...resolution, resolutionNodes: 1, resolutionEdges: 0, candidateRoots: 1, selectedRoots: [nodeId], traversals: 1, unselectedNodes: 0, unselectedEdges: 0 }, inputHash: '' },
    selection: { rootId: null, offset: 0 }, partial: true, deploymentCoherence: 'unknown',
    roots: { offset: 0, limit: 4, total: 1, previous: null, next: null, outsidePage: 0, unavailableEntries: 0,
      items: [{ status: 'available', id: nodeId, role: 'exported-function', sourceId, sourceName: 'client', path: 'inspect.ts', revision,
        label: 'inspect', startLine: 1, endLine: 1, evidenceIds: [id] }], evidence: { [id]: ref } } };
  return { schemaVersion: 'loredock-code-path-receipt/1', catalogId, projectionJson: JSON.stringify(sealProjection(projection)),
    originals: [{ ...ref, sourceId, buildId, contentHash: digest(text), spanHash: digest(text), blobId: '1'.repeat(40), text }],
    dependencies: [{ sourceId, name: 'client', revision, tree: '2'.repeat(40), status: 'ready', omitted: 0 }] };
}
