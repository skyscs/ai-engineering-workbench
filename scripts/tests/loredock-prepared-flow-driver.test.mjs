import assert from 'node:assert/strict';
import test from 'node:test';
import { assessPreview } from '../loredock-prepared-flow/assess.mjs';
import { hash } from '../loredock-prepared-flow/io.mjs';
import { beginScope, endScope } from '../loredock-prepared-flow/accounting.mjs';
import { OperationBudget } from '../../apps/loredock/dist/operation-budget.js';
import { sanitized } from '../loredock-prepared-flow/browser.mjs';

function originalFixture() {
  const original = '# Owned notes\nThe source states a local fact.\n';
  const corpus = { 'source-a': { 'README.md': original }, 'source-b': { 'README.md': original } };
  const revision = 'a'.repeat(40), tree = 'b'.repeat(40);
  const sources = { revisions: Object.fromEntries(Object.keys(corpus).map(name => [name, { revision, tree }])) };
  const context = { deploymentCoherence: 'unknown', sources: Object.keys(corpus).map(name => ({ name, sourceId: name + '-id', revision, tree, status: 'ready' })),
    spans: [{ id: 'original-a', sourceName: 'source-a', sourceId: 'source-a-id', revision, path: 'README.md',
      startLine: 2, endLine: 2, text: 'The source states a local fact.', contentHash: hash(original), spanHash: hash('The source states a local fact.') }],
    textBytes: Buffer.byteLength('The source states a local fact.') };
  const expected = { prepared: 'source-context-required-native-absent', requiredOriginals: ['fact'] };
  const references = { fact: { source: 'source-a', path: 'README.md', quote: 'The source states a local fact.' } };
  const review = { status: 'ready', context: { ...context, inputHash: hash(JSON.stringify(context)) }, compact: { item: null, reason: 'QUESTION_INSUFFICIENT_CONTEXT' } };
  return { review, input: { corpus, sources, expected, references } };
}
function rehash(review) {
  const { inputHash: _, ...context } = review.context;
  review.context.inputHash = hash(JSON.stringify(context));
}

test('independent source assessor rejects consistently rehashed wrong text and foreign identical originals', () => {
  const original = originalFixture(); assert.equal(assessPreview(original.review, original.input).requiredOriginals.length, 1);
  const wrongText = structuredClone(original.review), span = wrongText.context.spans[0];
  span.text = 'An invented local fact.'; span.spanHash = hash(span.text); wrongText.context.textBytes = Buffer.byteLength(span.text); rehash(wrongText);
  assert.throws(() => assessPreview(wrongText, original.input));
  const foreign = structuredClone(original.review);
  foreign.context.spans[0].sourceName = 'source-b'; foreign.context.spans[0].sourceId = 'source-b-id'; rehash(foreign);
  assert.throws(() => assessPreview(foreign, original.input), /Missing required original/);
});

test('an omitted native item cannot pass a required useful positive', () => {
  const original = originalFixture(); original.input.expected.prepared = 'native-required';
  assert.throws(() => assessPreview(original.review, original.input), /Required useful native path was omitted/);
});

test('diagnostic accounting forwards actual accepted and rejected work across separate budgets', () => {
  beginScope('ordinary-unit-accounting');
  const first = new OperationBudget({ limits: { work: 3 } }), second = new OperationBudget();
  first.charge('path', 2);
  assert.throws(() => first.charge('receipt', 2), error => error.code === 'CAPTURE_WORK_LIMIT');
  second.charge('receipt', 1); first.close(); second.close();
  const result = endScope();
  assert.equal(result.budgets.length, 2); assert.equal(result.totalWork, 3); assert.equal(result.requestedWork, 5);
  assert.deepEqual(result.unclosedBudgets, []);
  assert.equal(result.budgets[0].errors['charge:CAPTURE_WORK_LIMIT'], 1);
  for (const budget of result.budgets) assert.equal(Object.values(budget.charges).reduce((sum, row) => sum + row.accepted, 0), budget.final.totalWork);
  assert.equal(result.memoryQualified, false); assert.equal(result.timingQualified, false);
  assert.throws(() => beginScope('ordinary-unit-accounting'), /cannot be reused/);
});

test('browser journals remove session values from both structured and raw HTTP headers', () => {
  const value = { headers: { Cookie: 'owned-cookie', 'x-loredock-csrf': 'owned-csrf', Accept: 'application/json' },
    headersText: 'HTTP/1.1 200 OK\r\nSet-Cookie: owned-cookie\r\nX-LoreDock-CSRF: owned-csrf\r\nContent-Type: application/json\r\n',
    body: { token: 'owned-session-token', sourceText: 'Cookie: this is original source text.' } };
  const clean = sanitized(value), encoded = JSON.stringify(clean);
  for (const secret of ['owned-cookie', 'owned-csrf', 'owned-session-token']) assert(!encoded.includes(secret));
  assert.equal(clean.headers.Accept, 'application/json'); assert.equal(clean.body.sourceText, value.body.sourceText);
  assert(clean.headersText.includes('Content-Type: application/json'));
  assert.equal(value.headers.Cookie, 'owned-cookie', 'Sanitization must not mutate the captured event object.');
});
