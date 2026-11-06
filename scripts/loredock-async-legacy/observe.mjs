import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, cp, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Catalog } from '../../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../../apps/loredock/dist/store.js';
import { codeFlows } from '../../apps/loredock/dist/code-flows.js';
import { retrieveAnswerContext, validateCitedAnswer } from '../../apps/loredock/dist/answer-context.js';
import { sourceCandidatePreview } from '../../apps/loredock/dist/source-candidates.js';
import { answerPrompt } from '../../apps/loredock/dist/answer-prompt.js';
import { Corrections } from '../../apps/loredock/dist/corrections.js';
import { Reconciliation } from '../../apps/loredock/dist/reconciliation.js';
import { declarationMap } from '../../apps/loredock/dist/system-map.js';
import { Answers } from '../../apps/loredock/dist/answers.js';
import { AnswerWitnessStore } from '../../apps/loredock/dist/answer-witness-store.js';
import { validateQuestionWitness } from '../../apps/loredock/dist/question-witness.js';
import { sha256 } from '../../apps/loredock/dist/extract.js';
import { createLoreDockFixture, fixtureGit, repositoryIds } from '../loredock-fixture.mjs';
import { plan } from './plan.mjs';

const save = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
async function inventory(root, relative = '') {
  const result = [];
  for (const item of (await readdir(path.join(root, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = path.join(relative, item.name);
    if (item.isDirectory()) result.push(...await inventory(root, name));
    else if (item.isFile()) { const bytes = await readFile(path.join(root, name)); result.push({ path: name, bytes: bytes.length, sha256: sha256(bytes) }); }
    else throw new Error('Unexpected retained catalog entry: ' + name);
  }
  return result;
}
async function copy(source, target) {
  const before = await inventory(source);
  await cp(source, target, { recursive: true, errorOnExist: true, force: false });
  assert.deepEqual(await inventory(target), before); return before;
}
export async function projectionObservation(catalog) {
  const graph = await codeFlows(catalog), corrections = new Corrections(catalog), review = new Reconciliation(catalog);
  const contexts = [];
  for (const question of plan.questions) {
    const context = await retrieveAnswerContext(catalog, question);
    const output = JSON.stringify({ claims: [], unknowns: ['Which runtime evidence is still needed?'] });
    const validated = await validateCitedAnswer(catalog, context, output);
    const { inputHash: _hash, interfaces: _interfaces, ...old } = context;
    const legacy = { ...old, inputHash: sha256(JSON.stringify(old)) };
    await validateCitedAnswer(catalog, legacy, output);
    contexts.push({ context, prompt: answerPrompt(context), candidates: await sourceCandidatePreview(catalog, question),
      validated, absentInterfaces: { context: legacy, prompt: answerPrompt(legacy) } });
  }
  const overlay = corrections.list();
  return { graph, contexts, overlay, histories: overlay.corrections.map(row => corrections.history(row.id)),
    reconciliation: await review.preview() };
}

export async function savedObservation(catalog) {
  let calls = 0;
  const answers = new Answers(catalog, { prepare() { calls++; throw new Error('Unexpected model dispatch'); } });
  const witnesses = new AnswerWitnessStore(catalog), rows = catalog.store.all('SELECT id,requestId FROM answer_attempts ORDER BY rowid');
  const result = [];
  try {
    for (const row of rows) {
      const detail = answers.get(row.id), snapshot = witnesses.read(row.id);
      const checked = await validateQuestionWitness(catalog, snapshot);
      assert.equal(checked.status, 'revalidated');
      const witnessRow = catalog.store.one('SELECT preparationId,reviewedHash FROM answer_witnesses WHERE answerId=?', row.id);
      const replay = answers.startPrepared(row.requestId, witnessRow.preparationId, witnessRow.reviewedHash);
      assert.deepEqual(replay, detail);
      result.push({ detail, snapshot, replay, lexical: checked.lexical });
    }
    assert.equal(calls, 0); return result;
  } finally { await answers.stop(); }
}

async function main() {
  const [output, v1, v2] = process.argv.slice(2);
  assert.equal(process.argv.length, 5);
  for (const value of [output, v1, v2]) assert(path.isAbsolute(value ?? '') && path.resolve(value) === value);
  await mkdir(output); await save(path.join(output, 'plan.json'), plan);
  const result = { cases: [], errors: [], modelCalls: 0, resourceQualification: false };
  let store, catalog;
  async function open(data) { store = new CatalogStore(data); catalog = new Catalog(store); }
  async function close() { if (catalog) await catalog.stop(); catalog = undefined; if (store) store.close(); store = undefined; }
  async function index(id) { const state = catalog.state(); catalog.start(id, state.sourceSetVersion, state.policyVersion); await catalog.idle(); }
  const fixture = await createLoreDockFixture(); await save(path.join(output, 'fixture.json'), { root: fixture.root });
  const file = (repo, name) => path.join(fixture.root, 'sources', repo, name);
  const commit = repo => { fixtureGit(fixture.root, repo, ['add', '--all']); fixtureGit(fixture.root, repo, ['commit', '-qm', 'Add ordinary async compatibility inputs']); };
  const data = path.join(output, 'working-data');
  async function checkpoint(name, extra = {}) {
    const observed = await projectionObservation(catalog); await close();
    const directory = path.join(output, name); await mkdir(directory);
    await copy(data, path.join(directory, 'data'));
    await save(path.join(directory, 'expected.json'), { ...observed, ...extra });
    result.cases.push(name); await open(data);
  }
  try {
    await writeFile(file('portal', 'src/dispatch.ts'), `export function dispatch(site) { return fetch('/dispatch', {method:'POST', headers:{'X-Dispatch-Site':site}}); }
export function matching(site) { return fetch('/dispatch/matching', {headers:{'x-site':site}}); }
export function dynamic(headers) { return fetch('/dispatch/dynamic', {headers:headers}); }
export function unsupported() { return fetch(dynamicEndpoint); }
`);
    await writeFile(file('order-api', 'config/dispatch.json'), JSON.stringify({ routes: [
      { method: 'POST', path: '/dispatch', handler: 'Dispatch.accept' },
      { method: 'GET', path: '/dispatch/matching', handler: 'Dispatch.accept' },
      { method: 'GET', path: '/dispatch/dynamic', handler: 'Dispatch.accept' }], headerBindings: { 'Dispatch.accept.site': 'X-Site' } }) + '\n');
    const java = await readFile(file('order-api', 'src/main/java/Orders.java'), 'utf8');
    await writeFile(file('order-api', 'src/main/java/Orders.java'), java.replace('publisher.publish(topic,', 'publisher.publish("orders.placed.v2",'));
    commit('portal'); commit('order-api');
    await open(data);
    for (const repo of repositoryIds) await catalog.addSource(path.join(fixture.root, 'sources', repo));
    await index('supported');
    const first = await codeFlows(catalog);
    assert(first.edges.some(row => row.kind === 'event-delivery'));
    assert(first.omissions['adapter:dynamic-or-unsupported-http-request']);
    for (const status of ['gap', 'match', 'unknown']) assert(first.edges.some(row => row.headerCheck?.status === status));
    assert(catalog.readBuild().coverage.excluded > 0);
    await checkpoint('supported');
    const correctionRequests = [];
    for (const kind of ['code-link', 'declaration-link']) {
      const graph = kind === 'code-link' ? await codeFlows(catalog) : declarationMap(catalog);
      const edge = graph.edges.find(row => row.kind === (kind === 'code-link' ? 'event-delivery' : 'contract-match'));
      assert(edge);
      const input = { requestId: 'ordinary-' + kind, buildId: graph.buildId, targetKind: kind, targetId: edge.id,
        projectionHash: graph.inputHash, expectedRevision: catalog.state().correctionRevision, expectedPreviousId: null,
        action: 'dispute', statement: 'Review broker wiring before relying on this delivery.', environment: 'local' };
      const output = await new Corrections(catalog).save(input); correctionRequests.push({ input, output });
    }
    await checkpoint('reviewed', { correctionRequests });
    await index('same-support'); await checkpoint('refresh');
    const reapplications = [];
    for (let count = 0; count < 2; count++) {
      const preview = await new Reconciliation(catalog).preview(), entry = preview.entries.find(row => row.status === 'support-unchanged');
      assert(entry);
      const input = { requestId: 'ordinary-reapply-' + count, buildId: preview.buildId, sourceCorrectionId: entry.source.id,
        targetId: entry.current.id, previewHash: preview.previewHash, expectedRevision: preview.revision };
      const output = await new Reconciliation(catalog).reapply(input); reapplications.push({ input, output });
    }
    await checkpoint('reapplied', { reapplications });
    await writeFile(file('order-api', 'src/main/java/Orders.java'), java.replace('publisher.publish(topic,', 'publisher.publish("different-topic",'));
    commit('order-api'); await index('contradictory-topic');
    assert.equal((await codeFlows(catalog)).edges.some(row => row.kind === 'event-delivery'), false);
    await checkpoint('contradictory-topic'); await close();
    // A separate README-only Git source proves that native/code absence remains useful source context.
    const sourceOnly = path.join(output, 'source-only'); await mkdir(sourceOnly);
    fixtureGit(fixture.root, 'portal', ['rm', '-r', '--ignore-unmatch', '.']);
    await writeFile(file('portal', 'README.md'), '# Source-only orientation\n\nThe portal repository requires a deployment review.\n'); commit('portal');
    await open(path.join(sourceOnly, 'data')); await catalog.addSource(path.join(fixture.root, 'sources/portal')); await index('source-only');
    const observed = await projectionObservation(catalog); assert.equal(observed.graph.nodes.length, 0);
    assert(observed.contexts.every(row => row.context.spans.length > 0));
    await save(path.join(sourceOnly, 'expected.json'), observed); result.cases.push('source-only'); await close();
    for (const [name, source, count] of [['saved-v1', v1, 20], ['saved-v2', v2, 1]]) {
      const directory = path.join(output, name); await mkdir(directory);
      const before = await copy(source, path.join(directory, 'data'));
      await save(path.join(directory, 'retained-inputs.json'), { source, files: before });
      await open(path.join(directory, 'data')); const observed = await savedObservation(catalog);
      assert.equal(observed.length, count); await save(path.join(directory, 'expected.json'), observed); await close();
      assert.deepEqual(await inventory(source), before); result.cases.push(name);
    }
    assert.deepEqual(result.cases, plan.order);
  } catch (error) { result.errors.push({ name: error.name, message: error.message, stack: error.stack }); process.exitCode = 1; }
  finally { await close(); await save(path.join(output, 'result.json'), result); }
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] === new URL(import.meta.url).pathname) await main();
