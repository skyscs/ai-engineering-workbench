import assert from 'node:assert/strict';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { lookupCodeSymbols } from '../src/code-symbols.js';
import { codeFlows } from '../src/code-flows.js';
import { createApp } from '../src/app.js';
// @ts-expect-error Owned fixture generation is plain JavaScript.
import { createLoreDockFixture, fixtureGit } from '../../../scripts/loredock-fixture.mjs';
// @ts-expect-error Owned volume-shape generation is plain JavaScript.
import { createCapacityFixture } from '../../../scripts/loredock-capacity-fixture.mjs';

async function setup(t: TestContext, options: { volume?: boolean; repeatedClass?: boolean; packagedClasses?: boolean } = {}) {
  const fixture = options.volume ? await createCapacityFixture(5) : await createLoreDockFixture();
  if (options.repeatedClass) for (const source of ['order-api', 'order-worker']) {
    await writeFile(path.join(fixture.root, 'sources', source, 'src/main/java/Amber.java'),
      'public class Amber {\n' + Array.from({ length: 20 }, (_, index) => `  public String method${index}() { return "amber"; }`).join('\n') + '\n}\n');
    fixtureGit(fixture.root, source, ['add', 'src/main/java/Amber.java']); fixtureGit(fixture.root, source, ['commit', '-m', 'Add owned symbol lookup example']);
  }
  if (options.packagedClasses) {
    for (const [source, namespace] of [['order-api', 'demo.alpha'], ['order-worker', 'demo.beta']] as const) {
      await writeFile(path.join(fixture.root, 'sources', source, 'src/main/java/Shared.java'),
        `package ${namespace};\npublic class Shared {\n  public String run(String value) { return value; }\n  public String run(int value) { return "owned"; }\n  public void stop() {}\n}\n`);
      fixtureGit(fixture.root, source, ['add', 'src/main/java/Shared.java']); fixtureGit(fixture.root, source, ['commit', '-m', 'Add owned packaged Java methods']);
    }
    await writeFile(path.join(fixture.root, 'sources/portal/src/Shared.ts'), 'export function run() { return "owned"; }\n');
    fixtureGit(fixture.root, 'portal', ['add', 'src/Shared.ts']); fixtureGit(fixture.root, 'portal', ['commit', '-m', 'Add unrelated TypeScript function']);
  }
  const store = new CatalogStore(path.join(fixture.root, 'symbols-data')), catalog = new Catalog(store), analysis = new CodeAnalysis(catalog);
  t.after(async () => { await analysis.stop(); await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  const sources: string[] = options.volume ? fixture.manifest.sources.map((source: { id: string }) => source.id) : ['portal', 'order-api', 'order-worker'];
  const paths = sources.map(id => path.join(fixture.root, 'sources', id)), preview = await catalog.previewSources(paths);
  await catalog.registerSources({ paths, previewHash: preview.previewHash, requestId: 'sources' });
  if (options.repeatedClass || options.packagedClasses) store.run("UPDATE sources SET name='same display name' WHERE name IN ('order-api','order-worker')");
  const index = async (key: string) => { const state = catalog.state(), build = catalog.start(key, state.sourceSetVersion, state.policyVersion); await catalog.idle(); return build.id; };
  const buildId = await index('initial');
  const analyze = async (key: string, id = buildId) => { const run = analysis.start(key, id); await analysis.idle(); return run.id; };
  return { fixture, store, catalog, analysis, buildId, index, analyze };
}

test('literal simple, qualified and class lookup retains original support without recomputing full index summaries per file', async t => {
  const s = await setup(t); assert.equal((await lookupCodeSymbols(s.analysis, 'Orders.accept', s.buildId)).status, 'unavailable');
  const id = await s.analyze('all'), graph = codeFlows(s.catalog);
  let summaries = 0; const originalBuild = s.store.build.bind(s.store); s.store.build = id => { summaries++; return originalBuild(id); };
  const qualified = await lookupCodeSymbols(s.analysis, ' Orders.accept ', s.buildId);
  assert.equal(qualified.query, 'Orders.accept'); assert.equal(qualified.matches.length, 1); assert.equal(qualified.inventory!.id, id);
  assert.equal(qualified.matches[0]!.sourceName, 'order-api'); assert.equal(qualified.matches[0]!.qualifiedName, 'Orders.accept');
  assert.equal(qualified.coverage!.scanComplete, true); assert.equal(qualified.coverage!.scannedFiles, 5); assert.equal(summaries, 0);
  s.store.build = originalBuild;
  for (const name of ['accept', 'Orders']) assert.deepEqual((await lookupCodeSymbols(s.analysis, name, s.buildId)).matches, qualified.matches);
  for (const name of ['orders.accept', 'Orders accept', "' OR 1=1 --", 'Orders.*']) assert.equal((await lookupCodeSymbols(s.analysis, name, s.buildId)).matches.length, 0);
  const match = qualified.matches[0]!;
  for (const ref of match.evidence) {
    const original = s.catalog.evidence(ref.id); assert.equal(original.sourceId, match.sourceId); assert.equal(original.buildId, s.buildId);
    assert.equal(original.path, match.path); assert.equal(original.revision, match.revision); assert.equal(original.blobId, match.blob);
    assert.ok(ref.startLine <= match.range.endLine && ref.endLine >= match.range.startLine);
  }
  for (const bad of ['', ' '.repeat(2), '😀'.repeat(51)]) await assert.rejects(lookupCodeSymbols(s.analysis, bad, s.buildId), { code: 'INVALID_QUERY' });
  assert.deepEqual(codeFlows(s.catalog), graph); assert.equal(s.store.all('SELECT id FROM answer_attempts').length, 0);
});

test('symbol lookup balances duplicate display names by source identity and exposes match, output and time bounds', async t => {
  const s = await setup(t, { repeatedClass: true }); await s.analyze('classes');
  const result = await lookupCodeSymbols(s.analysis, 'Amber', s.buildId);
  assert.equal(result.coverage!.matchingSymbols, 40); assert.equal(result.matches.length, 20); assert.equal(result.coverage!.omittedMatches, 20);
  assert.equal(result.coverage!.matchedSources, 2); assert.notEqual(result.matches[0]!.sourceId, result.matches[1]!.sourceId);
  assert.equal(result.matches[0]!.sourceName, result.matches[1]!.sourceName);
  assert.equal(result.matches.filter(match => match.sourceId === result.matches[0]!.sourceId).length, 10);
  const three = await lookupCodeSymbols(s.analysis, 'Amber', s.buildId, { matches: 3 });
  assert.deepEqual(three.matches.map(match => match.sourceId), [result.matches[0]!.sourceId, result.matches[1]!.sourceId, result.matches[0]!.sourceId]);
  const bounded = await lookupCodeSymbols(s.analysis, 'Amber', s.buildId, { outputBytes: 4096 });
  assert.equal(bounded.coverage!.outputLimited, true); assert.ok(Buffer.byteLength(JSON.stringify(bounded)) <= 4096);
  assert.equal(bounded.coverage!.omittedMatches, 40 - bounded.matches.length);
  const stopped = await lookupCodeSymbols(s.analysis, 'Amber', s.buildId, { wallMs: 0 });
  assert.equal(stopped.coverage!.scannedFiles, 0); assert.equal(stopped.coverage!.timeStopped, true); assert.equal(stopped.coverage!.scanComplete, false);
  const none = await lookupCodeSymbols(s.analysis, 'Amber', s.buildId, { matches: 0 }); assert.equal(none.matches.length, 0); assert.equal(none.coverage!.matchingSymbols, 40);
  await assert.rejects(lookupCodeSymbols(s.analysis, 'Amber', s.buildId, { matches: 21 }), { code: 'INVALID_LIMIT' });
});

test('lookup selects the matching historical inventory and rejects corrupt checkpoints or original support', async t => {
  const s = await setup(t), first = await s.analyze('first'), laterBuild = await s.index('later'), later = await s.analyze('later', laterBuild);
  assert.equal((await lookupCodeSymbols(s.analysis, 'accept', s.buildId)).inventory!.id, first);
  assert.equal((await lookupCodeSymbols(s.analysis, 'accept', laterBuild)).inventory!.id, later);
  const unit = s.store.one<{ fileId: string; payload: string }>("SELECT fileId,payload FROM code_analysis_files WHERE runId=? AND status='parsed' ORDER BY ordinal LIMIT 1", later)!;
  s.store.run("UPDATE code_analysis_files SET payload='{}' WHERE runId=? AND fileId=?", later, unit.fileId);
  await assert.rejects(lookupCodeSymbols(s.analysis, 'accept', laterBuild), { code: 'CORRUPT_CODE_CHECKPOINT' });
  s.store.run('UPDATE code_analysis_files SET payload=? WHERE runId=? AND fileId=?', unit.payload, later, unit.fileId);
  const raw = s.store.one<{ raw: Uint8Array }>('SELECT raw FROM files WHERE id=?', unit.fileId)!.raw;
  s.store.run('UPDATE files SET raw=? WHERE id=?', Buffer.alloc(raw.length, 97), unit.fileId);
  await assert.rejects(lookupCodeSymbols(s.analysis, 'accept', laterBuild), { code: 'CORRUPT_EVIDENCE' });
  s.store.run('UPDATE files SET raw=? WHERE id=?', raw, unit.fileId);
  const owner = s.store.one<{ sourceId: string }>('SELECT sourceId FROM files WHERE id=?', unit.fileId)!.sourceId;
  const foreign = s.catalog.state().sources.find(source => source.id !== owner)!.id;
  s.store.run('UPDATE files SET sourceId=? WHERE id=?', foreign, unit.fileId);
  await assert.rejects(lookupCodeSymbols(s.analysis, 'accept', laterBuild), { code: 'CORRUPT_CODE_CHECKPOINT' });
  s.store.run('UPDATE files SET sourceId=? WHERE id=?', owner, unit.fileId);
  s.store.run("UPDATE code_analyses SET fingerprint='old-parser' WHERE id=?", later);
  assert.equal((await lookupCodeSymbols(s.analysis, 'accept', laterBuild)).status, 'unavailable');
  s.store.run('UPDATE code_analyses SET fingerprint=? WHERE id=?', s.analysis.fingerprint, later);
  s.store.run('DELETE FROM code_analysis_files WHERE runId=? AND fileId=?', later, unit.fileId);
  await assert.rejects(lookupCodeSymbols(s.analysis, 'accept', laterBuild), { code: 'CORRUPT_CODE_CHECKPOINT' });
});

test('a paused repeat does not hide the compatible published inventory for the same index', async t => {
  const s = await setup(t), published = await s.analyze('published');
  const repeat = s.analysis.start('repeat', s.buildId); s.analysis.control(repeat.id, 'pause'); await s.analysis.idle();
  assert.equal(s.analysis.get(repeat.id).published, false);
  assert.equal((await lookupCodeSymbols(s.analysis, 'accept', s.buildId)).inventory!.id, published);
});

test('short Java class and method names preserve packages, overloads and source identity without treating filenames as classes', async t => {
  const s = await setup(t, { packagedClasses: true }), id = await s.analyze('packaged'), fingerprint = s.analysis.fingerprint;
  const short = await lookupCodeSymbols(s.analysis, 'Shared.run', s.buildId);
  assert.equal(short.schemaVersion, 'loredock-code-symbols/2'); assert.equal(short.inventory!.id, id);
  assert.equal(short.coverage!.matchingSymbols, 4); assert.equal(short.coverage!.matchedSources, 2);
  assert.deepEqual(short.matches.map(match => match.qualifiedName), ['demo.alpha.Shared.run', 'demo.beta.Shared.run', 'demo.alpha.Shared.run', 'demo.beta.Shared.run']);
  assert.equal(new Set(short.matches.map(match => match.id)).size, 4); assert.equal(new Set(short.matches.map(match => match.sourceId)).size, 2);
  assert.deepEqual([...new Set(short.matches.map(match => match.sourceName))], ['same display name']);
  const full = await lookupCodeSymbols(s.analysis, 'demo.alpha.Shared.run', s.buildId);
  assert.equal(full.matches.length, 2); assert.deepEqual(full.matches, short.matches.filter(match => match.qualifiedName === 'demo.alpha.Shared.run'));
  assert.notEqual(full.matches[0]!.range.startLine, full.matches[1]!.range.startLine);
  const className = await lookupCodeSymbols(s.analysis, 'Shared', s.buildId); assert.equal(className.matches.length, 6);
  assert.equal(className.matches.filter(match => match.name === 'stop').length, 2);
  assert.equal((await lookupCodeSymbols(s.analysis, 'demo.alpha.Shared', s.buildId)).matches.length, 3);
  const simple = await lookupCodeSymbols(s.analysis, 'run', s.buildId);
  assert.equal(simple.matches.length, 5); assert.equal(simple.matches.filter(match => match.sourceName === 'portal').length, 1);
  for (const query of ['shared.run', 'Shared.RUN', 'alpha.Shared.run', 'demo.alpha', 'Shared.*', 'Shared.run()']) {
    assert.equal((await lookupCodeSymbols(s.analysis, query, s.buildId)).matches.length, 0);
  }
  for (const match of className.matches) for (const ref of match.evidence) {
    const original = s.catalog.evidence(ref.id); assert.equal(original.sourceId, match.sourceId); assert.equal(original.path, 'src/main/java/Shared.java');
    assert.equal(original.revision, match.revision); assert.ok(ref.startLine <= match.range.endLine && ref.endLine >= match.range.startLine);
  }
  assert.equal(s.analysis.fingerprint, fingerprint); assert.deepEqual(s.analysis.list().map(run => run.id), [id]);
  const app = createApp(s.catalog, { codeAnalysis: s.analysis }), base = 'http://127.0.0.1:4244';
  const session = await app.request(base + '/api/session', { method: 'POST', headers: { host: '127.0.0.1:4244', origin: base, 'x-loredock-client': 'web' } });
  const response = await app.request(base + '/api/code-symbols?q=Shared.run&buildId=' + s.buildId, { headers: { host: '127.0.0.1:4244', cookie: session.headers.get('set-cookie')!.split(';')[0]! } });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), short);
  assert.equal(s.store.all('SELECT id FROM answer_attempts').length, 0);
});

