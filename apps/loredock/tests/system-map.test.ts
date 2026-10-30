import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { declarationMap, mapLimits } from '../src/system-map.js';
import { createApp } from '../src/app.js';
import type { DeclarationMap } from '../src/system-map-types.js';
// @ts-expect-error The fixture generator is intentionally independent plain JavaScript.
import { createLoreDockFixture, fixtureGit } from '../../../scripts/loredock-fixture.mjs';

type Fixture = { root: string };
const repos = ['portal', 'order-api', 'order-worker'];
const filePath = (fixture: Fixture, repo: string, file: string) => path.join(fixture.root, 'sources', repo, file);
async function write(fixture: Fixture, repo: string, file: string, value: unknown) {
  const target = filePath(fixture, repo, file); await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(value, null, 2));
}
function commit(fixture: Fixture) {
  for (const repo of repos) if (fixtureGit(fixture.root, repo, ['status', '--porcelain=v1']).trim()) {
    fixtureGit(fixture.root, repo, ['add', '--all']); fixtureGit(fixture.root, repo, ['commit', '-qm', 'Add declaration-map test inputs']);
  }
}
async function setup(t: TestContext, mutate?: (fixture: Fixture) => Promise<void>) {
  const fixture = await createLoreDockFixture() as Fixture;
  if (mutate) { await mutate(fixture); commit(fixture); }
  const directory = path.join(fixture.root, 'catalog'); let store = new CatalogStore(directory), catalog = new Catalog(store);
  t.after(async () => { await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  for (const repo of repos) await catalog.addSource(path.join(fixture.root, 'sources', repo));
  const state = catalog.state(); catalog.start('first', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  return { fixture, get store() { return store; }, get catalog() { return catalog; }, restart: async () => {
    await catalog.stop(); store.close(); store = new CatalogStore(directory); catalog = new Catalog(store);
  } };
}

test('the map preserves repository-scoped declarations and treats matches as cited candidates', async t => {
  const { catalog, fixture } = await setup(t), map = declarationMap(catalog);
  assert.equal(map.nodes.filter(node => node.kind === 'repository').length, 3);
  assert.deepEqual(map.nodes.filter(node => node.kind === 'http-route').map(node => node.label).sort(), ['POST /api/orders', 'POST /legacy/orders']);
  const handler = map.nodes.filter(node => node.kind === 'handler-reference');
  assert.equal(handler.length, 1); assert.equal(handler[0]!.label, 'Orders.accept'); assert.equal(handler[0]!.properties.implementation, 'unresolved');
  const contracts = map.nodes.filter(node => node.kind === 'event-contract');
  assert.equal(contracts.length, 2); assert.notEqual(contracts[0]!.id, contracts[1]!.id); assert.notEqual(contracts[0]!.sourceId, contracts[1]!.sourceId);
  assert.equal(map.nodes.filter(node => node.kind === 'package').length, 3);
  const clues = map.edges.filter(edge => edge.status === 'candidate');
  assert.deepEqual(clues.map(edge => edge.kind).sort(), ['contract-match', 'setting-match']);
  assert.equal(clues.find(edge => edge.kind === 'setting-match')!.environment, 'local');
  for (const edge of map.edges) {
    assert.ok(map.nodes.some(node => node.id === edge.from)); assert.ok(map.nodes.some(node => node.id === edge.to));
    assert.ok(edge.evidenceIds.length); for (const id of edge.evidenceIds) assert.equal(catalog.evidence(id).buildId, map.buildId);
  }
  for (const node of map.nodes.filter(node => node.provenance === 'declaration')) for (const id of node.evidenceIds) assert.ok(map.evidence[id]);
  assert.equal(map.deploymentCoherence, 'unknown'); assert.equal(map.partial, true);
  assert.ok(map.gaps.some(gap => gap.includes('service identities')));
  assert.equal(JSON.stringify(map).includes(fixture.root), false, 'The projection must not expose absolute checkout paths');
  assert.equal(map.inputHash, declarationMap(catalog).inputHash);
});

test('changed same-name contracts remain distinct differences while historical evidence remains pinned', async t => {
  const { catalog, fixture } = await setup(t), before = declarationMap(catalog);
  const contract = JSON.parse(await readFile(filePath(fixture, 'order-worker', 'contracts/OrderPlaced.json'), 'utf8')) as { fields: Record<string, string> };
  contract.fields.createdAtMillis = 'epoch seconds'; await write(fixture, 'order-worker', 'contracts/OrderPlaced.json', contract); commit(fixture);
  const state = catalog.state(); catalog.start('second', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  const after = declarationMap(catalog), difference = after.edges.find(edge => edge.kind === 'contract-difference')!;
  assert.ok(difference); assert.equal(difference.status, 'difference'); assert.match(difference.reason, /does not establish runtime incompatibility/);
  assert.equal(after.nodes.filter(node => node.kind === 'event-contract').length, 2);
  assert.equal(after.edges.some(edge => edge.kind === 'contract-match'), false);
  const historical = declarationMap(catalog, before.buildId);
  assert.equal(historical.stale, true); assert.ok(historical.edges.some(edge => edge.kind === 'contract-match'));
  assert.deepEqual(historical.nodes.map(node => node.id), before.nodes.map(node => node.id));
});

test('environment separation and unsupported schemas cannot manufacture a connection', async t => {
  const { catalog } = await setup(t, async fixture => {
    await write(fixture, 'order-worker', 'config/local.json', { environment: 'production', orderTopic: 'orders.placed.v2' });
    await write(fixture, 'order-worker', 'contracts/OrderPlaced.json', { name: 'OrderPlaced', version: 2, fields: { id: 'string' }, transport: 'Kafka', customCompatibility: 'unverified' });
    await write(fixture, 'portal', 'config/invalid.json', { environment: ['local'], orderTopic: 'orders.placed.v2' });
    await write(fixture, 'portal', 'config/nested.json', { environment: 'local', orderTopic: { dynamic: 'unknown' } });
    await write(fixture, 'portal', 'arbitrary.json', { environment: 'local', arbitraryData: 'not a configuration declaration' });
    await write(fixture, 'portal', 'routes.json', { routes: [{ method: 'POST', path: '/bad', handler: ['not a literal'] }] });
    await write(fixture, 'portal', 'package.json', { name: '<script>window.mapInjected=true</script>' });
  });
  const map = declarationMap(catalog);
  assert.equal(map.edges.some(edge => edge.kind === 'setting-match' || edge.kind === 'setting-difference'), false);
  assert.equal(map.edges.some(edge => edge.kind === 'contract-match'), false);
  assert.equal(map.omissions['unsupported-contract'], 1); assert.equal(map.omissions['unsupported-environment'], 1);
  assert.equal(map.omissions['unsupported-setting'], 1); assert.equal(map.omissions['unsupported-route'], 1);
  assert.equal(map.omissions['unsupported-json'], 1); assert.equal(map.nodes.some(node => node.label === 'arbitraryData'), false);
  assert.ok(map.nodes.some(node => node.label === '<script>window.mapInjected=true</script>'));
});

test('document, file, input and node budgets disclose omissions without emitting dangling links', async t => {
  const { catalog } = await setup(t, async fixture => {
    for (let i = 0; i < 12; i++) await write(fixture, 'portal', `config/bulk-${String(i).padStart(2, '0')}.json`, { environment: 'local', ...Object.fromEntries(Array.from({ length: 65 }, (_, n) => [`key${n}`, 'x'.repeat(400)])) });
    for (let i = 0; i < 105; i++) await write(fixture, 'portal', `config/small-${i}.json`, { environment: 'local', key: 'value' });
    await write(fixture, 'portal', 'config/large.json', { environment: 'local', value: 'x'.repeat(mapLimits.fileBytes) });
  });
  const map = declarationMap(catalog);
  assert.ok(map.omissions['document-limit']); assert.ok(map.omissions['file-byte-limit']);
  assert.ok(map.omissions['input-byte-limit']); assert.ok(map.omissions['node-limit']);
  assert.ok(map.nodes.length <= mapLimits.nodes); assert.ok(map.edges.length <= mapLimits.edges);
  assert.ok(map.coverage.parsedBytes <= mapLimits.textBytes); assert.ok(Buffer.byteLength(JSON.stringify(map)) <= mapLimits.outputBytes);
  for (const edge of map.edges) assert.ok(map.nodes.some(node => node.id === edge.from) && map.nodes.some(node => node.id === edge.to));
});

test('comparison and edge limits stop unbounded cross-repository fan-out', async t => {
  const { catalog } = await setup(t, async fixture => {
    for (const repo of repos) for (let i = 0; i < 50; i++) await write(fixture, repo, `config/repeated-${i}.json`, { environment: 'local', sharedKey: 'value' });
  });
  const map = declarationMap(catalog);
  assert.ok(map.omissions['edge-limit']); assert.ok(map.omissions['comparison-limit']);
  assert.ok(map.edges.length <= mapLimits.edges); assert.ok(map.coverage.examinedDocuments <= mapLimits.documents);
  assert.ok(map.nodes.filter(node => node.kind === 'repository').every(repo => map.nodes.some(node => node.sourceId === repo.sourceId && node.kind !== 'repository')));
});

test('member and evidence-span limits omit whole declarations with explicit gaps', async t => {
  const { catalog } = await setup(t, async fixture => {
    await write(fixture, 'portal', 'extra-routes.json', { routes: Array.from({ length: 101 }, (_, n) => ({ method: 'GET', path: `/item/${n}`, handler: 'Items.list' })) });
    await writeFile(filePath(fixture, 'portal', 'config/long-lines.json'), '{\n' + '\n'.repeat(1000) + '"value":"not mapped"\n}');
  });
  const map = declarationMap(catalog);
  assert.equal(map.omissions['member-limit'], 1); assert.equal(map.omissions['file-span-limit'], 1);
  assert.equal(map.nodes.some(node => node.label === 'GET /item/100'), false);
  assert.equal(map.nodes.some(node => node.properties.value === 'not mapped'), false);
});

test('revocation fences cross-repository clues and policy changes fence historical maps', async t => {
  const { catalog } = await setup(t), initial = declarationMap(catalog);
  const api = initial.nodes.find(node => node.kind === 'repository' && node.label === 'order-api')!;
  catalog.revoke(api.sourceId);
  const after = declarationMap(catalog);
  assert.equal(after.nodes.some(node => node.sourceId === api.sourceId), false);
  assert.equal(Object.values(after.evidence).some(ref => ref.sourceName === 'order-api'), false);
  assert.equal(after.edges.some(edge => edge.status === 'candidate'), false);
  assert.equal(after.stale, true);
  catalog.updatePolicy(['config']);
  assert.throws(() => declarationMap(catalog, initial.buildId), /old policy/);
});

test('map values derive from checked source bytes, and corruption rejects the projection', async t => {
  const { catalog, store } = await setup(t), before = declarationMap(catalog);
  store.run('UPDATE files SET metadata=?', JSON.stringify({ name: 'Injected metadata', artifactId: 'Injected metadata' }));
  assert.deepEqual(declarationMap(catalog), before);
  store.run('UPDATE spans SET text=? WHERE id=?', 'Damaged evidence', Object.keys(before.evidence)[0]!);
  assert.throws(() => declarationMap(catalog), /integrity/);
});

test('missing valid spans cannot support facts parsed from uncited portions of a document', async t => {
  const { catalog, store } = await setup(t, async fixture => {
    await writeFile(filePath(fixture, 'portal', 'config/multispan.json'), '{\n' + '\n'.repeat(260) + '"value":"supported only with all spans"\n}');
  });
  assert.ok(declarationMap(catalog).nodes.some(node => node.properties.value === 'supported only with all spans'));
  const file = store.one<{ id: string }>("SELECT id FROM files WHERE path='config/multispan.json'")!;
  const issued = store.all<{ id: string }>('SELECT id FROM spans WHERE fileId=? ORDER BY startLine', file.id);
  assert.equal(issued.length, 3);
  store.run('DELETE FROM spans WHERE id=?', issued[1]!.id);
  assert.throws(() => declarationMap(catalog), /complete declaration document/);
  store.run('DELETE FROM spans WHERE fileId=?', file.id);
  assert.throws(() => declarationMap(catalog), /no issued evidence spans/);
});

test('restart reproduces the same projection and a fully revoked build yields an explicit empty map', async t => {
  const fixture = await setup(t), before = declarationMap(fixture.catalog);
  await fixture.restart(); assert.deepEqual(declarationMap(fixture.catalog), before);
  for (const source of fixture.catalog.state().sources) fixture.catalog.revoke(source.id);
  const empty = declarationMap(fixture.catalog);
  assert.equal(empty.nodes.length, 0); assert.equal(empty.edges.length, 0); assert.equal(Object.keys(empty.evidence).length, 0);
  assert.ok(empty.gaps.some(gap => gap.includes('Revoked')));
});

test('map HTTP reads require the local session and select only published authorized builds', async t => {
  const { catalog } = await setup(t), app = createApp(catalog), base = 'http://127.0.0.1:4244';
  const shared = { host: '127.0.0.1:4244', origin: base };
  assert.equal((await app.request(base + '/api/system-map', { headers: shared })).status, 401);
  const session = await app.request(base + '/api/session', { method: 'POST', headers: { ...shared, 'x-loredock-client': 'web' } });
  const headers = { ...shared, cookie: session.headers.get('set-cookie')!.split(';')[0]! };
  const response = await app.request(base + '/api/system-map', { headers });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const map = await response.json() as DeclarationMap; assert.ok(map.edges.some(edge => edge.kind === 'contract-match'));
  assert.equal((await app.request(base + '/api/system-map?buildId=unknown', { headers })).status, 404);
  const state = catalog.state(), next = catalog.start('pending', state.sourceSetVersion, state.policyVersion);
  assert.equal((await app.request(base + '/api/system-map?buildId=' + next.id, { headers })).status, 409);
});
