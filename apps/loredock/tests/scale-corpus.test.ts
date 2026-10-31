import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { projectOrientation, orientationLimits } from '../src/orientation.js';
import { SourceGit, type RepositoryIdentity } from '../src/git.js';
// @ts-expect-error The independent fixture generator is plain JavaScript.
import { createScaleFixture, scaleGit } from '../../../scripts/loredock-scale-fixture.mjs';

async function setup(t: TestContext, git?: SourceGit) {
  const fixture = await createScaleFixture() as { root: string; manifest: { sources: { id: string }[] } };
  const directory = path.join(fixture.root, 'data');
  const state = { fixture, store: new CatalogStore(directory), catalog: undefined as unknown as Catalog,
    paths: fixture.manifest.sources.map(source => path.join(fixture.root, 'sources', source.id)),
    async restart() { await state.catalog.stop(); state.store.close(); state.store = new CatalogStore(directory); state.catalog = new Catalog(state.store, git); },
    async index(requestId: string) { const p = state.catalog.state(); const b = state.catalog.start(requestId, p.sourceSetVersion, p.policyVersion); await state.catalog.idle(); return state.store.build(b.id); } };
  state.catalog = new Catalog(state.store, git);
  t.after(async () => { await state.catalog.stop(); state.store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  return state;
}
async function register(s: Awaited<ReturnType<typeof setup>>) {
  const preview = await s.catalog.previewSources(s.paths);
  return s.catalog.registerSources({ paths: s.paths, previewHash: preview.previewHash, requestId: 'twenty' });
}

test('twenty-source registration, overflow, orientation, refresh/history and revocation use production limits', async t => {
  const s = await setup(t), receipt = await register(s);
  assert.equal(receipt.sourceIds.length, 20); assert.equal(s.catalog.state().limits.sources, 20);
  const first = await s.index('initial'); assert.equal(first.coverage.indexed, 79); assert.equal(first.coverage.excluded, 60);
  const overview = projectOrientation(s.catalog); assert.equal(overview.sources.length, 20); assert.equal(overview.coverage.withContext, 20);
  const evidence = s.catalog.evidence(overview.sources[19]!.context!.evidenceIds[0]!);
  const second = await s.index('refresh'); assert.equal(second.refresh.reusedFiles, 79); assert.equal(second.refresh.gitReadAttempts, 20);
  assert.deepEqual(s.catalog.evidence(evidence.id), evidence); await s.restart(); assert.deepEqual(s.catalog.evidence(evidence.id), evidence);
  const extra = path.join(s.fixture.root, 'extra'); await mkdir(extra);
  execFileSync('git', ['init', '-q', '--template=' + path.join(s.fixture.root, 'empty-template')], { cwd: extra });
  const overflow = await s.catalog.previewSources([extra]); assert.equal(overflow.canRegister, false); assert.equal(overflow.available, 0);
  await assert.rejects(s.catalog.registerSources({ paths: [extra], previewHash: overflow.previewHash, requestId: 'overflow' }), { code: 'SOURCE_LIMIT' });
  assert.equal(s.store.sources().length, 20);
  s.catalog.revoke(receipt.sourceIds[19]!); assert.equal(projectOrientation(s.catalog).sources.length, 19);
  assert.throws(() => s.catalog.evidence(evidence.id), /unavailable/);
  assert.equal((await s.catalog.previewSources([extra])).canRegister, true);
  for (const source of s.fixture.manifest.sources) assert.equal(scaleGit(s.fixture.root, source.id, ['status', '--porcelain=v1']), '');
});

class PausingGit extends SourceGit {
  onFirstBlob: (() => void) | undefined;
  override async blob(identity: RepositoryIdentity, blob: string, signal: AbortSignal, limit: number) {
    const bytes = await super.blob(identity, blob, signal, limit);
    this.onFirstBlob?.(); this.onFirstBlob = undefined; return bytes;
  }
}

test('a ten-thousand-file first repository cannot starve later README cards; shares survive restart and resume', async t => {
  const git = new PausingGit(), s = await setup(t, git), portal = s.paths[0]!;
  const dir = path.join(portal, 'bulk'); await mkdir(dir);
  for (let start = 0; start < 10010; start += 100) await Promise.all(Array.from({ length: Math.min(100, 10010 - start) }, (_, i) => writeFile(path.join(dir, `f${String(start + i).padStart(5, '0')}.txt`), start + i < 4 ? 'x'.repeat(900000) : 'Small source file.\n')));
  scaleGit(s.fixture.root, 'portal', ['add', 'bulk']); scaleGit(s.fixture.root, 'portal', ['commit', '-qm', 'Add imbalanced committed inventory']);
  await register(s); const state = s.catalog.state(), b = s.catalog.start('imbalanced', state.sourceSetVersion, state.policyVersion);
  git.onFirstBlob = () => s.catalog.control(b.id, 'pause'); await s.catalog.idle(); assert.equal(s.store.build(b.id).status, 'paused');
  const allocation = s.store.buildRow(b.id).allocation; await s.restart();
  s.catalog.control(b.id, 'resume'); await s.catalog.idle(); const build = s.store.build(b.id);
  assert.equal(s.store.buildRow(b.id).allocation, allocation); assert.equal(build.coverage.pending, 0);
  assert.ok(build.sources[0]!.omitted > 9500); assert.ok(build.sources[0]!.coverage.bytes <= 50 * 1024 * 1024 / 20);
  assert.ok(build.sources[0]!.coverage.reasons['source-byte-limit']! >= 2);
  assert.equal(projectOrientation(s.catalog).coverage.withContext, 20);
  assert.ok(build.sources.slice(1).every(source => source.coverage.indexed > 0 && source.omitted === 0));
  assert.ok(s.store.one<{ n: number }>('SELECT count(*) n FROM files WHERE buildId=?', b.id)!.n <= 10000);
});

test('twenty maximum-size baseline READMEs receive attempts before manifests; oversized docs remain explicit gaps', async t => {
  const s = await setup(t), prefix = '# Repository\nOriginal documented responsibility.\n\n';
  for (const source of s.fixture.manifest.sources) {
    await writeFile(path.join(s.fixture.root, 'sources', source.id, 'README.md'), prefix + 'x'.repeat(orientationLimits.fileBytes - Buffer.byteLength(prefix)));
    scaleGit(s.fixture.root, source.id, ['add', 'README.md']); scaleGit(s.fixture.root, source.id, ['commit', '-qm', 'Add bounded long documentation']);
  }
  await register(s); await s.index('long'); const overview = projectOrientation(s.catalog);
  assert.equal(overview.coverage.withContext, 20); assert.equal(overview.coverage.parsedBytes, orientationLimits.textBytes);
  assert.ok(overview.sources.every(source => source.reading.length === 1)); assert.ok(overview.omissions['input-byte-limit']! > 0);
  assert.ok(Buffer.byteLength(JSON.stringify(overview)) <= orientationLimits.outputBytes);
  await writeFile(path.join(s.paths[0]!, 'README.md'), prefix + 'x'.repeat(orientationLimits.fileBytes));
  scaleGit(s.fixture.root, 'portal', ['add', 'README.md']); scaleGit(s.fixture.root, 'portal', ['commit', '-qm', 'Exceed orientation file bound']);
  await s.index('oversized'); const after = projectOrientation(s.catalog);
  assert.equal(after.sources[0]!.readme.state, 'limited'); assert.equal(after.coverage.withContext, 19);
});
