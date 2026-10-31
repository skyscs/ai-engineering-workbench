import assert from 'node:assert/strict';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { SourceGit, type RepositoryIdentity } from '../src/git.js';
import { sha256 } from '../src/extract.js';
import { indexChanges } from '../src/index-changes.js';
import { codeFlows } from '../src/code-flows.js';
import { Corrections } from '../src/corrections.js';
import { createApp } from '../src/app.js';
import { removeRefreshSchema } from './legacy-schema.js';
// @ts-expect-error The fixture generator is independent plain JavaScript.
import { createLoreDockFixture, fixtureGit } from '../../../scripts/loredock-fixture.mjs';

class CountingGit extends SourceGit {
  reads: string[] = [];
  override async blob(source: RepositoryIdentity, oid: string, signal: AbortSignal, bytes: number) {
    this.reads.push(oid); return super.blob(source, oid, signal, bytes);
  }
}
class GatedGit extends CountingGit {
  release!: () => void;
  private reached!: () => void;
  readonly ready = new Promise<void>(resolve => { this.reached = resolve; });
  private gate = new Promise<void>(resolve => { this.release = resolve; });
  override async blob(source: RepositoryIdentity, oid: string, signal: AbortSignal, bytes: number) {
    const result = await super.blob(source, oid, signal, bytes); this.reached(); await this.gate; return result;
  }
}
async function setup(t: TestContext, repos = ['portal', 'order-api', 'order-worker']) {
  const fixture = await createLoreDockFixture() as { root: string; manifest: { revisionVector: Record<string, string> } };
  const directory = path.join(fixture.root, 'data'); let store = new CatalogStore(directory), git = new CountingGit(), catalog = new Catalog(store, git);
  t.after(async () => { if (git instanceof GatedGit) git.release(); await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  for (const repo of repos) await catalog.addSource(path.join(fixture.root, 'sources', repo));
  const begin = (key: string) => { const state = catalog.state(); return catalog.start(key, state.sourceSetVersion, state.policyVersion); };
  const index = async (key: string) => { const build = begin(key); await catalog.idle(); return store.build(build.id); };
  return { fixture, begin, index, get store() { return store; }, get git() { return git; }, get catalog() { return catalog; },
    restart: async (reader: CountingGit = new CountingGit(), limits = {}) => {
      if (git instanceof GatedGit) git.release(); await catalog.stop(); store.close(); store = new CatalogStore(directory); git = reader; catalog = new Catalog(store, git, limits);
    } };
}
const file = (root: string, repo: string, name: string) => path.join(root, 'sources', repo, name);
function commit(root: string, repo: string) { fixtureGit(root, repo, ['add', '--all']); fixtureGit(root, repo, ['commit', '-qm', 'Update synthetic refresh inputs']); }

test('an unchanged corpus reuses 18 text files, rereads three binary canaries and issues independent evidence', async t => {
  const state = await setup(t), first = await state.index('first'), old = state.catalog.evidence(state.catalog.search('orders.placed.v2').hits[0]!.id);
  const oldIds = state.store.all<{ id: string }>('SELECT s.id FROM spans s JOIN files f ON f.id=s.fileId WHERE f.buildId=?', first.id).map(item => item.id);
  assert.equal(state.git.reads.length, 21); state.git.reads = [];
  const second = await state.index('second');
  assert.deepEqual(second.refresh, { baselineBuildId: first.id, version: 'git-reuse-v1', reusedFiles: 18, gitReadAttempts: 3, cacheRejections: 0 });
  assert.equal(state.git.reads.length, 3); assert.deepEqual(state.catalog.evidence(old.id), old);
  const newIds = state.store.all<{ id: string }>('SELECT s.id FROM spans s JOIN files f ON f.id=s.fileId WHERE f.buildId=?', second.id).map(item => item.id);
  assert.ok(newIds.every(id => !oldIds.includes(id))); for (const id of newIds) assert.equal(state.catalog.evidence(id).buildId, second.id);
  const changes = indexChanges(state.catalog);
  assert.equal(changes.complete, true); assert.equal(changes.counts.unchanged, 27); assert.equal(changes.files.length, 0);
  for (const source of second.sources) { assert.equal(source.revision, state.fixture.manifest.revisionVector[source.name]); assert.equal(fixtureGit(state.fixture.root, source.name, ['status', '--porcelain=v1']), ''); }
});

test('changed, added and removed paths rebuild affected code while old evidence stays pinned', async t => {
  const state = await setup(t), first = await state.index('first'), old = state.catalog.evidence(state.catalog.search('billing').hits[0]!.id);
  await writeFile(file(state.fixture.root, 'order-api', 'README.md'), '# Updated API\nRefreshChangedMarker\n');
  commit(state.fixture.root, 'order-api');
  await rm(file(state.fixture.root, 'portal', 'legacy/orders.js')); commit(state.fixture.root, 'portal');
  const consumer = await readFile(file(state.fixture.root, 'order-worker', 'src/main/java/OrderConsumer.java'), 'utf8');
  await writeFile(file(state.fixture.root, 'order-worker', 'src/main/java/AuditConsumer.java'), 'package audit;\n' + consumer.replaceAll('OrderConsumer', 'AuditConsumer'));
  commit(state.fixture.root, 'order-worker');
  const second = await state.index('second'), changes = indexChanges(state.catalog);
  assert.equal(changes.counts.changed, 1); assert.equal(changes.counts.added, 1); assert.equal(changes.counts.removed, 1);
  assert.equal(second.refresh.reusedFiles, 16); assert.equal(second.refresh.gitReadAttempts, 5);
  assert.ok(state.catalog.search('RefreshChangedMarker').hits.length); assert.equal(state.catalog.search('submitLegacy').hits.length, 0);
  assert.ok(codeFlows(state.catalog).nodes.some(node => node.label === 'audit.AuditConsumer.onMessage'));
  assert.ok(state.catalog.search('submitLegacy', first.id).hits.length); assert.deepEqual(state.catalog.evidence(old.id), old);
  for (const detail of changes.files) {
    if (detail.evidenceId) assert.equal(state.catalog.evidence(detail.evidenceId).buildId, second.id);
    if (detail.previousEvidenceId) assert.equal(state.catalog.evidence(detail.previousEvidenceId).buildId, first.id);
  }
});

test('a newly registered worker is inventoried and discovered instead of reusing a closed source set', async t => {
  const state = await setup(t, ['portal', 'order-api']); await state.index('first');
  assert.equal(codeFlows(state.catalog).nodes.some(node => node.kind === 'event-subscribe'), false);
  await state.catalog.addSource(path.join(state.fixture.root, 'sources/order-worker'));
  const build = await state.index('with-worker'), changes = indexChanges(state.catalog);
  assert.equal(build.refresh.reusedFiles, 13); assert.equal(changes.sources.find(source => source.name === 'order-worker')!.isNew, true);
  assert.equal(changes.counts.added, 8); assert.ok(codeFlows(state.catalog).edges.some(edge => edge.kind === 'event-delivery'));
});

test('corrupted bytes, incomplete spans and damaged metadata repair from pinned Git objects', async t => {
  const state = await setup(t); await state.index('first');
  const rows = state.store.all<{ id: string; path: string; raw: Uint8Array }>("SELECT id,path,raw FROM files WHERE status='indexed' AND sourceId=(SELECT id FROM sources WHERE name='portal') ORDER BY path");
  const bad = Buffer.alloc(rows[0]!.raw.byteLength, 120);
  state.store.run('UPDATE files SET raw=?,contentHash=? WHERE id=?', bad, sha256(bad), rows[0]!.id);
  state.store.run('DELETE FROM spans WHERE fileId=?', rows[1]!.id);
  state.store.run('UPDATE files SET metadata=? WHERE id=?', '{"kind":"poisoned"}', rows[2]!.id);
  const build = await state.index('repair'); assert.equal(build.refresh.cacheRejections, 3); assert.equal(build.refresh.reusedFiles, 15);
  assert.equal(build.refresh.gitReadAttempts, 6);
  for (const hit of state.catalog.search('submitOrder').hits) assert.notEqual(state.catalog.evidence(hit.id).metadata.kind, 'poisoned');
  assert.equal(indexChanges(state.catalog).counts.unchanged, 27);
});

test('policy, extractor, path, mode and source identity are cache boundaries', async t => {
  await t.test('policy and extractor', async sub => {
    const state = await setup(sub); const first = await state.index('first');
    state.store.run('UPDATE builds SET extractorVersion=? WHERE id=?', 'unqualified-extractor', first.id);
    assert.equal((await state.index('extractor-changed')).refresh.reusedFiles, 0);
    state.catalog.updatePolicy(['config']);
    const fresh = await state.index('policy-changed'); assert.equal(fresh.refresh.reusedFiles, 0); assert.equal(fresh.refresh.baselineBuildId, null);
    assert.throws(() => indexChanges(state.catalog, first.id), /old policy/);
  });
  await t.test('rename and mode', async sub => {
    const state = await setup(sub, ['portal']); await state.index('first');
    await rename(file(state.fixture.root, 'portal', 'README.md'), file(state.fixture.root, 'portal', 'README.txt')); commit(state.fixture.root, 'portal');
    fixtureGit(state.fixture.root, 'portal', ['update-index', '--chmod=+x', 'src/orders.ts']); fixtureGit(state.fixture.root, 'portal', ['commit', '-qm', 'Change an executable mode']);
    const build = await state.index('rename-mode'); assert.equal(build.refresh.reusedFiles, 4);
    const changes = indexChanges(state.catalog); assert.equal(changes.counts.added, 1); assert.equal(changes.counts.removed, 1); assert.equal(changes.counts.changed, 1);
  });
  await t.test('re-registration', async sub => {
    const state = await setup(sub, ['portal']); await state.index('first'); const old = state.catalog.state().sources[0]!;
    state.catalog.revoke(old.id); const added = await state.catalog.addSource(path.join(state.fixture.root, 'sources/portal'));
    assert.notEqual(added.id, old.id); const build = await state.index('re-registered'); assert.equal(build.refresh.reusedFiles, 0);
    assert.ok(indexChanges(state.catalog).files.every(item => item.sourceId !== old.id));
  });
});

test('new file limits are enforced before reuse and truncated inventory never proves removals', async t => {
  const state = await setup(t, ['portal']); await state.index('first');
  await state.restart(new CountingGit(), { totalBytes: 1 }); const totalLimited = await state.index('total-limit');
  assert.equal(totalLimited.refresh.reusedFiles, 0); assert.equal(totalLimited.refresh.gitReadAttempts, 0);
  assert.ok(totalLimited.coverage.reasons['total-byte-limit']);
  await state.restart(new CountingGit(), { paths: 2 }); const limited = await state.index('path-limit');
  assert.ok(limited.sources[0]!.omitted); const changes = indexChanges(state.catalog);
  assert.equal(changes.complete, false); assert.equal(changes.counts.removed, 0); assert.ok(changes.counts.uncompared);
  await state.restart(new CountingGit(), { fileBytes: 1 }); const lowerBytes = await state.index('file-limit');
  assert.equal(lowerBytes.refresh.reusedFiles, 0); assert.equal(lowerBytes.refresh.gitReadAttempts, 0); assert.ok(lowerBytes.coverage.reasons['file-size-limit']);
});

test('failed inventories remain unknown and complete update failure preserves the prior published index', async t => {
  class FailedInventory extends CountingGit {
    all = false;
    override async inventory(source: RepositoryIdentity, revision: string, signal: AbortSignal) {
      if (this.all || source.path.endsWith('/portal')) throw new Error('Synthetic inventory failure');
      return super.inventory(source, revision, signal);
    }
  }
  const state = await setup(t), first = await state.index('first'), reader = new FailedInventory();
  await state.restart(reader); const partial = await state.index('partial');
  assert.equal(partial.status, 'partial'); const changes = indexChanges(state.catalog);
  assert.equal(changes.complete, false); assert.equal(changes.counts.removed, 0); assert.ok(changes.counts.uncompared);
  reader.all = true; const failed = await state.index('failed'); assert.equal(failed.status, 'failed');
  assert.equal(state.catalog.state().publishedBuildId, partial.id); assert.throws(() => indexChanges(state.catalog, failed.id), /not been published/);
  assert.ok(state.catalog.search('billing', first.id).hits.length);
});

test('pause/restart/resume keeps the fixed baseline, pinned revision and completed reuse checkpoints', async t => {
  const state = await setup(t, ['portal']), first = await state.index('first'), reader = new GatedGit();
  await state.restart(reader); const next = state.begin('paused'); await reader.ready;
  state.catalog.control(next.id, 'pause'); reader.release(); await state.catalog.idle();
  assert.equal(state.store.build(next.id).status, 'paused'); assert.ok(state.store.build(next.id).refresh.reusedFiles);
  await state.restart(new CountingGit(), { paths: 2 });
  assert.throws(() => state.catalog.control(next.id, 'resume'), /Current limits do not cover/);
  await writeFile(file(state.fixture.root, 'portal', 'README.md'), '# Later HEAD\nNotInPausedIndex\n'); commit(state.fixture.root, 'portal');
  await state.restart(); state.catalog.control(next.id, 'resume'); await state.catalog.idle();
  const completed = state.store.build(next.id); assert.equal(completed.refresh.baselineBuildId, first.id); assert.equal(completed.refresh.reusedFiles, 6);
  assert.equal(completed.sources[0]!.revision, first.sources[0]!.revision); assert.equal(state.catalog.search('NotInPausedIndex').hits.length, 0);
  assert.equal(completed.refresh.gitReadAttempts, 1);
});

test('cancelled refreshes never publish copied checkpoints and source revocation purges all generations', async t => {
  const state = await setup(t, ['portal']), first = await state.index('first'), reader = new GatedGit();
  await state.restart(reader); const next = state.begin('cancel'); await reader.ready; state.catalog.control(next.id, 'cancel'); reader.release(); await state.catalog.idle();
  assert.equal(state.catalog.state().publishedBuildId, first.id); assert.throws(() => indexChanges(state.catalog, next.id), /not been published/);
  state.catalog.revoke(state.catalog.state().sources[0]!.id);
  assert.equal(state.store.one<{ count: number }>('SELECT count(*) AS count FROM files WHERE raw IS NOT NULL OR extractionHash IS NOT NULL')!.count, 0);
});

test('a failed reused-file publication rolls back its copied bytes and spans', async t => {
  const state = await setup(t, ['portal']), first = await state.index('first');
  state.store.db.exec("CREATE TRIGGER fail_reused_file BEFORE UPDATE OF reusedFromFileId ON files WHEN NEW.reusedFromFileId IS NOT NULL BEGIN SELECT RAISE(ABORT,'Synthetic reuse failure'); END;");
  const next = await state.index('failed-copy'); assert.equal(next.status, 'failed'); assert.match(next.reason!, /Synthetic reuse failure/);
  assert.equal(state.catalog.state().publishedBuildId, first.id); assert.equal(next.coverage.indexed, 0);
});

test('schema 4 upgrade validates legacy extraction before reuse and preserves engineer history', async t => {
  const state = await setup(t), first = await state.index('first'), code = codeFlows(state.catalog), edge = code.edges.find(edge => edge.kind === 'event-delivery')!;
  const corrections = new Corrections(state.catalog), saved = corrections.save({ requestId: 'legacy-note', buildId: first.id, targetKind: 'code-link', targetId: edge.id,
    projectionHash: code.inputHash, expectedRevision: 0, expectedPreviousId: null, action: 'clarify', statement: 'This is a local candidate.', environment: 'local' });
  const history = corrections.history(saved.id), evidence = state.catalog.evidence(state.catalog.search('OrderConsumer').hits[0]!.id);
  removeRefreshSchema(state.store); state.store.db.exec('PRAGMA user_version=4'); await state.restart();
  assert.equal(state.store.one<{ user_version: number }>('PRAGMA user_version')!.user_version, 5);
  assert.deepEqual(new Corrections(state.catalog).history(saved.id), history); assert.deepEqual(state.catalog.evidence(evidence.id), evidence);
  assert.equal(indexChanges(state.catalog, first.id).comparison, 'legacy');
  const next = await state.index('after-upgrade'); assert.equal(next.refresh.reusedFiles, 18); assert.equal(next.refresh.gitReadAttempts, 3);
  assert.equal(new Corrections(state.catalog).list().corrections.length, 0); assert.equal(new Corrections(state.catalog).list(first.id).corrections[0]!.id, saved.id);
});

test('change-summary HTTP uses the existing session and published/policy boundaries', async t => {
  const state = await setup(t), first = await state.index('first'), app = createApp(state.catalog), base = 'http://127.0.0.1:4244';
  const shared = { host: '127.0.0.1:4244', origin: base };
  assert.equal((await app.request(base + `/api/builds/${first.id}/changes`, { headers: shared })).status, 401);
  const session = await app.request(base + '/api/session', { method: 'POST', headers: { ...shared, 'x-loredock-client': 'web' } });
  const headers = { ...shared, cookie: session.headers.get('set-cookie')!.split(';')[0]! };
  const response = await app.request(base + `/api/builds/${first.id}/changes`, { headers }); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  state.catalog.updatePolicy(['config']); assert.equal((await app.request(base + `/api/builds/${first.id}/changes`, { headers })).status, 409);
});

test('comparison previews are bounded and share detail slots across changed sources', async t => {
  const state = await setup(t); await state.index('first');
  for (const repo of ['portal', 'order-worker']) {
    for (let index = 0; index < 60; index++) await writeFile(file(state.fixture.root, repo, `refresh-${index}.md`), 'New committed documentation.\n');
    commit(state.fixture.root, repo);
  }
  await state.index('many-changes'); const changes = indexChanges(state.catalog);
  assert.equal(changes.counts.added, 120); assert.equal(changes.files.length, 100); assert.equal(changes.omittedDetails, 20);
  assert.equal(changes.files.filter(item => item.sourceName === 'portal').length, 50);
  assert.equal(changes.files.filter(item => item.sourceName === 'order-worker').length, 50);
  assert.ok(Buffer.byteLength(JSON.stringify(changes)) <= changes.limits.outputBytes);
});
