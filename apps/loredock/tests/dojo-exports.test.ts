import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { typescriptFacts } from '../src/code-typescript.js';
import { codeFlows } from '../src/code-flows.js';
import { retrieveAnswerContext } from '../src/answer-context.js';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { sha256 } from '../src/extract.js';
// @ts-expect-error Frozen syntax examples are plain JavaScript.
import { dojoExportCases } from '../../../fixtures/loredock-dojo-exports/cases.mjs';
// @ts-expect-error The owned fixture generator is plain JavaScript.
import { createLoreDockFixture, fixtureGit } from '../../../scripts/loredock-fixture.mjs';

test('frozen Dojo export examples preserve literal ownership and reject ambiguous module bindings', async () => {
  const baseline = JSON.parse(await readFile(new URL('../../../fixtures/loredock-dojo-exports/baseline.json', import.meta.url), 'utf8')) as { sourceHashes: Record<string,string> };
  for (const [file, hash] of Object.entries(baseline.sourceHashes)) assert.equal(sha256(await readFile(new URL('../../../' + file, import.meta.url))), hash);
  for (const item of dojoExportCases as { id: string; source: string; names: string[]; paths: string[] }[]) {
    const facts = typescriptFacts(item.source, 'legacy.js');
    assert.deepEqual(facts.symbols.map(symbol => symbol.name), item.names, item.id);
    assert.deepEqual(facts.operations.map(operation => operation.properties.path), item.paths, item.id);
    assert.equal(new Set(facts.symbols.map(symbol => symbol.key)).size, facts.symbols.length);
    for (const operation of facts.operations) {
      const owner = facts.symbols.find(symbol => symbol.key === operation.owner)!; assert.ok(owner);
      assert.ok(operation.start >= owner.start && operation.end <= owner.end, item.id);
      assert.equal(operation.properties.adapter, 'dojo/request AMD');
    }
    if (!item.names.length) assert.ok(facts.gaps.includes('unsupported-amd-shape'), item.id);
  }
});

test('Dojo object budgets and parsed bodies never execute source', () => {
  const member = (index: number) => `action${index}: function() { return request.post('/cedar'); }`;
  const source = (count: number) => `define(['dojo/request'], function(request) { return {${Array.from({length:count}, (_, i) => member(i)).join(',')}}; });`;
  assert.equal(typescriptFacts(source(100), 'legacy.js').symbols.length, 100);
  const oversized = typescriptFacts(source(101), 'legacy.js');
  assert.equal(oversized.symbols.length, 0); assert.ok(oversized.gaps.includes('typescript-symbol-limit'));
  const probe = 'define(["dojo/request"], function(request) { return { send: function() { globalThis.__loredockDojoProbe = "executed"; return request.post("/cedar"); } }; });';
  assert.equal(typescriptFacts(probe, 'legacy.js').operations.length, 1);
  assert.equal(Object.hasOwn(globalThis, '__loredockDojoProbe'), false);
});

