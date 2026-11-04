import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
import { OperationBudgetError } from '../src/operation-budget.js';
import { createApp } from '../src/app.js';
import type { PathCaptureResult, PathHistoryResult } from '../src/native-capture-api.js';
import type { NativeStorageOptions } from '../src/native-receipt-files.js';
// @ts-expect-error Small owned development sources, never an exhausted qualification family.
import { corpusFactory } from '../../../scripts/loredock-native-assessment/fixture.mjs';
// @ts-expect-error Existing independent source/catalog fixture lifecycle.
import { receiptFixture } from '../../../scripts/loredock-capture-scale/fixture.mjs';

type Options = NonNullable<ConstructorParameters<typeof NativeCaptures>[1]>;
interface State {
  root: string; buildId: string; store: CatalogStore; catalog: Catalog; analysis: CodeAnalysis; paths: CodePathsV2;
  revisions: Record<string, string>; git(source: string, args: string[]): string; legacyRows(): string;
  counters(): { gitCalls: number; writeCalls: number; changedRows: number; factReads: number; snapshots: number; pathReads: number };
  analyze(key?: string): Promise<string>; restart(): Promise<void>; addSource(name?: string): Promise<void>; close(): Promise<void>;
}
const origin = 'http://127.0.0.1:4244';
const baseHeaders = { host: '127.0.0.1:4244', origin };
const genericError = { error: { message: 'The local operation failed. Check the daemon and retry.' } };
async function setup(t: TestContext, storage: NativeStorageOptions = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'native-capture-api-'));
  class Store extends CatalogStore { constructor(directory: string) { super(directory, storage); } }
  const state = await receiptFixture(root, corpusFactory(), { Catalog, CatalogStore: Store, SourceGit, CodeAnalysis, CodePaths: CodePathsV2 }) as State;
  const owners: NativeCaptures[] = []; let originals = 0;
  const observe = () => { const evidence = state.catalog.evidence.bind(state.catalog); state.catalog.evidence = id => { originals++; return evidence(id); }; };
  observe();
  t.after(async () => { for (const owner of owners) await owner.stop(); await state.close(); await rm(root, { recursive: true, force: true }); });
  await state.analyze();
  return { state, originals: () => originals,
    service(options: Options = {}) { const owner = new NativeCaptures(state.analysis, { paths: state.paths, ...options }); owners.push(owner); return owner; },
    async restart() { for (const owner of owners) await owner.stop(); await state.restart(); observe(); },
    get folder() { return path.join(state.store.directory, 'path-receipts', state.store.receipts.catalogId); } };
}
async function client(app: ReturnType<typeof createApp>) {
  const session = await app.request(origin + '/api/session', { method: 'POST', headers: { ...baseHeaders, 'x-loredock-client': 'web' } });
  assert.equal(session.status, 200);
  const cookie = session.headers.get('set-cookie')!.split(';')[0]!, { token } = await session.json() as { token: string };
  const headers = { ...baseHeaders, cookie, 'x-loredock-csrf': token };
  return { app, headers, request: (route: string, init: RequestInit = {}) => app.request(origin + '/api' + route, { ...init, headers: { ...headers, ...init.headers } }) };
}
function files(folder: string) { return existsSync(folder) ? readdirSync(folder).sort() : []; }
function barrier() { let release!: () => void; return { promise: new Promise<void>(resolve => { release = resolve; }), release: () => release() }; }
async function error(response: Response, status: number, code?: string) {
  assert.equal(response.status, status); assert.equal(response.headers.get('cache-control'), 'no-store');
  const value = await response.json() as { error: { code?: string; message: string } };
  assert.deepEqual(Object.keys(value), ['error']); if (code) assert.equal(value.error.code, code); return value;
}

