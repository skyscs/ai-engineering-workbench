import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { Worker } from 'node:worker_threads';
import { get as httpGet } from 'node:http';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { CodeAnalysisFollow } from '../src/code-analysis-follow.js';
import { FileParserService } from '../src/file-parser-service.js';
import { FileParserOwner } from '../src/file-parser-owner.js';
import { OwnedFileParser } from '../src/file-parser.js';
import { fileParserIdentity } from '../src/file-parser-identity.js';
import { fileParserProtocol } from '../src/file-parser-protocol.js';
import { OperationBudgetError } from '../src/operation-budget.js';
import { codeFlows } from '../src/code-flows.js';
import { LegacyReadOperation } from '../src/legacy-read-operation.js';
import { withLegacyFileParser, directLegacyFileParser } from '../src/legacy-file-parser.js';
import { LoreDockServer } from '../src/server.js';
import { AnswerWitnessStore } from '../src/answer-witness-store.js';
import { validateQuestionWitness } from '../src/question-witness.js';
// @ts-expect-error Independent synthetic repository fixture, without model execution.
import { createLoreDockFixture } from '../../../scripts/loredock-fixture.mjs';

async function until(check: () => boolean) {
  const deadline = performance.now() + 10000;
  while (!check()) { assert(performance.now() < deadline, 'The owned lifecycle checkpoint was not reached.'); await delay(1); }
}
async function setup(t: TestContext, parser = new FileParserService()) {
  const fixture = await createLoreDockFixture() as { root: string }, directory = path.join(fixture.root, 'data');
  const store = new CatalogStore(directory), catalog = new Catalog(store, undefined, {}, parser), analysis = await CodeAnalysis.create(catalog);
  t.after(async () => { await analysis.stop(); await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  for (const name of ['portal', 'order-api', 'order-worker']) await catalog.addSource(path.join(fixture.root, 'sources', name));
  const state = catalog.state(), build = catalog.start('index', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  return { directory, store, catalog, analysis, buildId: build.id };
}
async function controlled(t: TestContext, mode: 'hang' | 'exit' | 'invalid') {
  const folder = await mkdtemp(path.join(tmpdir(), 'owned-parser-control-')), entry = path.join(folder, 'worker.cjs');
  await writeFile(entry, `const {parentPort,workerData:d}=require('node:worker_threads');
const send=value=>{const b=Buffer.from(JSON.stringify(value)),a=new ArrayBuffer(b.length);new Uint8Array(a).set(b);parentPort.postMessage(a,[a]);};
send({version:d.version,generation:d.generation,identity:d.identity,type:'ready'});
parentPort.on('message',()=>{if(d.mode==='exit')process.exit(7);if(d.mode==='invalid'){parentPort.postMessage(new ArrayBuffer(0));return;}while(true){}});
`, { flag: 'wx' });
  let first = true, identity = '';
  const owners: FileParserOwner[] = [], exits: number[] = [];
  const service = new FileParserService(() => {
    const owner = first ? new FileParserOwner({ identify: async signal => identity = await fileParserIdentity(signal), spawn: generation => {
      const worker = new Worker(entry, { workerData: { generation, identity, mode, version: fileParserProtocol }, execArgv: [], env: {}, stdout: true, stderr: true });
      worker.once('exit', code => exits.push(code)); return worker;
    } }) : new OwnedFileParser();
    first = false; owners.push(owner); return owner;
  });
  t.after(async () => { await service.stop(); await rm(folder, { recursive: true, force: true }); });
  return { service, owners, exits };
}

test('foreground admission protects retrieval and both graph passes from a native writer', async t => {
  const s = await setup(t), operation = new LegacyReadOperation(s.catalog);
  let release!: () => void, entered!: () => void;
  const ready = new Promise<void>(resolve => { entered = resolve; }), wait = new Promise<void>(resolve => { release = resolve; });
  const pending = withLegacyFileParser(async input => { entered(); await wait; return directLegacyFileParser(input); },
    () => operation.run(async () => { await codeFlows(s.catalog, s.buildId, operation); return codeFlows(s.catalog, s.buildId, operation); }));
  void pending.catch(() => undefined); await ready;
  try {
    const before = s.store.one<{ n: number }>('SELECT total_changes() n')!.n;
    assert.throws(() => s.analysis.start('competing', s.buildId), { code: 'BUSY' });
    await assert.rejects(codeFlows(s.catalog), { code: 'BUSY' });
    assert.equal(s.store.one<{ n: number }>('SELECT total_changes() n')!.n, before);
  } finally { release(); await pending; }
  assert.equal(s.catalog.parser.snapshot().active, false);
  const run = s.analysis.start('admitted', s.buildId); await s.analysis.idle(); assert(s.analysis.get(run.id).published);
});

test('native pause joins actual exit before an explicit resume creates a new generation', async t => {
  const fake = await controlled(t, 'hang'), s = await setup(t, fake.service);
  const run = s.analysis.start('pause', s.buildId); await until(() => fake.service.snapshot().owner?.state === 'busy');
  await assert.rejects(codeFlows(s.catalog), { code: 'BUSY' });
  const paused = s.analysis.control(run.id, 'pause'), resumed = s.analysis.control(run.id, 'resume');
  await paused; await resumed; await s.analysis.idle();
  assert.equal(fake.exits.length, 1); assert.equal(fake.owners.length, 2);
  assert.equal(fake.owners[0]!.snapshot().owned, false); assert.equal(fake.owners[0]!.snapshot().state, 'closed');
  assert.notEqual(fake.owners[0]!.generation, fake.owners[1]!.generation);
  assert.equal(s.analysis.get(run.id).counts.parsed, 5); assert(s.analysis.get(run.id).published);
});

for (const action of ['cancel', 'stop'] as const) test(`native ${action} wins over an in-flight file and preserves pending checkpoints`, async t => {
  const fake = await controlled(t, 'hang'), s = await setup(t, fake.service);
  const run = s.analysis.start(action, s.buildId); await until(() => fake.service.snapshot().owner?.state === 'busy');
  if (action === 'stop') await s.analysis.stop(); else await s.analysis.control(run.id, 'cancel');
  const result = s.analysis.get(run.id);
  assert.equal(result.status, action === 'stop' ? 'interrupted' : 'cancelled'); assert.equal(result.published, false);
  assert.equal(result.counts.pending, 5); assert.equal(result.textBytes, 0); assert.equal(result.payloadBytes, 0);
  assert(result.elapsedMs > 0); assert.equal(fake.exits.length, 1); assert.equal(fake.owners[0]!.snapshot().owned, false);
});

for (const mode of ['exit', 'invalid'] as const) test(`a worker ${mode} fails the whole inventory without a syntax gap or automatic replacement`, async t => {
  const fake = await controlled(t, mode), s = await setup(t, fake.service), follow = new CodeAnalysisFollow(s.analysis);
  const run = s.analysis.start('failure', s.buildId); await s.analysis.idle();
  const failed = s.analysis.get(run.id); assert.equal(failed.status, 'failed'); assert.equal(failed.published, false);
  assert.equal(failed.counts.pending, 5); assert.equal(failed.counts.failed, undefined); assert.match(failed.reason!, /PARSER_/);
  follow.tick(); follow.stop(); assert.equal(fake.owners.length, 1);
  assert.throws(() => s.analysis.start('retry', s.buildId), { code: 'PARSER_UNAVAILABLE' });
  assert.equal(s.analysis.list().length, 1); assert.equal(fake.owners[0]!.snapshot().owned, false);
});

test('a source or policy change cannot publish a late worker reply', async t => {
  for (const event of ['source', 'policy'] as const) await t.test(event, async t => {
    const fake = await controlled(t, 'hang'), s = await setup(t, fake.service), run = s.analysis.start('fence', s.buildId);
    await until(() => s.catalog.parser.snapshot().owner?.state === 'busy');
    if (event === 'source') s.catalog.revoke(s.catalog.state().sources[0]!.id); else s.catalog.updatePolicy(['src']);
    await s.analysis.idle();
    assert.equal(s.analysis.get(run.id).status, 'fenced'); assert.equal(s.analysis.get(run.id).published, false);
    assert.equal(fake.exits.length, 1); assert.equal(fake.owners[0]!.snapshot().owned, false);
    assert.equal(s.store.one<{ n: number }>("SELECT count(*) n FROM code_analysis_files WHERE runId=? AND status='parsed'", run.id)!.n, 0);
  });
});

test('transport charges preserve the original budget error and join a rejected reply before reuse', async t => {
  const service = new FileParserService(), deadline = performance.now() + 10000; t.after(() => service.stop());
  await service.warm({ deadline });
  let charges = 0; const failure = new OperationBudgetError('CAPTURE_WORK_LIMIT', 'Synthetic original shared budget rejection.');
  const lease = service.acquire('foreground', { deadline, charge: bytes => { assert(bytes > 0); if (++charges === 2) throw failure; } });
  await assert.rejects(lease.parse('sample.ts', 'export function load() { return fetch("/sample"); }'), error => error === failure);
  assert.equal(charges, 2); assert.equal(service.snapshot().owner!.owned, false);
  await lease.release(); assert.equal(service.snapshot().owner, null);
  const next = service.acquire('foreground', { deadline });
  try { assert.equal((await next.parse('sample.ts', 'export function load() {}')).symbols.length, 1); }
  finally { await next.release(); }
});

test('metadata identity initialization is owned and shutdown joins it without spawning a compiler', async () => {
  const service = new FileParserService(); let release!: () => void;
  const pending = service.initialize(() => new Promise<void>(resolve => { release = resolve; }));
  void pending.catch(() => undefined); let stopped = false;
  const stop = service.stop().then(() => { stopped = true; });
  await delay(5); assert.equal(stopped, false); assert.equal(service.snapshot().owner, null);
  release(); await assert.rejects(pending, { code: 'CANCELLED' }); await stop; assert.equal(stopped, true);
});

test('server readiness includes the real source worker and idle shutdown releases its catalog', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'loredock-server-ready-')), server = new LoreDockServer({ directory, port: 0 });
  t.after(async () => { await server.stop(); await rm(directory, { recursive: true, force: true }); });
  const port = await server.start(); assert.equal(server.catalog.parser.snapshot().owner!.state, 'ready');
  // Keep the production Host allowlist while exercising a separate ephemeral test listener.
  const response = await new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
    httpGet({ hostname: '127.0.0.1', port, path: '/api/health', headers: { host: '127.0.0.1:4244' } }, incoming => {
      let body = ''; incoming.setEncoding('utf8'); incoming.on('data', chunk => { body += chunk; });
      incoming.on('end', () => resolve({ status: incoming.statusCode, body })); incoming.on('error', reject);
    }).on('error', reject);
  });
  assert.equal(response.status, 200); assert.equal(JSON.parse(response.body).service, 'loredock');
  await server.stop(); assert.equal(server.catalog.parser.snapshot().owner!.owned, false);
  const reopened = new CatalogStore(directory); reopened.close();
});

