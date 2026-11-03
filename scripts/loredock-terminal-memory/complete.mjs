import assert from 'node:assert/strict';
import { readArtifact } from '../loredock-qualification-assessment/artifact.mjs';
import { decodeReceipt, decodeHistory, decodeJSON } from '../loredock-qualification-assessment/codec.mjs';
import { operations } from '../loredock-qualification-assessment/assess.mjs';

const typed = node => [node.sourceName, node.path, node.kind, node.label, node.properties.role ?? null];
const ordered = values => values.map(value => JSON.stringify(value)).sort();

// Additional exact positive protocol; ordinary resource/support assessments stay independent.
export async function assessComplete({ root, raw, expected }) {
  const results = [];
  for (const name of operations) {
    const item = { name, state: 'fail' }; results.push(item);
    try {
      const rows = raw.operations.filter(row => row.name === name); assert.equal(rows.length, 1);
      const row = rows[0]; let saved;
      if (name === 'page-4') {
        const wrapper = decodeJSON(await readArtifact(root, row.artifact));
        assert.deepEqual(wrapper.result.projection.roots.items.map(node => [node.sourceName, node.path, node.label, node.role]), [expected.isolatedRoot]);
        item.state = 'pass'; continue;
      }
      if (name === 'history') saved = decodeHistory(decodeJSON(await readArtifact(root, row.artifact)).result);
      else saved = decodeReceipt(await readArtifact(root, row.receipt));
      const { projection, receipt } = saved, graph = projection.graph;
      assert.deepEqual(receipt.dependencies.map(row => row.name).sort(), [...expected.sources].sort());
      assert.deepEqual(projection.roots.items.map(node => [node.sourceName, node.path, node.label, node.role]), expected.roots);
      const wanted = name === 'isolated' ? [{ nodes: [[...expected.isolatedRoot.slice(0, 2), 'symbol', ...expected.isolatedRoot.slice(2)]], edges: [] }]
        : name === 'selected' ? expected.flows.slice(0, 1) : expected.flows;
      const nodes = new Map(graph.nodes.map(node => [node.id, node])), edges = new Map(graph.edges.map(edge => [edge.id, edge]));
      assert.deepEqual(graph.flows.map(flow => ({ nodes: flow.nodeIds.map(id => typed(nodes.get(id))), edges: flow.edgeIds.map(id => edges.get(id).kind) })), wanted);
      assert.deepEqual([...new Set(graph.flows.flatMap(flow => flow.nodeIds))].sort(), [...nodes.keys()].sort());
      assert.deepEqual([...new Set(graph.flows.flatMap(flow => flow.edgeIds))].sort(), [...edges.keys()].sort());
      assert.deepEqual(ordered(receipt.originals.map(row => [row.sourceName, row.path, row.startLine, row.endLine])),
        ordered(name === 'isolated' ? expected.isolatedOriginals : expected.originals));
      item.state = 'pass';
    } catch (error) { item.error = { name: error.name, message: error.message }; }
  }
  return { operations: results, failed: results.some(row => row.state !== 'pass') };
}
