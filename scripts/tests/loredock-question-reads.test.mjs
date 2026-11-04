import assert from 'node:assert/strict';
import { test, before } from 'node:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { receiptFixture } from '../loredock-receipt-fixture.mjs';
import { loadQuestionReadControl, verifyQuestionReadDelta } from '../../apps/loredock/tests/fixtures/question-read-reference/verify.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
let services, LexicalReadAccount, chooseQuestionRoot, retrieveAnswerContext, answerPrompt;
before(async () => {
  ({ services } = await import('../loredock-native-qualification/services.mjs'));
  ({ LexicalReadAccount } = await import('../../apps/loredock/dist/lexical-read-account.js'));
  ({ chooseQuestionRoot } = await import('../../apps/loredock/dist/question-path-selection.js'));
  ({ retrieveAnswerContext } = await import('../../apps/loredock/dist/answer-context.js'));
  ({ answerPrompt } = await import('../../apps/loredock/dist/answer-prompt.js'));
});
const code = expected => error => error.code === expected;
function corpus(variant = 'complete') {
  const result = corpusFactory(variant === 'partial');
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete result['a-permit-ui'][`ui/${name}.vue`];
  for (let i = 0; i < 6; i++) result['a-permit-ui'][`ui/00Noise${i}.vue`] = `<script setup lang="ts">\nconst unrelated${i} = () => console.log("noise");\n</script>\n<template><button @click="unrelated${i}">Noise</button></template>\n`;
  result['z-independent-notes']['README.md'] += 'UTF-8: café, Łódź, 界.\n';
  if (variant === 'ambiguous') result['a-permit-ui']['ui/BBRenew.vue'] = corpusFactory()['a-permit-ui']['ui/BBRenew.vue'];
  return result;
}
const question = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
async function setup(t, variant) {
  const parent = await mkdtemp(path.join(tmpdir(), 'question-reads-'));
  const fixture = await receiptFixture(parent, corpus(variant), services);
  const owners = [];
  t.after(async () => { for (const owner of owners) await owner.stop(); await fixture.close(); await rm(parent, { recursive: true, force: true }); });
  await fixture.analyze();
  const create = options => { const owner = new services.CodePaths(fixture.analysis, options); owners.push(owner); return owner; };
  return { fixture, parent, owners, create, request: { buildId: fixture.buildId } };
}

// Instrument the independent accepted control at actual SQLite results. Production
// accounting itself never uses wrappers; this counter also sees prepared-cache hits.
function countControlReads(store, catalog) {
  const result = { sqlRows: 0, originalBytes: 0, originalReads: 0 };
  const prepare = store.db.prepare, evidence = catalog.evidence;
  store.db.prepare = function(sql) {
    const statement = prepare.call(this, sql);
    for (const name of ['get', 'all']) {
      const read = statement[name]; statement[name] = function(...args) {
        const value = read.apply(this, args); result.sqlRows += name === 'all' ? value.length : value === undefined ? 0 : 1; return value;
      };
    }
    return statement;
  };
  catalog.evidence = function(...args) { const value = evidence.apply(this, args); result.originalReads++; result.originalBytes += Buffer.byteLength(value.text); return value; };
  return { result, restore() { store.db.prepare = prepare; catalog.evidence = evidence; } };
}

test('accepted controls reconstruct independently with only the declared production deltas', async () => {
  for (const name of ['store', 'catalog', 'code-paths-v2']) await verifyQuestionReadDelta(name);
  const old = await readFile(path.join(root, 'fixtures/loredock-native-question-context-run/control/code-paths-v2.js.txt'), 'utf8');
  assert.equal(await verifyQuestionReadDelta('code-paths-v2'), old);
});

