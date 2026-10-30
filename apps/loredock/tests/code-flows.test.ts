import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { codeFlows, flowLimits } from '../src/code-flows.js';
import { createApp } from '../src/app.js';
import type { CodeFlows } from '../src/code-flow-types.js';
// @ts-expect-error The fixture generator is intentionally independent plain JavaScript.
import { createLoreDockFixture, fixtureGit } from '../../../scripts/loredock-fixture.mjs';

type Fixture = { root: string };
const repos = ['portal', 'order-api', 'order-worker'];
const target = (fixture: Fixture, repo: string, file: string) => path.join(fixture.root, 'sources', repo, file);
async function put(fixture: Fixture, repo: string, file: string, text: string) {
  const filePath = target(fixture, repo, file); await mkdir(path.dirname(filePath), { recursive: true }); await writeFile(filePath, text);
}
function commit(fixture: Fixture) {
  for (const repo of repos) if (fixtureGit(fixture.root, repo, ['status', '--porcelain=v1'])) {
    fixtureGit(fixture.root, repo, ['add', '--all']); fixtureGit(fixture.root, repo, ['commit', '-qm', 'Add static-flow test inputs']);
  }
}
async function setup(t: TestContext, mutate?: (fixture: Fixture) => Promise<void>) {
  const fixture = await createLoreDockFixture() as Fixture;
  if (mutate) { await mutate(fixture); commit(fixture); }
  const directory = path.join(fixture.root, 'catalog'); let store = new CatalogStore(directory), catalog = new Catalog(store);
  t.after(async () => { await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  for (const repo of repos) await catalog.addSource(path.join(fixture.root, 'sources', repo));
  const index = async (key: string) => { const state = catalog.state(); catalog.start(key, state.sourceSetVersion, state.policyVersion); await catalog.idle(); };
  await index('first');
  return { fixture, index, get catalog() { return catalog; }, get store() { return store; }, restart: async () => {
    await catalog.stop(); store.close(); store = new CatalogStore(directory); catalog = new Catalog(store);
  } };
}
function validReferences(value: CodeFlows, catalog: Catalog) {
  for (const node of value.nodes) {
    assert.ok(node.evidenceIds.length);
    for (const id of node.evidenceIds) { const ref = catalog.evidence(id); assert.equal(ref.buildId, value.buildId); assert.equal(ref.sourceId, node.sourceId); assert.ok(value.evidence[id]); }
  }
  for (const edge of value.edges) {
    assert.ok(value.nodes.some(node => node.id === edge.from)); assert.ok(value.nodes.some(node => node.id === edge.to));
    for (const id of edge.evidenceIds) assert.ok(value.evidence[id]);
  }
  for (const flow of value.flows) {
    assert.equal(flow.nodeIds.length, flow.edgeIds.length + 1);
    for (let index = 0; index < flow.edgeIds.length; index++) {
      const edge = value.edges.find(edge => edge.id === flow.edgeIds[index])!;
      assert.equal(edge.from, flow.nodeIds[index]); assert.equal(edge.to, flow.nodeIds[index + 1]);
    }
    for (const id of flow.evidenceIds) assert.ok(value.evidence[id]);
  }
}

test('two partial cited outlines join both clients to the shared handler and candidate subscriber/write', async t => {
  const { catalog, fixture } = await setup(t), value = codeFlows(catalog);
  assert.equal(value.flows.length, 2); assert.equal(value.coverage.candidateDocuments, 5);
  assert.equal(value.flows[0]!.title, 'Vue action · Checkout.vue'); assert.equal(value.flows[1]!.title, 'Dojo action · orders.js');
  for (const flow of value.flows) {
    const path = flow.nodeIds.map(id => value.nodes.find(node => node.id === id)!);
    assert.ok(path.some(node => node.label === 'Orders.accept'));
    assert.ok(path.some(node => node.kind === 'event-publish'));
    assert.ok(path.some(node => node.kind === 'event-subscribe'));
    assert.equal(path.at(-1)!.kind, 'document-write');
    assert.equal(flow.status, 'partial'); assert.equal(flow.environment, null);
    assert.ok(flow.gaps.some(gap => gap.includes('Runtime topic parameters')));
    assert.ok(flow.gaps.some(gap => gap.includes('Dispatch') || gap.includes('dispatch')));
    assert.ok(flow.gaps.some(gap => gap.includes('concrete database')));
  }
  const event = value.edges.find(edge => edge.kind === 'event-delivery')!;
  assert.equal(event.status, 'candidate'); assert.equal(event.environment, 'local');
  assert.equal(value.edges.find(edge => edge.kind === 'dispatch-candidate')!.status, 'candidate');
  assert.ok(event.evidenceIds.some(id => value.evidence[id]!.path === 'contracts/OrderPlaced.json'));
  assert.ok(event.evidenceIds.some(id => value.evidence[id]!.path === 'config/local.json'));
  validReferences(value, catalog);
  assert.equal(value.inputHash, codeFlows(catalog).inputHash);
  assert.equal(JSON.stringify(value).includes(fixture.root), false);
  for (const repo of repos) assert.equal(fixtureGit(fixture.root, repo, ['status', '--porcelain=v1']), '');
});

test('a changed same-name record cannot create a delivery link and old flows stay pinned', async t => {
  const setupResult = await setup(t), before = codeFlows(setupResult.catalog), file = 'src/main/java/OrderConsumer.java';
  const source = await readFile(target(setupResult.fixture, 'order-worker', file), 'utf8');
  await put(setupResult.fixture, 'order-worker', file, source.replace('long createdAtMillis', 'String createdAtMillis')); commit(setupResult.fixture);
  await setupResult.index('changed-record');
  const after = codeFlows(setupResult.catalog);
  assert.equal(after.edges.some(edge => edge.kind === 'event-delivery'), false);
  assert.ok(after.omissions['unresolved-consumer-method']);
  const old = codeFlows(setupResult.catalog, before.buildId);
  assert.equal(old.stale, true); assert.ok(old.flows.every(flow => old.nodes.find(node => node.id === flow.nodeIds.at(-1))!.kind === 'document-write'));
  assert.deepEqual(old.nodes.map(node => node.id), before.nodes.map(node => node.id));
});

test('distinct explicit environments, differing contracts and contradictory literal topics suppress delivery candidates', async t => {
  for (const variation of ['environment', 'contract', 'literal-topic']) await t.test(variation, async subtest => {
    const { catalog } = await setup(subtest, async fixture => {
      if (variation === 'environment') await put(fixture, 'order-worker', 'config/local.json', JSON.stringify({ environment: 'production', orderTopic: 'orders.placed.v2' }));
      if (variation === 'contract') {
        const contract = JSON.parse(await readFile(target(fixture, 'order-worker', 'contracts/OrderPlaced.json'), 'utf8')) as { fields: Record<string, string> };
        contract.fields.createdAtMillis = 'epoch seconds'; await put(fixture, 'order-worker', 'contracts/OrderPlaced.json', JSON.stringify(contract));
      }
      if (variation === 'literal-topic') {
        const file = 'src/main/java/Orders.java', source = await readFile(target(fixture, 'order-api', file), 'utf8');
        await put(fixture, 'order-api', file, source.replace('publisher.publish(topic,', 'publisher.publish("different-topic",'));
      }
    });
    assert.equal(codeFlows(catalog).edges.some(edge => edge.kind === 'event-delivery'), false);
  });
});

test('ambiguous route handlers and relative imports are not resolved by names alone', async t => {
  const { catalog } = await setup(t, async fixture => {
    await put(fixture, 'order-api', 'other/Orders.java', 'final class Orders { Accepted accept(String orderId, String tenantId) { return null; } }');
    await put(fixture, 'portal', 'src/orders.js', `export function submitOrder() { return fetch('/api/orders', {method:'POST'}); }`);
  });
  const value = codeFlows(catalog);
  assert.equal(value.edges.some(edge => edge.kind === 'implements'), false); assert.ok(value.omissions['ambiguous-handler']);
  assert.equal(value.edges.some(edge => edge.kind === 'calls'), false); assert.ok(value.omissions['ambiguous-import']);
  assert.ok(value.flows.every(flow => !flow.nodeIds.some(id => value.nodes.find(node => node.id === id)!.kind === 'event-publish')));
});

test('dynamic URLs and unsupported code stay searchable without manufacturing flows', async t => {
  const { catalog } = await setup(t, async fixture => {
    await put(fixture, 'portal', 'src/orders.ts', 'export function submitOrder() { return fetch(dynamicEndpoint); }');
    await put(fixture, 'portal', 'legacy/orders.js', 'const note = "request.post(\'/legacy/orders\')";');
  });
  const value = codeFlows(catalog);
  assert.equal(value.nodes.some(node => node.kind === 'http-request'), false);
  assert.ok(value.omissions['adapter:dynamic-or-unsupported-http-request']);
  assert.ok(catalog.search('dynamicEndpoint').hits.length);
  assert.equal(value.edges.some(edge => edge.kind === 'http-target'), false);
});

test('flow projection survives restart, removes revoked evidence and fences old-policy reads', async t => {
  const setupResult = await setup(t), before = codeFlows(setupResult.catalog);
  await setupResult.restart(); assert.deepEqual(codeFlows(setupResult.catalog), before);
  const api = setupResult.catalog.state().sources.find(source => source.name === 'order-api')!;
  setupResult.catalog.revoke(api.id); const revoked = codeFlows(setupResult.catalog);
  assert.equal(revoked.nodes.some(node => node.sourceId === api.id), false);
  assert.equal(Object.values(revoked.evidence).some(ref => ref.sourceName === 'order-api'), false);
  assert.equal(revoked.edges.some(edge => edge.kind === 'event-delivery'), false);
  assert.equal(revoked.stale, true); validReferences(revoked, setupResult.catalog);
  for (const source of setupResult.catalog.state().sources.filter(source => source.status === 'active')) setupResult.catalog.revoke(source.id);
  assert.equal(codeFlows(setupResult.catalog).nodes.length, 0); assert.equal(codeFlows(setupResult.catalog).flows.length, 0);
  setupResult.catalog.updatePolicy(['legacy']);
  assert.throws(() => codeFlows(setupResult.catalog, before.buildId), /old policy/);
});

test('corrupted or missing code evidence rejects whole-file analysis', async t => {
  const { catalog, store } = await setup(t, async fixture => {
    await put(fixture, 'portal', 'multi.ts', '\n'.repeat(250) + 'export function extra(){ return fetch("/api/orders", {method:"POST"}); }');
  });
  const before = codeFlows(catalog), ref = Object.values(before.evidence).find(ref => ref.path === 'src/orders.ts')!;
  const row = store.one<{ text: string }>('SELECT text FROM spans WHERE id=?', ref.id)!;
  store.run('UPDATE spans SET text=? WHERE id=?', 'Corrupt source', ref.id);
  assert.throws(() => codeFlows(catalog), /integrity/);
  store.run('UPDATE spans SET text=? WHERE id=?', row.text, ref.id);
  const file = store.one<{ id: string }>("SELECT id FROM files WHERE path='multi.ts'")!;
  const issued = store.all<{ id: string }>('SELECT id FROM spans WHERE fileId=? ORDER BY startLine', file.id);
  assert.equal(issued.length, 3); store.run('DELETE FROM spans WHERE id=?', issued[1]!.id);
  assert.throws(() => codeFlows(catalog), /complete declaration document/);
  store.run('DELETE FROM spans WHERE fileId=?', file.id);
  assert.throws(() => codeFlows(catalog), /no issued evidence spans/);
});

test('multi-span code citations retain the distant record, interface and import binding evidence', async t => {
  const { catalog } = await setup(t, async fixture => {
    const file = 'src/main/java/Orders.java', source = await readFile(target(fixture, 'order-api', file), 'utf8');
    await put(fixture, 'order-api', file, source.replace('  Accepted accept(', '\n'.repeat(250) + '  Accepted accept('));
  });
  const value = codeFlows(catalog), publisher = value.nodes.find(node => node.kind === 'event-publish')!;
  assert.ok(publisher.startLine > 240);
  assert.equal(publisher.evidenceIds.length, 3);
  assert.ok(publisher.evidenceIds.some(id => catalog.evidence(id).text.includes('record OrderPlaced')));
  assert.ok(value.edges.find(edge => edge.kind === 'event-delivery')!.evidenceIds.includes(publisher.evidenceIds[0]!));
});

test('document, input, file, span and node limits disclose partial work and preserve graph references', async t => {
  const { catalog } = await setup(t, async fixture => {
    for (let index = 0; index < 12; index++) await put(fixture, 'portal', `b${index}.ts`, `export function f${index}(){ return fetch('/api/orders', {method:'POST'}); }\n//` + 'x'.repeat(28000));
    for (let index = 0; index < 105; index++) await put(fixture, 'portal', `source-${index}.ts`, `export function f${index}(){ return fetch('/api/orders', {method:'POST'}); }`);
    await put(fixture, 'portal', 'a.ts', '// ' + 'x'.repeat(flowLimits.fileBytes));
    await put(fixture, 'portal', 'z.ts', '\n'.repeat(1000) + 'export function last(){return 0;}');
    await put(fixture, 'order-worker', 'many.ts', Array.from({ length: 100 }, (_, index) => `export function w${index}(){ return fetch('/api/orders', {method:'POST'}); }`).join('\n'));
  });
  const value = codeFlows(catalog);
  for (const reason of ['document-limit', 'file-byte-limit', 'input-byte-limit', 'file-span-limit', 'node-limit']) assert.ok(value.omissions[reason], reason);
  assert.ok(value.nodes.length <= flowLimits.nodes); assert.ok(value.edges.length <= flowLimits.edges);
  assert.ok(value.coverage.parsedBytes <= flowLimits.textBytes); assert.ok(Buffer.byteLength(JSON.stringify(value)) <= flowLimits.outputBytes);
  validReferences(value, catalog);
});

test('edge and comparison budgets bound repeated candidate paths', async t => {
  const { catalog } = await setup(t, async fixture => {
    await put(fixture, 'order-worker', 'routes.json', JSON.stringify({ routes: Array.from({ length: 100 }, () => ({ method: 'POST', path: '/api/orders', handler: 'Missing.handle' })) }));
    await put(fixture, 'portal', 'many.ts', 'export function many(){' + `fetch('/api/orders', {method:'POST'});`.repeat(35) + '}');
  });
  const value = codeFlows(catalog);
  assert.ok(value.omissions['edge-limit']); assert.ok(value.omissions['comparison-limit']);
  assert.ok(value.edges.length <= flowLimits.edges); validReferences(value, catalog);
});

test('code-flow API uses the existing protected transport and published build boundary', async t => {
  const { catalog } = await setup(t), app = createApp(catalog), base = 'http://127.0.0.1:4244';
  const shared = { host: '127.0.0.1:4244', origin: base };
  assert.equal((await app.request(base + '/api/code-flows', { headers: shared })).status, 401);
  assert.equal((await app.request(base + '/api/code-flows', { headers: { ...shared, host: 'evil.invalid' } })).status, 403);
  const session = await app.request(base + '/api/session', { method: 'POST', headers: { ...shared, 'x-loredock-client': 'web' } });
  const headers = { ...shared, cookie: session.headers.get('set-cookie')!.split(';')[0]! };
  const response = await app.request(base + '/api/code-flows', { headers });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json() as CodeFlows).flows.length, 2);
  assert.equal((await app.request(base + '/api/code-flows?buildId=unknown', { headers })).status, 404);
  const state = catalog.state(), next = catalog.start('pending', state.sourceSetVersion, state.policyVersion);
  assert.equal((await app.request(base + '/api/code-flows?buildId=' + next.id, { headers })).status, 409);
});
