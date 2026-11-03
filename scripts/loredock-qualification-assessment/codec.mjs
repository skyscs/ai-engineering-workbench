import { createHash } from 'node:crypto';
import { captureAccounting } from '../loredock-capture-scale/budget.mjs';
import { topicRule, literalTopic } from '../loredock-literal-topics/topic.mjs';

// Pure extraction of the frozen receipt codec. No catalog, service, file or source execution.
// Projection page support is explicit; receipt selection remains offset zero.
export const receiptLimits = Object.freeze({ projectionBytes: 512 * 1024, spans: 30, textBytes: 64 * 1024,
  receiptBytes: 640 * 1024, wallMs: 5000, work: 1000000, sources: 20 });
export const hash = value => createHash('sha256').update(value).digest('hex');
const bytes = value => Buffer.byteLength(value, 'utf8');
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export class ReceiptError extends Error { constructor(code, message) { super(message); this.code = code; } }
function requireValue(ok, code = 'CORRUPT_RECEIPT', message = 'The recorded receipt failed validation.') { if (!ok) throw new ReceiptError(code, message); }
function keys(value, required, optional = []) {
  requireValue(object(value) && required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key)));
}
export function canonical(value, depth = 0) {
  requireValue(depth <= 40);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { requireValue(Number.isFinite(value)); return JSON.stringify(value); }
  if (Array.isArray(value)) return '[' + value.map(item => canonical(item, depth + 1)).join(',') + ']';
  requireValue(object(value));
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key], depth + 1)).join(',') + '}';
}
const same = (a, b) => canonical(a) === canonical(b);
export function decodeProjection(serialized, kind = 'paths') {
  const limits = receiptLimits;
  requireValue(['paths', 'roots'].includes(kind));
  requireValue(typeof serialized === 'string');
  requireValue(bytes(serialized) <= limits.projectionBytes, 'RECEIPT_PROJECTION_LIMIT', 'Projection bytes exceed the receipt bound.');
  let value; try { value = JSON.parse(serialized); } catch { throw new ReceiptError('CORRUPT_RECEIPT', 'Invalid recorded projection JSON.'); }
  canonical(value); // Bound nesting before recursive comparisons.
  requireValue(serialized === JSON.stringify(value));
  keys(value, ['schemaVersion', 'status', 'kind', 'generationId', 'projectionId', 'identity', 'coverage', 'graph', 'selection', 'partial', 'deploymentCoherence', 'roots']);
  requireValue(value.schemaVersion === 'loredock-shared-capture-paths/1' && value.status === 'available' && value.kind === kind
    && value.partial === true && value.deploymentCoherence === 'unknown' && hex(value.generationId) && hex(value.projectionId));
  const { projectionId, ...content } = value;
  requireValue(hash(JSON.stringify(content)) === projectionId && hash(JSON.stringify(value.identity)) === value.generationId);
  keys(value.identity, ['buildId', 'sourceSetVersion', 'inventoryId', 'fingerprint', 'analysisLimits', 'manifestHash', 'metadataDigest',
    'declarationAdapter', 'declarationInputHash', 'policyVersion', 'registryVersion', 'adapter', 'topicRule', 'accounting', 'limits']);
  requireValue(value.identity.adapter === 'connected-capture-budget-experiment-v1' && same(value.identity.topicRule, topicRule) && same(value.identity.accounting, captureAccounting));
  const graph = value.graph;
  if (kind === 'paths') {
    keys(graph, ['schemaVersion', 'adapterVersion', 'buildId', 'policyVersion', 'sourceSetVersion', 'registryVersion', 'stale', 'partial',
      'deploymentCoherence', 'nodes', 'edges', 'flows', 'evidence', 'gaps', 'omissions', 'declarationOmissions', 'limits', 'coverage', 'inputHash']);
    requireValue(graph.schemaVersion === 'loredock-shared-capture-display/1' && graph.adapterVersion === 'connected-capture-budget-experiment-v1'
      && graph.partial === true && graph.deploymentCoherence === 'unknown' && graph.buildId === value.identity.buildId
      && graph.policyVersion === value.identity.policyVersion && graph.registryVersion === value.identity.registryVersion
      && graph.sourceSetVersion === value.identity.sourceSetVersion && Array.isArray(graph.nodes) && graph.nodes.length <= 160
      && Array.isArray(graph.edges) && graph.edges.length <= 240 && Array.isArray(graph.flows) && graph.flows.length <= 2);
  } else requireValue(graph === null);
  keys(value.roots, ['offset', 'limit', 'total', 'previous', 'next', 'outsidePage', 'unavailableEntries', 'items', 'evidence']);
  keys(value.selection, ['rootId', 'offset']);
  requireValue(value.roots.limit === 4 && Array.isArray(value.roots.items) && value.roots.items.length <= 4
    && value.selection.offset === value.roots.offset && value.roots.offset === (kind === 'paths' ? 0 : 4));
  const evidence = new Map(), used = new Set(), nodeIds = new Set(), edgeIds = new Set();
  for (const dictionary of [graph?.evidence ?? {}, value.roots.evidence]) {
    requireValue(object(dictionary));
    for (const [id, ref] of Object.entries(dictionary)) {
      keys(ref, ['id', 'sourceName', 'path', 'revision', 'startLine', 'endLine']);
      requireValue(ref.id === id && (!evidence.has(id) || same(evidence.get(id), ref)));
      requireValue(typeof id === 'string' && typeof ref.sourceName === 'string' && typeof ref.path === 'string'
        && typeof ref.revision === 'string' && Number.isSafeInteger(ref.startLine) && ref.startLine > 0
        && Number.isSafeInteger(ref.endLine) && ref.endLine >= ref.startLine);
      evidence.set(id, ref);
    }
  }
  requireValue(evidence.size <= limits.spans, 'RECEIPT_SPAN_LIMIT', 'Complete original support exceeds the receipt span bound.');
  const support = ids => { requireValue(Array.isArray(ids) && ids.length > 0); for (const id of ids) { requireValue(evidence.has(id)); used.add(id); } };
  for (const node of graph?.nodes ?? []) {
    keys(node, ['id', 'kind', 'label', 'sourceId', 'sourceName', 'path', 'revision', 'startLine', 'endLine', 'properties', 'evidenceIds']);
    requireValue(typeof node.id === 'string' && !nodeIds.has(node.id)); nodeIds.add(node.id); support(node.evidenceIds);
  }
  for (const edge of graph?.edges ?? []) {
    keys(edge, ['id', 'kind', 'from', 'to', 'status', 'reason', 'environment', 'gaps', 'evidenceIds'], ['headerCheck', 'topicCheck']);
    requireValue(typeof edge.id === 'string' && !edgeIds.has(edge.id) && nodeIds.has(edge.from) && nodeIds.has(edge.to)
      && ['static', 'candidate'].includes(edge.status)); edgeIds.add(edge.id); support(edge.evidenceIds);
    if (edge.kind === 'event-delivery') {
      const witness = edge.topicCheck; keys(witness, ['rule', 'value', 'publisher', 'subscriber']);
      requireValue(edge.status === 'candidate' && witness.rule === topicRule.version && typeof witness.value === 'string');
      for (const [key, endpoint, kind] of [['publisher', edge.from, 'event-publish'], ['subscriber', edge.to, 'event-subscribe']]) {
        const item = witness[key], node = graph.nodes.find(row => row.id === endpoint);
        keys(item, ['expression', 'evidenceIds']);
        requireValue(node.kind === kind && literalTopic(item.expression) !== null && literalTopic(item.expression) === witness.value
          && item.expression === node.properties.topicExpression && same(item.evidenceIds, [...new Set(node.evidenceIds)].sort())
          && item.evidenceIds.every(id => edge.evidenceIds.includes(id)));
        support(item.evidenceIds);
      }
    } else requireValue(!Object.hasOwn(edge, 'topicCheck'));
  }
  for (const flow of graph?.flows ?? []) {
    keys(flow, ['id', 'title', 'status', 'environment', 'nodeIds', 'edgeIds', 'evidenceIds', 'gaps']);
    requireValue(flow.status === 'partial' && flow.environment === null && Array.isArray(flow.nodeIds) && flow.nodeIds.length > 0
      && flow.nodeIds.length <= 20 && flow.nodeIds.every(id => nodeIds.has(id)) && Array.isArray(flow.edgeIds)
      && flow.edgeIds.length === flow.nodeIds.length - 1 && flow.edgeIds.every(id => edgeIds.has(id)));
    for (let i = 0; i < flow.edgeIds.length; i++) { const edge = graph.edges.find(item => item.id === flow.edgeIds[i]);
      requireValue(edge.from === flow.nodeIds[i] && edge.to === flow.nodeIds[i + 1]); }
    support(flow.evidenceIds);
  }
  for (const root of value.roots.items) {
    if (root.status === 'unavailable') keys(root, ['status', 'id', 'reason']);
    else { keys(root, ['status', 'id', 'role', 'sourceId', 'sourceName', 'path', 'revision', 'label', 'startLine', 'endLine', 'evidenceIds']);
      requireValue(root.status === 'available'); support(root.evidenceIds); }
  }
  requireValue(used.size === evidence.size);
  return { value, evidence };
}
const originalKeys = ['id', 'buildId', 'sourceId', 'sourceName', 'revision', 'path', 'startLine', 'endLine', 'contentHash', 'spanHash', 'blobId', 'text'];
function checkOriginal(ref, item, value, deps) {
  keys(item, originalKeys);
  requireValue(item.buildId === value.identity.buildId && item.id === ref.id && item.sourceName === ref.sourceName
    && item.path === ref.path && item.revision === ref.revision && item.startLine === ref.startLine && item.endLine === ref.endLine
    && deps.some(dep => dep.sourceId === item.sourceId && dep.name === item.sourceName && dep.revision === item.revision)
    && hex(item.contentHash) && hex(item.spanHash) && hash(item.text) === item.spanHash);
}

