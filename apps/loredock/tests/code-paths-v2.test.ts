import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { SourceGit } from '../src/git.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { CodePaths } from '../src/code-paths.js';
import { CodePathsV2 } from '../src/code-paths-v2.js';
import { OperationBudget } from '../src/operation-budget.js';
import { literalTopic, topicRule } from '../src/literal-topic.js';
import { codePathLimits, PathWork } from '../src/code-paths-work.js';
import { bindingMetadata, bindingDomains, assertBindingMetadata } from '../src/code-paths-metadata.js';
import { declarationMap } from '../src/system-map.js';
import { compareHeaders } from '../src/http-headers.js';
import { sha256 } from '../src/extract.js';
import { CatalogError } from '../src/types.js';
import type { CodePathRequest } from '../src/code-paths-types.js';
import type { CodePathsAvailableV2, CodePathsResponseV2 } from '../src/code-paths-v2-types.js';
import { corpusFactory } from './fixtures/memory-runner-config.js';
// @ts-expect-error Unchanged qualified offline producer; no frozen corpus execution.
import { createCanonicalPaths } from '../../../scripts/loredock-canonical-facts/paths.mjs';
// @ts-expect-error Independent tiny owned input and lifecycle helper.
import { receiptFixture } from '../../../scripts/loredock-capture-scale/fixture.mjs';
// @ts-expect-error Unchanged independent direct-literal control.
import { literalTopic as referenceLiteral } from '../../../scripts/loredock-literal-topics/topic.mjs';
// @ts-expect-error Independent operation capability for the offline control only.
import { CaptureBudget } from '../../../scripts/loredock-capture-scale/budget.mjs';

interface State {
  root: string; buildId: string; store: CatalogStore; catalog: Catalog; analysis: CodeAnalysis; paths: CodePathsV2;
  counters(): { gitCalls: number; writeCalls: number; changedRows: number; factReads: number; snapshots: number; pathReads: number };
  write(source: string, file: string, text: string): Promise<void>; commit(source: string): string;
  index(key: string): Promise<string>; analyze(key?: string, buildId?: string): Promise<string>;
  restart(): Promise<void>; close(): Promise<void>;
}
const ReferencePaths = createCanonicalPaths({ codePathLimits, PathWork, bindingMetadata, bindingDomains,
  assertBindingMetadata, declarationMap, compareHeaders, sha256, CatalogError });
const services = { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths: CodePathsV2 };
const available = (value: CodePathsResponseV2) => { assert.ok(value.status === 'available'); return value; };
const pinned = (value: CodePathsAvailableV2) => ({ buildId: value.identity.buildId, inventoryId: value.identity.inventoryId, generationId: value.generationId });
async function setup(t: TestContext, transform?: (corpus: ReturnType<typeof corpusFactory>) => void) {
  const folder = await mkdtemp(path.join(tmpdir(), 'native-v2-')), corpus = corpusFactory();
  corpus['a-locker-client']!['markers/one.ts'] = 'export const marker = "native v2 fact-free source";\n';
  corpus['a-locker-client']!['markers/two.ts'] = corpus['a-locker-client']!['markers/one.ts']!;
  transform?.(corpus);
  const s = await receiptFixture(folder, corpus, services) as State;
  t.after(async () => { await s.close(); await rm(folder, { recursive: true, force: true }); });
  await s.analyze(); return s;
}

