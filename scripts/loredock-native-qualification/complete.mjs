import assert from 'node:assert/strict';
import { readArtifact } from '../loredock-native-assessment/artifact.mjs';
import { decodeReceipt, decodeProjection, historyOutput } from '../loredock-native-assessment/codec.mjs';
import { operations } from '../loredock-native-assessment/assess.mjs';
const typed = node => [node.sourceName, node.path, node.kind, node.label, node.properties.role ?? null];
const ordered = rows => rows.map(row => JSON.stringify(row)).sort();

export async function assessComplete({ root, rows, metadata, expected }) {
  const results = [];
  for (const name of operations) {
    const item = { name, state: 'fail' }; results.push(item);
    try {
      const matches = rows.filter(row => row.name === name); assert.equal(matches.length, 1); const row = matches[0]; let saved;
      if (name === 'page-4') {
        const raw = await readArtifact(root, row.output), { projection } = decodeProjection(raw.toString('utf8'), 'roots');
        assert.deepEqual(projection.roots.items.map(node => [node.sourceName, node.path, node.label, node.role]), [expected.isolatedRoot]); item.state = 'pass'; continue;
      }
      if (name === 'history') saved = historyOutput(await readArtifact(root, row.output));
      else saved = decodeReceipt(await readArtifact(root, row.receipt), metadata.catalogId);
      const { projection, receipt } = saved, graph = projection.graph;
      assert.deepEqual(receipt.dependencies.map(row => row.name).sort(), [...expected.sources].sort());
      assert.deepEqual(projection.roots.items.map(node => [node.sourceName, node.path, node.label, node.role]), expected.roots);
      const wanted = name === 'isolated' ? [{ nodes: [[...expected.isolatedRoot.slice(0, 2), 'symbol', ...expected.isolatedRoot.slice(2)]], edges: [] }]
        : name === 'selected' ? expected.flows.slice(0, 1) : expected.flows;
      const nodes = new Map(graph.nodes.map(node => [node.id, node])), edges = new Map(graph.edges.map(edge => [edge.id, edge]));
      assert.deepEqual(graph.flows.map(flow => ({ nodes: flow.nodeIds.map(id => typed(nodes.get(id))), edges: flow.edgeIds.map(id => edges.get(id).kind) })), wanted);
      assert.deepEqual(ordered(graph.nodes.map(typed)), ordered([...new Map(wanted.flatMap(flow => flow.nodes).map(node => [JSON.stringify(node), node])).values()]));
      assert.deepEqual([...new Set(graph.flows.flatMap(flow => flow.edgeIds))].sort(), [...edges.keys()].sort());
      assert.deepEqual(ordered(receipt.originals.map(row => [row.sourceName, row.path, row.startLine, row.endLine])),
        ordered(name === 'isolated' ? expected.isolatedOriginals : expected.originals)); item.state = 'pass';
    } catch (error) { item.error = { name: error.name, message: error.message }; }
  }
  return { operations: results, failed: results.some(row => row.state !== 'pass') };
}
