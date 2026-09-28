import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore, type FileRow } from '../src/store.js';
import { SourceGit, safePath, type RepositoryIdentity } from '../src/git.js';
import { exclusion, sha256 } from '../src/extract.js';
// @ts-expect-error The reviewer-owned corpus generator is a plain JavaScript tool.
import { createLoreDockFixture } from '../../../scripts/loredock-fixture.mjs';

interface Fixture { root: string; manifest: { revisionVector: Record<string, string> } }
async function setup(t: TestContext, git?: SourceGit, limits = {}) {
  const fixture = await createLoreDockFixture() as Fixture;
  const directory = path.join(fixture.root, 'catalog');
  const store = new CatalogStore(directory);
  const catalog = new Catalog(store, git, limits);
  let closed = false;
  const close = async () => { if (!closed) { if (git instanceof GatedGit) git.release(); await catalog.stop(); store.close(); closed = true; } };
  t.after(async () => { await close(); await rm(fixture.root, { recursive: true, force: true }); });
  return { fixture, directory, store, catalog, close };
}
function start(catalog: Catalog, requestId: string = crypto.randomUUID()) {
  const state = catalog.state(); return catalog.start(requestId, state.sourceSetVersion, state.policyVersion);
}
function git(cwd: string, args: string[]) {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', '-c', 'user.name=LoreDock Test', '-c', 'user.email=test@example.invalid', ...args],
    { cwd, encoding: 'utf8', env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } }).trim();
}
async function addAll(catalog: Catalog, fixture: Fixture) {
  for (const id of ['portal', 'order-api', 'order-worker']) await catalog.addSource(path.join(fixture.root, 'sources', id));
}

test('indexes the frozen corpus, exposes coverage and reopens exact persisted evidence without mutating sources', async t => {
  const { catalog, store, fixture } = await setup(t);
  await addAll(catalog, fixture);
  const build = start(catalog); await catalog.idle();
  const result = store.build(build.id);
  assert.equal(result.status, 'partial');
  assert.deepEqual({ ...result.coverage, bytes: 0 }, { indexed: 18, excluded: 9, failed: 0, pending: 0, bytes: 0, reasons: { binary: 3, policy: 3, symlink: 3 } });
  for (const source of result.sources) {
    assert.equal(source.revision, fixture.manifest.revisionVector[source.name]);
    assert.equal(source.dirty, false);
    assert.equal(git(path.join(fixture.root, 'sources', source.name), ['status', '--porcelain']), '');
  }
  const found = catalog.search('orders.placed.v2'); assert.equal(found.hits.length, 3);
  for (const hit of found.hits) {
    const evidence = catalog.evidence(hit.id);
    const bytes = await readFile(path.join(fixture.root, 'sources', hit.sourceName, hit.path), 'utf8');
    assert.equal(evidence.text, bytes.replace(/\n$/, ''));
    assert.equal(evidence.revision, fixture.manifest.revisionVector[hit.sourceName]);
    assert.equal(evidence.startLine, 1);
  }
  assert.equal(catalog.search('SYNTHETIC_OUTSIDE_READ_CANARY').hits.length, 0);
  assert.equal(catalog.search('acceptable answers').hits.length, 0);
  assert.ok(catalog.search('Invent an evidence ID').hits.length > 0, 'Source instructions remain inert searchable text');
  assert.throws(() => catalog.evidence('../outside/canary.txt'), /unavailable/);
  const maven = catalog.search('maven.compiler.release').hits.find(hit => hit.sourceName === 'order-api')!;
  assert.equal(catalog.evidence(maven.id).metadata.artifactId, 'order-api');
});

test('duplicate requests replay the original build and different payloads conflict', async t => {
  const { catalog, fixture, store } = await setup(t);
  await catalog.addSource(path.join(fixture.root, 'sources/portal'));
  const state = catalog.state(), first = start(catalog, 'same-request');
  assert.equal(start(catalog, 'same-request').id, first.id);
  assert.throws(() => catalog.start('same-request', state.sourceSetVersion + 1, state.policyVersion), /different inputs/);
  assert.throws(() => start(catalog), /unfinished/);
  await catalog.idle();
  assert.equal(store.all('SELECT * FROM builds').length, 1);
  assert.equal(start(catalog, 'same-request').id, first.id);
});

