import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { SourceGit } from '../src/git.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { declarationMap } from '../src/system-map.js';
import { sha256 } from '../src/extract.js';
import { CatalogError } from '../src/types.js';
import { compareHeaders } from '../src/http-headers.js';
import type { CodeFlows, FlowEdge, FlowNode, StaticFlow } from '../src/code-flow-types.js';
// @ts-expect-error The independently versioned offline prototype is JavaScript.
import { connectedProjection } from '../../../scripts/loredock-connected-admission.mjs';
// @ts-expect-error Owned fixture preparation does not execute a frozen measurement.
import { prepareConnectedCase } from '../../../scripts/loredock-connected-fixture.mjs';

const services = { Catalog, CatalogStore, SourceGit, CodeAnalysis, declarationMap, sha256, CatalogError, compareHeaders };

test('connected admission preserves supported paths beyond the display cap of irrelevant symbols', async t => {
  const state = await prepareConnectedCase(services, 'dense'); t.after(() => state.close()); await state.analyze('facts');
  const value = await connectedProjection(services, state.analysis, state.buildId), graph = value.graph as CodeFlows;
  assert.equal(value.status, 'available'); assert.equal(graph.nodes.length, 13); assert.equal(graph.edges.length, 12);
  assert.equal(graph.flows.length, 2);
  assert.ok(graph.flows.every((flow: StaticFlow) => graph.nodes.find((node: FlowNode) => node.id === flow.nodeIds.at(-1))!.kind === 'document-write'));
  assert.ok(value.resolution.nodes.length > 160); assert.ok(graph.omissions['unselected-resolution-nodes']! >= 160);
  assert.ok(!graph.nodes.some((node: FlowNode) => ['a.ts', 'b.ts'].includes(node.path)));
  assert.ok(graph.edges.filter((edge: FlowEdge) => edge.kind === 'event-delivery').every((edge: FlowEdge) => edge.status === 'candidate'));
});

test('truncated alternatives cannot make the remaining import or handler unique', async t => {
  const state = await prepareConnectedCase(services, 'truncated'); t.after(() => state.close()); await state.analyze('facts');
  const value = await connectedProjection(services, state.analysis, state.buildId);
  assert.equal(value.status, 'available'); assert.equal(Object.keys(value.coverage.incompleteSources).length, 2);
  for (const kind of ['calls', 'implements']) {
    assert.ok(value.resolution.resolutions.some((item: { kind: string; targets: string[]; outcome: string }) => item.kind === kind && item.targets.length === 1 && item.outcome === 'incomplete'));
    assert.ok(!value.graph.edges.some((edge: FlowEdge) => edge.kind === kind));
  }
});

test('connected reads honor internal limits, admit whole paths and discard data on a yielded policy change', async t => {
  const state = await prepareConnectedCase(services); t.after(() => state.close()); await state.analyze('facts');
  const limited = await connectedProjection(services, state.analysis, state.buildId, { limits: { resolutionNodes: 1 } });
  assert.equal(limited.status, 'failed'); assert.equal(limited.error.code, 'RESOLUTION_LIMIT'); assert.equal(limited.graph, null);
  const bounded = await connectedProjection(services, state.analysis, state.buildId, { limits: { nodes: 1 } });
  assert.equal(bounded.status, 'available'); assert.deepEqual(bounded.graph.nodes, []); assert.deepEqual(bounded.graph.edges, []);
  assert.deepEqual(bounded.graph.flows, []); assert.equal(bounded.graph.omissions['whole-path-node-limit'], 2);
  let changed = false;
  const fenced = await connectedProjection(services, state.analysis, state.buildId, { afterFile() {
    if (!changed) { changed = true; state.catalog.updatePolicy(['src']); }
  } });
  assert.equal(changed, true); assert.equal(fenced.error.code, 'ANALYSIS_FENCED'); assert.equal(fenced.graph, null);
  assert.deepEqual(fenced.payloads, []); assert.equal(fenced.resolution, undefined); assert.equal(fenced.inventory, undefined);
});

test('index-excluded code makes source uniqueness incomplete without loading every excluded path', async t => {
  const state = await prepareConnectedCase(services); t.after(() => state.close());
  state.catalog.updatePolicy(['legacy']); const buildId = await state.index('policy-index'); await state.analyze('policy-facts', buildId);
  const value = await connectedProjection(services, state.analysis, buildId);
  assert.equal(value.status, 'available');
  const reasons = Object.values(value.coverage.incompleteSources).flat() as string[];
  assert.ok(reasons.includes('Index-excluded code files: 1'));
  assert.ok(!value.graph.edges.some((edge: FlowEdge) => edge.kind === 'calls'));
  assert.ok(value.resolution.resolutions.some((item: { kind: string; outcome: string }) => item.kind === 'calls' && item.outcome === 'incomplete'));
});
