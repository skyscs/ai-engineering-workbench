import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
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
import { bindingProjection } from '../../../scripts/loredock-binding-coverage.mjs';
// @ts-expect-error Small regression fixtures do not execute frozen qualification matrices.
import { prepareConnectedCase, connectedGit } from '../../../scripts/loredock-connected-fixture.mjs';
// @ts-expect-error The offline metadata verifier is JavaScript.
import { verifySavedTree, metadataFrame } from '../../../scripts/loredock-binding-metadata.mjs';

const services = { Catalog, CatalogStore, SourceGit, CodeAnalysis, declarationMap, sha256, CatalogError, compareHeaders };
type Binding = { kind: string; targets: string[]; outcome: string; incomplete: boolean; domain: { complete: boolean; reasons: Record<string, number> } };
const noResult = (value: { graph: unknown; envelope?: unknown; resolution?: unknown }) => {
  assert.equal(value.graph, null); assert.equal(value.envelope, undefined); assert.equal(value.resolution, undefined);
};

test('saved trees match independent Git bytes and reject missing or colliding entries', async t => {
  const state = await prepareConnectedCase(services); t.after(() => state.close());
  const target = path.join(state.root, 'sources', 'console');
  await mkdir(path.join(target, '__proto__')); await writeFile(path.join(target, '__proto__', 'constructor'), 'independent bytes\n');
  await writeFile(path.join(target, 'café.txt'), 'non-ASCII original\n');
  connectedGit(state.root, 'console', ['add', '--all']); connectedGit(state.root, 'console', ['commit', '-qm', 'Add independent tree regression entries']);
  const entries = connectedGit(state.root, 'console', ['ls-tree', '-rz', 'HEAD'], false).split('\0').filter(Boolean).map((row: string) => {
    const [meta, file] = row.split('\t'), [mode, , blob] = meta!.split(' '); return { path: file, mode, blob };
  });
  const tree = connectedGit(state.root, 'console', ['rev-parse', 'HEAD^{tree}']);
  const work = { step: async () => {} };
  assert.equal(await verifySavedTree(entries, tree, work), tree);
  await assert.rejects(verifySavedTree(entries.slice(1), tree, work), { code: 'CORRUPT_PATH_TREE' });
  await assert.rejects(verifySavedTree([...entries, entries[0]], tree, work), { code: 'CORRUPT_PATH_METADATA' });
  await assert.rejects(verifySavedTree([...entries, { ...entries[0], path: '__proto__' }], tree, work), { code: 'CORRUPT_PATH_METADATA' });
  assert.equal(metadataFrame('F', ['é', null, 12]), 'F2:é-1:2:12\n');
});

test('unrelated profile gaps preserve useful imports and Java paths without read mutations', async t => {
  const state = await prepareConnectedCase(services); t.after(() => state.close());
  for (const source of ['console', 'parcel-api', 'parcel-worker']) {
    await writeFile(path.join(state.root, 'sources', source, 'unrelated.ts'), 'export const annotation = "not a target";\n');
    connectedGit(state.root, source, ['add', '--all']); connectedGit(state.root, source, ['commit', '-qm', 'Add unrelated profile gap']);
  }
  const build = await state.index('gaps'); await state.analyze('gaps', build); const before = state.counters();
  const value = await bindingProjection(services, state.analysis, build);
  assert.equal(value.status, 'available', JSON.stringify(value.error));
  assert.ok(value.envelope.coverage.sources.every((source: { treeVerified: boolean; filesWithGaps: number }) => source.treeVerified && source.filesWithGaps > 0));
  assert.equal(value.graph.flows.length, 2);
  for (const flow of value.graph.flows) assert.ok(value.graph.nodes.some((node: FlowNode) => node.id === flow.nodeIds.at(-1) && node.kind === 'document-write'));
  assert.ok(value.resolution.resolutions.every((binding: Binding) => binding.domain.complete && !binding.incomplete));
  assert.deepEqual(state.counters(), before);
});

test('known alternatives stay ambiguous when a further target has unsupported syntax', async t => {
  const state = await prepareConnectedCase(services, 'ambiguity'); t.after(() => state.close());
  const dir = path.join(state.root, 'sources', 'console', 'src', 'parcels'); await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.js'), 'export const sendParcel = () => "uncertain third target";\n');
  connectedGit(state.root, 'console', ['add', '--all']); connectedGit(state.root, 'console', ['commit', '-qm', 'Add incomplete third target']);
  const build = await state.index('third'); await state.analyze('third', build);
  const value = await bindingProjection(services, state.analysis, build); assert.equal(value.status, 'available', JSON.stringify(value.error));
  assert.ok(value.resolution.resolutions.some((binding: Binding) => binding.kind === 'calls' && binding.targets.length === 2
    && binding.outcome === 'ambiguous' && binding.incomplete && binding.domain.reasons['target-parser-gaps']));
  assert.ok(!value.resolution.edges.some((edge: FlowEdge) => edge.kind === 'calls'));
});

test('removing an excluded path cannot turn it into a verified absent target', async t => {
  const state = await prepareConnectedCase(services); t.after(() => state.close());
  state.catalog.updatePolicy(['README.md']); const build = await state.index('excluded'); await state.analyze('excluded', build);
  const file = state.store.one("SELECT id FROM files WHERE buildId=? AND path='README.md' LIMIT 1", build);
  state.store.run('DELETE FROM files WHERE id=?', file.id);
  const value = await bindingProjection(services, state.analysis, build);
  noResult(value); assert.equal(value.error.code, 'CORRUPT_PATH_TREE');
});

test('cancellation, metadata bounds and generation-scoped root selection are explicit', async t => {
  const state = await prepareConnectedCase(services, 'roots'); t.after(() => state.close()); await state.analyze('facts');
  for (const stage of ['metadata', 'read', 'resolve', 'admit']) {
    const controller = new AbortController();
    const value = await bindingProjection(services, state.analysis, state.buildId, { signal: controller.signal,
      checkpoint(info: { stage: string }) { if (info.stage === stage) controller.abort(); } });
    noResult(value); assert.equal(value.error.code, 'CANCELLED');
  }
  for (const limits of [{ metadataBytes: 1 }, { metadataEntries: 1 }]) {
    const value = await bindingProjection(services, state.analysis, state.buildId, { limits });
    noResult(value); assert.equal(value.error.code, 'METADATA_LIMIT');
  }
  const normal = await bindingProjection(services, state.analysis, state.buildId); assert.equal(normal.status, 'available');
  const rootId = normal.resolution.roots.at(-1).id, generationId = normal.envelope.generationId;
  const selected = await bindingProjection(services, state.analysis, state.buildId, { rootId, generationId });
  assert.equal(selected.graph.flows.length, 1); assert.equal(selected.graph.flows[0].nodeIds[0], rootId);
  for (const options of [{ rootId }, { rootId, generationId: 'foreign' }, { rootId: 'foreign', generationId }]) {
    noResult(await bindingProjection(services, state.analysis, state.buildId, options));
  }
});

test('metadata changes after admission cannot publish a previously complete graph', async t => {
  const state = await prepareConnectedCase(services); t.after(() => state.close()); await state.analyze('facts'); let changed = false;
  const value = await bindingProjection(services, state.analysis, state.buildId, { checkpoint(info: { stage: string }) {
    if (info.stage === 'admit' && !changed) {
      changed = true; state.store.run("UPDATE files SET reason='changed during read' WHERE buildId=? AND path='README.md'", state.buildId);
    }
  } });
  assert.equal(changed, true); noResult(value); assert.equal(value.error.code, 'METADATA_CHANGED');
});
