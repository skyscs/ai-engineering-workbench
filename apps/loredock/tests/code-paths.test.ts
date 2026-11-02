import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { writeFile, mkdir, symlink, chmod } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { serve } from '@hono/node-server';
import path from 'node:path';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { SourceGit } from '../src/git.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { declarationMap } from '../src/system-map.js';
import { codeFlows } from '../src/code-flows.js';
import { sha256 } from '../src/extract.js';
import { CatalogError } from '../src/types.js';
import { compareHeaders } from '../src/http-headers.js';
import { CodePaths, pathRequest } from '../src/code-paths.js';
import { createApp } from '../src/app.js';
import { verifySavedTree } from '../src/code-paths-metadata.js';
import { PathWork, codePathLimits } from '../src/code-paths-work.js';
import type { CodePathsAvailable, CodePathsResponse, CodePathGraph } from '../src/code-paths-types.js';
import type { AnalysisLimits } from '../src/code-analysis-types.js';
// @ts-expect-error Small regression fixtures do not execute frozen measurements.
import { prepareConnectedCase, connectedGit } from '../../../scripts/loredock-connected-fixture.mjs';
// @ts-expect-error Qualified offline reference; the frozen matrix is never executed here.
import { bindingProjection } from '../../../scripts/loredock-binding-coverage.mjs';

const services = { Catalog, CatalogStore, SourceGit, CodeAnalysis, declarationMap, sha256, CatalogError, compareHeaders };
interface State {
  root: string; buildId: string; catalog: Catalog; store: CatalogStore; analysis: CodeAnalysis;
  corpus: Record<string, Record<string, string>>; index(key: string): Promise<string>;
  analyze(key: string, buildId?: string): Promise<string>; restart(): Promise<void>; close(): Promise<void>;
  counters(): { gitCalls: number; writeCalls: number; changedRows: number };
}
async function setup(t: TestContext, variant = 'small', limits: Partial<AnalysisLimits> = {}) {
  const state = await prepareConnectedCase(services, variant, limits) as State;
  t.after(() => state.close()); return state;
}
function available(value: CodePathsResponse): CodePathsAvailable { assert.equal(value.status, 'available'); assert.ok(value.status === 'available'); return value; }
function normalized(graph: CodePathGraph) {
  const keys = new Map(graph.nodes.map(node => [node.id, [node.sourceName, node.path, node.kind, node.label, node.startLine, node.endLine].join('\0')]));
  return { nodes: graph.nodes.map(({ id: _id, ...node }) => node), edges: graph.edges.map(({ id: _id, from, to, ...edge }) => ({ ...edge, from: keys.get(from), to: keys.get(to) })),
    flows: graph.flows.map(flow => ({ title: flow.title, nodes: flow.nodeIds.map(id => keys.get(id)), gaps: flow.gaps, evidenceIds: flow.evidenceIds })),
    evidence: graph.evidence, omissions: graph.omissions, declarationOmissions: graph.declarationOmissions };
}
const pinned = (value: CodePathsAvailable) => ({ buildId: value.identity.buildId, inventoryId: value.identity.inventoryId, generationId: value.generationId });
async function commitSources(s: State, files: Record<string, Record<string, string>>) {
  for (const [source, entries] of Object.entries(files)) {
    for (const [file, text] of Object.entries(entries)) await writeFile(path.join(s.root, 'sources', source, file), text);
    connectedGit(s.root, source, ['add', '--all']); connectedGit(s.root, source, ['commit', '-qm', 'Add owned connected-path regression input']);
  }
  s.buildId = await s.index('changed'); await s.analyze('changed', s.buildId);
}

