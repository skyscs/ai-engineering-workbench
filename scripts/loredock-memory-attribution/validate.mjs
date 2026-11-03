import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { hash } from '../loredock-capture-memory/fixture.mjs';
const canonical = value => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
};
export { resourceFailures, validateObservation, validateProjection } from '../loredock-capture-memory/validate.mjs';
import { validateProjection } from '../loredock-capture-memory/validate.mjs';
export function validateReceipt(text, name, oracle, size, corpus, metadata) {
  const receipt = JSON.parse(text), { receiptHash, ...body } = receipt;
  assert.equal(hash(canonical(body)), receiptHash); assert.equal(canonical(receipt), text);
  const p = JSON.parse(receipt.projectionJson); validateProjection(p);
  assert.equal(p.identity.buildId, metadata.buildId); assert.equal(p.identity.inventoryId, metadata.inventory.id);
  assert.equal(p.coverage.factEntries, size.facts); assert.equal(p.coverage.scannedFiles, size.codeFiles);
  assert.equal(p.coverage.metadataEntries, size.files); assert.equal(p.roots.total, oracle.rootCount);
  assert.deepEqual(receipt.dependencies.map(row => row.name).sort(), Object.keys(corpus).sort());
  assert.equal(receipt.dependencies.length, oracle.sourceCount);
  for (const dependency of receipt.dependencies) {
    const source = metadata.sources.find(row => row.sourceId === dependency.sourceId); assert.ok(source);
    for (const key of ['sourceId', 'name', 'revision', 'tree', 'status', 'omitted']) assert.equal(dependency[key], source[key]);
  }
  assert.ok(!receipt.originals.some(row => row.sourceName === oracle.uncitedSource));
  const originals = new Map(receipt.originals.map(row => [row.id, row])); assert.equal(originals.size, receipt.originals.length);
  for (const item of receipt.originals) {
    const source = corpus[item.sourceName]?.[item.path]; assert.equal(typeof source, 'string');
    assert.equal(item.revision, metadata.revisions[item.sourceName]); assert.equal(item.contentHash, hash(source));
    assert.equal(item.text, source.split('\n').slice(item.startLine - 1, item.endLine).join('\n'));
    assert.equal(item.spanHash, hash(item.text));
    assert.equal(item.blobId, createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0`).update(source).digest('hex'));
  }
  const refs = { ...p.graph.evidence, ...p.roots.evidence };
  assert.deepEqual(Object.keys(refs).sort(), [...originals.keys()].sort());
  for (const [id, ref] of Object.entries(refs)) for (const key of ['id', 'sourceName', 'path', 'revision', 'startLine', 'endLine'])
    assert.equal(ref[key], originals.get(id)[key]);
  for (const item of [...p.graph.nodes, ...p.graph.edges, ...p.graph.flows, ...p.roots.items.filter(row => row.status === 'available')]) {
    assert.ok(item.evidenceIds.length); for (const id of item.evidenceIds) assert.ok(originals.has(id));
  }
  const nodes = new Map(p.graph.nodes.map(row => [row.id, row])), edges = new Map(p.graph.edges.map(row => [row.id, row]));
  for (const flow of p.graph.flows) {
    assert.equal(flow.nodeIds.length - 1, flow.edgeIds.length);
    for (let i = 0; i < flow.edgeIds.length; i++) { const edge = edges.get(flow.edgeIds[i]);
      assert.equal(edge.from, flow.nodeIds[i]); assert.equal(edge.to, flow.nodeIds[i + 1]); }
    assert.equal(nodes.get(flow.nodeIds.at(-1)).kind, name === 'isolated' ? 'symbol' : 'document-write');
  }
  if (name === 'isolated') {
    assert.equal(p.graph.nodes.length, 1); assert.equal(p.graph.edges.length, 0); assert.equal(p.graph.flows.length, 1);
    assert.equal(receipt.originals.length, oracle.isolatedOriginals); assert.ok(p.coverage.omissions[oracle.isolated.reason] > 0);
    const node = p.graph.nodes[0], [source, file, label, role] = oracle.isolatedRoot;
    assert.deepEqual([node.sourceName, node.path, node.label, node.properties.role], [source, file, label, role]);
  } else {
    assert.equal(p.graph.flows.length, name === 'selected' ? oracle.selectedFlows : oracle.defaultFlows);
    assert.equal(receipt.originals.length, oracle.defaultOriginals);
    for (const expected of name === 'selected' ? oracle.selectedRequiredNodes : oracle.requiredNodes) {
      const [source, file, kind, label, role] = expected;
      assert.equal(p.graph.nodes.filter(node => node.sourceName === source && node.path === file && node.kind === kind && node.label === label
        && (role === null || node.properties.role === role)).length, 1, 'Exact typed expected node.');
    }
    const deliveries = p.graph.edges.filter(edge => edge.kind === 'event-delivery'); assert.ok(deliveries.length);
    for (const edge of deliveries) {
      assert.equal(edge.status, 'candidate'); assert.equal(edge.environment, oracle.environment);
      assert.equal(edge.topicCheck.value, oracle.topic); assert.equal(edge.topicCheck.rule, 'direct-java-topic-literal/1');
      for (const [key, endpoint] of [['publisher', edge.from], ['subscriber', edge.to]]) {
        assert.equal(edge.topicCheck[key].expression, '"' + oracle.topic + '"');
        assert.deepEqual(edge.topicCheck[key].evidenceIds, [...new Set(nodes.get(endpoint).evidenceIds)].sort());
        for (const id of edge.topicCheck[key].evidenceIds) assert.ok(edge.evidenceIds.includes(id));
      }
    }
  }
  return { receipt, projection: p };
}
