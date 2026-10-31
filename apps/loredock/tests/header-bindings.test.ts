import assert from 'node:assert/strict';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { codeFlows } from '../src/code-flows.js';
import { typescriptFacts } from '../src/code-typescript.js';
import { compareHeaders, headerLimits, requestHeaderProperties, routeHeaderProperties } from '../src/http-headers.js';
// @ts-expect-error The independent fixture generator is plain JavaScript.
import { createLoreDockFixture, fixtureGit } from '../../../scripts/loredock-fixture.mjs';

test('an independent HTTP candidate exposes a literal header gap with original evidence from both sides', async t => {
  const fixture = await createLoreDockFixture() as { root: string };
  const store = new CatalogStore(path.join(fixture.root, 'catalog')), catalog = new Catalog(store);
  t.after(async () => { await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  await writeFile(path.join(fixture.root, 'sources/portal/src/receipt.ts'),
    "export function submitReceipt(key: string) { return fetch('/receipts', { method: 'POST', headers: { 'X-Receipt-Key': key } }); }\n");
  await writeFile(path.join(fixture.root, 'sources/order-api/config/receipt-routes.json'), JSON.stringify({
    routes: [{ method: 'POST', path: '/receipts', handler: 'Ledger.accept' }],
    headerBindings: { 'Ledger.accept.key': 'X-Receipt' },
  }) + '\n');
  for (const source of ['portal', 'order-api']) {
    fixtureGit(fixture.root, source, ['add', '--all']); fixtureGit(fixture.root, source, ['commit', '-qm', 'Add independent header binding example']);
    await catalog.addSource(path.join(fixture.root, 'sources', source));
  }
  const state = catalog.state(); catalog.start('headers', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  const projection = codeFlows(catalog), request = projection.nodes.find(node => node.kind === 'http-request' && node.path === 'src/receipt.ts')!;
  const edge = projection.edges.find(edge => edge.kind === 'http-target' && edge.from === request.id)!;
  assert.equal(edge.status, 'candidate'); assert.ok('headerCheck' in edge);
  assert.equal((edge.headerCheck as { status: string }).status, 'gap');
  assert.match(edge.reason, /X-Receipt-Key/); assert.match(edge.reason, /X-Receipt/);
  assert.ok(edge.evidenceIds.some(id => catalog.evidence(id).path === 'src/receipt.ts'));
  assert.ok(edge.evidenceIds.some(id => catalog.evidence(id).path === 'config/receipt-routes.json'));
  assert.ok(edge.gaps.some(gap => /runtime|deployment/i.test(gap)));
  for (const source of ['portal', 'order-api']) assert.equal(fixtureGit(fixture.root, source, ['status', '--porcelain=v1']), '');
});

test('header comparison ignores ASCII case but never invents renames or runtime values', () => {
  const route = routeHeaderProperties({ 'Ledger.accept.key': 'X-Receipt' }, 'Ledger.accept');
  assert.equal(compareHeaders(requestHeaderProperties(['x-receipt']), route).status, 'match');
  for (const names of [[], ['X-Receipt-Key'], ['X_Receipt']]) {
    assert.equal(compareHeaders(requestHeaderProperties(names), route).status, 'gap');
  }
  assert.equal(compareHeaders(requestHeaderProperties(), route).status, 'unknown');
  assert.equal(compareHeaders(requestHeaderProperties(['X-Receipt']), routeHeaderProperties(undefined, 'Ledger.accept')).status, 'unknown');
});

test('supported fetch and Dojo options retain only literal header names, including empty declarations', () => {
  for (const options of ['', ', {}', ', {headers:{}}', ', {headers:{"x-receipt": sensitiveValue()}}']) {
    for (const source of [
      `export function send() { return fetch('/receipts'${options}); }`,
      `define(['dojo/request'], function(request) { return function send() { return request.post('/receipts'${options}); }; });`,
    ]) {
      const facts = typescriptFacts(source, 'client.js'), properties = facts.operations[0]!.properties;
      assert.equal(properties.requestHeaderStatus, 'literal');
      assert.equal(properties.requestHeaderNames, options.includes('sensitiveValue') ? '["x-receipt"]' : '[]');
      assert.ok(!JSON.stringify(properties).includes('sensitiveValue'));
    }
  }
});

test('ambiguous or unsupported headers retain HTTP candidates but never claim complete names', () => {
  const headers = [
    'dynamic', 'new Headers()', '[["X-Receipt", key]]', 'null',
    '{...more}', '{[name]:key}', '{get receipt(){throw Error("must not run");}}', '{receipt}',
    '{__proto__:{"X-Receipt":key}}', '{"X-Receipt":a,"x-receipt":b}',
    '{"bad name":key}', '{"X-Ünicode":key}', `{"${'X'.repeat(129)}":key}`,
    `{${Array.from({length:17}, (_, index) => `"X-${index}":key`).join(',')}}`,
    `{${Array.from({length:5}, (_, index) => `"X-${index}${'a'.repeat(110)}":key`).join(',')}}`,
  ];
  for (const value of headers) {
    for (const source of [
      `export function send() { return fetch('/receipts', {headers:${value}}); }`,
      `define(['dojo/request'], function(request) { return function send() { return request.post('/receipts', {headers:${value}}); }; });`,
    ]) {
      const facts = typescriptFacts(source, 'client.js'); assert.equal(facts.operations.length, 1, source);
      assert.equal(facts.operations[0]!.properties.requestHeaderStatus, 'unknown', source);
      assert.ok(facts.gaps.includes('unresolved-http-headers'), source);
    }
  }
  const inherited = typescriptFacts(`export function send(){return fetch('/receipts',{__proto__:options});}`, 'client.js');
  assert.equal(inherited.operations[0]!.properties.requestHeaderStatus, 'unknown');
});

test('binding ownership is exact and malformed or oversized bindings stay unresolved', () => {
  const owned = routeHeaderProperties({ 'Ledger.accept.key': 'X-Receipt', 'Ledger.acceptExtra.key': 'Unrelated' }, 'Ledger.accept');
  assert.equal(owned.headerBindings, '[{"parameter":"key","name":"X-Receipt"}]');
  for (const input of [undefined, {}, { 'Other.accept.key': 'X-Receipt' }]) {
    assert.equal(routeHeaderProperties(input, 'Ledger.accept').headerBindingStatus, 'not-declared');
  }
  for (const input of [null, [], 'X-Receipt', { 'Ledger.accept.key': 4 }, { 'Ledger.accept.key': 'bad:name' },
    { 'Ledger.accept.key.extra': 'X-Receipt' }, { 'Ledger.accept.key': 'X'.repeat(129) },
    Object.fromEntries(Array.from({length:17}, (_, i) => [`Ledger.accept.p${i}`, 'X-Receipt'])),
    Object.fromEntries(Array.from({length:4}, (_, i) => [`Ledger.accept.p${i}`, 'X'.repeat(128)])),
  ]) assert.equal(routeHeaderProperties(input, 'Ledger.accept').headerBindingStatus, 'unknown', JSON.stringify(input));
  const maximum = requestHeaderProperties(Array.from({length:headerLimits.names}, (_, i) => `X-${i}`));
  assert.equal(maximum.requestHeaderStatus, 'literal'); assert.ok(maximum.requestHeaderNames!.length <= 512);
});
