import assert from 'node:assert/strict';
import { bytes, canonical, choice, eq, fields, gitId, hash, hex, limits, list, locator, number, optionalNull, parse, sorted, text, unique, uuid } from './schema.mjs';
import { decodeProjection } from './projection.mjs';
export { decodeProjection } from './projection.mjs';
export { canonical, hash, limits } from './schema.mjs';
const original = value => fields(value, { id: uuid, buildId: uuid, sourceId: uuid, ...locator, contentHash: hex, spanHash: hex, blobId: gitId, text: text(limits.textBytes) });
const dependency = value => fields(value, { sourceId: uuid, name: text(512, 1), revision: optionalNull(gitId), tree: optionalNull(gitId), status: choice('ready', 'failed', 'pending'), omitted: number() });
export function records(decoded, originals, dependencies) {
  list(original, limits.spans)(originals); list(dependency, limits.sources)(dependencies);
  sorted(originals.map(row => row.id)); sorted(dependencies.map(row => row.sourceId)); unique(dependencies.map(row => row.name));
  const { projection: p, evidence } = decoded;
  eq(dependencies.map(row => row.sourceId), p.coverage.sources.map(row => row.sourceId).sort()); eq(originals.length, evidence.size);
  for (const dep of dependencies) {
    const row = p.coverage.sources.find(row => row.sourceId === dep.sourceId); eq(dep.status, row.status); eq(dep.omitted, row.omittedPaths);
    if (dep.status === 'ready') { gitId(dep.revision); gitId(dep.tree); } if (row.treeVerified) gitId(dep.tree);
  }
  assert.ok(originals.reduce((total, row) => total + bytes(row.text), 0) <= limits.textBytes);
  const byId = new Map(originals.map(item => [item.id, item]));
  for (const item of originals) {
    const ref = evidence.get(item.id), dep = dependencies.find(row => row.sourceId === item.sourceId); assert.ok(ref && dep && dep.status === 'ready');
    eq(item.buildId, p.identity.buildId); eq(item.sourceName, dep.name); eq(item.revision, dep.revision);
    for (const key of Object.keys(locator)) eq(item[key], ref[key]);
    eq(hash(item.text), item.spanHash); eq(item.text.split('\n').length, item.endLine - item.startLine + 1);
    for (const other of originals) if (other.id !== item.id && other.sourceId === item.sourceId && other.path === item.path) {
      eq(item.contentHash, other.contentHash); eq(item.blobId, other.blobId); assert.ok(item.endLine < other.startLine || other.endLine < item.startLine);
    }
  }
  // Every displayed node/root needs continuous same-file original coverage.
  for (const item of [...p.graph.nodes, ...p.roots.items.filter(row => row.status === 'available')]) {
    const ranges = item.evidenceIds.map(id => byId.get(id)).filter(row => row && row.sourceId === item.sourceId && row.sourceName === item.sourceName && row.path === item.path && row.revision === item.revision).sort((a, b) => a.startLine - b.startLine);
    let through = item.startLine - 1;
    for (const range of ranges) if (range.startLine <= through + 1) through = Math.max(through, range.endLine);
    assert.ok(through >= item.endLine, 'Node has incomplete same-file original support.');
  }
  for (const edge of p.graph.edges) if (edge.topicCheck) for (const endpoint of [edge.topicCheck.publisher, edge.topicCheck.subscriber])
    assert.ok(endpoint.evidenceIds.some(id => byId.get(id).text.includes(endpoint.expression)), 'Literal witness is absent from originals.');
  return { ...decoded, receipt: { originals, dependencies } };
}
export function decodeReceipt(input, catalogId) {
  uuid(catalogId); const receipt = parse(input, limits.receiptBytes);
  fields(receipt, { schemaVersion: choice('loredock-code-path-receipt/1'), catalogId: uuid, receiptHash: hex,
    projectionJson: text(limits.projectionBytes), originals: list(original, 30), dependencies: list(dependency, 20) });
  eq(receipt.catalogId, catalogId); const { receiptHash, ...body } = receipt; eq(hash(canonical(body)), receiptHash);
  const decoded = records(decodeProjection(receipt.projectionJson), receipt.originals, receipt.dependencies); return { ...decoded, receipt };
}
export function metrics(value, history = false) {
  const scalar = ['pathWork', 'receiptWork', 'totalWork', 'work', 'checkpoints', 'projectionBytes', 'receiptBytes', 'textBytes', 'spans', 'sources'];
  fields(value, { accountingVersion: choice('shared-capture-work/1'), ...Object.fromEntries(scalar.map(key => [key, number()])),
    wallMs: n => assert.ok(Number.isFinite(n) && n >= 0 && n < 5000), publicationLocks: choice(history ? 0 : 1) });
  eq(value.totalWork, value.pathWork + value.receiptWork); eq(value.work, value.totalWork); assert.ok(value.totalWork <= 1000000);
  if (history) eq(value.pathWork, 0);
  for (const key of ['projectionBytes', 'receiptBytes', 'textBytes', 'spans', 'sources']) assert.ok(value[key] <= limits[key]);
}
export function captureOutput(input) {
  const value = parse(input, limits.receiptBytes, true);
  fields(value, { status: choice('captured'), receiptId: hex, created: choice(true, false), metrics }); return value;
}
export function historyOutput(input) {
  const value = parse(input, limits.receiptBytes, true);
  fields(value, { status: choice('recorded'), receiptId: hex, currentApplicability: choice('not-checked'), stale: choice(true, false),
    projection: () => {}, originals: list(original, 30), dependencies: list(dependency, 20), metrics: item => metrics(item, true) });
  const saved = records(decodeProjection(JSON.stringify(value.projection)), value.originals, value.dependencies);
  return { ...saved, receipt: { ...saved.receipt, receiptHash: value.receiptId }, output: value };
}
