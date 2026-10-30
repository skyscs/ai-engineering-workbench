import assert from 'node:assert/strict';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { Corrections, correctionLimits } from '../src/corrections.js';
import { codeFlows } from '../src/code-flows.js';
import { declarationMap } from '../src/system-map.js';
import { createApp } from '../src/app.js';
import type { CorrectionInput } from '../src/correction-types.js';
// @ts-expect-error The fixture generator is intentionally independent plain JavaScript.
import { createLoreDockFixture, fixtureGit } from '../../../scripts/loredock-fixture.mjs';

async function setup(t: TestContext, extraClient = '') {
  const fixture = await createLoreDockFixture() as { root: string };
  if (extraClient) {
    await writeFile(path.join(fixture.root, 'sources/portal/extra.ts'), extraClient);
    fixtureGit(fixture.root, 'portal', ['add', 'extra.ts']); fixtureGit(fixture.root, 'portal', ['commit', '-qm', 'Add correction budget inputs']);
  }
  const directory = path.join(fixture.root, 'data'); let store = new CatalogStore(directory), catalog = new Catalog(store), corrections = new Corrections(catalog);
  t.after(async () => { await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  for (const repo of ['portal', 'order-api', 'order-worker']) await catalog.addSource(path.join(fixture.root, 'sources', repo));
  const index = async (key: string) => { const state = catalog.state(); catalog.start(key, state.sourceSetVersion, state.policyVersion); await catalog.idle(); };
  await index('first');
  return { fixture, index, get store() { return store; }, get catalog() { return catalog; }, get corrections() { return corrections; },
    restart: async () => { await catalog.stop(); store.close(); store = new CatalogStore(directory); catalog = new Catalog(store); corrections = new Corrections(catalog); } };
}
let request = 0;
function input(catalog: Catalog, corrections: Corrections, kind: CorrectionInput['targetKind'] = 'code-link'): CorrectionInput {
  const projection = kind === 'code-link' ? codeFlows(catalog) : declarationMap(catalog);
  const edge = projection.edges.find(edge => edge.kind === (kind === 'code-link' ? 'event-delivery' : 'contract-match'))!;
  const previous = corrections.list(projection.buildId).corrections.find(item => item.targetId === edge.id && item.targetKind === kind);
  return { requestId: `correction-${++request}`, buildId: projection.buildId, targetKind: kind, targetId: edge.id,
    projectionHash: projection.inputHash, expectedRevision: catalog.state().correctionRevision, expectedPreviousId: previous?.id ?? null,
    action: 'dispute', statement: 'The subscriber may use a different broker. Review deployment wiring before relying on this link.', environment: 'local' };
}

test('a human correction preserves source facts and marks both dependent flows for review', async t => {
  const { catalog, corrections } = await setup(t), before = codeFlows(catalog), originalMap = declarationMap(catalog);
  const saved = corrections.save(input(catalog, corrections));
  assert.equal(saved.provenance, 'human'); assert.equal(saved.verification, 'unverified'); assert.equal(saved.environment, 'local');
  assert.deepEqual(saved.affectedFlowIds, before.flows.map(flow => flow.id).sort());
  assert.equal(saved.version, 1); assert.equal(corrections.list().revision, 1); assert.equal(corrections.list().corrections[0]!.id, saved.id);
  assert.deepEqual(codeFlows(catalog), before); assert.deepEqual(declarationMap(catalog), originalMap);
  const history = corrections.history(saved.id);
  assert.equal(history.versions[0]!.original.status, 'candidate');
  assert.equal(history.versions[0]!.original.environment, 'local'); assert.ok(history.versions[0]!.original.evidenceIds.length);
  assert.equal(catalog.state().builds.length, 1, 'Saving must not start an index or AI work');
});

test('versions, exact replay, clarification and withdrawal remain append-only across restart', async t => {
  const state = await setup(t), firstInput = input(state.catalog, state.corrections), first = state.corrections.save(firstInput);
  assert.deepEqual(state.corrections.save(firstInput), first); assert.equal(state.catalog.state().correctionRevision, 1);
  assert.deepEqual(state.corrections.save(Object.fromEntries(Object.entries(firstInput).reverse())), first, 'JSON object order cannot change request identity');
  assert.throws(() => state.corrections.save({ ...firstInput, statement: 'Different replay content.' }), /different correction inputs/);
  const nextInput = { ...input(state.catalog, state.corrections), action: 'clarify' as const, statement: 'The engineer claims a production scope; source configuration remains local.', environment: 'production' };
  const next = state.corrections.save(nextInput); assert.equal(next.previousId, first.id); assert.equal(next.version, 2);
  assert.equal(state.corrections.history(next.id).versions[0]!.original.environment, 'local');
  assert.equal(next.environment, 'production', 'Human scope must stay separate from source scope');
  const withdrawn = state.corrections.save({ ...input(state.catalog, state.corrections), action: 'withdraw', statement: null, environment: null });
  assert.equal(withdrawn.version, 3); assert.equal(withdrawn.action, 'withdraw');
  const before = state.corrections.history(first.id); assert.deepEqual(before.versions.map(item => item.action), ['withdraw', 'clarify', 'dispute']);
  await state.restart(); assert.deepEqual(state.corrections.history(first.id), before);
  assert.equal(state.corrections.list().corrections.filter(item => item.action !== 'withdraw').length, 0);
  assert.equal(state.corrections.save(nextInput).id, next.id, 'A superseded request still replays its own immutable result');
  assert.throws(() => state.store.run('UPDATE corrections SET statement=? WHERE id=?', 'Overwritten history', first.id), /purge/);
  assert.throws(() => state.store.run('DELETE FROM corrections WHERE id=?', first.id), /history/);
  assert.throws(() => state.store.run('UPDATE corrections SET statement=NULL,environment=NULL,target=NULL,purged=1 WHERE id=?', first.id), /authorized content purge/);
});

test('compare-and-set rejects competing edits and stale map hashes without losing prior notes', async t => {
  const { catalog, corrections } = await setup(t), proposed = input(catalog, corrections), competing = { ...proposed, requestId: 'competing-edit' };
  const saved = corrections.save(proposed);
  assert.throws(() => corrections.save(competing), /correction changed/);
  const fresh = input(catalog, corrections);
  assert.throws(() => corrections.save({ ...fresh, expectedPreviousId: null }), /correction changed/);
  assert.throws(() => corrections.save({ ...fresh, projectionHash: '0'.repeat(64) }), /map changed/);
  assert.equal(corrections.list().corrections[0]!.id, saved.id); assert.equal(corrections.list().revision, 1);
});

test('declaration corrections conservatively invalidate flows using their original evidence', async t => {
  const { catalog, corrections } = await setup(t), first = corrections.save(input(catalog, corrections, 'declaration-link'));
  assert.equal(first.affectedFlowIds.length, 2);
  const history = corrections.history(first.id); assert.equal(history.versions[0]!.original.kind, 'contract-match');
  assert.equal(history.versions[0]!.original.schemaVersion, 'loredock-map-v1');
});

test('new indexes do not inherit old corrections and historical originals keep their review', async t => {
  const state = await setup(t), first = state.corrections.save(input(state.catalog, state.corrections));
  await state.index('second');
  assert.equal(state.corrections.list().corrections.length, 0);
  const historical = state.corrections.list(first.buildId);
  assert.equal(historical.stale, true); assert.equal(historical.corrections[0]!.id, first.id);
  const old = state.corrections.history(first.id).versions[0]!;
  for (const id of old.original.evidenceIds) assert.equal(state.catalog.evidence(id).buildId, first.buildId);
  const foreign = input(state.catalog, state.corrections);
  assert.throws(() => state.corrections.save({ ...foreign, targetId: first.targetId }), /issued code link/);
});

test('revocation fences history/replay immediately and pending purge clears every version after restart', async t => {
  const state = await setup(t), original = input(state.catalog, state.corrections), first = state.corrections.save(original);
  state.corrections.save({ ...input(state.catalog, state.corrections), action: 'withdraw', statement: null, environment: null });
  const unrelated = state.catalog.state().sources.find(source => source.name === 'portal')!;
  state.store.revoke(unrelated.id);
  assert.equal(state.corrections.list().corrections.length, 0); assert.equal(state.corrections.list().editable, false);
  assert.throws(() => state.corrections.history(first.id), /authorization change/);
  assert.throws(() => state.corrections.save(original), /authorization change/);
  assert.equal(state.store.one<{ count: number }>('SELECT count(*) AS count FROM corrections WHERE statement IS NOT NULL')!.count, 1, 'Logical purge has not run yet');
  await state.restart();
  assert.equal(state.store.one<{ count: number }>('SELECT count(*) AS count FROM corrections WHERE statement IS NOT NULL OR target IS NOT NULL OR environment IS NOT NULL OR purged=0')!.count, 0);
  assert.equal(state.store.source(unrelated.id).purge, 'completed');
  assert.throws(() => state.corrections.save(original), /authorization change/);
});

test('policy changes fence old corrections without rewriting their historical content', async t => {
  const { catalog, corrections, store } = await setup(t), proposed = input(catalog, corrections), saved = corrections.save(proposed);
  catalog.updatePolicy(['legacy']);
  assert.throws(() => corrections.list(saved.buildId), /old policy/);
  assert.throws(() => corrections.history(saved.id), /old policy/);
  assert.throws(() => corrections.save(proposed), /old policy/);
  assert.equal(store.one<{ statement: string }>('SELECT statement FROM corrections WHERE id=?', saved.id)!.statement, saved.statement);
});

test('failed dependency publication rolls back the version, history and project revision atomically', async t => {
  const { catalog, corrections, store } = await setup(t), proposed = input(catalog, corrections);
  store.db.exec("CREATE TRIGGER fail_correction_dependency BEFORE INSERT ON correction_flows BEGIN SELECT RAISE(ABORT,'Synthetic dependency failure'); END;");
  assert.throws(() => corrections.save(proposed), /Synthetic dependency failure/);
  assert.equal(store.one<{ count: number }>('SELECT count(*) AS count FROM corrections')!.count, 0);
  assert.equal(store.one<{ count: number }>('SELECT count(*) AS count FROM correction_sources')!.count, 0); assert.equal(catalog.state().correctionRevision, 0);
  store.db.exec('DROP TRIGGER fail_correction_dependency');
  assert.equal(corrections.save(proposed).version, 1);
});

test('invalid targets/input, damaged evidence and unsupported target provenance fail closed', async t => {
  const { catalog, corrections, store } = await setup(t), proposed = input(catalog, corrections);
  for (const invalid of [null, { ...proposed, extra: true }, { ...proposed, statement: '' }, { ...proposed, statement: 'x'.repeat(2001) },
    { ...proposed, environment: '\nproduction' }, { ...proposed, action: ['dispute'] }, { ...proposed, targetKind: ['code-link'] },
    { ...proposed, expectedRevision: -1 }, { ...proposed, action: 'withdraw', statement: 'Ignored text must fail' }]) assert.throws(() => corrections.save(invalid), /Choose an indexed link/);
  assert.throws(() => corrections.save({ ...proposed, targetId: 'f'.repeat(64) }), /issued code link/);
  const map = declarationMap(catalog), declared = map.edges.find(edge => edge.status === 'declared')!;
  assert.throws(() => corrections.save({ ...proposed, targetKind: 'declaration-link', projectionHash: map.inputHash, targetId: declared.id }), /issued code link/);
  const saved = corrections.save(proposed), ref = corrections.history(saved.id).versions[0]!.original.evidenceIds[0]!;
  store.run('UPDATE spans SET text=? WHERE id=?', 'Corrupted original evidence', ref);
  assert.throws(() => corrections.list(), /integrity/); assert.throws(() => corrections.history(saved.id), /integrity/);
});

test('HTML-like statements remain literal human input and note revisions reserve a withdrawal slot', async t => {
  const { catalog, corrections } = await setup(t), unsafe = '<img src=x onerror="window.correctionInjected=true">';
  const first = corrections.save({ ...input(catalog, corrections), statement: unsafe });
  assert.equal(corrections.list().corrections[0]!.statement, unsafe);
  for (let version = 2; version < correctionLimits.versions; version++) corrections.save({ ...input(catalog, corrections), action: 'clarify', statement: `Human clarification ${version}.` });
  assert.throws(() => corrections.save(input(catalog, corrections)), /final version is reserved/);
  const final = corrections.save({ ...input(catalog, corrections), action: 'withdraw', statement: null, environment: null });
  assert.equal(final.version, correctionLimits.versions); assert.equal(corrections.history(first.id).versions.length, correctionLimits.versions);
  assert.ok(Buffer.byteLength(JSON.stringify(corrections.history(first.id))) <= correctionLimits.historyBytes);
});

test('the per-index target cap bounds review storage without silently dropping active corrections', async t => {
  const { catalog, corrections } = await setup(t, 'export function bulk(){' + `fetch('/api/orders', {method:'POST'});`.repeat(55) + '}');
  const projection = codeFlows(catalog), initial = input(catalog, corrections);
  assert.ok(projection.edges.length > correctionLimits.targets);
  for (const edge of projection.edges.slice(0, correctionLimits.targets)) corrections.save({ ...initial, requestId: `target-${edge.id}`, targetId: edge.id,
    expectedRevision: catalog.state().correctionRevision });
  const next = projection.edges[correctionLimits.targets]!;
  assert.throws(() => corrections.save({ ...initial, requestId: 'one-too-many', targetId: next.id, expectedRevision: catalog.state().correctionRevision }), /target limit/);
  assert.equal(corrections.list().corrections.length, correctionLimits.targets);
  assert.ok(Buffer.byteLength(JSON.stringify(corrections.list())) <= correctionLimits.outputBytes);
});

test('schema 3 migration preserves pinned evidence and existing answer bytes', async t => {
  const state = await setup(t), ref = state.catalog.search('OrderConsumer').hits[0]!, evidence = state.catalog.evidence(ref.id);
  state.store.run(`INSERT INTO answer_attempts (id,requestId,payloadHash,question,buildId,policyVersion,registryVersion,status,inputHash,connection,model,effort,promptVersion,schemaVersion,result,createdAt)
    VALUES ('legacy','legacy','hash','Legacy question',?,1,?,'succeeded','hash','{}','fake','medium','old-prompt','old-schema',?,'2026-01-01')`, evidence.buildId, state.catalog.state().sourceSetVersion, '{"claims":[],"unknowns":["Legacy unknown?"]}');
  const before = state.store.one('SELECT * FROM answer_attempts WHERE id=\'legacy\'');
  state.store.db.exec('DROP TABLE correction_flows; DROP TABLE correction_sources; DROP TABLE corrections; ALTER TABLE project DROP COLUMN correctionRevision; PRAGMA user_version=3;');
  await state.restart();
  assert.equal(state.store.one<{ user_version: number }>('PRAGMA user_version')!.user_version, 4);
  assert.equal(state.catalog.state().correctionRevision, 0); assert.deepEqual(state.catalog.evidence(ref.id), evidence);
  assert.deepEqual(state.store.one('SELECT * FROM answer_attempts WHERE id=\'legacy\''), before);
  assert.equal(state.corrections.save(input(state.catalog, state.corrections)).version, 1);
});

test('correction transport requires session/CSRF and historical reads retain no-store fencing', async t => {
  const { catalog, corrections } = await setup(t), app = createApp(catalog), base = 'http://127.0.0.1:4244', shared = { host: '127.0.0.1:4244', origin: base };
  assert.equal((await app.request(base + '/api/corrections', { headers: shared })).status, 401);
  const session = await app.request(base + '/api/session', { method: 'POST', headers: { ...shared, 'x-loredock-client': 'web' } });
  const headers = { ...shared, cookie: session.headers.get('set-cookie')!.split(';')[0]!, 'Content-Type': 'application/json' }, token = (await session.json() as { token: string }).token;
  const proposed = input(catalog, corrections), body = JSON.stringify(proposed);
  assert.equal((await app.request(base + '/api/corrections', { method: 'POST', headers, body })).status, 403);
  const saved = await app.request(base + '/api/corrections', { method: 'POST', headers: { ...headers, 'x-loredock-csrf': token }, body });
  assert.equal(saved.status, 201); const id = (await saved.json() as { id: string }).id;
  const history = await app.request(base + `/api/corrections/${id}/history`, { headers });
  assert.equal(history.status, 200); assert.equal(history.headers.get('cache-control'), 'no-store');
  assert.equal((await app.request(base + '/api/corrections?buildId=unknown', { headers })).status, 404);
  catalog.revoke(catalog.state().sources[0]!.id);
  assert.equal((await app.request(base + `/api/corrections/${id}/history`, { headers })).status, 404);
});