test('server shutdown joins startup before listen and releases the partial store owner', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'loredock-server-starting-')), server = new LoreDockServer({ directory, port: 0 });
  t.after(() => rm(directory, { recursive: true, force: true }));
  const starting = server.start(); void starting.catch(() => undefined);
  await server.stop(); await assert.rejects(starting);
  assert.equal(server.catalog.parser.snapshot().active, false); assert.equal(server.catalog.parser.snapshot().owner?.owned ?? false, false);
  const reopened = new CatalogStore(directory); reopened.close();
});

test('an old native inventory requires explicit reanalysis while its saved v2 witness stays exact and readable', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'owned-parser-upgrade-'));
  const baseline = new URL('../../../docs/fixtures/loredock-async-legacy/baseline/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', baseline), 'utf8')) as { files: { path: string; sha256: string; gzipSha256: string }[] };
  const entry = manifest.files.find(row => row.path === 'saved-v2/loredock.db.gz')!;
  const compressed = await readFile(new URL(entry.path, baseline)), raw = gunzipSync(compressed);
  const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
  assert.equal(hash(compressed), entry.gzipSha256); assert.equal(hash(raw), entry.sha256);
  await writeFile(path.join(directory, 'loredock.db'), raw, { flag: 'wx' });
  const store = new CatalogStore(directory), catalog = new Catalog(store), analysis = await CodeAnalysis.create(catalog);
  t.after(async () => { await analysis.stop(); await catalog.stop(); store.close(); await rm(directory, { recursive: true, force: true }); });
  const old = analysis.list().find(row => row.published)!; assert(old); assert.equal(old.currentParser, false);
  const inventories = analysis.list(), follow = new CodeAnalysisFollow(analysis); follow.tick(); follow.stop(); assert.deepEqual(analysis.list(), inventories);
  assert.throws(() => analysis.files(old.id), { code: 'PARSER_CHANGED' });
  store.run("UPDATE code_analyses SET status='paused' WHERE id=?", old.id);
  await assert.rejects(analysis.control(old.id, 'resume'), { code: 'PARSER_CHANGED' });
  const row = store.one<{ answerId: string }>('SELECT answerId FROM answer_witnesses LIMIT 1')!, witnesses = new AnswerWitnessStore(catalog);
  const snapshot = witnesses.read(row.answerId), before = hash(JSON.stringify(store.all('SELECT * FROM answer_witnesses')));
  assert.equal((await validateQuestionWitness(catalog, snapshot)).status, 'revalidated');
  const run = analysis.start('explicit-new-parser', old.buildId); await analysis.idle();
  assert(analysis.get(run.id).published); assert.equal(analysis.get(run.id).currentParser, true);
  assert.notEqual(analysis.get(run.id).fingerprint, old.fingerprint);
  assert.deepEqual(witnesses.read(row.answerId), snapshot);
  assert.equal((await validateQuestionWitness(catalog, snapshot)).status, 'revalidated');
  assert.equal(hash(JSON.stringify(store.all('SELECT * FROM answer_witnesses'))), before);
});