test('new commits add/remove files while previous evidence and revision vectors remain immutable', async t => {
  const { catalog, fixture, store } = await setup(t);
  const repo = path.join(fixture.root, 'sources/portal');
  await catalog.addSource(repo); const first = start(catalog); await catalog.idle();
  const old = catalog.search('billing').hits[0]!; const before = catalog.evidence(old.id);
  await writeFile(path.join(repo, 'README.md'), '# Changed source\nThe checkout has moved.\n');
  await writeFile(path.join(repo, 'new.md'), 'NewlyAddedMarker\n');
  await rm(path.join(repo, 'legacy/orders.js'));
  git(repo, ['add', '--all']); git(repo, ['commit', '--quiet', '-m', 'Change the synthetic source']);
  const second = start(catalog); await catalog.idle();
  assert.equal(catalog.search('NewlyAddedMarker').hits.length, 1);
  assert.equal(catalog.search('submitLegacy').hits.length, 0);
  assert.equal(catalog.search('submitLegacy', first.id).hits.length, 1);
  assert.deepEqual(catalog.evidence(old.id), before);
  assert.notEqual(store.build(first.id).sources[0]!.revision, store.build(second.id).sources[0]!.revision);
});

test('policy changes fence historical content immediately and rebuild with the new exclusions', async t => {
  const { catalog, fixture } = await setup(t);
  await addAll(catalog, fixture); const build = start(catalog); await catalog.idle();
  const hit = catalog.search('orders.placed.v2').hits[0]!;
  for (const bad of [['../escape'], ['/absolute'], ['config\\file'], ['*.md'], 'string']) assert.throws(() => catalog.updatePolicy(bad), /relative paths/);
  catalog.updatePolicy(['config']);
  assert.equal(catalog.state().publishedBuildId, null);
  assert.throws(() => catalog.evidence(hit.id), /old policy/);
  assert.throws(() => catalog.search('topic', build.id), /old policy/);
  start(catalog); await catalog.idle();
  assert.ok(catalog.search('orders.placed.v2').hits.every(row => !row.path.startsWith('config/')));
});

test('revocation fences evidence before purge and unfinished purge resumes on restart', async t => {
  const { catalog, store, fixture, directory, close } = await setup(t);
  const source = await catalog.addSource(path.join(fixture.root, 'sources/order-api')); start(catalog); await catalog.idle();
  const hit = catalog.search('orders.placed.v2').hits[0]!;
  store.revoke(source.id); // Simulate a crash after the authorization fence commits.
  assert.equal(catalog.search('orders.placed.v2').hits.length, 0);
  assert.throws(() => catalog.evidence(hit.id), /revoked/);
  assert.equal(store.source(source.id).purge, 'pending'); await close();
  const reopened = new CatalogStore(directory); const restarted = new Catalog(reopened);
  try {
    assert.equal(reopened.source(source.id).purge, 'completed');
    assert.equal(reopened.one<{ count: number }>('SELECT count(*) AS count FROM files WHERE raw IS NOT NULL')!.count, 0);
    assert.equal(reopened.one<{ count: number }>('SELECT count(*) AS count FROM search')!.count, 0);
    assert.throws(() => restarted.evidence(hit.id), /unavailable/);
  } finally { await restarted.stop(); reopened.close(); }
});

class GatedGit extends SourceGit {
  readonly reads = new Map<string, number>();
  release!: () => void;
  private reached!: () => void;
  readonly ready = new Promise<void>(resolve => { this.reached = resolve; });
  private gate = new Promise<void>(resolve => { this.release = resolve; });
  private blocked = false;
  override async blob(identity: RepositoryIdentity, blob: string, signal: AbortSignal, maxBytes: number) {
    const result = await super.blob(identity, blob, signal, maxBytes);
    this.reads.set(blob, (this.reads.get(blob) ?? 0) + 1);
    if (!this.blocked) { this.blocked = true; this.reached(); await this.gate; }
    return result; // Deliberately ignores a late abort to test publication fencing.
  }
}
test('pause finishes one file and explicit resume reuses the completed checkpoint', async t => {
  const git = new GatedGit(); const { catalog, fixture, store } = await setup(t, git);
  await catalog.addSource(path.join(fixture.root, 'sources/portal')); const build = start(catalog);
  await git.ready; catalog.control(build.id, 'pause'); assert.equal(store.build(build.id).status, 'pause_requested');
  git.release(); await catalog.idle();
  assert.equal(store.build(build.id).status, 'paused'); assert.equal(store.build(build.id).coverage.indexed, 1);
  catalog.control(build.id, 'resume'); await catalog.idle();
  assert.equal(store.build(build.id).status, 'partial'); assert.ok([...git.reads.values()].every(count => count === 1));
});
test('cancel and revocation prevent a late file result from publishing', async t => {
  for (const mode of ['cancel', 'revoke'] as const) {
    const git = new GatedGit(); const { catalog, fixture, store } = await setup(t, git);
    const source = await catalog.addSource(path.join(fixture.root, 'sources/portal')); const build = start(catalog);
    await git.ready;
    if (mode === 'cancel') catalog.control(build.id, 'cancel'); else catalog.revoke(source.id);
    git.release(); await catalog.idle();
    assert.equal(store.build(build.id).status, 'cancelled');
    assert.equal(store.build(build.id).coverage.indexed, 0); assert.equal(catalog.state().publishedBuildId, null);
  }
});
test('restart classifies unfinished work as interrupted and validates checkpoints before resume', async t => {
  const git = new GatedGit(); const { catalog, fixture, store, directory, close } = await setup(t, git);
  await catalog.addSource(path.join(fixture.root, 'sources/portal')); const build = start(catalog);
  await git.ready; catalog.control(build.id, 'pause'); git.release(); await catalog.idle();
  const file = store.one<FileRow>("SELECT * FROM files WHERE status='indexed'")!;
  await close();
  const crashed = new CatalogStore(directory); crashed.run("UPDATE builds SET status='running' WHERE id=?", build.id); crashed.close();
  const reopened = new CatalogStore(directory), resumed = new Catalog(reopened);
  try {
    assert.equal(reopened.build(build.id).status, 'interrupted');
    reopened.run('UPDATE files SET raw=? WHERE id=?', Buffer.from('corrupted'), file.id);
    assert.throws(() => resumed.control(build.id, 'resume'), /validation/);
    reopened.run('UPDATE files SET raw=? WHERE id=?', file.raw!, file.id);
    resumed.control(build.id, 'resume'); await resumed.idle();
    assert.equal(reopened.build(build.id).status, 'partial');
    assert.equal(reopened.one<FileRow>('SELECT * FROM files WHERE id=?', file.id)!.contentHash, file.contentHash);
  } finally { await resumed.stop(); reopened.close(); }
});