test('Dojo sibling exports retain exact code ownership, original evidence, history and source fences', async t => {
  const fixture = await createLoreDockFixture() as { root: string };
  const file = path.join(fixture.root, 'sources/portal/legacy/batch.js');
  const source = `define(['dojo/request'], function(request) {\n  return {\n    reserve: function(data) { return request.post('/cedar', {data:data}); },\n    cancel: function(id) { return request.delete('/cedar'); }\n  };\n});\n`;
  await writeFile(file, source);
  await writeFile(path.join(fixture.root, 'sources/portal/legacy/use-batch.ts'), "import { reserve } from './batch';\nexport function invoke() { return reserve({}); }\n");
  await writeFile(path.join(fixture.root, 'sources/order-api/config/batch-routes.json'), JSON.stringify({ routes: [
    { method: 'POST', path: '/cedar', handler: 'Batch.reserve' }, { method: 'DELETE', path: '/cedar', handler: 'Batch.cancel' },
  ] }, null, 2) + '\n');
  for (const repo of ['portal', 'order-api']) { fixtureGit(fixture.root, repo, ['add', '--all']); fixtureGit(fixture.root, repo, ['commit', '-qm', 'Add bounded Dojo export examples']); }
  const store = new CatalogStore(path.join(fixture.root, 'dojo-data')), catalog = new Catalog(store);
  t.after(async () => { await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  for (const repo of ['portal', 'order-api', 'order-worker']) await catalog.addSource(path.join(fixture.root, 'sources', repo));
  const index = async (request: string) => { const state = catalog.state(); catalog.start(request, state.sourceSetVersion, state.policyVersion); await catalog.idle(); };
  await index('dojo-first'); const before = codeFlows(catalog);
  assert.equal(before.adapterVersion, 'pilot-code-v3');
  const symbols = before.nodes.filter(node => node.kind === 'symbol' && node.path === 'legacy/batch.js');
  assert.deepEqual(symbols.map(node => [node.label, node.startLine, node.endLine]), [['reserve', 3, 3], ['cancel', 4, 4]]);
  assert.equal(new Set(symbols.map(node => node.id)).size, 2);
  const esCaller = before.nodes.find(node => node.kind === 'symbol' && node.path === 'legacy/use-batch.ts')!;
  assert.ok(esCaller); assert.equal(before.edges.some(edge => edge.kind === 'calls' && edge.from === esCaller.id), false);
  assert.ok(before.omissions['unresolved-import'], 'An AMD object property is not an ES module named export.');
  for (const symbol of symbols) {
    const performs = before.edges.find(edge => edge.kind === 'performs' && edge.from === symbol.id)!; assert.ok(performs);
    const operation = before.nodes.find(node => node.id === performs.to)!;
    assert.equal(operation.properties.method, symbol.label === 'reserve' ? 'POST' : 'DELETE');
    const link = before.edges.find(edge => edge.kind === 'http-target' && edge.from === operation.id)!;
    assert.equal(link.status, 'candidate'); assert.ok(link.gaps.length);
    assert.equal(before.nodes.find(node => node.id === link.to)!.properties.path, '/cedar');
    for (const id of link.evidenceIds) {
      const original = catalog.evidence(id); assert.equal(original.buildId, before.buildId);
      if (original.sourceName === 'portal') { assert.equal(original.path, 'legacy/batch.js'); assert.equal(original.startLine, 1); assert.match(original.text, /define\(\['dojo\/request'\]/); }
    }
  }
  const context = retrieveAnswerContext(catalog, 'cedar'); assert.equal(context.interfaces!.codeAdapter, 'pilot-code-v3');
  assert.ok(context.interfaces!.comparisons.some(item => item.from.path === 'legacy/batch.js'));
  await writeFile(file, source.replaceAll('/cedar', '/birch')); fixtureGit(fixture.root, 'portal', ['add', '--all']);
  fixtureGit(fixture.root, 'portal', ['commit', '-qm', 'Change only the owned Dojo example']); await index('dojo-next');
  const current = codeFlows(catalog), old = codeFlows(catalog, before.buildId);
  assert.equal(old.stale, true); assert.deepEqual(old.nodes.map(node => node.id), before.nodes.map(node => node.id));
  assert.ok(current.nodes.some(node => node.path === 'legacy/batch.js' && node.properties.path === '/birch'));
  const originalId = symbols[0]!.evidenceIds[0]!; catalog.revoke(symbols[0]!.sourceId);
  assert.throws(() => catalog.evidence(originalId));
  assert.ok(codeFlows(catalog, before.buildId).nodes.every(node => node.sourceId !== symbols[0]!.sourceId));
  assert.equal(store.all('SELECT id FROM answer_attempts').length, 0);
  for (const repo of ['portal', 'order-api', 'order-worker']) assert.equal(fixtureGit(fixture.root, repo, ['status', '--porcelain=v1']), '');
});