// Only declared version-derived identifiers are normalized. All semantic content,
// original evidence, source identities, coverage, omissions and topic witnesses remain.
function normalized(value: CodePathsAvailableV2) {
  const ids = new Map<string, string>([[value.generationId, '<generation>'], [value.projectionId, '<projection>']]);
  const key = (source: string, file: string, kind: string, label: string, start: number, end: number) => JSON.stringify([source, file, kind, label, start, end]);
  for (const node of value.graph?.nodes ?? []) ids.set(node.id, key(node.sourceName, node.path, node.kind, node.label, node.startLine, node.endLine));
  for (const root of value.roots.items) { assert.ok(root.status === 'available'); ids.set(root.id, key(root.sourceName, root.path, 'symbol', root.label, root.startLine, root.endLine)); }
  for (const edge of value.graph?.edges ?? []) ids.set(edge.id, JSON.stringify([edge.kind, ids.get(edge.from), ids.get(edge.to), edge.environment]));
  for (const flow of value.graph?.flows ?? []) ids.set(flow.id, JSON.stringify([flow.title, flow.nodeIds.map(id => ids.get(id)), flow.edgeIds.map(id => ids.get(id))]));
  if (value.graph) ids.set(value.graph.inputHash, '<graph>');
  const result = JSON.parse(JSON.stringify(value, (_key, v: unknown) => typeof v === 'string' ? ids.get(v) ?? v : v)) as CodePathsAvailableV2;
  return { ...result, schemaVersion: '<envelope-version>', identity: { ...result.identity, adapter: '<adapter>' },
    graph: result.graph ? { ...result.graph, schemaVersion: '<display-version>', adapterVersion: '<adapter>' } : null };
}
function nativeHashes(value: CodePathsAvailableV2) {
  assert.equal(value.schemaVersion, 'loredock-code-paths/2'); assert.equal(value.identity.adapter, 'connected-paths-v2');
  assert.equal(value.generationId, sha256(JSON.stringify(value.identity)));
  const { projectionId, ...content } = value; assert.equal(projectionId, sha256(JSON.stringify(content)));
  if (!value.graph) return;
  const { inputHash, ...graph } = value.graph; assert.equal(inputHash, sha256(JSON.stringify(graph)));
  assert.equal(graph.schemaVersion, 'loredock-connected-display/2'); assert.equal(graph.adapterVersion, 'connected-paths-v2');
  assert.equal(new Set(graph.nodes.map(node => node.id)).size, graph.nodes.length);
  for (const edge of graph.edges) assert.equal(edge.id, sha256(JSON.stringify([value.generationId, 'connected-paths-v2', 'edge', edge.kind, edge.from, edge.to, edge.environment])));
  for (const flow of graph.flows) assert.equal(flow.id, sha256(JSON.stringify([value.identity.buildId, 'connected-paths-v2', flow.nodeIds[0], flow.edgeIds])));
}

test('typed literals preserve exact independent syntax and UTF-8 boundaries', () => {
  const values: unknown[] = [undefined, null, 4, {}, '""', '"topic"', ' "topic"', '"topic"\n', '"a\\nb"', '"a\nb"', '"a\rb"', 'topic', "'topic'", '"a" + "b"', '"a\\u0062"', '"a"suffix',
    '"' + 'x'.repeat(256) + '"', '"' + 'x'.repeat(257) + '"', '"' + '雪'.repeat(85) + 'x"', '"' + '雪'.repeat(85) + 'xx"'];
  for (const value of values) assert.equal(literalTopic(value), referenceLiteral(value));
  assert.equal(literalTopic('"' + '雪'.repeat(85) + 'x"')?.length, 86);
  assert.equal(literalTopic('"' + '雪'.repeat(85) + 'xx"'), null); assert.ok(Object.isFrozen(topicRule));
});

test('native v2 matches qualified semantic output, originals, full scan and every work charge across selections', async t => {
  const s = await setup(t), reference = new ReferencePaths(s.analysis), firstReads: string[] = [], file = s.analysis.file.bind(s.analysis);
  t.after(() => reference.stop()); s.analysis.file = (id, fileId) => { firstReads.push(fileId); return file(id, fileId); };
  const compare = async (request: CodePathRequest, referenceRequest = request, kind: 'paths' | 'roots' = 'paths') => {
    const results = [], before = s.counters();
    for (const [paths, input, Budget] of [[reference, referenceRequest, CaptureBudget], [s.paths, request, OperationBudget]] as const) {
      const charges: unknown[] = [], budget = new Budget({ observe: (charge: unknown) => { charges.push(charge); } }); firstReads.length = 0;
      try {
        const value = available(await paths.read(input, kind, undefined, budget));
        results.push({ value, semantic: normalized(value), files: [...firstReads], charges, work: budget.stats().pathWork });
      } finally { budget.close(); }
    }
    const [old, next] = results; assert.ok(old && next);
    assert.deepEqual(next.semantic, old.semantic); assert.deepEqual(next.charges, old.charges); assert.deepEqual(next.files, old.files);
    assert.equal(next.files.length, s.analysis.snapshot(next.value.identity.inventoryId).fileIds.length); assert.equal(next.work, old.work); assert.ok(next.work > 0);
    for (const name of ['gitCalls', 'writeCalls', 'changedRows'] as const) assert.equal(s.counters()[name], before[name]);
    nativeHashes(next.value); assert.notEqual(next.value.generationId, old.value.generationId); return { old: old.value, next: next.value };
  };
  const first = await compare({ buildId: s.buildId });
  const witness = first.next.graph!.edges.find(edge => edge.kind === 'event-delivery')!.topicCheck!;
  assert.equal(witness.value, 'locker.reserved.v2');
  for (const endpoint of [witness.publisher, witness.subscriber]) assert.ok(endpoint.evidenceIds.some(id => s.catalog.evidence(id).text.includes(endpoint.expression)));
  const again = await compare({ buildId: s.buildId }); assert.deepEqual(again.next, first.next);
  await compare({ ...pinned(first.next), rootId: first.next.roots.items[0]!.id }, { ...pinned(first.old), rootId: first.old.roots.items[0]!.id });
  const page = await compare({ ...pinned(first.next), offset: 4 }, { ...pinned(first.old), offset: 4 }, 'roots');
  const isolated = await compare({ ...pinned(first.next), rootId: page.next.roots.items[0]!.id }, { ...pinned(first.old), rootId: page.old.roots.items[0]!.id });
  assert.equal(isolated.next.graph!.nodes.length, 1);
  await assert.rejects(s.paths.read(pinned(first.old)), { code: 'INVALID_GENERATION' });
  const v1 = new CodePaths(s.analysis), legacy = await v1.read({ buildId: s.buildId }); assert.ok(legacy.status === 'available');
  await assert.rejects(s.paths.read(pinned({ ...first.next, generationId: legacy.generationId })), { code: 'INVALID_GENERATION' });
  await assert.rejects(v1.read(pinned(first.next)), { code: 'INVALID_GENERATION' }); await v1.stop();
});