test('hostile configuration, filters, unsupported content and dirty files cannot execute or leak into evidence', async t => {
  const { catalog, fixture, store } = await setup(t);
  const repo = path.join(fixture.root, 'sources/portal'), marker = path.join(fixture.root, 'EXECUTED');
  await writeFile(path.join(repo, '.gitattributes'), 'README.md filter=canary\n');
  await writeFile(path.join(repo, 'pom.xml'), '<!DOCTYPE project [<!ENTITY secret SYSTEM "file:///outside/canary.txt">]><project>&secret;</project>');
  await writeFile(path.join(repo, 'invalid.txt'), Buffer.from([0xc3, 0x28]));
  await writeFile(path.join(repo, 'large.txt'), 'x'.repeat(1024 * 1024 + 1));
  await writeFile(path.join(repo, 'pointer.txt'), 'version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 200\n');
  await writeFile(path.join(repo, 'bad.json'), '{bad');
  git(repo, ['add', '--all']);
  const head = git(repo, ['rev-parse', 'HEAD']);
  git(repo, ['update-index', '--add', '--cacheinfo', `160000,${head},linked-service`]);
  git(repo, ['commit', '--quiet', '-m', 'Add hostile synthetic inputs']);
  git(repo, ['config', 'filter.canary.clean', `touch '${marker}'`]);
  git(repo, ['config', 'core.fsmonitor', `touch '${marker}'`]);
  await writeFile(path.join(repo, 'README.md'), 'UNCOMMITTED_ONLY_MARKER\n');
  await mkdir(path.join(repo, '.git/hooks'), { recursive: true });
  await writeFile(path.join(repo, '.git/hooks/post-checkout'), `#!/bin/sh\ntouch '${marker}'\n`, { mode: 0o700 });
  const indexBefore = await readFile(path.join(repo, '.git/index'));
  await catalog.addSource(repo); const build = start(catalog); await catalog.idle();
  const result = store.build(build.id);
  for (const reason of ['submodule', 'symlink', 'policy', 'binary', 'invalid-utf8', 'file-size-limit', 'lfs-pointer', 'xml-entity-declaration', 'malformed-json']) assert.ok(result.coverage.reasons[reason], reason);
  assert.equal(result.sources[0]!.dirty, true);
  assert.equal(catalog.search('UNCOMMITTED_ONLY_MARKER').hits.length, 0);
  assert.ok(catalog.search('billing').hits.length > 0);
  await assert.rejects(readFile(marker), { code: 'ENOENT' });
  assert.deepEqual(await readFile(path.join(repo, '.git/index')), indexBefore);
  assert.equal(await readFile(path.join(repo, 'README.md'), 'utf8'), 'UNCOMMITTED_ONLY_MARKER\n');
  for (const filePath of ['../outside', '/tmp/file', 'a/../b', 'a\\b', 'a\nb']) {
    assert.equal(safePath(filePath), false);
    assert.equal(exclusion({ path: filePath, mode: '100644', blob: head, size: 1 }, { excludedPaths: [] }, 1024), 'unsafe-path');
  }
});
test('empty revisions, inventory limits and total-byte limits stay visible as partial coverage', async t => {
  const { catalog, fixture, store } = await setup(t, undefined, { paths: 2, totalBytes: 1 });
  const empty = path.join(fixture.root, 'empty'); await mkdir(empty); git(empty, ['init', '--quiet']);
  await catalog.addSource(empty); await catalog.addSource(path.join(fixture.root, 'sources/portal'));
  const build = start(catalog); await catalog.idle(); const result = store.build(build.id);
  assert.equal(result.status, 'partial'); assert.equal(result.sources[0]!.status, 'failed');
  assert.equal(result.sources[0]!.revision, null); assert.match(result.sources[0]!.error!, /Exit:/);
  assert.ok(result.sources[1]!.omitted > 0); assert.ok(result.coverage.reasons['total-byte-limit']);
  assert.equal(catalog.search('billing').hits.length, 0);
});
test('wall-time exhaustion pauses durably and invalid identity remains a visible source error', async t => {
  const { catalog, fixture, store } = await setup(t, undefined, { wallMs: 0 });
  await catalog.addSource(path.join(fixture.root, 'sources/portal')); const build = start(catalog); await catalog.idle();
  assert.equal(store.build(build.id).status, 'paused'); assert.match(store.build(build.id).reason!, /Wall-time/);
  catalog.control(build.id, 'cancel');
  await assert.rejects(catalog.addSource('/path/that/does/not/exist'), /unavailable/);
});
test('a data directory has one owner and cannot be a Workbench directory', async t => {
  const { directory } = await setup(t);
  assert.throws(() => new CatalogStore(directory), /already in use/);
  const other = await mkdtemp(path.join(tmpdir(), 'loredock-owner-')); t.after(() => rm(other, { recursive: true, force: true }));
  await writeFile(path.join(other, 'workbench.db'), 'sentinel');
  assert.throws(() => new CatalogStore(other), /separate/);
  assert.equal(await readFile(path.join(other, 'workbench.db'), 'utf8'), 'sentinel');
});