test('revocation, policy changes and inventory eviction during a yielded lookup prevent publication', async t => {
  const s = await setup(t); const first = await s.analyze('first');
  const removed = lookupCodeSymbols(s.analysis, 'unmatched', s.buildId); await yieldTurn();
  s.store.run('DELETE FROM code_analyses WHERE id=?', first); await assert.rejects(removed, { code: 'NOT_FOUND' });
  await s.analyze('second');
  const revoked = lookupCodeSymbols(s.analysis, 'unmatched', s.buildId); await yieldTurn();
  s.catalog.revoke(s.catalog.state().sources[2]!.id); await assert.rejects(revoked, { code: 'ANALYSIS_FENCED' });
  const current = await s.index('current'); await s.analyze('current', current);
  const policy = lookupCodeSymbols(s.analysis, 'unmatched', current); await yieldTurn();
  s.catalog.updatePolicy(['src']); await assert.rejects(policy, { code: 'ANALYSIS_FENCED' });
});

test('full inventory lookup reaches supported symbols outside the unchanged graph sample while unsupported files remain gaps', async t => {
  const s = await setup(t, { volume: true }), graph = codeFlows(s.catalog); await s.analyze('shape');
  assert.equal(graph.coverage.examinedDocuments, 100); assert.equal(graph.coverage.candidateDocuments, 121);
  assert.ok(!graph.nodes.some(node => node.kind === 'symbol' && node.label === 'Orders.accept'));
  const result = await lookupCodeSymbols(s.analysis, 'Orders.accept', s.buildId);
  assert.equal(result.coverage!.scannedFiles, 121); assert.equal(result.matches.length, 1); assert.equal(result.matches[0]!.sourceName, 'order-api');
  assert.equal(result.coverage!.filesWithSyntaxGaps, 6); assert.equal(result.coverage!.syntaxGapMessages, 7);
  const unsupported = await lookupCodeSymbols(s.analysis, 'OrderBadge', s.buildId); assert.equal(unsupported.matches.length, 0); assert.equal(unsupported.partial, true);
  assert.deepEqual(codeFlows(s.catalog), graph);
});

