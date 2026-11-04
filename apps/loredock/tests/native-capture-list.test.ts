import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { serve } from '@hono/node-server';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { SourceGit } from '../src/git.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { CodePathsV2 } from '../src/code-paths-v2.js';
import { NativeCaptures } from '../src/native-capture.js';
import { NativeReceiptError } from '../src/native-receipt-json.js';
import { OperationBudget, OperationBudgetError } from '../src/operation-budget.js';
import { createApp } from '../src/app.js';
import type { PathCaptureListResult } from '../src/native-capture-api.js';
import type { NativeReceipt } from '../src/native-receipt-types.js';
// @ts-expect-error Ordinary owned development corpus, not an exhausted resource family.
import { corpusFactory } from '../../../scripts/loredock-native-assessment/fixture.mjs';
// @ts-expect-error Existing source/catalog fixture lifecycle.
import { receiptFixture } from '../../../scripts/loredock-capture-scale/fixture.mjs';

type Options = NonNullable<ConstructorParameters<typeof NativeCaptures>[1]>;
interface State {
  root: string; buildId: string; store: CatalogStore; catalog: Catalog; analysis: CodeAnalysis; paths: CodePathsV2;
  counters(): { gitCalls: number; writeCalls: number; changedRows: number; factReads: number; snapshots: number; pathReads: number };
  analyze(key?: string, id?: string): Promise<string>; index(key: string): Promise<string>;
  restart(): Promise<void>; addSource(name?: string): Promise<void>; close(): Promise<void>;
}
const origin = 'http://127.0.0.1:4244', headers = { host: '127.0.0.1:4244', origin };
const generic = { error: { message: 'The local operation failed. Check the daemon and retry.' } };
function barrier() { let release!: () => void; return { promise: new Promise<void>(resolve => { release = resolve; }), release: () => release() }; }
async function setup(t: TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), 'native-capture-list-'));
  const state = await receiptFixture(root, corpusFactory(), { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths: CodePathsV2 }) as State;
  const owners: NativeCaptures[] = []; let originals = 0, serial = 0;
  const observe = () => { const read = state.catalog.evidence.bind(state.catalog); state.catalog.evidence = id => { originals++; return read(id); }; };
  observe(); await state.analyze();
  t.after(async () => { for (const owner of owners) await owner.stop(); await state.close(); await rm(root, { recursive: true, force: true }); });
  const service = (options: Options = {}) => { const owner = new NativeCaptures(state.analysis, { paths: state.paths, ...options }); owners.push(owner); return owner; };
  const folder = () => path.join(state.store.directory, 'path-receipts', state.store.receipts.catalogId);
  const ids = () => existsSync(folder()) ? readdirSync(folder()).filter(name => name.endsWith('.json')).map(name => name.slice(0, -5)).sort() : [];
  const saved = (id: string) => JSON.parse(readFileSync(path.join(folder(), id + '.json'), 'utf8')) as NativeReceipt;
  return { state, service, ids, saved, folder, originals: () => originals,
    async seed(pairs = 1, buildId = state.buildId) {
      const owner = service();
      for (let index = 0; index < pairs; index++) {
        await state.analyze('listing-' + serial++, buildId); const first = await owner.capture({ buildId }), record = saved(first.receiptId), projection = JSON.parse(record.projectionJson);
        await owner.capture({ buildId, inventoryId: projection.identity.inventoryId, generationId: projection.generationId, rootId: projection.roots.items[0].id });
      }
      await owner.stop();
    },
    async restart() { for (const owner of owners) await owner.stop(); await state.restart(); observe(); } };
}
async function client(app: ReturnType<typeof createApp>) {
  const session = await app.request(origin + '/api/session', { method: 'POST', headers: { ...headers, 'x-loredock-client': 'web' } }); assert.equal(session.status, 200);
  const cookie = session.headers.get('set-cookie')!.split(';')[0]!;
  return (query = '', extra: Record<string, string> = {}, signal?: AbortSignal) => app.request(origin + '/api/path-captures' + query,
    { headers: { ...headers, cookie, ...extra }, ...signal ? { signal } : {} });
}
async function failure(response: Response, status: number, code?: string) {
  assert.equal(response.status, status); assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json() as { error: { code?: string; message: string } }; assert.deepEqual(Object.keys(body), ['error']);
  if (code) assert.equal(body.error.code, code); return body;
}