test('compiled lexical composition preserves every context and prompt byte with actual control row/text counts', async t => {
  const { fixture, parent } = await setup(t), { store, catalog } = fixture;
  const { Catalog: OldCatalog } = await loadQuestionReadControl('catalog', pathToFileURL(parent + '/'));
  const control = new OldCatalog(store);
  const before = fixture.counters(), legacy = fixture.legacyRows();
  for (const query of [question, 'Which entry point publishes permit.granted.v3?', 'unmatchedvocabulary']) {
    const counter = countControlReads(store, control); let baseline;
    try { baseline = await store.withPreparedReads(() => retrieveAnswerContext(control, query, fixture.buildId)); }
    finally { counter.restore(); }
    const budget = new services.OperationBudget(), account = new LexicalReadAccount(budget);
    const actual = await store.withPreparedReads(() => store.withLexicalReads(account, () => retrieveAnswerContext(catalog, query, fixture.buildId)));
    assert.equal(JSON.stringify(actual), JSON.stringify(baseline)); assert.equal(actual.inputHash, baseline.inputHash);
    assert.equal(answerPrompt(actual), answerPrompt(baseline));
    assert.deepEqual(account.stats(), { ...counter.result, acceptedUnits: counter.result.sqlRows + counter.result.originalBytes, rejectedUnits: 0 });
    assert.equal(budget.stats().totalWork, account.stats().acceptedUnits); assert(account.stats().originalBytes > 0);
    t.diagnostic(JSON.stringify({ query, inputHash: actual.inputHash, ...account.stats() }));
    // Reuse the actual capability after the lexical phase; no double billing there.
    const stats = account.stats(); await fixture.paths.read({ buildId: fixture.buildId }, 'paths', undefined, budget);
    assert.deepEqual(account.stats(), stats); assert(budget.stats().pathWork > 0);
    await assert.rejects(fixture.paths.read({ buildId: fixture.buildId }, 'paths', undefined, budget), code('CAPTURE_BUDGET_OWNERSHIP')); budget.close();
  }
  const after = fixture.counters(); for (const key of ['gitCalls', 'writeCalls', 'changedRows']) assert.equal(after[key], before[key]);
  assert.equal(fixture.legacyRows(), legacy);
});

test('current catalog keeps archived store compatibility and evidence failures preserve actual charges', async t => {
  const { fixture, parent } = await setup(t);
  const { CatalogStore: OldStore } = await loadQuestionReadControl('store', pathToFileURL(parent + '/'));
  const old = await receiptFixture(parent, corpus(), { ...services, CatalogStore: OldStore }); t.after(() => old.close());
  const oldContext = retrieveAnswerContext(old.catalog, question, old.buildId);
  assert(oldContext.spans.length > 0);
  for (const span of oldContext.spans) assert.equal(old.catalog.evidence(span.id).text, span.text);
  assert.throws(() => old.catalog.evidence('missing'), code('NOT_FOUND'));
  const { store, catalog } = fixture, id = retrieveAnswerContext(catalog, question, fixture.buildId).spans.find(span => Buffer.byteLength(span.text) > 100).id;
  const original = catalog.evidence(id), budget = new services.OperationBudget(), account = new LexicalReadAccount(budget);
  store.withLexicalReads(account, () => { assert.equal(catalog.evidence(id).text, original.text); assert.throws(() => catalog.evidence('missing'), code('NOT_FOUND')); });
  assert.equal(account.stats().originalReads, 1); assert.equal(account.stats().originalBytes, Buffer.byteLength(original.text));
  const limited = new services.OperationBudget({ limits: { work: 100 } }), refused = new LexicalReadAccount(limited);
  assert(Buffer.byteLength(original.text) > 100);
  assert.throws(() => store.withLexicalReads(refused, () => catalog.evidence(id)), code('CAPTURE_WORK_LIMIT'));
  assert.equal(refused.stats().originalBytes, Buffer.byteLength(original.text));
  assert.equal(refused.stats().rejectedUnits, refused.stats().originalBytes); limited.close();
  const file = store.one('SELECT fileId FROM spans WHERE id=?', id).fileId;
  const corrupt = new LexicalReadAccount(budget); store.run('UPDATE files SET metadata=? WHERE id=?', '{', file);
  assert.throws(() => store.withLexicalReads(corrupt, () => catalog.evidence(id)), SyntaxError);
  assert(corrupt.stats().sqlRows > 0); assert.equal(corrupt.stats().originalBytes, 0); budget.close();
});

