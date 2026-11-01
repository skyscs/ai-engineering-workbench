import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { SourceGit } from '../src/git.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { codeFlows } from '../src/code-flows.js';
import { declarationMap } from '../src/system-map.js';
import { sha256 } from '../src/extract.js';
import { CatalogError } from '../src/types.js';
import { compareHeaders } from '../src/http-headers.js';
// @ts-expect-error The prospective offline reader is an independent JavaScript harness.
import { savedFlowProjection, graphSemantics } from '../../../scripts/loredock-durable-flows.mjs';
// @ts-expect-error Owned fixture preparation does not execute a frozen measurement receipt.
import { prepareFlowCase } from '../../../scripts/loredock-durable-flow-probe.mjs';

const services = { Catalog, CatalogStore, SourceGit, CodeAnalysis, codeFlows, declarationMap, sha256, CatalogError, compareHeaders };

test('offline saved-fact comparison preserves graph semantics and detects changed evidence, limits and links', async t => {
  const state = await prepareFlowCase(services); t.after(() => state.close());
  const unavailable = await savedFlowProjection(services, state.analysis, state.buildId);
  assert.equal(unavailable.status, 'unavailable'); assert.equal(unavailable.graph, null);
  await state.analyze('facts');
  const current = codeFlows(state.catalog), saved = await savedFlowProjection(services, state.analysis, state.buildId);
  assert.ok(saved.graph); assert.notEqual(saved.graph.adapterVersion, current.adapterVersion);
  assert.deepEqual(graphSemantics(saved.graph), graphSemantics(current));
  for (const mutate of [
    (graph: typeof current) => { graph.nodes[0]!.label += ' changed'; },
    (graph: typeof current) => { graph.edges[0]!.status = 'candidate'; },
    (graph: typeof current) => { graph.nodes[0]!.evidenceIds = []; },
    (graph: typeof current) => { graph.limits.nodes++; },
    (graph: typeof current) => { graph.nodes.reverse(); },
  ]) {
    const changed = structuredClone(current); mutate(changed);
    assert.notDeepEqual(graphSemantics(saved.graph), graphSemantics(changed));
  }
});

test('offline yielded fact reads discard consumed payloads when authorization changes', async t => {
  const state = await prepareFlowCase(services); t.after(() => state.close()); await state.analyze('facts');
  let changed = false;
  const result = await savedFlowProjection(services, state.analysis, state.buildId, 'wide', { afterFile() {
    if (!changed) { changed = true; state.catalog.updatePolicy(['src']); }
  } });
  assert.equal(changed, true); assert.equal(result.status, 'failed'); assert.equal(result.error.code, 'ANALYSIS_FENCED');
  assert.equal(result.graph, null); assert.deepEqual(result.payloads, []);
  assert.equal(result.selection, undefined); assert.equal(result.inventory, undefined);
});