test('empty discovery does not create storage, derive paths or mutate the catalog', async t => {
  const s = await setup(t), before = s.state.counters(), originals = s.originals(), service = s.service();
  const result = await service.list(); assert.equal(result.schemaVersion, 'loredock-path-captures/1');
  assert.deepEqual(result.items, []); assert.equal(result.totalStored, 0); assert.equal(result.scanned, 0); assert.equal(result.unavailableCount, 0);
  assert.equal(result.previousOffset, null); assert.equal(result.nextOffset, null); assert.equal(result.pageSize, 4);
  assert.equal(result.metrics.pathWork, 0); assert.equal(result.metrics.publicationLocks, 0); assert.ok(result.metrics.totalWork > 0);
  assert.equal(existsSync(s.folder()), false); assert.deepEqual(s.state.counters(), before); assert.equal(s.originals(), originals);
  assert.deepEqual((await service.list({ generationId: result.generationId, offset: 0 })).items, []);
  await assert.rejects(service.list({ generationId: result.generationId, offset: 4 }), { code: 'INVALID_CAPTURE_LIST' });
});

test('bounded pages equal native records, revalidate all originals and survive eviction/restart', async t => {
  const s = await setup(t); await s.seed(3); const ids = s.ids(); assert.equal(ids.length, 6);
  let charged = 0; const service = s.service({ budget: { observe: value => { charged += value.units; } } });
  const originalFiles = new Map(ids.map(id => [id, readFileSync(path.join(s.folder(), id + '.json'))]));
  const page = async (generationId?: string, offset?: number) => {
    const before = s.state.counters(), originals = s.originals(); charged = 0;
    const result = await service.list(generationId === undefined ? {} : { generationId, offset: offset! });
    assert.deepEqual(s.state.counters(), before); assert.equal(s.originals() - originals, result.items.reduce((sum, item) => sum + item.originalCount, 0));
    assert.equal(result.metrics.totalWork, charged); assert.equal(result.metrics.receiptWork, charged); assert.equal(result.metrics.pathWork, 0);
    assert.equal(result.metrics.publicationLocks, 0); assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 65536);
    for (const item of result.items) {
      const record = s.saved(item.receiptId), projection = JSON.parse(record.projectionJson);
      assert.deepEqual(item, { receiptId: item.receiptId, buildId: projection.identity.buildId, rootId: projection.selection.rootId,
        titles: projection.graph.flows.map((flow: { title: string }) => flow.title), originalCount: record.originals.length,
        dependencies: record.dependencies, stale: false, currentApplicability: 'not-checked' });
    }
    assert.ok(!JSON.stringify(result).includes('interface EventPublisher')); return result;
  };
  const first = await page(); assert.equal(first.scanned, 4); assert.equal(first.totalStored, 6); assert.equal(first.nextOffset, 4); assert.equal(first.unavailableCount, 0);
  const second = await page(first.generationId, 4); assert.equal(second.scanned, 2); assert.equal(second.previousOffset, 0); assert.equal(second.nextOffset, null);
  assert.deepEqual([...first.items, ...second.items].map(item => item.receiptId), ids);
  assert.deepEqual((await service.list({ pageSize: 1, generationId: first.generationId, offset: 1 })).items, [first.items[1]]);
  const duplicate = await service.capture({ buildId: s.state.buildId }); assert.equal(duplicate.created, false);
  assert.equal((await service.list()).generationId, first.generationId);
  await s.restart(); const reopened = await s.service().list(); assert.equal(reopened.generationId, first.generationId); assert.deepEqual(reopened.items, first.items);
  for (const [id, bytes] of originalFiles) assert.deepEqual(readFileSync(path.join(s.folder(), id + '.json')), bytes);
  await s.state.addSource('extra-context');
  await assert.rejects(s.service().list({ generationId: first.generationId, offset: 0 }), { code: 'CAPTURE_LIST_CHANGED' });
  assert.ok((await s.service().list()).items.every(item => item.stale));
});