test('path query parsing accepts identities only and requires pinned aligned pages', () => {
  const buildId = '00000000-0000-0000-0000-000000000001', inventoryId = '00000000-0000-0000-0000-000000000002', generationId = 'a'.repeat(64);
  assert.deepEqual(pathRequest(new URLSearchParams({ buildId }), 'paths'), { buildId });
  assert.deepEqual(pathRequest(new URLSearchParams({ buildId, inventoryId, generationId, offset: '4' }), 'roots'), { buildId, inventoryId, generationId, offset: 4 });
  for (const query of ['', `buildId=${buildId}&buildId=${buildId}`, `buildId=${buildId}&limits=1`, `buildId=${buildId}&inventoryId=${inventoryId}`,
    `buildId=${buildId}&rootId=${generationId}`, `buildId=${buildId}&offset=0`, 'buildId=' + 'x'.repeat(1200), `buildId=${buildId}&generationId=`])
    assert.throws(() => pathRequest(new URLSearchParams(query), 'paths'), CatalogError);
  for (const offset of ['', '-1', '1', '04', '4.0', '1e2', '12004']) assert.throws(() => pathRequest(new URLSearchParams({ buildId, inventoryId, generationId, offset }), 'roots'), CatalogError);
  assert.throws(() => pathRequest(new URLSearchParams({ buildId, inventoryId, generationId }), 'roots'), CatalogError);
});

test('typed saved-tree proof preserves independent SHA-256 byte ordering and opaque modes', async t => {
  const s = await setup(t), inventoryId = await s.analyze('facts'), directory = path.join(s.root, 'independent-tree');
  await mkdir(directory); await mkdir(path.join(directory, 'constructor')); await mkdir(path.join(directory, 'file'));
  await writeFile(path.join(directory, 'constructor', 'é.txt'), 'owned Unicode leaf\n');
  await writeFile(path.join(directory, 'file.c'), 'owned regular leaf\n');
  await writeFile(path.join(directory, 'file', 'run'), 'owned executable leaf\n'); await chmod(path.join(directory, 'file', 'run'), 0o755);
  await symlink('constructor/é.txt', path.join(directory, 'link'));
  const git = (args: string[]) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', ...args], {
    cwd: directory, encoding: 'utf8', env: { PATH: process.env.PATH!, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }, timeout: 10000,
  });
  git(['init', '-q', '--object-format=sha256', '--initial-branch=main', '--template=']); git(['add', '--all']);
  const tree = git(['write-tree']).trim(), entries = git(['ls-tree', '-rz', tree]).split('\0').filter(Boolean).map(row => {
    const [meta, file] = row.split('\t'), [mode, , blob] = meta!.split(' '); return { path: file!, mode: mode!, blob: blob! };
  });
  const work = new PathWork(s.analysis, s.analysis.snapshot(inventoryId), { ...codePathLimits }, { signal: new AbortController().signal }, performance.now());
  assert.equal(tree.length, 64); assert.equal(await verifySavedTree(entries, tree, work), tree);
  await assert.rejects(verifySavedTree(entries.slice(1), tree, work), { code: 'CORRUPT_PATH_TREE' });
});

for (const variant of ['small', 'ambiguity', 'truncated', 'topic', 'long-chain']) test(`typed paths preserve qualified ${variant} semantics and legacy derivations`, async t => {
  const s = await setup(t, variant); await s.analyze('facts'); const legacy = codeFlows(s.catalog, s.buildId), before = s.counters();
  const reference = await bindingProjection(services, s.analysis, s.buildId); assert.equal(reference.status, 'available');
  const service = new CodePaths(s.analysis), value = available(await service.read({ buildId: s.buildId }));
  assert.ok(value.graph); assert.deepEqual(normalized(value.graph), normalized(reference.graph));
  assert.equal(value.coverage.incompleteBindings, reference.resolution.resolutions.filter((item: { incomplete: boolean }) => item.incomplete).length);
  assert.equal(value.coverage.resolution.alternativeReferences, reference.resolution.coverage.alternativeReferences);
  assert.deepEqual(value.coverage.omissions, reference.resolution.omissions);
  assert.deepEqual(available(await service.read({ buildId: s.buildId })), value);
  assert.deepEqual(codeFlows(s.catalog, s.buildId), legacy); assert.deepEqual(s.counters(), before);
  assert.ok(!('resolution' in value) && !('payloads' in value) && !('units' in value));
  for (const ref of Object.values({ ...value.graph.evidence, ...value.roots.evidence })) {
    const original = s.catalog.evidence(ref.id);
    assert.equal(original.buildId, s.buildId); assert.equal(original.path, ref.path); assert.equal(original.revision, ref.revision);
    assert.equal(original.startLine, ref.startLine); assert.equal(original.endLine, ref.endLine);
  }
  assert.ok(Buffer.byteLength(JSON.stringify(value)) <= 512 * 1024);
});