test('native v2 retains caller budget ownership, exact aggregate limits, cancellation and the original deadline', async t => {
  const s = await setup(t), budget = new OperationBudget();
  const value = available(await s.paths.read({ buildId: s.buildId }, 'paths', undefined, budget));
  const units = budget.stats().pathWork; assert.ok(units > 1); budget.charge('receipt', 3);
  assert.equal(budget.stats().totalWork, units + 3); assert.equal(budget.stats().receiptWork, 3);
  await assert.rejects(s.paths.read({ buildId: s.buildId }, 'paths', undefined, budget), { code: 'CAPTURE_BUDGET_OWNERSHIP' });
  budget.close(); const before = s.counters();
  await assert.rejects(s.paths.read({ buildId: s.buildId }, 'paths', undefined, budget), { code: 'CLOSED_CAPTURE_BUDGET' });
  await assert.rejects(s.paths.read({ buildId: s.buildId }, 'paths', undefined, new CaptureBudget()), { code: 'INVALID_CAPTURE_BUDGET' });
  assert.equal(s.counters().factReads, before.factReads); assert.equal(s.counters().snapshots, before.snapshots);
  const aggregate = new OperationBudget({ limits: { work: units } }); aggregate.charge('receipt', 1);
  try { await assert.rejects(s.paths.read({ buildId: s.buildId }, 'paths', undefined, aggregate), { code: 'CAPTURE_WORK_LIMIT' }); }
  finally { aggregate.close(); }
  const exact = new OperationBudget({ limits: { work: units } });
  try { assert.deepEqual(await s.paths.read({ buildId: s.buildId }, 'paths', undefined, exact), value); assert.equal(exact.stats().totalWork, units); }
  finally { exact.close(); }
  let reached = false; const timed = new OperationBudget({ limits: { wallMs: 1000 } });
  const paths = new CodePathsV2(s.analysis, { checkpoint: async ({ stage }) => {
    if (stage === 'read' && !reached) { reached = true; await delay(Math.max(0, timed.deadline - performance.now()) + 5); }
  } });
  try { await assert.rejects(paths.read({ buildId: s.buildId }, 'paths', undefined, timed), { code: 'CAPTURE_TIME_LIMIT' }); assert.ok(reached); }
  finally { timed.close(); await paths.stop(); }
  const controller = new AbortController(); controller.abort();
  await assert.rejects(s.paths.read({ buildId: s.buildId }, 'paths', controller.signal), { code: 'CANCELLED' });
  const expected = new Error('Deliberate synchronous charge observer failure.');
  await assert.rejects(new CodePathsV2(s.analysis, { budget: { observe: () => { throw expected; } } }).read({ buildId: s.buildId }), error => error === expected);
  await assert.rejects(new CodePathsV2(s.analysis, { budget: { observe: () => Promise.resolve() } }).read({ buildId: s.buildId }), { code: 'INVALID_CAPTURE_OBSERVER' });
  assert.deepEqual(await s.paths.read({ buildId: s.buildId }), value);
});