test('symbol HTTP lookup requires protected scope and validates literal query input', async t => {
  const s = await setup(t); await s.analyze('http'); const app = createApp(s.catalog, { codeAnalysis: s.analysis }), base = 'http://127.0.0.1:4244';
  const request = (query: string, headers: Record<string, string> = {}) => app.request(base + '/api/code-symbols?' + query, { headers: { host: '127.0.0.1:4244', ...headers } });
  assert.equal((await request('q=accept')).status, 401); assert.equal((await request('q=accept', { origin: 'https://evil.invalid' })).status, 403);
  const session = await app.request(base + '/api/session', { method: 'POST', headers: { host: '127.0.0.1:4244', origin: base, 'x-loredock-client': 'web' } });
  const cookie = session.headers.get('set-cookie')!.split(';')[0]!, headers = { cookie };
  assert.equal((await request('q=accept&buildId=' + s.buildId, headers)).status, 200);
  for (const query of ['', 'q=', 'q=' + 'x'.repeat(201)]) assert.equal((await request(query, headers)).status, 400);
  assert.equal((await request('q=accept&buildId=foreign', headers)).status, 404);
  s.catalog.updatePolicy(['src']); assert.equal((await request('q=accept&buildId=' + s.buildId, headers)).status, 409);
  assert.equal(s.store.all('SELECT id FROM answer_attempts').length, 0);
});