test('unrelated profile gaps leave useful paths available while metadata bounds stay explicit', async t => {
  const s = await setup(t);
  await commitSources(s, Object.fromEntries(['console', 'parcel-api', 'parcel-worker'].map(source => [source, { 'unrelated.ts': 'export const marker = "not a binding target";\n' }])));
  const result = available(await new CodePaths(s.analysis).read({ buildId: s.buildId }));
  assert.equal(result.graph!.flows.length, 2); assert.equal(result.coverage.incompleteBindings, 0);
  assert.ok(result.coverage.sources.every(source => source.treeVerified && source.filesWithGaps > 0));
  for (const flow of result.graph!.flows) assert.equal(result.graph!.nodes.find(node => node.id === flow.nodeIds.at(-1))!.kind, 'document-write');
  for (const limits of [{ metadataEntries: 0 }, { metadataBytes: 1 }, { facts: 0 }, { work: 0 }, { wallMs: 0 }, { outputBytes: 1 }])
    await assert.rejects(new CodePaths(s.analysis, { limits }).read({ buildId: s.buildId }), CatalogError);
});

test('four-root pages preserve isolated and unavailable entries with generation-bound selection', async t => {
  const s = await setup(t, 'roots'), action = s.corpus.console!['src/Dispatch.vue']!;
  const files: Record<string, string> = {};
  for (let i = 0; i < 3; i++) files[`src/Extra${i}.vue`] = action.replace('const send =', `const extra${i} =`).replace('@click="send"', `@click="extra${i}"`);
  files['src/ZIsolated.vue'] = '<script setup lang="ts">\nimport { absent } from "./missing";\nconst isolated = () => absent();\n</script>\n<template><button @click="isolated">Inspect</button></template>\n';
  files['src/TooLong.ts'] = `export function ${'entry'.repeat(105)}() { return fetch('/unbound', { method: 'POST' }); }\n`;
  await commitSources(s, { console: files }); const service = new CodePaths(s.analysis);
  const first = available(await service.read({ buildId: s.buildId }));
  assert.equal(first.roots.total, 9); assert.equal(first.roots.items.length, 4); assert.equal(first.roots.next, 4);
  const page = available(await service.read({ ...pinned(first), offset: 4 }, 'roots'));
  assert.equal(page.graph, null); assert.equal(page.roots.previous, 0); assert.equal(page.roots.next, 8);
  const isolated = page.roots.items.find(item => item.status === 'available' && item.label === 'isolated'); assert.ok(isolated);
  const selected = available(await service.read({ ...pinned(first), rootId: isolated.id }));
  assert.equal(selected.graph!.nodes.length, 1); assert.equal(selected.graph!.nodes[0]!.id, isolated.id); assert.equal(selected.graph!.edges.length, 0);
  assert.equal(selected.generationId, first.generationId); assert.notEqual(selected.projectionId, first.projectionId);
  const last = available(await service.read({ ...pinned(first), offset: 8 }, 'roots'));
  assert.equal(last.roots.items.length, 1); assert.equal(last.roots.unavailableEntries, 1); assert.equal(last.roots.items[0]!.status, 'unavailable');
  assert.deepEqual(last.roots.evidence, {}); assert.equal(last.roots.next, null);
  for (const input of [{ ...pinned(first), offset: 12 }, { ...pinned(first), offset: 0, generationId: 'b'.repeat(64) }])
    await assert.rejects(service.read(input, 'roots'), CatalogError);
  await assert.rejects(service.read({ ...pinned(first), rootId: 'b'.repeat(64) }), { code: 'INVALID_ROOT' });
  assert.deepEqual(available(await service.read({ buildId: s.buildId })), first);
});

