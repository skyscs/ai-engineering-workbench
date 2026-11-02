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
import type { FlowNode, FlowEdge } from '../src/code-flow-types.js';
// @ts-expect-error The independently versioned offline candidate is JavaScript.
import { scaleProjection } from '../../../scripts/loredock-connected-scale.mjs';
// @ts-expect-error Small existing test fixtures do not execute frozen measurement harnesses.
import { prepareConnectedCase } from '../../../scripts/loredock-connected-fixture.mjs';

const services = { Catalog, CatalogStore, SourceGit, CodeAnalysis, declarationMap, sha256, CatalogError, compareHeaders };

test('indexed resolution preserves complete alternatives outside display slots', async t => {
  const state = await prepareConnectedCase(services, 'ambiguity'); t.after(() => state.close()); await state.analyze('facts');
  const value = await scaleProjection(services, state.analysis, state.buildId);
  assert.equal(value.status, 'available'); assert.ok(value.resolution.nodes.length > 160);
  for (const kind of ['calls', 'implements']) {
    assert.ok(value.resolution.resolutions.some((item: { kind: string; targets: string[]; outcome: string }) => item.kind === kind && item.targets.length === 2 && item.outcome === 'ambiguous'));
    assert.ok(!value.graph.edges.some((edge: FlowEdge) => edge.kind === kind));
  }
  assert.ok(Buffer.byteLength(JSON.stringify(value.envelope)) <= 512 * 1024);
});

test('cooperative resolution and admission both discard pending data on cancellation', async t => {
  const state = await prepareConnectedCase(services); t.after(() => state.close()); await state.analyze('facts');
  for (const stage of ['resolve', 'admit']) {
    const controller = new AbortController(); let reached = false;
    const value = await scaleProjection(services, state.analysis, state.buildId, { signal: controller.signal,
      checkpoint(info: { stage: string }) { if (info.stage === stage) { reached = true; controller.abort(); } } });
    assert.equal(reached, true); assert.equal(value.error.code, 'CANCELLED'); assert.equal(value.graph, null);
    assert.equal(value.envelope, undefined); assert.equal(value.resolution, undefined);
  }
});

test('work bounds, explicit roots and whole-path admission do not silently narrow resolution', async t => {
  const state = await prepareConnectedCase(services, 'roots'); t.after(() => state.close()); await state.analyze('facts');
  const limited = await scaleProjection(services, state.analysis, state.buildId, { limits: { work: 1 } });
  assert.equal(limited.error.code, 'WORK_LIMIT'); assert.equal(limited.graph, null);
  const normal = await scaleProjection(services, state.analysis, state.buildId);
  assert.equal(normal.status, 'available'); assert.equal(normal.resolution.roots.length, 4);
  const root = normal.resolution.roots.at(-1).id;
  const selected = await scaleProjection(services, state.analysis, state.buildId, { rootId: root });
  assert.equal(selected.graph.flows.length, 1); assert.equal(selected.graph.flows[0].nodeIds[0], root);
  assert.ok(selected.graph.nodes.some((node: FlowNode) => node.kind === 'document-write'));
  assert.deepEqual(selected.resolution, normal.resolution);
  const bounded = await scaleProjection(services, state.analysis, state.buildId, { limits: { nodes: 1 } });
  assert.deepEqual(bounded.graph.nodes, []); assert.deepEqual(bounded.graph.edges, []); assert.deepEqual(bounded.graph.flows, []);
  assert.equal(bounded.graph.omissions['whole-path-node-limit'], 2);
});

test('policy edits at an admission checkpoint invalidate the complete pending graph', async t => {
  const state = await prepareConnectedCase(services); t.after(() => state.close()); await state.analyze('facts'); let changed = false;
  const value = await scaleProjection(services, state.analysis, state.buildId, { checkpoint(info: { stage: string }) {
    if (info.stage === 'admit' && !changed) { changed = true; state.catalog.updatePolicy(['legacy']); }
  } });
  assert.equal(changed, true); assert.equal(value.error.code, 'ANALYSIS_FENCED'); assert.equal(value.graph, null);
  assert.equal(value.envelope, undefined); assert.equal(value.resolution, undefined);
});
