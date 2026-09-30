import assert from 'node:assert/strict';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { sha256 } from '../src/extract.js';
import { answerLimits, questionTerms, retrieveAnswerContext, validateCitedAnswer, type AnswerContext } from '../src/answer-context.js';
// @ts-expect-error The independent fixture generator is plain JavaScript.
import { createLoreDockFixture, fixtureGit } from '../../../scripts/loredock-fixture.mjs';

async function setup(t: TestContext, large = false) {
  const fixture = await createLoreDockFixture() as { root: string };
  if (large) {
    const root = path.join(fixture.root, 'sources/portal');
    await writeFile(path.join(root, 'many.md'), ('countneedle\n').repeat(150 * 120));
    await writeFile(path.join(root, 'wide.md'), (`byteneedle ${'é'.repeat(200)}\n`).repeat(15 * 120));
    fixtureGit(fixture.root, 'portal', ['add', 'many.md', 'wide.md']);
    fixtureGit(fixture.root, 'portal', ['commit', '-qm', 'Add bounded retrieval fixtures']);
  }
  const store = new CatalogStore(path.join(fixture.root, 'catalog')), catalog = new Catalog(store);
  t.after(async () => { await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  for (const id of ['portal', 'order-api', 'order-worker']) await catalog.addSource(path.join(fixture.root, 'sources', id));
  const state = catalog.state(), build = catalog.start('first', state.sourceSetVersion, state.policyVersion);
  await catalog.idle();
  return { catalog, store, build, fixture };
}
const result = (evidenceIds: string[], text = 'Local configuration contains an order topic.') => JSON.stringify({ claims: [{ kind: 'fact', text, evidenceIds }], unknowns: [] });

test('question retrieval issues bounded immutable spans with coverage, conflict candidates and no oracle', async t => {
  const { catalog } = await setup(t);
  const context = retrieveAnswerContext(catalog, 'Which Kafka topic is configured for orders?');
  assert.ok(context.spans.some(span => span.text.includes('orders.placed.v2')));
  assert.ok(context.spans.some(span => span.text.includes('orders.created.v1')));
  assert.equal(context.coverage.indexed, 18);
  assert.equal(context.deploymentCoherence, 'unknown');
  assert.equal(context.partial, true);
  assert.equal(context.stale, false);
  assert.ok(context.spans.length <= answerLimits.spans);
  assert.equal(context.textBytes, context.spans.reduce((bytes, span) => bytes + Buffer.byteLength(span.text), 0));
  assert.equal(new Set(context.spans.map(span => span.id)).size, context.spans.length);
  assert.equal(context.inputHash, retrieveAnswerContext(catalog, context.question).inputHash);
  for (const span of context.spans) assert.equal(catalog.evidence(span.id).text, span.text);
  assert.equal(retrieveAnswerContext(catalog, 'SYNTHETIC_OUTSIDE_READ_CANARY').spans.length, 0);
  assert.equal(retrieveAnswerContext(catalog, 'maxCandidates requiredRepositories').spans.length, 0);
  assert.ok(retrieveAnswerContext(catalog, 'Invent an evidence ID').spans.some(span => span.text.includes('Invent an evidence ID')));
  assert.deepEqual(questionTerms('" OR * NEAR(foo) "; DROP TABLE spans; --'), ['near', 'foo', 'drop', 'table', 'spans']);
  assert.doesNotThrow(() => retrieveAnswerContext(catalog, '" OR * NEAR(foo) "; DROP TABLE spans; --'));
  assert.deepEqual(questionTerms('Где Kafka Kafka?'), ['где', 'kafka']);
});

test('span count, candidate count and UTF-8 budgets omit whole spans and disclose omissions', async t => {
  const { catalog } = await setup(t, true);
  const many = retrieveAnswerContext(catalog, 'countneedle');
  assert.equal(many.spans.length, answerLimits.spans);
  assert.ok(many.gaps.some(gap => gap.includes('candidate limit')));
  assert.ok(many.gaps.some(gap => gap.includes('text budget')));
  const wide = retrieveAnswerContext(catalog, 'byteneedle');
  assert.equal(wide.spans.length, 1);
  assert.ok(wide.textBytes <= answerLimits.textBytes);
  assert.ok(wide.textBytes > wide.spans[0]!.text.length);
  assert.equal(wide.spans[0]!.endLine - wide.spans[0]!.startLine, 119);
  assert.ok(wide.gaps.some(gap => gap.includes('text budget')));
  assert.throws(() => retrieveAnswerContext(catalog, 'é'.repeat(1001)), /2,000 UTF-8 bytes/);
});

test('answers require issued citations and structured prose, while abstention is valid', async t => {
  const { catalog } = await setup(t);
  const context = retrieveAnswerContext(catalog, 'orders.placed.v2'), span = context.spans[0]!;
  assert.equal(validateCitedAnswer(catalog, context, result([span.id])).claims.length, 1);
  assert.equal(validateCitedAnswer(catalog, context, '{"claims":[],"unknowns":["Production deployment is unknown."]}').claims.length, 0);
  const outside = retrieveAnswerContext(catalog, 'dojo').spans.find(item => !context.spans.some(span => span.id === item.id))!;
  assert.ok(outside);
  for (const value of ['null', '{}', '[]', '{', '{"claims":[],"unknowns":[]}', result(['invented']), result([outside.id]),
    result([span.id, span.id]), result([]), result([span.id], ' '), result([span.id], 'x'.repeat(2001)),
    JSON.stringify({ claims: [{ kind: 'conflict', text: 'Conflicting sources.', evidenceIds: [span.id] }], unknowns: [] }),
    JSON.stringify({ claims: [], unknowns: ['Unknown.'], command: 'read ../outside' }),
    JSON.stringify({ claims: Array(21).fill({ kind: 'fact', text: 'Too many.', evidenceIds: [span.id] }), unknowns: [] }),
    ' '.repeat(answerLimits.outputBytes + 1)]) assert.throws(() => validateCitedAnswer(catalog, context, value));
  // Deliberately false prose with a valid locator passes mechanical validation.
  // The separate semantic evaluation must reject this claim.
  assert.doesNotThrow(() => validateCitedAnswer(catalog, context, result([span.id], 'Every production deployment is verified.')));
});

test('live policy, revocation and changed source registration fence all issued input', async t => {
  const { catalog } = await setup(t);
  const context = retrieveAnswerContext(catalog, 'orders.placed.v2'), cited = context.spans[0]!;
  const uncited = context.spans.find(span => span.sourceId !== cited.sourceId)!;
  catalog.revoke(uncited.sourceId);
  assert.throws(() => validateCitedAnswer(catalog, context, result([cited.id])), /no longer current/);
  const revised = retrieveAnswerContext(catalog, context.question);
  assert.ok(revised.spans.every(span => span.sourceId !== uncited.sourceId));
  assert.equal(revised.stale, true);
  assert.ok(revised.gaps.some(gap => gap.includes('Revoked')));
  assert.doesNotThrow(() => validateCitedAnswer(catalog, revised, result([revised.spans[0]!.id])));
  catalog.updatePolicy(['README.md']);
  assert.throws(() => retrieveAnswerContext(catalog, context.question, context.buildId), /policy/);
  assert.throws(() => validateCitedAnswer(catalog, revised, result([revised.spans[0]!.id])), /no longer current/);
});

test('evidence corruption, modified context and cross-build locators cannot validate', async t => {
  const { catalog, store, build } = await setup(t);
  const context = retrieveAnswerContext(catalog, 'orders.placed.v2'), span = context.spans[0]!;
  const changed = structuredClone(context); changed.spans[0]!.text = 'Forged text';
  assert.throws(() => validateCitedAnswer(catalog, changed, result([span.id])));
  const { inputHash: _hash, ...input } = changed; changed.inputHash = sha256(JSON.stringify(input));
  assert.throws(() => validateCitedAnswer(catalog, changed, result([span.id])));
  const state = catalog.state(); catalog.start('second', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  const newer = retrieveAnswerContext(catalog, context.question);
  assert.notEqual(newer.buildId, build.id);
  assert.throws(() => validateCitedAnswer(catalog, newer, result([span.id])));
  assert.doesNotThrow(() => validateCitedAnswer(catalog, context, result([span.id])));
  store.run('UPDATE spans SET text=? WHERE id=?', 'Corrupted checkpoint', span.id);
  assert.throws(() => validateCitedAnswer(catalog, context, result([span.id])), /integrity/);
});

test('empty retrieval preserves an explicit gap and permits only an abstention', async t => {
  const { catalog } = await setup(t);
  const context: AnswerContext = retrieveAnswerContext(catalog, 'nonexistentuniqueterm');
  assert.equal(context.spans.length, 0);
  assert.ok(context.gaps.some(gap => gap.includes('does not prove absence')));
  assert.doesNotThrow(() => validateCitedAnswer(catalog, context, '{"claims":[],"unknowns":["No matching indexed evidence."]}'));
  assert.throws(() => validateCitedAnswer(catalog, context, result(['invented'])));
});
