import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { SourceGit } from '../src/git.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { CodePathsV2 } from '../src/code-paths-v2.js';
import { CodePaths } from '../src/code-paths.js';
import { OperationBudgetError, operationAccounting } from '../src/operation-budget.js';
import { topicRule } from '../src/literal-topic.js';
import type { CodePathsAvailableV2, CodePathsResponseV2 } from '../src/code-paths-v2-types.js';
// @ts-expect-error Small owned development corpus, never a reserved resource family.
import { corpusFactory } from '../../../scripts/loredock-native-assessment/fixture.mjs';
// @ts-expect-error Existing independent owned source/catalog lifecycle.
import { receiptFixture } from '../../../scripts/loredock-capture-scale/fixture.mjs';

interface State {
  buildId: string; store: CatalogStore; catalog: Catalog; analysis: CodeAnalysis; paths: CodePathsV2;
  counters(): { gitCalls: number; writeCalls: number; changedRows: number };
  analyze(): Promise<string>; close(): Promise<void>;
}
const origin = 'http://127.0.0.1:4244';
async function setup(t: TestContext, dynamic = false) {
  const root = await mkdtemp(path.join(tmpdir(), 'public-native-paths-'));
  const corpus = corpusFactory() as Record<string, Record<string, string>>;
  if (dynamic) {
    corpus['b-permit-api']!['Grants.java'] = corpus['b-permit-api']!['Grants.java']!.replace('"permit.granted.v3"', 'tenant');
    corpus['c-permit-store']!['PermitWriter.java'] = corpus['c-permit-store']!['PermitWriter.java']!.replace('"permit.granted.v3"', 'group');
  }
  const state = await receiptFixture(root, corpus, { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths: CodePathsV2 }) as State;
  t.after(async () => { await state.close(); await rm(root, { recursive: true, force: true }); });
  await state.analyze(); return state;
}
async function client(app: ReturnType<typeof createApp>) {
  const session = await app.request(origin + '/api/session', { method: 'POST', headers: {
    host: '127.0.0.1:4244', origin, 'x-loredock-client': 'web',
  } });
  assert.equal(session.status, 200);
  const cookie = session.headers.get('set-cookie')!.split(';')[0]!;
  return (route: string, signal?: AbortSignal) => app.request(origin + '/api' + route, {
    headers: { host: '127.0.0.1:4244', origin, cookie }, ...signal ? { signal } : {},
  });
}
const available = (value: CodePathsResponseV2): CodePathsAvailableV2 => { assert.equal(value.schemaVersion, 'loredock-code-paths/2'); assert.ok(value.status === 'available'); return value; };