test('missing, unpublished and evicted inventories never trigger analysis or substitute a generation', async t => {
  const s = await setup(t), service = new CodePaths(s.analysis), before = s.counters();
  assert.equal((await service.read({ buildId: s.buildId })).status, 'unavailable'); assert.deepEqual(s.counters(), before);
  const old = await s.analyze('old'), initial = available(await service.read({ buildId: s.buildId }));
  const pending = s.analysis.start('pending', s.buildId); s.analysis.control(pending.id, 'pause'); await s.analysis.idle();
  assert.equal(s.analysis.get(pending.id).published, false);
  assert.equal(available(await service.read({ buildId: s.buildId })).identity.inventoryId, old);
  s.analysis.control(pending.id, 'cancel'); await s.analyze('replacement');
  const current = available(await service.read({ buildId: s.buildId })); assert.notEqual(current.generationId, initial.generationId);
  await s.analyze('eviction');
  const missing = await service.read(pinned(initial)); assert.equal(missing.status, 'unavailable'); assert.ok(!('graph' in missing));
});

test('busy, cancellation and shutdown release request ownership', async t => {
  const s = await setup(t); await s.analyze('facts'); let enter!: () => void, release!: () => void;
  const reached = new Promise<void>(resolve => { enter = resolve; }), gate = new Promise<void>(resolve => { release = resolve; }); let held = false;
  const service = new CodePaths(s.analysis, { checkpoint: async () => { if (!held) { held = true; enter(); await gate; } } });
  const controller = new AbortController(), first = service.read({ buildId: s.buildId }, 'paths', controller.signal);
  await reached; await assert.rejects(new CodePaths(s.analysis).read({ buildId: s.buildId }), { code: 'PATHS_BUSY' });
  controller.abort(); const rejected = assert.rejects(first, { code: 'CANCELLED' }); release(); await rejected;
  available(await new CodePaths(s.analysis).read({ buildId: s.buildId }));
  let stopping: Promise<void> | undefined;
  const stopped = new CodePaths(s.analysis, { checkpoint: () => { stopping ??= stopped.stop(); } });
  await assert.rejects(stopped.read({ buildId: s.buildId }), { code: 'CANCELLED' }); await stopping;
  await assert.rejects(stopped.read({ buildId: s.buildId }), { code: 'SERVICE_STOPPED' });
  available(await new CodePaths(s.analysis).read({ buildId: s.buildId }));
});

test('concurrent writes discard only the pending response and allow a stable explicit retry', async t => {
  const s = await setup(t); const inventoryId = await s.analyze('facts'); let changed = false;
  const service = new CodePaths(s.analysis, { checkpoint: async ({ stage }) => {
    if (stage === 'admit' && !changed) {
      changed = true; const pending = s.analysis.start('concurrent', s.buildId); s.analysis.control(pending.id, 'pause'); await s.analysis.idle();
    }
  } });
  await assert.rejects(service.read({ buildId: s.buildId }), { code: 'METADATA_CHANGED' });
  assert.equal(s.analysis.get(inventoryId).published, true);
  assert.equal(available(await service.read({ buildId: s.buildId })).identity.inventoryId, inventoryId);
});

test('typed reads reject excluded-row corruption and scope changes before publication', async t => {
  const s = await setup(t); s.catalog.updatePolicy(['README.md']); s.buildId = await s.index('excluded'); await s.analyze('excluded', s.buildId);
  const file = s.store.one<{ id: string }>("SELECT id FROM files WHERE buildId=? AND path='README.md' LIMIT 1", s.buildId)!;
  s.store.db.exec('SAVEPOINT owned_corruption'); s.store.run('DELETE FROM files WHERE id=?', file.id);
  await assert.rejects(new CodePaths(s.analysis).read({ buildId: s.buildId }), { code: 'CORRUPT_PATH_TREE' });
  s.store.db.exec('ROLLBACK TO owned_corruption; RELEASE owned_corruption');
  const service = new CodePaths(s.analysis, { checkpoint: ({ stage }) => { if (stage === 'resolve') s.catalog.updatePolicy(['changed']); } });
  await assert.rejects(service.read({ buildId: s.buildId }), { code: 'ANALYSIS_FENCED' });
});

