import assert from 'node:assert/strict';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { answerLimits, retrieveAnswerContext, type AnswerContext } from '../src/answer-context.js';
import { answerPrompt } from '../src/answers.js';
// @ts-expect-error The independent fixture generator is plain JavaScript.
import { createScaleFixture, scaleGit } from '../../../scripts/loredock-scale-fixture.mjs';

interface Fixture {
  root: string;
  manifest: { sources: { id: string }[]; evidence: { id: string; sourceId: string; revision: string; path: string; contentHash: string; blobId: string; startLine: number; endLine: number }[] };
  oracle: { questions: { id: string; question: string; evidence: string[] }[] };
}
async function setup(t: TestContext, modify?: (fixture: Fixture) => Promise<string[] | void>) {
  const fixture = await createScaleFixture() as Fixture;
  let close = async () => {};
  t.after(async () => { await close(); await rm(fixture.root, { recursive: true, force: true }); });
  const paths = await modify?.(fixture) ?? fixture.manifest.sources.map(source => path.join(fixture.root, 'sources', source.id));
  const directory = path.join(fixture.root, 'data');
  const state = { fixture, store: new CatalogStore(directory), catalog: undefined as unknown as Catalog,
    async restart() { await state.catalog.stop(); state.store.close(); state.store = new CatalogStore(directory); state.catalog = new Catalog(state.store); },
    async index(requestId: string) { const p = state.catalog.state(); const build = state.catalog.start(requestId, p.sourceSetVersion, p.policyVersion); await state.catalog.idle(); return build; } };
  state.catalog = new Catalog(state.store);
  close = async () => { await state.catalog.stop(); state.store.close(); };
  const preview = await state.catalog.previewSources(paths); await state.catalog.registerSources({ paths, previewHash: preview.previewHash, requestId: 'register' });
  await state.index('initial'); return state;
}
const locators = (context: AnswerContext) => context.spans.map(span => [span.sourceName, span.revision, span.path, span.startLine, span.endLine, span.contentHash, span.spanHash]);
const represented = (context: AnswerContext) => new Set(context.spans.map(span => span.sourceId));
const hint = (context: AnswerContext) => context.gaps.some(gap => gap.startsWith('Full repository names'));
function bounded(context: AnswerContext) {
  assert.ok(context.spans.length <= answerLimits.spans); assert.ok(context.textBytes <= answerLimits.textBytes);
  assert.equal(context.textBytes, context.spans.reduce((sum, span) => sum + Buffer.byteLength(span.text), 0));
  assert.ok(Buffer.byteLength(answerPrompt(context)) <= 96 * 1024);
}

test('all twenty frozen questions recover original required evidence with stable selections across fresh identities', async t => {
  const first = await setup(t), second = await setup(t);
  assert.notEqual(first.catalog.state().sources[0]!.id, second.catalog.state().sources[0]!.id);
  for (const question of first.fixture.oracle.questions) {
    const context = retrieveAnswerContext(first.catalog, question.question); bounded(context);
    assert.deepEqual(locators(context), locators(retrieveAnswerContext(second.catalog, question.question)), question.id);
    for (const id of question.evidence) {
      const expected = first.fixture.manifest.evidence.find(ref => ref.id === id)!;
      const match = context.spans.find(span => span.sourceName === expected.sourceId && span.revision === expected.revision && span.path === expected.path
        && span.contentHash === expected.contentHash && span.startLine <= expected.startLine && span.endLine >= expected.endLine);
      assert.ok(match, `${question.id} missed ${id}`); assert.equal(first.catalog.evidence(match.id).blobId, expected.blobId);
    }
  }
  for (const state of [first, second]) {
    const sample = retrieveAnswerContext(state.catalog, 'unmatchedvocabulary026'); bounded(sample);
    assert.equal(sample.retrievalMode, 'orientation'); assert.equal(represented(sample).size, 20);
    assert.ok(sample.sources.every(source => sample.spans.some(span => span.sourceId === source.sourceId && span.path === 'README.md')));
    assert.ok(sample.gaps.some(gap => gap.includes('not a relevance match')));
  }
  assert.deepEqual(locators(retrieveAnswerContext(first.catalog, 'unmatchedvocabulary026')), locators(retrieveAnswerContext(second.catalog, 'unmatchedvocabulary026')));
  assert.equal(hint(retrieveAnswerContext(first.catalog, 'What happened to fulfillment-api?')), false, 'Historical names are not registry aliases.');
});