test('v1 and v2 share catalog ownership in both directions and stop/cancel release it', async t => {
  const s = await setup(t);
  for (const [First, Second] of [[CodePaths, CodePathsV2], [CodePathsV2, CodePaths]] as const) {
    let enter!: () => void, release!: () => void, held = false;
    const reached = new Promise<void>(resolve => { enter = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
    const first = new First(s.analysis, { checkpoint: async () => { if (!held) { held = true; enter(); await gate; } } });
    const second = new Second(s.analysis), controller = new AbortController(), active = first.read({ buildId: s.buildId }, 'paths', controller.signal);
    await reached;
    try { await assert.rejects(second.read({ buildId: s.buildId }), { code: 'PATHS_BUSY' }); controller.abort(); }
    finally { release(); }
    await assert.rejects(active, { code: 'CANCELLED' }); assert.equal((await second.read({ buildId: s.buildId })).status, 'available');
    await first.stop(); await first.stop(); await second.stop();
    await assert.rejects(first.read({ buildId: s.buildId }), { code: 'SERVICE_STOPPED' });
  }
  let stopping: Promise<void> | undefined;
  const stopped = new CodePathsV2(s.analysis, { checkpoint: () => { stopping ??= stopped.stop(); } });
  await assert.rejects(stopped.read({ buildId: s.buildId }), { code: 'CANCELLED' }); await stopping;
  available(await s.paths.read({ buildId: s.buildId }));
});

test('native v2 keeps all original and metadata fences through nested reads, worker overlap and restart', async t => {
  const s = await setup(t), initial = available(await s.paths.read({ buildId: s.buildId }));
  const file = s.store.one<{ id: string; raw: Uint8Array }>("SELECT id,raw FROM files WHERE buildId=? AND path='markers/two.ts'", s.buildId)!;
  s.store.db.exec('SAVEPOINT native_corrupt');
  try {
    s.store.run('UPDATE files SET raw=? WHERE id=?', Buffer.alloc(file.raw.length, 120), file.id);
    await assert.rejects(s.paths.read({ ...pinned(initial), rootId: initial.roots.items[0]!.id }), { code: 'CORRUPT_EVIDENCE' });
  } finally { s.store.db.exec('ROLLBACK TO native_corrupt; RELEASE native_corrupt'); }
  assert.deepEqual(await s.store.withPreparedReads(() => s.paths.read({ buildId: s.buildId })), initial);
  let release!: () => void, enter!: () => void, held = false;
  const gate = new Promise<void>(resolve => { release = resolve; }), reached = new Promise<void>(resolve => { enter = resolve; });
  const scoped = s.store.withPreparedReads.bind(s.store);
  s.store.withPreparedReads = action => scoped(async () => { if (!held) { held = true; enter(); await gate; } return action(); });
  s.analysis.start('overlapping-worker', s.buildId); await reached;
  try { available(await s.paths.read({ buildId: s.buildId })); }
  finally { release(); s.store.withPreparedReads = scoped; }
  await s.analysis.idle();
  const fresh = available(await s.paths.read({ buildId: s.buildId }));
  let wrote = false;
  const external = new DatabaseSync(path.join(s.root, 'data/loredock.db'));
  const changed = new CodePathsV2(s.analysis, { checkpoint: ({ stage }) => { if (stage === 'admit' && !wrote) {
    wrote = true; const version = s.store.one<{ data_version: number }>('PRAGMA data_version')!.data_version;
    external.prepare('UPDATE builds SET reason=? WHERE id=?').run('Independent committed metadata change.', s.buildId);
    assert.notEqual(s.store.one<{ data_version: number }>('PRAGMA data_version')!.data_version, version);
  } } });
  try { await assert.rejects(changed.read({ buildId: s.buildId }), { code: 'METADATA_CHANGED' }); assert.ok(wrote); }
  finally { external.close(); await changed.stop(); }
  assert.deepEqual(await s.paths.read({ buildId: s.buildId }), fresh);
  for (const stage of ['metadata', 'read', 'resolve', 'admit']) {
    const controller = new AbortController(); let seen = false;
    const paths = new CodePathsV2(s.analysis, { checkpoint: info => { if (info.stage === stage) { seen = true; controller.abort(); } } });
    await assert.rejects(paths.read({ buildId: s.buildId }, 'paths', controller.signal), { code: 'CANCELLED' }); assert.ok(seen); await paths.stop();
  }
  await s.restart(); assert.deepEqual(await s.paths.read({ buildId: s.buildId }), fresh);
  let evicted = false;
  const replacing = new CodePathsV2(s.analysis, { checkpoint: async ({ stage }) => { if (stage === 'admit' && !evicted) {
    evicted = true; await s.analyze('replace'); await s.analyze('evict');
  } } });
  await assert.rejects(replacing.read(pinned(fresh)), { code: 'ANALYSIS_FENCED' }); await replacing.stop();
  assert.equal((await s.paths.read(pinned(fresh))).status, 'unavailable');
  const revoked = new CodePathsV2(s.analysis, { checkpoint: ({ stage }) => { if (stage === 'resolve') s.catalog.revoke(s.catalog.state().sources[0]!.id); } });
  await assert.rejects(revoked.read({ buildId: s.buildId }), { code: 'ANALYSIS_FENCED' }); await revoked.stop();
});

test('a worker overlapping v2 uses fresh reads and policy changes fence an active candidate', async t => {
  const s = await setup(t); let release!: () => void, enter!: () => void, held = false;
  const gate = new Promise<void>(resolve => { release = resolve; }), reached = new Promise<void>(resolve => { enter = resolve; });
  const paths = new CodePathsV2(s.analysis, { checkpoint: async ({ stage }) => {
    if (stage === 'read' && !held) { held = true; enter(); await gate; }
  } });
  const active = paths.read({ buildId: s.buildId }); await reached;
  try {
    const run = s.analysis.start('worker-over-v2', s.buildId); await s.analysis.idle();
    assert.ok(s.analysis.get(run.id).published);
  } finally { release(); }
  await assert.rejects(active, { code: 'METADATA_CHANGED' }); await paths.stop();
  available(await s.paths.read({ buildId: s.buildId }));
  let changed = false;
  const policy = new CodePathsV2(s.analysis, { checkpoint: ({ stage }) => { if (stage === 'read' && !changed) {
    changed = true; s.catalog.updatePolicy(['excluded-after-start']);
  } } });
  await assert.rejects(policy.read({ buildId: s.buildId }), { code: 'ANALYSIS_FENCED' }); assert.ok(changed); await policy.stop();
  await assert.rejects(s.paths.read({ buildId: s.buildId }), { code: 'POLICY_CHANGED' });
});

for (const mode of ['different', 'dynamic', 'escaped', 'overlength', 'absent', 'ambiguous'] as const) test(`native v2 preserves conservative ${mode} topic/target behavior`, async t => {
  const s = await setup(t, corpus => {
    const api = corpus['b-locker-api']!, sink = corpus['c-locker-store']!;
    if (mode === 'different') sink['LockerWriter.java'] = sink['LockerWriter.java']!.replace('"locker.reserved.v2"', '"another.topic"');
    if (mode === 'dynamic') {
      api['Reservations.java'] = api['Reservations.java']!.replace('"locker.reserved.v2"', 'token');
      sink['LockerWriter.java'] = sink['LockerWriter.java']!.replace('"locker.reserved.v2"', 'group');
      for (const source of [api, sink]) source['config/topic.json'] = JSON.stringify({ environment: 'regression', orderTopic: 'locker.reserved.v2' });
    }
    if (mode === 'escaped' || mode === 'overlength' || mode === 'absent') {
      const expression = mode === 'escaped' ? '"locker\\u002ereserved.v2"' : mode === 'absent' ? '""' : '"' + 'x'.repeat(257) + '"';
      api['Reservations.java'] = api['Reservations.java']!.replace('"locker.reserved.v2"', expression);
      sink['LockerWriter.java'] = sink['LockerWriter.java']!.replace('"locker.reserved.v2"', expression);
    }
    if (mode === 'ambiguous') api['other/Reservations.java'] = 'class Reservations { void reserve(String token, String locker) {} }\n';
  });
  const reference = new ReferencePaths(s.analysis); t.after(() => reference.stop());
  const value = available(await s.paths.read({ buildId: s.buildId })), control = available(await reference.read({ buildId: s.buildId }));
  assert.deepEqual(normalized(value), normalized(control)); nativeHashes(value);
  assert.ok(!value.graph!.edges.some(edge => edge.kind === (mode === 'ambiguous' ? 'implements' : 'event-delivery')));
  if (mode === 'dynamic') { const legacy = await new CodePaths(s.analysis).read({ buildId: s.buildId }); assert.ok(legacy.status === 'available' && legacy.graph!.edges.some(edge => edge.kind === 'event-delivery')); }
});