test('original, fact and manifest corruption discard the entire typed response', async t => {
  const s = await setup(t); const inventoryId = await s.analyze('facts');
  const file = s.store.one<{ id: string }>("SELECT id FROM files WHERE buildId=? AND path='src/parcels.ts'", s.buildId)!;
  for (const mutate of [
    () => s.store.run('UPDATE files SET raw=? WHERE id=?', Buffer.from('changed original'), file.id),
    () => s.store.run("UPDATE code_analysis_files SET payload='{}' WHERE runId=? AND fileId=?", inventoryId, file.id),
    () => s.store.run('DELETE FROM code_analysis_files WHERE runId=? AND fileId=?', inventoryId, file.id),
  ]) {
    s.store.db.exec('SAVEPOINT owned_corruption');
    try { mutate(); await assert.rejects(new CodePaths(s.analysis).read({ buildId: s.buildId }), CatalogError); }
    finally { s.store.db.exec('ROLLBACK TO owned_corruption; RELEASE owned_corruption'); }
  }
  available(await new CodePaths(s.analysis).read({ buildId: s.buildId }));
});

test('abort at every read stage and inventory eviction leave no retained request owner', async t => {
  const s = await setup(t); await s.analyze('facts');
  for (const stage of ['metadata', 'read', 'resolve', 'admit']) {
    const controller = new AbortController(); let reached = false;
    const service = new CodePaths(s.analysis, { checkpoint: info => { if (info.stage === stage) { reached = true; controller.abort(); } } });
    await assert.rejects(service.read({ buildId: s.buildId }, 'paths', controller.signal), { code: 'CANCELLED' }); assert.equal(reached, true);
  }
  let evicted = false;
  const service = new CodePaths(s.analysis, { checkpoint: async ({ stage }) => {
    if (stage === 'admit' && !evicted) { evicted = true; await s.analyze('replacement'); await s.analyze('evict'); }
  } });
  await assert.rejects(service.read({ buildId: s.buildId }), { code: 'ANALYSIS_FENCED' });
  available(await new CodePaths(s.analysis).read({ buildId: s.buildId }));
});

test('source revocation during root-page work fences the response', async t => {
  const s = await setup(t); await s.analyze('facts'); const first = available(await new CodePaths(s.analysis).read({ buildId: s.buildId }));
  let changed = false;
  const service = new CodePaths(s.analysis, { checkpoint: ({ stage }) => {
    if (stage === 'admit' && !changed) { changed = true; s.catalog.revoke(s.catalog.state().sources[0]!.id); }
  } });
  await assert.rejects(service.read({ ...pinned(first), offset: 0 }, 'roots'), { code: 'ANALYSIS_FENCED' });
  assert.equal(changed, true);
});

test('a supported-root catalog can be empty without claiming no runtime behavior', async t => {
  const s = await setup(t), files: Record<string, Record<string, string>> = {};
  for (const [source, entries] of Object.entries(s.corpus)) {
    files[source] = {};
    for (const file of Object.keys(entries)) if (/\.(ts|js|vue|java)$/.test(file)) files[source]![file] = file.endsWith('.java')
      ? 'public @interface Unknown {}\n' : file.endsWith('.vue') ? '<template><p>No supported action</p></template>\n' : 'export const label = "no supported function";\n';
  }
  await commitSources(s, files); const service = new CodePaths(s.analysis), value = available(await service.read({ buildId: s.buildId }));
  assert.equal(value.roots.total, 0); assert.deepEqual(value.graph!.flows, []); assert.equal(value.partial, true); assert.equal(value.deploymentCoherence, 'unknown');
  const page = available(await service.read({ ...pinned(value), offset: 0 }, 'roots'));
  assert.deepEqual(page.roots.items, []); assert.equal(page.roots.previous, null); assert.equal(page.roots.next, null);
});