test('default, explicit and paged compiled output stays byte-identical while question selection reaches a late root', async t => {
  const { fixture, parent, create, owners, request } = await setup(t);
  const { CodePathsV2: OldPaths } = await loadQuestionReadControl('code-paths-v2', pathToFileURL(parent + '/'));
  const control = new OldPaths(fixture.analysis); owners.push(control);
  const old = await control.read(request), actual = await fixture.paths.read(request);
  assert.equal(JSON.stringify(actual), JSON.stringify(old)); assert(actual.roots.total > 4);
  const binding = { ...request, inventoryId: actual.identity.inventoryId, generationId: actual.generationId };
  for (let offset = 0; offset < actual.roots.total; offset += 4)
    assert.deepEqual(await fixture.paths.read({ ...binding, offset }, 'roots'), await control.read({ ...binding, offset }, 'roots'));
  const context = retrieveAnswerContext(fixture.catalog, question, fixture.buildId); let chosen;
  const selected = create({ selectRoot: async (resolution, work) => { chosen = await chooseQuestionRoot(resolution, context, work); return chosen; } });
  const budget = new services.OperationBudget(), graph = await selected.read(request, 'paths', undefined, budget);
  const explicit = { ...binding, rootId: graph.selection.rootId };
  assert.equal(JSON.stringify(graph), JSON.stringify(await control.read(explicit)));
  assert.equal(JSON.stringify(graph), JSON.stringify(await fixture.paths.read(explicit)));
  assert(!actual.roots.items.some(row => row.id === graph.selection.rootId)); assert.equal(chosen.observation.eligibleRoots, 1);
  assert(graph.graph.edges.some(edge => edge.topicCheck?.value === 'permit.granted.v3'));
  assert(graph.graph.nodes.some(node => node.kind === 'document-write'));
  await assert.rejects(selected.read(explicit), code('INVALID_SELECTION'));
  await assert.rejects(selected.read({ ...binding, offset: 0 }, 'roots'), code('INVALID_SELECTION'));
  await assert.rejects(selected.read({ ...binding, generationId: 'f'.repeat(64) }), code('INVALID_GENERATION'));
  assert(budget.stats().pathWork > 0); budget.close();
  await assert.rejects(create({ selectRoot: async () => ({ rootId: 'f'.repeat(64) }) }).read(request), code('INVALID_SELECTION'));
  await assert.rejects(create({ selectRoot: async () => undefined }).read(request), code('INVALID_SELECTION'));
});

test('selected production reads preserve partial wiring and reject ambiguity or unsupported original anchors', async t => {
  for (const variant of ['partial', 'ambiguous']) {
    const { fixture, create, request } = await setup(t, variant);
    const context = retrieveAnswerContext(fixture.catalog, 'Which entry point reaches permit.granted.v3?', fixture.buildId);
    const owner = create({ selectRoot: (resolution, work) => chooseQuestionRoot(resolution, context, work) });
    if (variant === 'ambiguous') { await assert.rejects(owner.read(request), code('QUESTION_AMBIGUOUS')); continue; }
    const result = await owner.read(request);
    assert(result.graph.omissions['unresolved-consumer-method'] > 0);
    assert(!result.graph.edges.some(edge => ['event-delivery', 'dispatch-candidate'].includes(edge.kind)));
    assert.equal(result.graph.nodes.at(-1).kind, 'event-publish');
    await assert.rejects(create({ selectRoot: (resolution, work) => chooseQuestionRoot(resolution, { ...context, spans: [] }, work) }).read(request), code('QUESTION_INSUFFICIENT_CONTEXT'));
  }
});

test('selector remains inside the actual path owner, cancellation, write fence and shared budget', async t => {
  const { fixture, create, request } = await setup(t), context = retrieveAnswerContext(fixture.catalog, question, fixture.buildId);
  const selectRoot = (resolution, work) => chooseQuestionRoot(resolution, context, work);
  let enter, release; const entered = new Promise(resolve => { enter = resolve; }), gate = new Promise(resolve => { release = resolve; });
  const occupied = create({ selectRoot: async (...args) => { enter(); await gate; return selectRoot(...args); } });
  const running = occupied.read(request), outcome = running.then(value => ({ value }), error => ({ error })); await entered;
  await assert.rejects(create().read(request), code('PATHS_BUSY'));
  const stopped = occupied.stop(); release(); assert.equal((await outcome).error.code, 'CANCELLED'); await stopped;
  const sqlWriter = create({ selectRoot: async (...args) => { fixture.store.run('UPDATE project SET correctionRevision=correctionRevision+1'); return selectRoot(...args); } });
  await assert.rejects(sqlWriter.read(request), code('METADATA_CHANGED'));
  const exhausted = new services.OperationBudget({ limits: { work: 1 } });
  await assert.rejects(create({ selectRoot }).read(request, 'paths', undefined, exhausted), code('CAPTURE_WORK_LIMIT')); exhausted.close();
  const sourceWriter = create({ selectRoot: async (...args) => { await fixture.addSource(); return selectRoot(...args); } });
  await assert.rejects(sourceWriter.read(request), code('ANALYSIS_FENCED'));
});