test('mixed policy pages count fenced candidates without returning their summaries or IDs', async t => {
  const s = await setup(t); await s.seed(3); const old = s.ids(), bytes = new Map(old.map(id => [id, readFileSync(path.join(s.folder(), id + '.json'))]));
  s.state.catalog.updatePolicy(['private']); const buildId = await s.state.index('new-policy'); await s.seed(1, buildId);
  const allowed = s.ids().filter(id => !old.includes(id)), service = s.service(); let result = await service.list();
  let unavailable = 0, scanned = 0; const seen: string[] = [];
  while (true) {
    unavailable += result.unavailableCount; scanned += result.scanned; seen.push(...result.items.map(item => item.receiptId));
    for (const id of old) assert.ok(!JSON.stringify(result).includes(id));
    if (result.nextOffset === null) break;
    result = await service.list({ generationId: result.generationId, offset: result.nextOffset });
  }
  assert.equal(unavailable, 6); assert.equal(scanned, 8); assert.deepEqual(seen.sort(), allowed);
  for (const [id, data] of bytes) assert.deepEqual(readFileSync(path.join(s.folder(), id + '.json')), data);
  s.state.catalog.updatePolicy(['another-private']); const before = s.originals(), fenced = await service.list();
  assert.equal(fenced.totalStored, 8); assert.equal(fenced.scanned, 4); assert.equal(fenced.unavailableCount, 4); assert.equal(fenced.nextOffset, 4);
  assert.deepEqual(fenced.items, []); assert.equal(s.originals(), before);
});

test('undisplayed source revocation removes discoverable records across restart', async t => {
  const s = await setup(t); await s.seed(2); const record = s.saved(s.ids()[0]!);
  const hidden = record.dependencies.find(dep => !record.originals.some(row => row.sourceId === dep.sourceId))!; assert.ok(hidden);
  s.state.catalog.revoke(hidden.sourceId); assert.equal(s.state.store.source(hidden.sourceId).purge, 'completed');
  assert.equal((await s.service().list()).totalStored, 0); assert.deepEqual(s.ids(), []);
  await s.restart(); assert.equal((await s.service().list()).totalStored, 0);
});

test('one shared budget bounds the whole page and explicit smaller pages recover', async t => {
  const s = await setup(t); await s.seed(3); const first = await s.service().list({ pageSize: 1 }), limit = first.metrics.totalWork + 500;
  const bounded = s.service({ budget: { limits: { work: limit } } });
  await assert.rejects(bounded.list(), { code: 'CAPTURE_WORK_LIMIT' });
  const single = await bounded.list({ pageSize: 1 }); assert.deepEqual(single.items, first.items); assert.ok(single.metrics.totalWork <= limit);
  const supplied = new OperationBudget({ limits: { work: limit } });
  try { await assert.rejects(s.service().list({}, undefined, supplied), { code: 'CAPTURE_WORK_LIMIT' }); assert.ok(supplied.stats().totalWork > 0); supplied.check(); }
  finally { supplied.close(); }
  await assert.rejects(s.service({ budget: { limits: { wallMs: 0 } } }).list(), { code: 'CAPTURE_TIME_LIMIT' });
});