test('historical paths and generation identities survive restart without read-side writes', async t => {
  const s = await setup(t); await s.analyze('first'); const first = available(await new CodePaths(s.analysis).read({ buildId: s.buildId }));
  await s.restart(); assert.deepEqual(available(await new CodePaths(s.analysis).read({ buildId: s.buildId })), first);
  const later = await s.index('later'); await s.analyze('later', later);
  const service = new CodePaths(s.analysis), historical = available(await service.read({ buildId: s.buildId }));
  assert.equal(historical.graph!.stale, true); assert.deepEqual(normalized(historical.graph!), normalized(first.graph!));
  assert.notEqual(historical.generationId, first.generationId);
  await assert.rejects(service.read(pinned(first)), { code: 'INVALID_GENERATION' });
  const before = s.counters(); assert.deepEqual(available(await service.read(pinned(historical))), historical); assert.deepEqual(s.counters(), before);
});

test('protected path endpoints reject malformed inputs before scanning and return only bounded envelopes', async t => {
  const s = await setup(t), app = createApp(s.catalog, { codeAnalysis: s.analysis }), base = 'http://127.0.0.1:4244';
  const raw = (route: string, init: RequestInit = {}) => app.request(base + '/api' + route, { ...init, headers: { host: '127.0.0.1:4244', ...init.headers } });
  assert.equal((await raw('/code-paths')).status, 401); assert.equal((await raw('/code-paths/roots')).status, 401);
  assert.equal((await raw('/code-paths', { headers: { host: 'evil.invalid' } })).status, 403);
  assert.equal((await raw('/code-paths', { headers: { origin: 'https://evil.invalid' } })).status, 403);
  const session = await raw('/session', { method: 'POST', headers: { origin: base, 'x-loredock-client': 'web' } });
  const cookie = session.headers.get('set-cookie')!.split(';')[0]!;
  const request = (route: string) => raw(route, { headers: { cookie, origin: base } });
  let snapshots = 0; const snapshot = s.analysis.snapshot.bind(s.analysis);
  s.analysis.snapshot = id => { snapshots++; return snapshot(id); };
  for (const query of ['', `?buildId=${s.buildId}&buildId=${s.buildId}`, `?buildId=${s.buildId}&budget=100`, `?buildId=${s.buildId}&rootId=${'a'.repeat(64)}`,
    `?buildId=${s.buildId}&offset=0`, '?buildId=' + 'x'.repeat(2000)]) {
    const response = await request('/code-paths' + query); assert.equal(response.status, 400); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Object.keys(await response.json() as object), ['error']);
  }
  assert.equal(snapshots, 0);
  const missing = await request(`/code-paths?buildId=${s.buildId}`); assert.equal(missing.status, 200); assert.equal((await missing.json() as CodePathsResponse).status, 'unavailable');
  await s.analyze('facts'); const before = s.counters();
  const response = await request(`/code-paths?buildId=${s.buildId}`), value = available(await response.json() as CodePathsResponse);
  assert.equal(response.status, 200); assert.ok(value.graph); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(s.counters(), before); assert.ok(Buffer.byteLength(JSON.stringify(value)) <= 512 * 1024);
  const query = new URLSearchParams({ ...pinned(value), offset: '0' });
  const page = await request('/code-paths/roots?' + query); assert.equal(page.status, 200); assert.equal(available(await page.json() as CodePathsResponse).graph, null);
  query.set('offset', '1'); assert.equal((await request('/code-paths/roots?' + query)).status, 400);
  query.set('offset', '4'); assert.equal((await request('/code-paths/roots?' + query)).status, 400);
  const foreign = new URLSearchParams({ ...pinned(value), rootId: 'b'.repeat(64) }); assert.equal((await request('/code-paths?' + foreign)).status, 400);
  s.store.run("UPDATE code_analyses SET fingerprint='incompatible' WHERE id=?", value.identity.inventoryId);
  const incompatible = await request(`/code-paths?buildId=${s.buildId}`); assert.equal((await incompatible.json() as CodePathsResponse).status, 'unavailable');
});

