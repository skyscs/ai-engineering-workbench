import assert from 'node:assert/strict';
import { limitsFor } from './limits.mjs';

const nodeTypes = ['hidden', 'array', 'string', 'object', 'code', 'closure', 'regexp', 'number', 'native', 'synthetic',
  'concatenated string', 'sliced string', 'symbol', 'bigint', 'object shape'];
const edgeTypes = ['context', 'element', 'property', 'internal', 'hidden', 'shortcut', 'weak'];
const meta = {
  node_fields: ['type', 'name', 'id', 'self_size', 'edge_count', 'trace_node_id', 'detachedness'],
  node_types: [nodeTypes, 'string', 'number', 'number', 'number', 'number', 'number'],
  edge_fields: ['type', 'name_or_index', 'to_node'], edge_types: [edgeTypes, 'string_or_number', 'node'],
  trace_function_info_fields: ['function_id', 'name', 'script_name', 'script_id', 'line', 'column'],
  trace_node_fields: ['id', 'function_info_index', 'count', 'size', 'children'],
  sample_fields: ['timestamp_us', 'last_assigned_id'], location_fields: ['object_index', 'script_id', 'line', 'column'],
};
const integer = value => Number.isSafeInteger(value) && value >= 0;
const exactKeys = (object, keys) => assert.deepEqual(Object.keys(object).sort(), [...keys].sort());

