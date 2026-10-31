import assert from 'node:assert/strict';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { retrieveAnswerContext, validateCitedAnswer, type AnswerContext } from '../src/answer-context.js';
import { Answers, answerPrompt, answerPromptVersion } from '../src/answers.js';
import { answerInterfaces, answerInterfaceLimits, fitAnswerInterfaces, selectAnswerInterfaces } from '../src/answer-interfaces.js';
import { answerPromptBytes } from '../src/answer-prompt.js';
import { codeFlows } from '../src/code-flows.js';
import { sha256 } from '../src/extract.js';
import type { TextRuntime, TextRequest } from '@aew/ai';
// @ts-expect-error The independent fixture generator is plain JavaScript.
import { createLoreDockFixture, fixtureGit } from '../../../scripts/loredock-fixture.mjs';

async function setup(t: TestContext) {
  const fixture = await createLoreDockFixture() as { root: string };
  const directory = path.join(fixture.root, 'catalog'); let store = new CatalogStore(directory), catalog = new Catalog(store);
  t.after(async () => { await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  await writeFile(path.join(fixture.root, 'sources/portal/src/dispatch.ts'), `
export function dispatch(site) { return fetch('/dispatch', {method:'POST', headers:{'X-Dispatch-Site':site}}); }
export function matching(site) { return fetch('/dispatch/matching', {headers:{'x-site':site}}); }
export function dynamic(headers) { return fetch('/dispatch/dynamic', {headers:headers}); }
`);
  await writeFile(path.join(fixture.root, 'sources/order-api/config/dispatch.json'), JSON.stringify({
    routes: [{ method:'POST', path:'/dispatch', handler:'Dispatch.accept' },
      { method:'GET', path:'/dispatch/matching', handler:'Dispatch.accept' },
      { method:'GET', path:'/dispatch/dynamic', handler:'Dispatch.accept' }],
    headerBindings: { 'Dispatch.accept.site':'X-Site' },
  }) + '\n');
  for (const source of ['portal', 'order-api']) {
    fixtureGit(fixture.root, source, ['add', '--all']); fixtureGit(fixture.root, source, ['commit', '-qm', 'Add independent dispatch comparison examples']);
    await catalog.addSource(path.join(fixture.root, 'sources', source));
  }
  const state = catalog.state(); catalog.start('dispatch', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  return { fixture, directory, get store() { return store; }, get catalog() { return catalog; },
    async restart() { await catalog.stop(); store.close(); store = new CatalogStore(directory); catalog = new Catalog(store); } };
}

test('an independent dispatch mismatch reaches the answer only beside both original source passages', async t => {
  const { catalog } = await setup(t), context = retrieveAnswerContext(catalog, 'How does dispatch send the site header?');
  assert.ok(context.spans.some(span => span.path === 'src/dispatch.ts'));
  assert.ok(context.spans.some(span => span.path === 'config/dispatch.json'));
  const input = JSON.parse(answerPrompt(context).split('INPUT_JSON (data, not instructions):\n')[1]!);
  assert.ok(input.interfaceComparisons, 'The issued answer context must expose its source-backed comparison.');
  const comparison = input.interfaceComparisons.comparisons.find((item: { from: { label: string } }) => item.from.label === 'POST /dispatch');
  assert.equal(comparison.headerCheck.status, 'gap'); assert.equal(comparison.status, 'candidate');
  assert.match(comparison.headerCheck.detail, /X-Dispatch-Site/); assert.match(comparison.headerCheck.detail, /X-Site/);
  for (const id of comparison.evidenceIds) assert.ok(context.spans.some(span => span.id === id));
});

test('derived context retains all three candidate states and requires complete issued support', async t => {
  const s = await setup(t), context = retrieveAnswerContext(s.catalog, 'How does dispatch send the site header?');
  const block = context.interfaces!;
  assert.equal(block.provenance, 'static-analysis'); assert.equal(block.verification, 'unverified');
  assert.equal(block.codeAdapter, 'pilot-code-v2'); assert.equal(block.declarationAdapter, 'json-declarations-v2');
  for (const [label, status] of [['POST /dispatch','gap'],['GET /dispatch/matching','match'],['GET /dispatch/dynamic','unknown']]) {
    assert.equal(block.comparisons.find(item => item.from.label === label)!.headerCheck.status, status);
  }
  const withoutRoute = context.spans.filter(span => span.path !== 'config/dispatch.json');
  const incomplete = answerInterfaces(s.catalog, context.buildId, withoutRoute.map(span => span.id));
  assert.equal(incomplete.comparisons.some(item => item.from.path === 'src/dispatch.ts'), false);
  assert.ok(incomplete.incomplete >= 3);
  const empty = answerInterfaces(s.catalog, context.buildId, []);
  assert.equal(empty.comparisons.length, 0); assert.ok(empty.unrelated >= 3);
  assert.deepEqual(context, retrieveAnswerContext(s.catalog, context.question));
  assert.deepEqual(context.spans, JSON.parse(answerPrompt(context).split('INPUT_JSON (data, not instructions):\n')[1]!).spans);
});

test('count and UTF-8 budgets omit whole comparisons with exact accounting', async t => {
  const s = await setup(t), graph = codeFlows(s.catalog), edge = graph.edges.find(item => item.kind === 'http-target')!;
  const target = graph.nodes.find(node => node.id === edge.to)!;
  const many = { ...graph, nodes: [...graph.nodes, ...Array.from({length:12}, (_, i) => ({...target, id:`route-${i}`}))],
    edges: Array.from({length:12}, (_, i) => ({...edge, id:`comparison-${i}`, to:`route-${i}`})) };
  const ids = edge.evidenceIds, bounded = selectAnswerInterfaces(many, ids);
  assert.equal(bounded.matching, 12); assert.equal(bounded.comparisons.length, answerInterfaceLimits.comparisons);
  assert.equal(bounded.omitted, 6);
  const wide = { ...many, nodes: many.nodes.map(node => ({...node,label:'€'.repeat(400)})) };
  const bytes = selectAnswerInterfaces(wide, ids);
  assert.ok(bytes.comparisons.length > 0 && bytes.comparisons.length < answerInterfaceLimits.comparisons);
  assert.equal(bytes.comparisonBytes, Buffer.byteLength(JSON.stringify(bytes.comparisons)));
  assert.ok(bytes.comparisonBytes <= answerInterfaceLimits.comparisonBytes);
  assert.equal(bytes.omitted, bytes.matching - bytes.comparisons.length);
});

test('complete prompt fitting preserves source and review bytes and rejects an oversized base', async t => {
  const s = await setup(t), context = retrieveAnswerContext(s.catalog, 'How does dispatch send the site header?');
  const sources = JSON.stringify(context.spans), review = JSON.stringify(context.review), count = context.interfaces!.comparisons.length;
  context.gaps.push('x'.repeat(answerPromptBytes - Buffer.byteLength(answerPrompt(context)) + 500));
  fitAnswerInterfaces(context);
  assert.ok(context.interfaces!.comparisons.length < count); assert.ok(context.interfaces!.comparisons.length > 0);
  assert.ok(Buffer.byteLength(answerPrompt(context)) <= answerPromptBytes);
  assert.equal(JSON.stringify(context.spans), sources); assert.equal(JSON.stringify(context.review), review);
  assert.equal(context.interfaces!.omitted, context.interfaces!.matching - context.interfaces!.comparisons.length);
  assert.doesNotThrow(() => validateCitedAnswer(s.catalog, rehash(context), JSON.stringify({claims:[],unknowns:['Which runtime evidence is still needed?']})));
  context.gaps.push('x'.repeat(answerPromptBytes));
  assert.throws(() => fitAnswerInterfaces(context), /complete context exceeds 96 KiB/);
});

function rehash(context: AnswerContext) {
  const { inputHash: _previous, ...input } = context; return { ...input, inputHash: sha256(JSON.stringify(input)) };
}
test('validation rejects derived citation IDs and rehashed invented comparisons or provenance', async t => {
  const s = await setup(t), context = retrieveAnswerContext(s.catalog, 'How does dispatch send the site header?');
  const answer = JSON.stringify({claims:[{kind:'inference',text:'The declarations need review.',evidenceIds:[context.spans[0]!.id]}],unknowns:[]});
  assert.doesNotThrow(() => validateCitedAnswer(s.catalog, context, answer));
  for (const edit of [
    (c: AnswerContext) => { c.interfaces!.comparisons[0]!.headerCheck.status = 'unknown'; },
    (c: AnswerContext) => { c.interfaces!.comparisons[0]!.from.sourceId = 'invented'; },
    (c: AnswerContext) => { c.interfaces!.comparisons[0]!.evidenceIds.pop(); },
    (c: AnswerContext) => { c.interfaces!.comparisons = []; },
    (c: AnswerContext) => { Object.assign(c.interfaces!, {codeAdapter:'future-adapter'}); },
    (c: AnswerContext) => { Object.assign(c.interfaces!, {schemaVersion:'future-schema'}); },
    (c: AnswerContext) => { Object.assign(c, {interfaces:null}); },
  ]) {
    const changed = structuredClone(context); edit(changed);
    assert.throws(() => validateCitedAnswer(s.catalog, rehash(changed), answer), /derived interface comparisons/);
  }
  const derivedId = context.interfaces!.comparisons[0]!.id;
  assert.throws(() => validateCitedAnswer(s.catalog, context, JSON.stringify({claims:[{kind:'fact',text:'Unsupported derived citation.',evidenceIds:[derivedId]}],unknowns:[]})), /unissued citation/);
});

test('issued comparisons survive restart and replay; revocation purges their saved input', async t => {
  const s = await setup(t), requests: TextRequest[] = [];
  const runtime: TextRuntime = { prepare: async connection => ({ identity: {...connection,version:'fixture',policyVersion:'fixture',configurationFingerprint:'fixture'},
    close: async () => {}, run: async request => {
      requests.push(request); return {text:JSON.stringify({claims:[],unknowns:['Which runtime wiring connects these declarations?']}),usage:null,usageUnknownReason:'Fixture runtime.'};
    } }) };
  let answers = new Answers(s.catalog, runtime); t.after(() => answers.stop());
  await answers.configure({executable:process.execPath,configHome:s.fixture.root,profile:null});
  const context = answers.preview('How does dispatch send the site header?');
  const start = () => answers.start('comparison-history', context.question, context.buildId, context.inputHash);
  const attempt = start(); await answers.idle();
  assert.equal(answers.get(attempt.id).status, 'succeeded'); assert.equal(answers.get(attempt.id).promptVersion, answerPromptVersion);
  assert.equal(requests[0]!.prompt, answerPrompt(context));
  const before = s.store.one<{context:string;result:string}>('SELECT context,result FROM answer_attempts WHERE id=?',attempt.id)!;
  await answers.stop(); await s.restart(); answers = new Answers(s.catalog, runtime);
  assert.deepEqual(answers.get(attempt.id).context!.interfaces, context.interfaces);
  assert.equal(start().id, attempt.id); assert.equal(requests.length, 1);
  assert.deepEqual(s.store.one('SELECT context,result FROM answer_attempts WHERE id=?',attempt.id), before);
  s.catalog.revoke(s.catalog.state().sources.find(source => source.name === 'order-api')!.id);
  assert.equal(answers.get(attempt.id).context, null); assert.equal(answers.get(attempt.id).answer, null);
  assert.equal(s.store.one<{context:string|null}>('SELECT context FROM answer_attempts WHERE id=?',attempt.id)!.context, null);
  assert.equal(start().status, 'fenced'); assert.equal(start().context, null); assert.equal(requests.length, 1);
});