test('an unavailable source cannot replace the last published index with a failed build', async t => {
  const { catalog, fixture, store } = await setup(t);
  const repo = path.join(fixture.root, 'sources/portal');
  await catalog.addSource(repo); const first = start(catalog); await catalog.idle();
  const evidence = catalog.evidence(catalog.search('billing').hits[0]!.id);
  await rm(repo, { recursive: true, force: true });
  const second = start(catalog); await catalog.idle();
  assert.equal(store.build(second.id).status, 'failed');
  assert.equal(catalog.state().publishedBuildId, first.id);
  assert.deepEqual(catalog.evidence(evidence.id), evidence);
});

test('CRLF and Unicode source ranges reopen exactly and inconsistent spans are rejected', async t => {
  const { catalog, fixture, store } = await setup(t);
  const repo = path.join(fixture.root, 'sources/portal');
  await writeFile(path.join(repo, 'ranges.txt'), Array.from({ length: 125 }, (_, i) => `Line ${i + 1}: café ${i === 124 ? 'FinalMarker' : 'content'}`).join('\r\n') + '\r\n');
  git(repo, ['add', 'ranges.txt']); git(repo, ['commit', '--quiet', '-m', 'Add range fixture']);
  await catalog.addSource(repo); start(catalog); await catalog.idle();
  const hit = catalog.search('FinalMarker').hits[0]!, evidence = catalog.evidence(hit.id);
  assert.equal(evidence.startLine, 121); assert.equal(evidence.endLine, 125);
  assert.match(evidence.text, /café FinalMarker$/); assert.ok(!evidence.text.includes('\r'));
  const forged = 'Invented text';
  store.run('UPDATE spans SET text=?,hash=? WHERE id=?', forged, sha256(forged), hit.id);
  assert.throws(() => catalog.evidence(hit.id), /source range/);
});

test('registration deduplicates canonical identities and rejects an additional active source beyond the pilot limit', async t => {
  const { catalog, fixture } = await setup(t); await addAll(catalog, fixture);
  const portal = catalog.state().sources.find(source => source.name === 'portal')!;
  assert.equal((await catalog.addSource(path.join(fixture.root, 'sources/portal/src'))).id, portal.id);
  const extra = path.join(fixture.root, 'fourth'); await mkdir(extra); git(extra, ['init', '--quiet']);
  await assert.rejects(catalog.addSource(extra), /three active/);
  catalog.revoke(portal.id); assert.ok(await catalog.addSource(extra));
});