test('public defaults expose native identities, literal support and pinned selections without writes or receipts', async t => {
  const s = await setup(t), request = await client(createApp(s.catalog, { codeAnalysis: s.analysis }));
  const before = s.counters(), response = await request('/code-paths?buildId=' + s.buildId);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const value = available(await response.json() as CodePathsResponseV2);
  assert.equal(value.identity.adapter, 'connected-paths-v2'); assert.deepEqual(value.identity.accounting, operationAccounting);
  assert.deepEqual(value.identity.topicRule, topicRule); assert.equal(value.graph!.schemaVersion, 'loredock-connected-display/2');
  assert.deepEqual(value, await s.paths.read({ buildId: s.buildId }));
  const delivery = value.graph!.edges.find(edge => edge.kind === 'event-delivery')!;
  assert.equal(delivery.status, 'candidate'); assert.equal(delivery.topicCheck!.value, 'permit.granted.v3');
  assert.equal(value.deploymentCoherence, 'unknown'); assert.equal(value.partial, true);
  for (const endpoint of [delivery.topicCheck!.publisher, delivery.topicCheck!.subscriber]) {
    assert.ok(endpoint.evidenceIds.length);
    for (const id of endpoint.evidenceIds) {
      const original = await request('/evidence/' + id); assert.equal(original.status, 200);
      assert.ok((await original.json() as { text: string }).text.includes(endpoint.expression));
    }
  }
  const pins = { buildId: s.buildId, inventoryId: value.identity.inventoryId, generationId: value.generationId };
  const selected = available(await (await request('/code-paths?' + new URLSearchParams({ ...pins, rootId: value.roots.items[0]!.id }))).json() as CodePathsResponseV2);
  assert.equal(selected.graph!.flows.length, 1);
  const page = available(await (await request('/code-paths/roots?' + new URLSearchParams({ ...pins, offset: '4' }))).json() as CodePathsResponseV2);
  assert.equal(page.graph, null); assert.equal(page.roots.items.length, 1);
  const isolated = available(await (await request('/code-paths?' + new URLSearchParams({ ...pins, rootId: page.roots.items[0]!.id }))).json() as CodePathsResponseV2);
  assert.equal(isolated.graph!.nodes.length, 1); assert.equal(isolated.graph!.edges.length, 0);
  const legacy = new CodePaths(s.analysis); let old;
  try { old = await legacy.read({ buildId: s.buildId }); } finally { await legacy.stop(); }
  assert.ok(old.status === 'available'); assert.notEqual(old.generationId, value.generationId);
  const stale = await request('/code-paths?' + new URLSearchParams({ ...pins, generationId: old.generationId }));
  assert.equal(stale.status, 400); assert.equal((await stale.json() as { error: { code: string } }).error.code, 'INVALID_GENERATION');
  for (const key of ['gitCalls', 'writeCalls', 'changedRows'] as const) assert.equal(s.counters()[key], before[key]);
  assert.deepEqual(await readdir(path.join(s.store.directory, 'path-receipts', s.store.receipts.catalogId)), []);
});

test('public native paths retain an unresolved dynamic topic instead of a delivery candidate', async t => {
  const s = await setup(t, true), request = await client(createApp(s.catalog, { codeAnalysis: s.analysis }));
  const value = available(await (await request('/code-paths?buildId=' + s.buildId)).json() as CodePathsResponseV2);
  assert.ok(!value.graph!.edges.some(edge => edge.kind === 'event-delivery'));
  assert.ok(value.coverage.omissions['unresolved-topic-expression']! > 0);
  for (const flow of value.graph!.flows) assert.equal(value.graph!.nodes.find(node => node.id === flow.nodeIds.at(-1))!.kind, 'event-publish');
});

test('public native budget outcomes are bounded conflicts while internal faults remain generic', async t => {
  const s = await setup(t);
  for (const mode of ['work', 'time', 'cancel', 'internal'] as const) await t.test(mode, async () => {
    const paths = new CodePathsV2(s.analysis, mode === 'work' ? { budget: { limits: { work: 0 } } }
      : mode === 'time' ? { budget: { limits: { wallMs: 0 } } }
        : mode === 'internal' ? { budget: { observe: () => { throw new OperationBudgetError('INVALID_CAPTURE_OBSERVER', 'Internal test detail.'); } } } : {});
    try {
      const request = await client(createApp(s.catalog, { codeAnalysis: s.analysis, codePaths: paths }));
      const controller = new AbortController(); if (mode === 'cancel') controller.abort();
      const response = await request('/code-paths?buildId=' + s.buildId, controller.signal);
      assert.equal(response.status, mode === 'internal' ? 500 : 409); assert.equal(response.headers.get('cache-control'), 'no-store');
      const result = await response.json() as { error: { code?: string; message: string } }; assert.deepEqual(Object.keys(result), ['error']);
      if (mode === 'internal') assert.deepEqual(result, { error: { message: 'The local operation failed. Check the daemon and retry.' } });
      else assert.equal(result.error.code, { work: 'CAPTURE_WORK_LIMIT', time: 'CAPTURE_TIME_LIMIT', cancel: 'CANCELLED' }[mode]);
      assert.ok(!JSON.stringify(result).includes('Internal test detail.'));
    } finally { await paths.stop(); }
  });
});