test('HTTP cancellation releases a busy read and leaves lightweight routes responsive', async t => {
  const s = await setup(t); await s.analyze('facts'); let enter!: () => void, release!: () => void, held = false;
  const reached = new Promise<void>(resolve => { enter = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  const paths = new CodePaths(s.analysis, { checkpoint: async () => { if (!held) { held = true; enter(); await gate; } } });
  const app = createApp(s.catalog, { codeAnalysis: s.analysis, codePaths: paths }), base = 'http://127.0.0.1:4244';
  const session = await app.request(base + '/api/session', { method: 'POST', headers: { host: '127.0.0.1:4244', origin: base, 'x-loredock-client': 'web' } });
  const headers = { host: '127.0.0.1:4244', cookie: session.headers.get('set-cookie')!.split(';')[0]! }, url = base + `/api/code-paths?buildId=${s.buildId}`;
  const controller = new AbortController(), response = app.request(url, { headers, signal: controller.signal }); await reached;
  assert.equal((await app.request(base + '/api/health', { headers })).status, 200);
  const busy = await app.request(url, { headers }); assert.equal(busy.status, 409); assert.deepEqual(await busy.json(), { error: { code: 'PATHS_BUSY', message: 'Another connected path read is running. Retry when it finishes.' } });
  controller.abort(); release(); const cancelled = await response; assert.equal(cancelled.status, 409);
  assert.equal((await cancelled.json() as { error: { code: string } }).error.code, 'CANCELLED');
  assert.equal((await app.request(url, { headers })).status, 200);
});

test('a closed TCP request aborts connected work through the Node adapter', { timeout: 15000 }, async t => {
  const s = await prepareConnectedCase(services) as State;
  let server: ReturnType<typeof serve> | undefined, paths: CodePaths | undefined, release = () => {};
  t.after(async () => {
    release(); await paths?.stop(); if (server && 'closeAllConnections' in server) server.closeAllConnections();
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    await s.close();
  });
  await s.analyze('facts'); let enter!: () => void, held = false, serverSignal: AbortSignal | undefined, report!: (code: string) => void;
  const reached = new Promise<void>(resolve => { enter = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  const observed = new Promise<string>(resolve => { report = resolve; });
  paths = new CodePaths(s.analysis, { checkpoint: async () => { if (!held) { held = true; enter(); await gate; } } });
  const read = paths.read.bind(paths);
  paths.read = (input, kind, signal) => {
    serverSignal ??= signal;
    return read(input, kind, signal).catch(error => { report(error instanceof CatalogError ? error.code : 'UNEXPECTED'); throw error; });
  };
  const app = createApp(s.catalog, { codeAnalysis: s.analysis, codePaths: paths });
  server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address === 'object'); const base = `http://127.0.0.1:${address.port}`;
  // Native HTTP preserves the allowed Host while this owned listener uses an ephemeral port.
  const request = (route: string, headers: Record<string, string>, method = 'GET', signal?: AbortSignal) =>
    new Promise<{ status: number; headers: IncomingHttpHeaders; body: string }>((resolve, reject) => {
      const req = httpRequest(base + route, { headers, method, ...signal ? { signal } : {} }, response => {
        let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; });
        response.on('end', () => resolve({ status: response.statusCode!, headers: response.headers, body })); response.on('error', reject);
      }); req.on('error', reject); req.end();
    });
  const session = await request('/api/session', { host: '127.0.0.1:4244', origin: 'http://127.0.0.1:4244', 'x-loredock-client': 'web' }, 'POST');
  assert.equal(session.status, 200);
  const headers = { host: '127.0.0.1:4244', cookie: session.headers['set-cookie']![0]!.split(';')[0]! }, controller = new AbortController();
  const response = request(`/api/code-paths?buildId=${s.buildId}`, headers, 'GET', controller.signal); await reached;
  assert.ok(serverSignal); const aborted = serverSignal.aborted ? Promise.resolve() : once(serverSignal, 'abort');
  const rejected = assert.rejects(response, { name: 'AbortError' }); controller.abort(); await rejected; await aborted; release();
  assert.equal(await observed, 'CANCELLED');
  const retry = await request(`/api/code-paths?buildId=${s.buildId}`, headers);
  assert.equal(retry.status, 200); available(JSON.parse(retry.body) as CodePathsResponse);
});