// This readout never labels a runtime/conditional path as a proved strong retainer.
// Raw V8 graphs and node/edge indices remain necessary for ownership review.
export function summarizeSnapshot(bytes, selectors, reduced) {
  const limits = limitsFor(reduced);
  assert.ok(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= limits.fileBytes);
  assert.ok(Array.isArray(selectors) && selectors.length > 0 && selectors.length <= limits.selectors);
  const labels = new Set();
  for (const selector of selectors) {
    exactKeys(selector, ['label', 'name', 'properties']);
    assert.ok(typeof selector.label === 'string' && selector.label.length <= 128 && !labels.has(selector.label)); labels.add(selector.label);
    assert.ok(typeof selector.name === 'string' && selector.name.length <= 128);
    assert.ok(selector.properties && typeof selector.properties === 'object' && !Array.isArray(selector.properties)
      && Object.keys(selector.properties).length <= 4);
    for (const [key, value] of Object.entries(selector.properties)) assert.ok(key.length <= 128 && typeof value === 'string' && value.length <= 256);
  }
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
  exactKeys(value, ['snapshot', 'nodes', 'edges', 'trace_function_infos', 'trace_tree', 'samples', 'locations', 'strings']);
  exactKeys(value.snapshot, ['meta', 'node_count', 'edge_count', 'trace_function_count']);
  assert.deepEqual(value.snapshot.meta, meta, 'Unsupported pinned V8 heap schema.');
  const count = value.snapshot.node_count, edgeCount = value.snapshot.edge_count;
  assert.ok(integer(count) && count > 0 && count <= limits.nodes && integer(edgeCount) && edgeCount <= limits.edges);
  const { nodes, edges, strings, locations } = value;
  assert.ok(Array.isArray(nodes) && nodes.length === count * 7 && Array.isArray(edges) && edges.length === edgeCount * 3);
  assert.ok(Array.isArray(strings) && strings.length <= limits.strings && strings.every(value => typeof value === 'string'));
  assert.equal(value.snapshot.trace_function_count, 0);
  for (const key of ['trace_function_infos', 'trace_tree', 'samples']) assert.deepEqual(value[key], [], 'Allocation traces are outside this terminal schema.');
  assert.ok(Array.isArray(locations) && locations.length <= count * 4 && locations.length % 4 === 0);
  for (let i = 0; i < locations.length; i += 4) {
    assert.ok(integer(locations[i]) && locations[i] % 7 === 0 && locations[i] < nodes.length);
    for (let j = 1; j < 4; j++) assert.ok(integer(locations[i + j]));
  }
  const ids = new Set(), offsets = new Uint32Array(count + 1); let cursor = 0, shallowBytes = 0, nativeNodes = 0, weakEdges = 0;
  for (let index = 0; index < count; index++) {
    const at = index * 7;
    for (let field = 0; field < 7; field++) assert.ok(integer(nodes[at + field]), 'Invalid node field.');
    assert.ok(nodes[at] < nodeTypes.length && nodes[at + 1] < strings.length && !ids.has(nodes[at + 2])); ids.add(nodes[at + 2]);
    assert.equal(nodes[at + 5], 0); assert.ok(nodes[at + 6] <= 2);
    offsets[index] = cursor; cursor += nodes[at + 4]; assert.ok(cursor <= edgeCount, 'Invalid edge ownership count.');
    shallowBytes += nodes[at + 3]; assert.ok(Number.isSafeInteger(shallowBytes));
    if (nodeTypes[nodes[at]] === 'native') nativeNodes++;
  }
  offsets[count] = cursor; assert.equal(cursor, edgeCount); assert.equal(nodeTypes[nodes[0]], 'synthetic');
  for (let index = 0; index < edgeCount; index++) {
    const at = index * 3, type = edges[at], name = edges[at + 1], target = edges[at + 2];
    assert.ok(integer(type) && type < edgeTypes.length && integer(name) && integer(target) && target % 7 === 0 && target < nodes.length);
    if (!['element', 'hidden'].includes(edgeTypes[type])) assert.ok(name < strings.length, 'Invalid edge string index.');
    if (edgeTypes[type] === 'weak') weakEdges++;
  }
  const describe = index => ({ index, id: nodes[index * 7 + 2], type: nodeTypes[nodes[index * 7]], name: strings[nodes[index * 7 + 1]].slice(0, 256),
    shallowBytes: nodes[index * 7 + 3] });
  // One bounded non-weak breadth-first traversal; runtime edges remain explicitly unclassified.
  const parents = new Int32Array(count).fill(-1), via = new Int32Array(count).fill(-1), queue = new Uint32Array(count);
  queue[0] = 0; parents[0] = 0; let head = 0, tail = 1;
  while (head < tail) {
    const source = queue[head++];
    for (let edge = offsets[source]; edge < offsets[source + 1]; edge++) {
      const at = edge * 3, target = edges[at + 2] / 7;
      if (edgeTypes[edges[at]] === 'weak' || parents[target] !== -1) continue;
      parents[target] = source; via[target] = edge; queue[tail++] = target;
    }
  }
  function retainingPath(index) {
    if (parents[index] === -1) return { state: 'no-nonweak-path-found', edges: [] };
    const path = []; let current = index;
    while (current !== 0) {
      if (path.length >= limits.pathSteps) return { state: 'path-limit', edges: [] };
      const edge = via[current], at = edge * 3, type = edgeTypes[edges[at]], parent = parents[current];
      path.push({ edgeIndex: edge, from: describe(parent), to: describe(current), type,
        name: ['element', 'hidden'].includes(type) ? edges[at + 1] : strings[edges[at + 1]].slice(0, 256) });
      current = parent;
    }
    path.reverse();
    return { state: path.every(edge => ['context', 'element', 'property'].includes(edge.type)
      && !['native', 'hidden'].includes(edge.from.type) && !['native', 'hidden'].includes(edge.to.type))
      ? 'explicit-strong-edges' : 'runtime-edges-unclassified', edges: path };
  }
  const groups = selectors.map(selector => ({ selector, count: 0, shallowBytes: 0, examples: [] }));
  for (let index = 0; index < count; index++) {
    if (nodeTypes[nodes[index * 7]] !== 'object') continue;
    for (const group of groups) {
      if (strings[nodes[index * 7 + 1]] !== group.selector.name) continue;
      const properties = new Map();
      for (let edge = offsets[index]; edge < offsets[index + 1]; edge++) {
        const at = edge * 3, target = edges[at + 2];
        if (edgeTypes[edges[at]] === 'property' && nodeTypes[nodes[target]] === 'string') properties.set(strings[edges[at + 1]], strings[nodes[target + 1]]);
      }
      if (!Object.entries(group.selector.properties).every(([key, value]) => properties.get(key) === value)) continue;
      group.count++; group.shallowBytes += nodes[index * 7 + 3];
      if (group.examples.length < limits.matches) group.examples.push({ node: describe(index), path: retainingPath(index) });
    }
  }
  const result = { schemaVersion: 'loredock-terminal-heap-summary/1', nodes: count, edges: edgeCount, strings: strings.length,
    shallowBytes, nativeNodes, weakEdges, nonWeakReachableNodes: tail, groups, resourceAcceptance: false,
    interpretation: 'Post-collection graph only. Runtime/conditional edges are unclassified. Counts and shallow sizes are not retained subtree bytes, native RSS or proof of a leak; selectors may overlap.' };
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= limits.summaryBytes, 'Heap summary output bound exceeded.');
  return result;
}
