import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { Corrections } from '../src/corrections.js';
import { Reconciliation, reconciliationLimits } from '../src/reconciliation.js';
import { codeFlows } from '../src/code-flows.js';
import { declarationMap } from '../src/system-map.js';
import { sha256 } from '../src/extract.js';
import { createApp } from '../src/app.js';
import { removeReconciliationSchema } from './legacy-schema.js';
import type { CorrectionInput } from '../src/correction-types.js';
import type { ReconciliationPreview } from '../src/reconciliation-types.js';
// @ts-expect-error The owned fixture generator is intentionally plain JavaScript.
import { createLoreDockFixture, fixtureGit } from '../../../scripts/loredock-fixture.mjs';

async function setup(t: TestContext, extra = '') {
  const fixture = await createLoreDockFixture() as { root: string };
  if (extra) {
    await writeFile(path.join(fixture.root, 'sources/portal/extra.ts'), extra);
    fixtureGit(fixture.root, 'portal', ['add', 'extra.ts']); fixtureGit(fixture.root, 'portal', ['commit', '-qm', 'Add bounded review inputs']);
  }
  const directory = path.join(fixture.root, 'data'); let store = new CatalogStore(directory), catalog = new Catalog(store);
  t.after(async () => { await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  for (const repo of ['portal', 'order-api', 'order-worker']) await catalog.addSource(path.join(fixture.root, 'sources', repo));
  const index = async (id: string) => { const state = catalog.state(); const result = catalog.start(id, state.sourceSetVersion, state.policyVersion); await catalog.idle(); return store.build(result.id); };
  await index('first');
  return { fixture, index, get store() { return store; }, get catalog() { return catalog; },
    get corrections() { return new Corrections(catalog); }, get review() { return new Reconciliation(catalog); },
    restart: async () => { await catalog.stop(); store.close(); store = new CatalogStore(directory); catalog = new Catalog(store); } };
}
let request = 0;
function note(catalog: Catalog, kind: CorrectionInput['targetKind'] = 'code-link', buildId?: string): CorrectionInput {
  const graph = kind === 'code-link' ? codeFlows(catalog, buildId) : declarationMap(catalog, buildId);
  const edge = graph.edges.find(edge => edge.kind === (kind === 'code-link' ? 'event-delivery' : 'contract-match'))!;
  const current = new Corrections(catalog).list(graph.buildId).corrections.find(item => item.targetId === edge.id && item.targetKind === kind);
  return { requestId: `note-${++request}`, buildId: graph.buildId, targetKind: kind, targetId: edge.id, projectionHash: graph.inputHash,
    expectedRevision: catalog.state().correctionRevision, expectedPreviousId: current?.id ?? null,
    action: 'dispute', statement: 'Review broker wiring before relying on this delivery.', environment: 'local' };
}
function applyInput(preview: ReconciliationPreview, index = 0) {
  const entry = preview.entries[index]!;
  return { requestId: `reapply-${++request}`, buildId: preview.buildId, sourceCorrectionId: entry.source.id,
    targetId: entry.current!.id, previewHash: preview.previewHash, expectedRevision: preview.revision };
}
async function change(root: string, repo: string, file: string, text: string) {
  await writeFile(path.join(root, 'sources', repo, file), text);
  fixtureGit(root, repo, ['add', '--all']); fixtureGit(root, repo, ['commit', '-qm', 'Change owned reconciliation support']);
}

test('preview is read-only; explicit reapplication preserves both indexes, all flow dependencies and exact origin across restart', async t => {
  const state = await setup(t), original = state.corrections.save(note(state.catalog)), originalVersion = state.corrections.inspect(original.id);
  await state.index('second'); const graph = codeFlows(state.catalog), preview = state.review.preview();
  assert.equal(preview.entries[0]!.status, 'support-unchanged'); assert.equal(preview.fromBuildId, original.buildId);
  assert.equal(state.corrections.list().corrections.length, 0); assert.equal(state.catalog.state().correctionRevision, 1);
  const input = applyInput(preview), result = state.review.reapply(input);
  assert.equal(result.version, 1); assert.equal(result.statement, original.statement); assert.equal(result.environment, original.environment);
  assert.deepEqual(result.reappliedFrom, { id: original.id, buildId: original.buildId, version: 1 });
  assert.deepEqual(result.affectedFlowIds, graph.flows.map(flow => flow.id).sort());
  assert.deepEqual(state.corrections.inspect(original.id), originalVersion); assert.deepEqual(codeFlows(state.catalog), graph);
  const current = state.corrections.inspect(result.id);
  assert.notDeepEqual(current.original.evidenceIds, originalVersion.original.evidenceIds);
  for (const id of current.original.evidenceIds) assert.equal(state.catalog.evidence(id).buildId, result.buildId);
  assert.equal(state.review.preview().entries[0]!.status, 'already-reviewed');
  await state.restart(); assert.deepEqual(state.review.reapply(input), result); assert.deepEqual(state.corrections.inspect(result.id), current);
});

test('unrelated commit revisions do not change matching support and wider scope remains explicit', async t => {
  const state = await setup(t); state.corrections.save(note(state.catalog));
  await change(state.fixture.root, 'order-api', 'README.md', '# API\nNew unrelated orientation text.\n'); await state.index('second');
  const preview = state.review.preview(); assert.equal(preview.entries[0]!.status, 'support-unchanged');
  assert.notDeepEqual(preview.scope.previous, preview.scope.current); assert.match(preview.gaps[0]!, /wider current scope/);
});

test('changed supporting content is blocked and old/current evidence remains separately addressable', async t => {
  const state = await setup(t); state.corrections.save(note(state.catalog));
  const name = 'src/main/java/OrderConsumer.java', old = await readFile(path.join(state.fixture.root, 'sources/order-worker', name), 'utf8');
  await change(state.fixture.root, 'order-worker', name, old + '\n// Changed deployment review context.\n'); await state.index('second');
  const preview = state.review.preview(), entry = preview.entries[0]!;
  assert.equal(entry.status, 'support-changed'); assert.ok(entry.current);
  assert.throws(() => state.review.reapply(applyInput(preview)), /Only an unchanged/);
  for (const id of entry.original.evidenceIds) assert.equal(state.catalog.evidence(id).buildId, preview.fromBuildId);
  for (const id of entry.current.evidenceIds) assert.equal(state.catalog.evidence(id).buildId, preview.buildId);
  assert.equal(state.catalog.state().correctionRevision, 1);
});

test('declaration comparisons include full contract bytes and reject changed contract properties', async t => {
  const state = await setup(t), source = state.corrections.save(note(state.catalog, 'declaration-link')); await state.index('same');
  assert.equal(state.review.preview().entries[0]!.status, 'support-unchanged');
  const name = 'contracts/order.schema.json';
  const files = state.store.all<{ path: string }>("SELECT f.path FROM files f JOIN sources s ON s.id=f.sourceId WHERE f.buildId=? AND s.name='order-worker' AND f.path LIKE '%json'", state.catalog.state().publishedBuildId!);
  const contract = files.find(file => file.path.includes('contract'))?.path ?? name;
  const old = await readFile(path.join(state.fixture.root, 'sources/order-worker', contract), 'utf8');
  await change(state.fixture.root, 'order-worker', contract, old + '\n'); await state.index('changed');
  assert.equal(state.review.preview(undefined, source.buildId).entries[0]!.status, 'support-changed');
  const incompatible = JSON.parse(old) as { fields: Record<string, string> }; incompatible.fields.tenantId = 'uuid';
  await change(state.fixture.root, 'order-worker', contract, JSON.stringify(incompatible, null, 2) + '\n'); await state.index('incompatible-contract');
  assert.equal(state.review.preview(undefined, source.buildId).entries[0]!.status, 'missing');
});

test('matching changed topic configuration cannot inherit a delivery correction with unchanged Java endpoints', async t => {
  const state = await setup(t), source = state.corrections.save(note(state.catalog));
  for (const repo of ['order-api', 'order-worker']) {
    const file = 'config/local.json', original = await readFile(path.join(state.fixture.root, 'sources', repo, file), 'utf8');
    await change(state.fixture.root, repo, file, original.replaceAll('orders.placed.v2', 'orders.placed.v3'));
  }
  await state.index('new-topic'); const preview = state.review.preview();
  assert.equal(preview.entries[0]!.source.id, source.id); assert.equal(preview.entries[0]!.status, 'support-changed');
  assert.ok(preview.entries[0]!.current); assert.throws(() => state.review.reapply(applyInput(preview)), /Only an unchanged/);
});

test('missing links and duplicate endpoint identities never infer a target', async t => {
  await t.test('missing', async sub => {
    const state = await setup(sub); state.corrections.save(note(state.catalog));
    const name = 'src/main/java/OrderConsumer.java'; await rm(path.join(state.fixture.root, 'sources/order-worker', name));
    fixtureGit(state.fixture.root, 'order-worker', ['add', '--all']); fixtureGit(state.fixture.root, 'order-worker', ['commit', '-qm', 'Remove owned subscriber']);
    await state.index('second'); assert.equal(state.review.preview().entries[0]!.status, 'missing'); assert.equal(state.review.preview().entries[0]!.current, null);
  });
  await t.test('ambiguous', async sub => {
    const state = await setup(sub, "export function repeated(){fetch('/api/orders',{method:'POST'});fetch('/api/orders',{method:'POST'});}");
    const graph = codeFlows(state.catalog), edge = graph.edges.find(edge => edge.kind === 'http-target' && graph.nodes.find(node => node.id === edge.from)?.path === 'extra.ts')!;
    assert.ok(edge); state.corrections.save({ ...note(state.catalog), targetId: edge.id }); await state.index('second');
    assert.equal(state.review.preview().entries[0]!.status, 'ambiguous');
  });
});

test('current decisions including withdrawals and source edits invalidate a reviewed preview', async t => {
  const state = await setup(t), source = state.corrections.save(note(state.catalog)); await state.index('second');
  let preview = state.review.preview(); const stale = applyInput(preview);
  state.corrections.save({ ...note(state.catalog, 'code-link', source.buildId), action: 'clarify', statement: 'A newer review of the original claim.' });
  assert.throws(() => state.review.reapply(stale), /comparison changed/);
  preview = state.review.preview(); const second = applyInput(preview);
  state.corrections.save(note(state.catalog)); assert.throws(() => state.review.reapply(second), /comparison changed/);
  assert.equal(state.review.preview().entries[0]!.status, 'already-reviewed');
  state.corrections.save({ ...note(state.catalog), action: 'withdraw', statement: null, environment: null });
  preview = state.review.preview(); assert.equal(preview.entries[0]!.status, 'already-reviewed');
  assert.throws(() => state.review.reapply(applyInput(preview)), /Only an unchanged/);
  state.corrections.save({ ...note(state.catalog, 'code-link', source.buildId), action: 'withdraw', statement: null, environment: null });
  assert.equal(state.review.preview().entries.length, 0);
});

test('exact replay is order-independent, payload conflicts fail and a replay never reactivates a superseded note', async t => {
  const state = await setup(t); state.corrections.save(note(state.catalog)); await state.index('second');
  const input = applyInput(state.review.preview()), first = state.review.reapply(input);
  state.corrections.save({ ...note(state.catalog), action: 'withdraw', statement: null, environment: null });
  assert.deepEqual(state.review.reapply(Object.fromEntries(Object.entries(input).reverse())), first);
  assert.equal(state.corrections.list().corrections[0]!.action, 'withdraw');
  assert.throws(() => state.review.reapply({ ...input, expectedRevision: input.expectedRevision + 1 }), /different correction inputs/);
  assert.throws(() => state.corrections.save({ ...note(state.catalog), requestId: input.requestId }), /different correction inputs/);
  for (const invalid of [null, { ...input, extra: true }, { ...input, targetId: 'invalid' }, { ...input, expectedRevision: -1 }]) assert.throws(() => state.review.reapply(invalid), /current comparison/);
});

test('publication failure rolls back new note, lineage, dependency rows and global revision', async t => {
  const state = await setup(t); state.corrections.save(note(state.catalog)); await state.index('second'); const input = applyInput(state.review.preview());
  const counts = () => ['corrections', 'correction_sources', 'correction_flows', 'correction_reapplications'].map(table => state.store.one<{ count: number }>(`SELECT count(*) AS count FROM ${table}`)!.count);
  const before = counts(); state.store.db.exec("CREATE TRIGGER fail_reapplication BEFORE INSERT ON correction_reapplications BEGIN SELECT RAISE(ABORT,'Synthetic lineage failure'); END;");
  assert.throws(() => state.review.reapply(input), /Synthetic lineage failure/); assert.deepEqual(counts(), before); assert.equal(state.catalog.state().correctionRevision, 1);
  state.store.db.exec('DROP TRIGGER fail_reapplication'); assert.equal(state.review.reapply(input).version, 1);
});

test('new publication and policy changes invalidate pending comparisons; successful notes are independent of later source withdrawal', async t => {
  const state = await setup(t), source = state.corrections.save(note(state.catalog)); await state.index('second');
  const second = state.catalog.state().publishedBuildId!, pending = applyInput(state.review.preview());
  await state.index('third'); assert.throws(() => state.review.reapply(pending), /comparison changed/);
  const accepted = applyInput(state.review.preview(second)), current = state.review.reapply(accepted);
  state.corrections.save({ ...note(state.catalog, 'code-link', source.buildId), action: 'withdraw', statement: null, environment: null });
  assert.equal(state.corrections.list(second).corrections[0]!.id, current.id); assert.deepEqual(state.review.reapply(accepted), current);
  state.catalog.updatePolicy(['legacy']);
  assert.throws(() => state.review.reapply(accepted), /old policy/); assert.throws(() => state.corrections.history(current.id), /old policy/);
});

test('explicit older ancestor selection recovers a skipped review without silently resurrecting it', async t => {
  const state = await setup(t), original = state.corrections.save(note(state.catalog)); await state.index('second'); await state.index('third');
  const defaultPreview = state.review.preview(); assert.equal(defaultPreview.entries.length, 0); assert.equal(defaultPreview.ancestors.length, 2);
  const older = state.review.preview(undefined, original.buildId); assert.equal(older.entries[0]!.status, 'support-unchanged');
  assert.equal(state.review.reapply(applyInput(older)).reappliedFrom?.id, original.id);
  assert.throws(() => state.review.preview(original.buildId, defaultPreview.buildId), /unavailable/);
});

test('ancestry discovery is bounded, cyclic records stop and policy changes reset discovery', async t => {
  const state = await setup(t), first = state.catalog.state().publishedBuildId!;
  for (let index = 0; index < 22; index++) await state.index(`refresh-${index}`);
  const preview = state.review.preview(); assert.equal(preview.ancestors.length, reconciliationLimits.ancestors); assert.ok(preview.gaps.some(gap => gap.includes('limited to 20')));
  assert.throws(() => state.review.preview(undefined, first), /unavailable/);
  const current = state.catalog.state().publishedBuildId!; state.store.run('UPDATE builds SET baselineBuildId=? WHERE id=?', current, preview.ancestors[0]!.id);
  assert.ok(state.review.preview().gaps.some(gap => gap.includes('cycle')));
  state.catalog.updatePolicy(['legacy']); await state.index('new-policy'); assert.equal(state.review.preview().ancestors.length, 0);
});

test('preview correction/output limits disclose omissions', async t => {
  const state = await setup(t, 'export function many(){' + "fetch('/api/orders',{method:'POST'});".repeat(30) + '}');
  const graph = codeFlows(state.catalog);
  for (const edge of graph.edges.slice(0, 23)) state.corrections.save({ ...note(state.catalog), requestId: `bulk-${edge.id}`, targetId: edge.id });
  await state.index('second'); const preview = state.review.preview();
  assert.equal(preview.entries.length, reconciliationLimits.corrections); assert.equal(preview.omittedCorrections, 3);
  assert.ok(Buffer.byteLength(JSON.stringify(preview)) <= reconciliationLimits.outputBytes); assert.ok(preview.gaps.some(gap => gap.includes('outside this bounded preview')));
});

test('revocation fences previews, provenance/history and exact replay before purge and after restart', async t => {
  const state = await setup(t), source = state.corrections.save(note(state.catalog)); await state.index('second');
  const input = applyInput(state.review.preview()), current = state.review.reapply(input);
  const dependency = state.catalog.state().sources.find(item => item.name === 'portal')!; state.store.revoke(dependency.id);
  const fenced = state.review.preview(); assert.equal(fenced.entries.length, 0);
  assert.ok(fenced.scope.current.every(source => source.sourceId !== dependency.id));
  assert.equal(state.corrections.list().corrections.length, 0);
  assert.throws(() => state.review.preview(undefined, source.buildId), /unavailable/);
  assert.throws(() => state.review.reapply(input), /authorization change/); assert.throws(() => state.corrections.history(current.id), /authorization change/);
  await state.restart(); assert.equal(state.store.one<{ count: number }>('SELECT count(*) AS count FROM corrections WHERE statement IS NOT NULL OR target IS NOT NULL')!.count, 0);
  assert.equal(state.store.one<{ count: number }>('SELECT count(*) AS count FROM correction_reapplications')!.count, 1);
  assert.throws(() => state.review.reapply(input), /authorization change/);
});

test('schema 5 migration preserves existing correction bytes; lineage is immutable and integrity checked', async t => {
  const state = await setup(t), source = state.corrections.save(note(state.catalog)), before = state.store.one('SELECT * FROM corrections WHERE id=?', source.id);
  removeReconciliationSchema(state.store); state.store.db.exec('PRAGMA user_version=5'); await state.restart();
  assert.equal(state.store.one<{ user_version: number }>('PRAGMA user_version')!.user_version, 7); assert.deepEqual(state.store.one('SELECT * FROM corrections WHERE id=?', source.id), before);
  await state.index('second'); const current = state.review.reapply(applyInput(state.review.preview()));
  assert.throws(() => state.store.run('UPDATE correction_reapplications SET previewHash=? WHERE correctionId=?', '0'.repeat(64), current.id), /immutable/);
  assert.throws(() => state.store.run('DELETE FROM correction_reapplications WHERE correctionId=?', current.id), /immutable/);
  state.store.db.exec('DROP TRIGGER reapplication_identity'); state.store.run('UPDATE correction_reapplications SET previewHash=? WHERE correctionId=?', '0'.repeat(64), current.id);
  assert.throws(() => state.corrections.history(current.id), /provenance check/);
});

test('unsupported adapter provenance and corrupt original evidence cannot produce an eligible proposal', async t => {
  const state = await setup(t), source = state.corrections.save(note(state.catalog));
  const row = state.store.one<{ target: string; buildId: string; targetKind: string; targetId: string; version: number; previousId: string | null; action: string; statement: string; environment: string }>('SELECT * FROM corrections WHERE id=?', source.id)!;
  const target = JSON.stringify({ ...JSON.parse(row.target), adapterVersion: 'future-adapter' });
  state.store.db.exec('DROP TRIGGER correction_identity; DROP TRIGGER correction_content');
  state.store.run('UPDATE corrections SET target=?,contentHash=? WHERE id=?', target, sha256(JSON.stringify([row.buildId, row.targetKind, row.targetId, row.version, row.previousId, row.action, row.statement, row.environment, target])), source.id);
  await state.index('second'); assert.equal(state.review.preview().entries[0]!.status, 'unsupported');
  const id = state.corrections.inspect(source.id).original.evidenceIds[0]!; state.store.run('UPDATE spans SET text=? WHERE id=?', 'Damaged source evidence', id);
  assert.throws(() => state.review.preview(), /integrity/);
});

test('new corrections remain withdrawable when old index evidence later becomes damaged', async t => {
  const state = await setup(t), source = state.corrections.save(note(state.catalog)); await state.index('second');
  const current = state.review.reapply(applyInput(state.review.preview()));
  const id = state.corrections.inspect(source.id).original.evidenceIds[0]!; state.store.run('UPDATE spans SET text=? WHERE id=?', 'Damaged old source evidence', id);
  assert.equal(state.corrections.list().corrections[0]!.id, current.id);
  assert.equal(state.corrections.save({ ...note(state.catalog), action: 'withdraw', statement: null, environment: null }).action, 'withdraw');
});

test('reconciliation transport requires a session, CSRF and no-store on protected data', async t => {
  const state = await setup(t), source = state.corrections.save(note(state.catalog)); await state.index('second');
  const app = createApp(state.catalog), base = 'http://127.0.0.1:4244', host = { host: '127.0.0.1:4244' };
  assert.equal((await app.request(base + '/api/correction-reconciliation', { headers: host })).status, 401);
  const session = await app.request(base + '/api/session', { method: 'POST', headers: { ...host, origin: base, 'x-loredock-client': 'web' } });
  const { token } = await session.json() as { token: string }, cookie = session.headers.get('set-cookie')!.split(';')[0]!;
  const headers = { ...host, cookie, origin: base, 'content-type': 'application/json' };
  const preview = await app.request(base + '/api/correction-reconciliation', { headers }); assert.equal(preview.headers.get('cache-control'), 'no-store');
  const input = applyInput(await preview.json() as ReconciliationPreview);
  assert.equal(input.sourceCorrectionId, source.id);
  assert.equal((await app.request(base + '/api/corrections/reapply', { method: 'POST', headers, body: JSON.stringify(input) })).status, 403);
  assert.equal((await app.request(base + '/api/corrections/reapply', { method: 'POST', headers: { ...headers, 'x-loredock-csrf': token }, body: JSON.stringify(input) })).status, 201);
});