test('normalized full names preserve ambiguous identities, reject identifier prefixes and disclose sample limits', async t => {
  const state = await setup(t, async fixture => {
    const paths: string[] = [];
    for (const [index, id] of ['portal', 'order-api'].entries()) {
      const group = path.join(fixture.root, `group-${index}`); await mkdir(group);
      const target = path.join(group, 'shared-service'); await rename(path.join(fixture.root, 'sources', id), target); paths.push(target);
    }
    return paths;
  });
  for (const question of ['What is SHARED service?', 'Explain shared_service.', 'Explain sharedService.']) {
    const context = retrieveAnswerContext(state.catalog, question); assert.equal(hint(context), true); bounded(context);
    assert.equal(context.sources.length, 2); assert.equal(represented(context).size, 2);
    assert.equal(context.spans.filter(span => span.path === 'README.md').length, 2, 'Display names cannot collapse different identities.');
  }
  for (const question of ['unshared-service', 'shared-service-extra', 'shared-service.other', 'sharedservice']) assert.equal(hint(retrieveAnswerContext(state.catalog, question)), false, question);
  const full = await setup(t); const names = full.catalog.state().sources.map(source => source.name).join(', ');
  const limited = retrieveAnswerContext(full.catalog, names); bounded(limited);
  assert.ok(limited.gaps.some(gap => gap.includes('named-source sample limit')));
});

test('oversized or missing baseline documents do not consume other source opportunities or imply complete coverage', async t => {
  const state = await setup(t, async fixture => {
    await writeFile(path.join(fixture.root, 'sources/portal/README.md'), '# Oversized\n' + 'é'.repeat(35000));
    await rm(path.join(fixture.root, 'sources/deployment-production/README.md'));
    await rename(path.join(fixture.root, 'sources/order-api/README.md'), path.join(fixture.root, 'sources/order-api/OTHER.md'));
    for (const id of ['portal', 'deployment-production', 'order-api']) { scaleGit(fixture.root, id, ['add', '--all']); scaleGit(fixture.root, id, ['commit', '-qm', 'Vary baseline document availability']); }
  });
  const evidence = state.catalog.evidence.bind(state.catalog);
  state.catalog.evidence = id => {
    const file = state.store.one<{ path: string; name: string }>('SELECT f.path,src.name FROM spans s JOIN files f ON f.id=s.fileId JOIN sources src ON src.id=f.sourceId WHERE s.id=?', id)!;
    assert.ok(file.name !== 'portal' || file.path !== 'README.md', 'Do not reopen a span already known to exceed the text budget.');
    return evidence(id);
  };
  const context = retrieveAnswerContext(state.catalog, 'unmatchedvocabulary026'); bounded(context);
  assert.equal(represented(context).size, 19);
  assert.ok(context.spans.some(span => span.sourceName === 'portal' && span.path === 'package.json'));
  assert.ok(context.spans.some(span => span.sourceName === 'order-api' && span.path === 'pom.xml'));
  assert.ok(context.gaps.some(gap => gap.includes('No source passages') && gap.includes('deployment-production')));
  assert.ok(context.gaps.some(gap => gap.includes('text budget')));
});

test('source representation, exact historical evidence and authorization survive refresh and restart', async t => {
  const state = await setup(t), question = 'Does inventory-api represent one application?';
  const before = retrieveAnswerContext(state.catalog, question), bytes = JSON.stringify(before);
  const original = state.catalog.evidence(before.spans.find(span => span.sourceName === 'inventory-api' && span.path === 'config/routes.json')!.id);
  await state.restart(); assert.deepEqual(retrieveAnswerContext(state.catalog, question), before);
  await state.index('refresh'); assert.deepEqual(state.catalog.evidence(original.id), original); assert.equal(JSON.stringify(before), bytes);
  assert.equal(retrieveAnswerContext(state.catalog, question, before.buildId).buildId, before.buildId);
  state.catalog.revoke(original.sourceId);
  const after = retrieveAnswerContext(state.catalog, question); assert.equal(after.sources.length, 19);
  assert.ok(after.spans.every(span => span.sourceId !== original.sourceId)); assert.throws(() => state.catalog.evidence(original.id), /unavailable/);
  assert.equal(hint(after), false, 'Revoked names cannot add sampling hints.');
  state.catalog.updatePolicy(['README.md']); assert.throws(() => retrieveAnswerContext(state.catalog, question, before.buildId), /policy/);
});