test('capture HTTP boundaries reject authority and malformed input before native work', async t => {
  const s = await setup(t), service = s.service(); let calls = 0;
  const capture = service.capture.bind(service), history = service.history.bind(service);
  service.capture = (...args) => { calls++; return capture(...args); }; service.history = (...args) => { calls++; return history(...args); };
  const app = createApp(s.state.catalog, { codeAnalysis: s.state.analysis, codePaths: s.state.paths, nativeCaptures: service });
  const c = await client(app), save = '/path-captures?buildId=' + s.state.buildId, read = '/path-captures/' + 'a'.repeat(64);
  const before = s.state.counters();
  for (const route of [save, read]) {
    const method = route === save ? 'POST' : 'GET';
    assert.equal((await app.request(origin + '/api' + route, { method, headers: baseHeaders })).status, 401);
    assert.equal((await c.request(route, { method, headers: { host: 'evil.invalid' } })).status, 403);
    assert.equal((await c.request(route, { method, headers: { origin: 'https://evil.invalid' } })).status, 403);
    assert.equal((await c.request(route, { method, headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  }
  for (const headers of [{ 'x-loredock-csrf': '' }, { origin: '' }]) await error(await c.request(save, { method: 'POST', headers }), 403);
  for (const query of ['', '?buildId=bad', '?buildId=' + 'x'.repeat(1100),
    '?buildId=' + s.state.buildId + '&buildId=' + s.state.buildId,
    '?buildId=' + s.state.buildId + '&%62uildId=' + s.state.buildId,
    ...['inventoryId=' + s.state.buildId, 'generationId=' + 'a'.repeat(64), 'rootId=' + 'a'.repeat(64),
      'offset=0', 'path=/tmp/private', 'output=/tmp/private', 'work=999', 'catalogId=' + s.state.buildId, 'fingerprint=override', '__proto__=x']
      .map(value => '?buildId=' + s.state.buildId + '&' + value)]) {
    await error(await c.request('/path-captures' + query, { method: 'POST' }), 400);
  }
  for (const body of ['{}', '[]', 'null', '{"buildId":"first","buildId":"second"}', 'private'])
    await error(await c.request(save, { method: 'POST', body }), 400);
  await error(await c.request(save, { method: 'POST', body: ' '.repeat(16385) }), 413);
  for (const id of ['bad', 'A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), '%2Ftmp%2Fprivate'])
    await error(await c.request('/path-captures/' + id), 400);
  for (const query of ['?buildId=' + s.state.buildId, '?x=1&x=2', '?receiptId=' + 'a'.repeat(64)]) await error(await c.request(read + query), 400);
  await error(await c.request(read, { headers: { 'content-length': '1' } }), 400);
  await error(await c.request(read, { headers: { 'transfer-encoding': 'chunked' } }), 400);
  assert.equal(calls, 0); assert.equal(s.originals(), 0); assert.deepEqual(s.state.counters(), before); assert.deepEqual(files(s.folder), []);
  await error(await c.request('/path-captures?buildId=00000000-0000-0000-0000-000000000000', { method: 'POST' }), 400, 'INVALID_RECEIPT_SELECTION');
  assert.deepEqual(s.state.counters(), before);
});

test('default and injected HTTP owners save exact native selections and reopen history across eviction and restart', async t => {
  const s = await setup(t), state = s.state, legacy = state.legacyRows(), before = state.counters();
  let c = await client(createApp(state.catalog, { codeAnalysis: state.analysis }));
  const save = '/path-captures?buildId=' + state.buildId;
  const first = await c.request(save, { method: 'POST', body: ' \n\t' }); assert.equal(first.status, 201); assert.equal(first.headers.get('cache-control'), 'no-store');
  const saved = await first.json() as PathCaptureResult; assert.equal(saved.status, 'captured'); assert.equal(saved.created, true); assert.equal(saved.metrics.publicationLocks, 1);
  const storedBytes = readFileSync(path.join(s.folder, saved.receiptId + '.json')), stored = JSON.parse(storedBytes.toString());
  const historyRoute = '/path-captures/' + saved.receiptId;
  const read = async () => {
    const counters = state.counters(), originals = s.originals(), response = await c.request(historyRoute);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const text = await response.text(), value = JSON.parse(text) as PathHistoryResult;
    assert.equal(value.status, 'recorded'); assert.equal(value.currentApplicability, 'not-checked');
    assert.equal(value.metrics.pathWork, 0); assert.equal(value.metrics.publicationLocks, 0);
    assert.equal(s.originals() - originals, 10); assert.deepEqual(state.counters(), counters);
    assert.equal(JSON.stringify(value.projection), stored.projectionJson); assert.deepEqual(value.originals, stored.originals); assert.deepEqual(value.dependencies, stored.dependencies);
    assert.equal(value.dependencies.length, 4); assert.equal(value.metrics.sources, 4); assert.equal(value.metrics.spans, 10);
    return { text, value };
  };
  const original = await read(); assert.equal(original.value.stale, false); assert.equal(original.value.projection.schemaVersion, 'loredock-code-paths/2');
  const duplicate = await c.request(save, { method: 'POST' }); assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json() as PathCaptureResult).created, false);
  const projection = original.value.projection;
  const pins = { buildId: state.buildId, inventoryId: projection.identity.inventoryId, generationId: projection.generationId };
  const selected = await c.request('/path-captures?' + new URLSearchParams({ ...pins, rootId: projection.roots.items[0]!.id }), { method: 'POST' });
  assert.equal(selected.status, 201); const selectedId = (await selected.json() as PathCaptureResult).receiptId;
  const selectedHistory = await (await c.request('/path-captures/' + selectedId)).json() as PathHistoryResult;
  assert.equal(selectedHistory.projection.graph.flows.length, 1); assert.notEqual(selectedId, saved.receiptId);
  const roots = await state.paths.read({ ...pins, offset: 4 }, 'roots'); assert.ok(roots.status === 'available');
  const isolated = await c.request('/path-captures?' + new URLSearchParams({ ...pins, rootId: roots.roots.items[0]!.id }), { method: 'POST' });
  assert.equal(isolated.status, 201);
  const isolatedHistory = await (await c.request('/path-captures/' + (await isolated.json() as PathCaptureResult).receiptId)).json() as PathHistoryResult;
  assert.equal(isolatedHistory.projection.graph.nodes.length, 1); assert.equal(isolatedHistory.projection.graph.edges.length, 0);
  for (const key of ['gitCalls', 'writeCalls', 'changedRows'] as const) assert.equal(state.counters()[key], before[key]);
  assert.equal(state.legacyRows(), legacy);
  await state.analyze('replace-one'); await state.analyze('replace-two'); assert.equal((await read()).text, original.text);
  await s.restart(); c = await client(createApp(state.catalog, { codeAnalysis: state.analysis, codePaths: state.paths, nativeCaptures: s.service() }));
  assert.equal((await read()).text, original.text); assert.deepEqual(readFileSync(path.join(s.folder, saved.receiptId + '.json')), storedBytes);
  await state.addSource('new-context'); const stale = await read(); assert.equal(stale.value.stale, true); assert.deepEqual(stale.value.dependencies, original.value.dependencies);
  assert.equal(state.legacyRows(), legacy);
  for (const [name, revision] of Object.entries(state.revisions)) { assert.equal(state.git(name, ['rev-parse', 'HEAD']), revision); assert.equal(state.git(name, ['status', '--porcelain']), ''); }
});

test('HTTP capacity, policy fences and hidden-source revocation preserve actual native storage rules', async t => {
  for (const mode of ['capacity', 'policy', 'revoke'] as const) await t.test(mode, async sub => {
    const s = await setup(sub, mode === 'capacity' ? { limits: { records: 1 } } : {}), state = s.state;
    let c = await client(createApp(state.catalog, { codeAnalysis: state.analysis, codePaths: state.paths, nativeCaptures: s.service() }));
    const save = '/path-captures?buildId=' + state.buildId, saved = await (await c.request(save, { method: 'POST' })).json() as PathCaptureResult;
    const route = '/path-captures/' + saved.receiptId, before = readFileSync(path.join(s.folder, saved.receiptId + '.json'));
    const history = await (await c.request(route)).json() as PathHistoryResult;
    if (mode === 'capacity') {
      const selection = { buildId: state.buildId, inventoryId: history.projection.identity.inventoryId, generationId: history.projection.generationId, rootId: history.projection.roots.items[0]!.id };
      await error(await c.request('/path-captures?' + new URLSearchParams(selection), { method: 'POST' }), 409, 'CAPTURE_STORAGE_FULL');
      assert.equal((await c.request(save, { method: 'POST' })).status, 200); assert.equal(files(s.folder).length, 1);
    } else if (mode === 'policy') {
      assert.equal((await c.request('/policy', { method: 'PUT', body: JSON.stringify({ excludedPaths: ['ui'] }) })).status, 200);
      await error(await c.request(route), 409, 'POLICY_CHANGED'); assert.deepEqual(readFileSync(path.join(s.folder, saved.receiptId + '.json')), before);
    } else {
      const hidden = history.dependencies.find(dep => !history.originals.some(original => original.sourceId === dep.sourceId))!; assert.ok(hidden);
      assert.equal((await c.request('/sources/' + hidden.sourceId + '/revoke', { method: 'POST' })).status, 200);
      assert.equal(state.store.source(hidden.sourceId).purge, 'completed'); assert.deepEqual(files(s.folder), []); await error(await c.request(route), 404, 'RECEIPT_NOT_FOUND');
    }
    await s.restart(); c = await client(createApp(state.catalog, { codeAnalysis: state.analysis, codePaths: state.paths, nativeCaptures: s.service() }));
    if (mode === 'capacity') assert.equal((await c.request(route)).status, 200);
    else await error(await c.request(route), mode === 'policy' ? 409 : 404, mode === 'policy' ? 'POLICY_CHANGED' : 'RECEIPT_NOT_FOUND');
    if (mode !== 'revoke') assert.deepEqual(readFileSync(path.join(s.folder, saved.receiptId + '.json')), before);
  });
});

test('HTTP native errors are bounded and private faults stay generic', async t => {
  const s = await setup(t), state = s.state, save = '/path-captures?buildId=' + state.buildId;
  for (const [name, options, status, code] of [
    ['work', { budget: { limits: { work: 0 } } }, 409, 'CAPTURE_WORK_LIMIT'],
    ['time', { budget: { limits: { wallMs: 0 } } }, 409, 'CAPTURE_TIME_LIMIT'],
    ['sources', { limits: { sources: 3 } }, 409, 'RECEIPT_SOURCE_LIMIT'],
    ['text', { limits: { textBytes: 1 } }, 409, 'RECEIPT_TEXT_LIMIT'],
    ['bytes', { limits: { receiptBytes: 1 } }, 409, 'RECEIPT_BYTES_LIMIT'],
  ] as [string, Options, number, string][]) await t.test(name, async () => {
    const service = s.service(options), c = await client(createApp(state.catalog, { codeAnalysis: state.analysis, nativeCaptures: service }));
    await error(await c.request(save, { method: 'POST' }), status, code); assert.deepEqual(files(s.folder), []); await service.stop();
  });
  for (const code of ['RECEIPT_STORAGE_BUSY', 'RECEIPT_SCOPE_FENCED', 'RECEIPT_FENCED', 'CANCELLED', 'CAPTURE_TIME_LIMIT', 'CAPTURE_WORK_LIMIT',
    'DISABLED_RECEIPT_STORAGE', 'INVALID_RECEIPT_HOOK', 'CORRUPT_RECEIPT', 'CAPTURE_GUARD_RELEASE_FAILED', '__proto__']) {
    const service = s.service({ checkpoint() { throw new NativeReceiptError(code, '/private/source/path secret detail'); } });
    const c = await client(createApp(state.catalog, { codeAnalysis: state.analysis, nativeCaptures: service }));
    const known = ['RECEIPT_STORAGE_BUSY', 'RECEIPT_SCOPE_FENCED', 'RECEIPT_FENCED', 'CANCELLED', 'CAPTURE_TIME_LIMIT', 'CAPTURE_WORK_LIMIT'].includes(code);
    for (const [route, init] of [[save, { method: 'POST' }], ['/path-captures/' + 'a'.repeat(64), {}]] as const) {
      const value = await error(await c.request(route, init), known ? 409 : 500, known ? code : undefined);
      if (!known) assert.deepEqual(value, genericError); assert.ok(!JSON.stringify(value).includes('private'));
    }
    await service.stop();
  }
  const stopped = s.service(); await stopped.stop();
  const c = await client(createApp(state.catalog, { codeAnalysis: state.analysis, nativeCaptures: stopped }));
  await error(await c.request(save, { method: 'POST' }), 409, 'SERVICE_STOPPED');
  const ready = await client(createApp(state.catalog, { codeAnalysis: state.analysis, nativeCaptures: s.service() }));
  await error(await ready.request('/path-captures/' + 'a'.repeat(64)), 404, 'RECEIPT_NOT_FOUND');
  state.store.run("UPDATE code_analyses SET fingerprint='incompatible'");
  await error(await ready.request(save, { method: 'POST' }), 409, 'RECEIPT_UNAVAILABLE');
});

test('HTTP cancellation, contention and shutdown release the actual capture owner', async t => {
  const s = await setup(t), state = s.state, save = '/path-captures?buildId=' + state.buildId;
  for (const mode of ['signal', 'stop'] as const) await t.test(mode, async () => {
    const reached = barrier(), gate = barrier(); let held = false;
    const service = s.service({ async checkpoint() { if (!held) { held = true; reached.release(); await gate.promise; } } });
    const c = await client(createApp(state.catalog, { codeAnalysis: state.analysis, nativeCaptures: service }));
    const controller = new AbortController(), pending = c.request(save, { method: 'POST', signal: controller.signal });
    try {
      await reached.promise; assert.equal((await c.request('/health')).status, 200);
      await error(await c.request(save, { method: 'POST' }), 409, 'CAPTURE_BUSY');
      await error(await c.request('/path-captures/' + 'a'.repeat(64)), 409, 'CAPTURE_BUSY');
      const stopped = mode === 'stop' ? service.stop() : undefined; if (mode === 'signal') controller.abort();
      gate.release(); await error(await pending, 409, 'CANCELLED'); await stopped; assert.deepEqual(files(s.folder), []);
      if (mode === 'stop') await error(await c.request(save, { method: 'POST' }), 409, 'SERVICE_STOPPED');
    } finally { gate.release(); await pending; await service.stop(); }
  });
  assert.equal((await (await client(createApp(state.catalog, { codeAnalysis: state.analysis, nativeCaptures: s.service() }))).request(save, { method: 'POST' })).status, 201);
});

test('real TCP bodies and disconnected capture/history requests stop before publication or output', { timeout: 20000 }, async t => {
  const s = await setup(t), state = s.state, initial = s.service(), saved = await initial.capture({ buildId: state.buildId }); await initial.stop();
  const originalBytes = readFileSync(path.join(s.folder, saved.receiptId + '.json'));
  for (const operation of ['capture', 'history'] as const) await t.test(operation, async () => {
    const reached = barrier(), gate = barrier(); let held = false, serverSignal: AbortSignal | undefined, report!: (code: string) => void;
    const observed = new Promise<string>(resolve => { report = resolve; });
    const service = s.service({ async checkpoint() { if (!held) { held = true; reached.release(); await gate.promise; } } });
    const original = service[operation].bind(service);
    // Observe the real propagated request signal and outcome without changing service work.
    if (operation === 'capture') service.capture = (input, signal) => { serverSignal = signal; return (original as NativeCaptures['capture'])(input, signal).catch(fail); };
    else service.history = (input, signal) => { serverSignal = signal; return (original as NativeCaptures['history'])(input, signal).catch(fail); };
    function fail(error: unknown): never { report(error instanceof NativeReceiptError || error instanceof OperationBudgetError ? error.code : 'UNEXPECTED'); throw error; }
    const app = createApp(state.catalog, { codeAnalysis: state.analysis, codePaths: state.paths, nativeCaptures: service });
    const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 });
    try {
      await once(server, 'listening'); const address = server.address(); assert.ok(address && typeof address === 'object');
      const request = (route: string, headers: Record<string, string>, method = 'GET', signal?: AbortSignal, body = '') =>
        new Promise<{ status: number; headers: IncomingHttpHeaders; body: string }>((resolve, reject) => {
          const req = httpRequest(`http://127.0.0.1:${address.port}/api` + route, { method, headers, ...signal ? { signal } : {} }, response => {
            let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; });
            response.on('end', () => resolve({ status: response.statusCode!, headers: response.headers, body })); response.on('error', reject);
          }); req.on('error', reject); req.end(body);
        });
      const session = await request('/session', { ...baseHeaders, 'x-loredock-client': 'web' }, 'POST'); assert.equal(session.status, 200);
      const headers = { ...baseHeaders, cookie: session.headers['set-cookie']![0]!.split(';')[0]!, 'x-loredock-csrf': (JSON.parse(session.body) as { token: string }).token };
      for (const bodyHeaders of [{ 'content-length': '1' }, { 'transfer-encoding': 'chunked' }]) {
        const rejected = await request('/path-captures/' + saved.receiptId, { ...headers, ...bodyHeaders }, 'GET', undefined, 'x');
        assert.equal(rejected.status, 400); assert.equal(held, false); assert.equal(rejected.headers['cache-control'], 'no-store');
      }
      const route = operation === 'capture' ? '/path-captures?buildId=' + state.buildId : '/path-captures/' + saved.receiptId;
      const controller = new AbortController(), response = request(route, headers, operation === 'capture' ? 'POST' : 'GET', controller.signal);
      await reached.promise; assert.ok(serverSignal); const aborted = serverSignal.aborted ? Promise.resolve() : once(serverSignal, 'abort');
      const rejected = assert.rejects(response, { name: 'AbortError' }); controller.abort(); await rejected; await aborted; gate.release();
      assert.equal(await observed, 'CANCELLED');
      const retry = await request(route, headers, operation === 'capture' ? 'POST' : 'GET'); assert.equal(retry.status, 200);
      assert.deepEqual(files(s.folder), [saved.receiptId + '.json']); assert.deepEqual(readFileSync(path.join(s.folder, saved.receiptId + '.json')), originalBytes);
    } finally {
      gate.release(); await service.stop(); if ('closeAllConnections' in server) server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