test('list cancellation and source changes fence every cooperative phase without partial summaries', async t => {
  for (const stage of ['projection', 'originals', 'handoff'] as const) for (const action of ['cancel', 'policy'] as const) await t.test(stage + ' ' + action, async sub => {
    const s = await setup(sub); await s.seed(); const ids = s.ids(), controller = new AbortController(); let changed = false;
    const service = s.service({ checkpoint(info) { if (!changed && info.stage === stage) { changed = true;
      if (action === 'cancel') controller.abort(); else s.state.catalog.updatePolicy(['private']);
    } } });
    await assert.rejects(service.list({}, controller.signal), { code: action === 'cancel' ? 'CANCELLED' : 'RECEIPT_FENCED' });
    assert.deepEqual(s.ids(), ids); assert.equal((await s.service().list()).totalStored, 2);
  });
});

test('the final owned ID-vector fence catches publication without SQL epoch changes', async t => {
  const s = await setup(t); await s.seed(3); const removed = s.ids()[0]!, file = path.join(s.folder(), removed + '.json'), bytes = readFileSync(file);
  unlinkSync(file); const before = s.state.counters(); let published = false;
  const service = s.service({ checkpoint(info) { if (!published && info.stage === 'handoff') {
    published = true; const budget = new OperationBudget();
    try { s.state.store.receipts.publish(bytes, budget, () => {}); } finally { budget.close(); }
  } } });
  await assert.rejects(service.list(), { code: 'CAPTURE_LIST_CHANGED' }); assert.deepEqual(s.state.counters(), before);
  assert.deepEqual(readFileSync(file), bytes); assert.equal((await s.service().list()).totalStored, 6);
});

test('storage faults preserve bytes and never return a partial readable page', async t => {
  for (const mode of ['corrupt', 'unknown', 'closed'] as const) await t.test(mode, async sub => {
    const s = await setup(sub); await s.seed(); const service = s.service(); let file: string | undefined, bytes: Buffer | undefined;
    if (mode === 'corrupt') { file = path.join(s.folder(), s.ids()[1]! + '.json'); writeFileSync(file, '{}'); bytes = readFileSync(file); }
    if (mode === 'unknown') { file = path.join(s.folder(), 'unexpected'); writeFileSync(file, 'Retain for explicit diagnosis.'); bytes = readFileSync(file); }
    if (mode === 'closed') s.state.store.receipts.close();
    const request = await client(createApp(s.state.catalog, { codeAnalysis: s.state.analysis, nativeCaptures: service }));
    assert.deepEqual(await failure(await request(), 500), generic);
    if (file) assert.deepEqual(readFileSync(file), bytes);
  });
});

test('HTTP listing guards malformed inputs before work and preserves native outcomes', async t => {
  const s = await setup(t), service = s.service(); let calls = 0; const list = service.list.bind(service);
  service.list = (...args) => { calls++; return list(...args); };
  const app = createApp(s.state.catalog, { codeAnalysis: s.state.analysis, nativeCaptures: service }), request = await client(app), before = s.state.counters();
  assert.equal((await app.request(origin + '/api/path-captures', { headers })).status, 401);
  await failure(await request('', { origin: 'https://evil.invalid' }), 403);
  await failure(await request('', { host: 'evil.invalid' }), 403);
  for (const query of ['?pageSize=2', '?pageSize=0', '?pageSize=04', '?pageSize=1&pageSize=4', '?offset=0', '?generationId=' + 'a'.repeat(64),
    '?generationId=bad&offset=0', '?generationId=' + 'a'.repeat(64) + '&offset=64', '?generationId=' + 'a'.repeat(64) + '&offset=1',
    '?generationId=' + 'a'.repeat(64) + '&offset=00', '?pageSize=' + '1'.repeat(1100), '?path=/tmp/private', '?budget=1', '?output=/tmp/private'])
    await failure(await request(query), 400);
  await failure(await request('', { 'content-length': '1' }), 400);
  await failure(await request('', { 'transfer-encoding': 'chunked' }), 400);
  assert.equal(calls, 0); assert.deepEqual(s.state.counters(), before);
  const empty = await request(); assert.equal(empty.status, 200); const value = await empty.json() as PathCaptureListResult; assert.equal(value.totalStored, 0);
  await failure(await request('?generationId=' + 'a'.repeat(64) + '&offset=0'), 409, 'CAPTURE_LIST_CHANGED');
  await service.stop(); await failure(await request(), 409, 'SERVICE_STOPPED');
  const defaultRequest = await client(createApp(s.state.catalog, { codeAnalysis: s.state.analysis })); assert.equal((await defaultRequest()).status, 200);
});