function records(projection, originals, dependencies) {
  const { value, evidence } = projection;
  requireValue(Array.isArray(dependencies) && dependencies.length <= receiptLimits.sources
    && Array.isArray(originals) && originals.length === evidence.size);
  const names = new Set(), sources = new Set();
  for (const dep of dependencies) {
    keys(dep, ['sourceId', 'name', 'revision', 'tree', 'status', 'omitted']);
    requireValue(['sourceId', 'name', 'revision', 'tree'].every(key => typeof dep[key] === 'string' && dep[key].length > 0)
      && dep.status === 'ready' && dep.omitted === 0 && !names.has(dep.name) && !sources.has(dep.sourceId));
    names.add(dep.name); sources.add(dep.sourceId);
  }
  requireValue(Array.isArray(value.coverage.sources)
    && same(value.coverage.sources.map(row => row.sourceId).sort(), [...sources].sort()));
  const seen = new Set(); let textBytes = 0;
  for (const item of originals) {
    requireValue(object(item) && !seen.has(item.id) && evidence.has(item.id)
      && typeof item.text === 'string' && typeof item.blobId === 'string' && /^[a-f0-9]{40}$/.test(item.blobId));
    checkOriginal(evidence.get(item.id), item, value, dependencies);
    seen.add(item.id); textBytes += bytes(item.text);
    requireValue(textBytes <= receiptLimits.textBytes, 'RECEIPT_TEXT_LIMIT');
  }
}
export function decodeJSON(buffer) {
  requireValue(Buffer.isBuffer(buffer) && buffer.length <= receiptLimits.receiptBytes * 2, 'ARTIFACT_BYTES_LIMIT');
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer);
  const value = JSON.parse(text); canonical(value);
  // Raw worker artifacts are JSON.stringify output. This also rejects duplicate keys.
  requireValue(text === JSON.stringify(value), 'NONCANONICAL_ARTIFACT');
  return value;
}
export function decodeReceipt(buffer) {
  requireValue(Buffer.isBuffer(buffer) && buffer.length <= receiptLimits.receiptBytes, 'RECEIPT_BYTES_LIMIT');
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer);
  const receipt = JSON.parse(text);
  keys(receipt, ['schemaVersion', 'projectionJson', 'originals', 'dependencies', 'receiptHash']);
  requireValue(receipt.schemaVersion === 'loredock-shared-capture-receipt/1', 'UNSUPPORTED_RECEIPT_VERSION');
  requireValue(text === canonical(receipt));
  const { receiptHash, ...body } = receipt;
  requireValue(hex(receiptHash) && hash(canonical(body)) === receiptHash);
  const decoded = decodeProjection(receipt.projectionJson);
  records(decoded, receipt.originals, receipt.dependencies);
  return { receipt, projection: decoded.value, evidence: decoded.evidence };
}
export function decodeHistory(value) {
  keys(value, ['status', 'receiptId', 'currentApplicability', 'stale', 'projection', 'originals', 'dependencies', 'metrics']);
  requireValue(value.status === 'recorded' && hex(value.receiptId) && value.currentApplicability === 'not-checked' && typeof value.stale === 'boolean');
  const decoded = decodeProjection(JSON.stringify(value.projection));
  records(decoded, value.originals, value.dependencies);
  return { receipt: { receiptHash: value.receiptId, originals: value.originals, dependencies: value.dependencies },
    projection: decoded.value, evidence: decoded.evidence };
}
