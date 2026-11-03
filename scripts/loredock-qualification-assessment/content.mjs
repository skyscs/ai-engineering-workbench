import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { hash } from './codec.mjs';

// Expected sources and metadata are caller-owned frozen values, never live catalog input.
export function validateSupport(saved, corpus, metadata) {
  const p = saved.projection;
  assert.equal(p.identity.buildId, metadata.buildId);
  assert.equal(p.identity.inventoryId, metadata.inventory.id);
  assert.equal(p.identity.manifestHash, metadata.manifestHash);
  assert.equal(p.identity.fingerprint, metadata.inventory.fingerprint);
  assert.deepEqual(p.identity.analysisLimits, metadata.inventory.limits);
  const sources = new Map(metadata.sources.map(row => [row.name, row]));
  assert.equal(sources.size, metadata.sources.length);
  assert.deepEqual([...sources.keys()].sort(), Object.keys(corpus).sort());
  const fields = ['sourceId', 'name', 'revision', 'tree', 'status', 'omitted'];
  const vector = rows => rows.map(row => Object.fromEntries(fields.map(key => [key, row[key]]))).sort((a, b) => a.name.localeCompare(b.name));
  if (saved.receipt) assert.deepEqual(vector(saved.receipt.dependencies), vector(metadata.sources));
  assert.deepEqual(p.coverage.sources.map(row => row.sourceId).sort(), metadata.sources.map(row => row.sourceId).sort());
  for (const ref of saved.evidence.values()) {
    const source = sources.get(ref.sourceName), text = corpus[ref.sourceName]?.[ref.path];
    assert.ok(source, 'Referenced source is in the frozen scope.');
    assert.equal(ref.revision, source.revision);
    assert.equal(ref.revision, metadata.revisions[ref.sourceName]);
    assert.equal(typeof text, 'string', 'Referenced file exists in the frozen corpus.');
    assert.ok(ref.endLine <= text.replaceAll('\r\n', '\n').split('\n').length, 'Original line range is in the frozen file.');
  }
  for (const item of saved.receipt?.originals ?? []) {
    const source = corpus[item.sourceName][item.path];
    assert.equal(item.contentHash, hash(source));
    assert.equal(item.text, source.replaceAll('\r\n', '\n').split('\n').slice(item.startLine - 1, item.endLine).join('\n'));
    assert.equal(item.blobId, createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0`).update(source).digest('hex'));
  }
  for (const item of [...(p.graph?.nodes ?? []), ...p.roots.items.filter(row => row.status === 'available')]) {
    const source = sources.get(item.sourceName);
    assert.ok(source); assert.equal(item.sourceId, source.sourceId); assert.equal(item.revision, source.revision);
    assert.equal(typeof corpus[item.sourceName]?.[item.path], 'string');
  }
}
export function validateUsefulness(saved, name, oracle, size) {
  const { receipt, projection: p } = saved;
  assert.equal(p.coverage.factEntries, size.facts); assert.equal(p.coverage.scannedFiles, size.codeFiles);
  assert.equal(p.coverage.metadataEntries, size.files); assert.equal(p.roots.total, oracle.rootCount);
  if (name === 'page-4') {
    assert.equal(p.roots.offset, 4); assert.equal(p.roots.items.length, 1);
    const root = p.roots.items[0];
    assert.deepEqual([root.sourceName, root.path, root.label, root.role], oracle.isolatedRoot); return;
  }
  assert.equal(receipt.dependencies.length, oracle.sourceCount);
  assert.ok(!receipt.originals.some(row => row.sourceName === oracle.uncitedSource));
  const nodes = new Map(p.graph.nodes.map(row => [row.id, row]));
  for (const flow of p.graph.flows) assert.equal(nodes.get(flow.nodeIds.at(-1)).kind,
    name === 'isolated' ? 'symbol' : (oracle.terminalKind ?? 'document-write'));
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
    if (oracle.requiredOmission) assert.ok(p.coverage.omissions[oracle.requiredOmission] > 0);
    const deliveries = p.graph.edges.filter(edge => edge.kind === 'event-delivery'); assert.equal(deliveries.length > 0, oracle.expectDelivery !== false);
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
}
