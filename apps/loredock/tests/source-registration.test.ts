import assert from 'node:assert/strict';
import { rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { removeOnboardingSchema } from './legacy-schema.js';
// @ts-expect-error The independent fixture generator is plain JavaScript.
import { createLoreDockFixture } from '../../../scripts/loredock-fixture.mjs';

async function setup(t: TestContext) {
  const fixture = await createLoreDockFixture() as { root: string };
  const directory = path.join(fixture.root, 'data');
  const state = { root: fixture.root, store: new CatalogStore(directory), catalog: undefined as unknown as Catalog,
    paths: ['portal', 'order-api', 'order-worker'].map(id => path.join(fixture.root, 'sources', id)),
    async restart() { await state.catalog.stop(); state.store.close(); state.store = new CatalogStore(directory); state.catalog = new Catalog(state.store); } };
  state.catalog = new Catalog(state.store);
  t.after(async () => { await state.catalog.stop(); state.store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  return state;
}

test('preview identifies canonical aliases, existing sources and failures without mutation; valid set registers once', async t => {
  const s = await setup(t); await s.catalog.addSource(s.paths[1]!);
  const alias = path.join(s.root, 'portal-alias'); await symlink(s.paths[0]!, alias);
  const paths = [s.paths[0]!, alias, s.paths[1]!, '../relative', path.join(s.root, 'missing'), s.paths[2]!];
  const before = s.catalog.state(), preview = await s.catalog.previewSources(paths);
  assert.deepEqual(preview.rows.map(row => row.status), ['ready', 'duplicate', 'existing', 'invalid', 'invalid', 'ready']);
  assert.equal(preview.rows[1]!.path, s.paths[0]); assert.equal(preview.ready, 2); assert.equal(preview.canRegister, true);
  assert.deepEqual(s.catalog.state(), before);
  const input = { paths, previewHash: preview.previewHash, requestId: 'bulk' };
  const receipts = await Promise.all([s.catalog.registerSources(input), s.catalog.registerSources(input)]);
  assert.deepEqual(receipts[0], receipts[1]); assert.equal(receipts[0]!.sourceIds.length, 2);
  assert.equal(s.catalog.state().sourceSetVersion, before.sourceSetVersion + 1); assert.equal(s.catalog.state().builds.length, 0);
  await s.restart(); assert.deepEqual(await s.catalog.registerSources(input), receipts[0]);
  s.catalog.revoke(receipts[0]!.sourceIds[0]!);
  await rm(s.paths[0]!, { recursive: true });
  assert.deepEqual(await s.catalog.registerSources(input), receipts[0]);
  assert.equal(s.store.source(receipts[0]!.sourceIds[0]!).status, 'revoked');
  await assert.rejects(s.catalog.registerSources({ ...input, paths: [s.paths[2]] }), { code: 'CONFLICT' });
});

test('changed canonical identity and competing previews reject the complete set before mutation', async t => {
  const s = await setup(t), alias = path.join(s.root, 'alias'); await symlink(s.paths[0]!, alias);
  const paths = [alias, s.paths[2]!], preview = await s.catalog.previewSources(paths);
  await rm(alias); await symlink(s.paths[1]!, alias);
  await assert.rejects(s.catalog.registerSources({ paths, previewHash: preview.previewHash, requestId: 'changed' }), { code: 'STALE_PREVIEW' });
  assert.equal(s.store.sources().length, 0);
  const a = await s.catalog.previewSources([s.paths[0]!]), b = await s.catalog.previewSources([s.paths[1]!]);
  const results = await Promise.allSettled([
    s.catalog.registerSources({ paths: [s.paths[0]], previewHash: a.previewHash, requestId: 'first' }),
    s.catalog.registerSources({ paths: [s.paths[1]], previewHash: b.previewHash, requestId: 'second' }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1); assert.equal(s.store.sources().length, 1);
  assert.equal(s.store.all('SELECT * FROM source_registrations').length, 1);
});

test('a failed batch insert rolls back all sources, registry revision and receipt', async t => {
  const s = await setup(t), preview = await s.catalog.previewSources(s.paths);
  s.store.db.exec("CREATE TRIGGER fail_second BEFORE INSERT ON sources WHEN NEW.name='order-api' BEGIN SELECT RAISE(ABORT,'Synthetic disk failure'); END;");
  const input = { paths: s.paths, previewHash: preview.previewHash, requestId: 'atomic' };
  await assert.rejects(s.catalog.registerSources(input), /Synthetic disk failure/);
  assert.equal(s.store.sources().length, 0); assert.equal(s.store.project().sourceSetVersion, preview.sourceSetVersion);
  assert.equal(s.store.all('SELECT * FROM source_registrations').length, 0);
  s.store.db.exec('DROP TRIGGER fail_second'); assert.equal((await s.catalog.registerSources(input)).sourceIds.length, 3);
});

test('input bounds and a schema 6 upgrade preserve existing sources, evidence and legacy resume allocation', async t => {
  const s = await setup(t);
  for (const value of [null, [], ['x'.repeat(4097)], Array(41).fill('/x'), Array(20).fill('/' + 'x'.repeat(500))]) await assert.rejects(s.catalog.previewSources(value), { code: 'INVALID_PATHS' });
  await s.catalog.addSource(s.paths[0]!); const state = s.catalog.state();
  const build = s.catalog.start('legacy', state.sourceSetVersion, state.policyVersion); await s.catalog.idle();
  const evidence = s.catalog.evidence(s.catalog.search('billing').hits[0]!.id);
  const paused = s.catalog.start('legacy-paused', state.sourceSetVersion, state.policyVersion);
  s.catalog.control(paused.id, 'pause'); await s.catalog.idle();
  removeOnboardingSchema(s.store); s.store.db.exec('PRAGMA user_version=6'); await s.restart();
  assert.equal(s.store.one<{ user_version: number }>('PRAGMA user_version')!.user_version, 8);
  assert.deepEqual(s.catalog.evidence(evidence.id), evidence); assert.equal(s.store.buildRow(build.id).allocation, null);
  s.catalog.control(paused.id, 'resume'); await s.catalog.idle();
  assert.equal(s.store.build(paused.id).coverage.indexed, 6);
  const preview = await s.catalog.previewSources(s.paths); assert.deepEqual(preview.rows.map(row => row.status), ['existing', 'ready', 'ready']);
});