test('an active list owns capture/history concurrency and shutdown releases ownership', async t => {
  const s = await setup(t); await s.seed(); const gate = barrier(), reached = barrier(); let held = false;
  const service = s.service({ async checkpoint() { if (!held) { held = true; reached.release(); await gate.promise; } } });
  const pending = service.list();
  try {
    await reached.promise; await assert.rejects(s.service().list(), { code: 'CAPTURE_BUSY' });
    await assert.rejects(service.capture({ buildId: s.state.buildId }), { code: 'CAPTURE_BUSY' });
    await assert.rejects(service.history(s.ids()[0]!), { code: 'CAPTURE_BUSY' });
    const stopped = service.stop(), rejected = assert.rejects(pending, { code: 'CANCELLED' }); gate.release(); await rejected; await stopped;
    await assert.rejects(service.list(), { code: 'SERVICE_STOPPED' }); assert.equal((await s.service().list()).totalStored, 2);
  } finally { gate.release(); await pending.catch(() => {}); await service.stop(); }
});

test('a real disconnected HTTP list aborts the native owner and permits explicit retry', { timeout: 15000 }, async t => {
  const s = await setup(t); await s.seed(); const gate = barrier(), reached = barrier(); let held = false, serverSignal: AbortSignal | undefined, report!: (code: string) => void;
  const observed = new Promise<string>(resolve => { report = resolve; });
  const service = s.service({ async checkpoint(info) { if (!held && info.stage === 'originals') { held = true; reached.release(); await gate.promise; } } });
  const list = service.list.bind(service); service.list = (input, signal, budget) => { serverSignal = signal; return list(input, signal, budget).catch(error => {
    report(error instanceof NativeReceiptError || error instanceof OperationBudgetError ? error.code : 'UNEXPECTED'); throw error;
  }); };
  const app = createApp(s.state.catalog, { codeAnalysis: s.state.analysis, nativeCaptures: service });
  const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 });
  try {
    await once(server, 'listening'); const address = server.address(); assert.ok(address && typeof address === 'object');
    const request = (route: string, supplied: Record<string, string>, method = 'GET', signal?: AbortSignal) => new Promise<{ status: number; headers: IncomingHttpHeaders; body: string }>((resolve, reject) => {
      const req = httpRequest(`http://127.0.0.1:${address.port}/api` + route, { method, headers: supplied, ...signal ? { signal } : {} }, response => {
        let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; });
        response.on('end', () => resolve({ status: response.statusCode!, headers: response.headers, body })); response.on('error', reject);
      }); req.on('error', reject); req.end();
    });
    const session = await request('/session', { ...headers, 'x-loredock-client': 'web' }, 'POST'); assert.equal(session.status, 200);
    const authenticated = { ...headers, cookie: session.headers['set-cookie']![0]!.split(';')[0]! }, controller = new AbortController();
    const pending = request('/path-captures', authenticated, 'GET', controller.signal); await reached.promise;
    assert.equal((await request('/health', authenticated)).status, 200); assert.equal((await request('/path-captures', authenticated)).status, 409);
    assert.ok(serverSignal); const aborted = serverSignal.aborted ? Promise.resolve() : once(serverSignal, 'abort');
    const rejected = assert.rejects(pending, { name: 'AbortError' }); controller.abort(); await rejected; await aborted; gate.release();
    assert.equal(await observed, 'CANCELLED'); const retry = await request('/path-captures', authenticated); assert.equal(retry.status, 200);
    assert.equal((JSON.parse(retry.body) as PathCaptureListResult).items.length, 2);
  } finally { gate.release(); await service.stop(); if ('closeAllConnections' in server) server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
