import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { factorNativeQuestion, expandNativeQuestion, compactVersionForPrompt } from '../../apps/loredock/dist/question-native-format.js';
import { compactQuestionPath, preparedQuestionPrompt } from '../../apps/loredock/dist/question-context.js';
import { readQuestionSnapshot, questionSnapshot } from '../../apps/loredock/dist/question-witness.js';
import { OperationBudget } from '../../apps/loredock/dist/operation-budget.js';
import { decodeNativeReceipt } from '../../apps/loredock/dist/native-receipt.js';
import { loadNativeV1Control } from '../../apps/loredock/tests/fixtures/native-format-v1-reference/verify.mjs';

const directory = new URL('../../apps/loredock/tests/fixtures/native-format-v1-reference/', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
const code = expected => error => error.code === expected;
async function fixture() {
  const manifest = JSON.parse(await readFile(new URL('baseline.json', directory), 'utf8')), values = {};
  for (const [file, identity] of Object.entries(manifest.files)) {
    const raw = await readFile(new URL(file, directory)); assert.equal(raw.length, identity.bytes); assert.equal(hash(raw), identity.sha256);
    values[file] = raw.toString();
  }
  const snapshot = JSON.parse(values['complete-v1-snapshot.json']);
  return { raw: values['complete-v1-item.json'], item: JSON.parse(values['complete-v1-item.json']), snapshot, ...readQuestionSnapshot(snapshot) };
}
function withBudget(callback) {
  const budget = new OperationBudget(); try { return callback(budget, n => budget.charge('receipt', n)); } finally { budget.close(); }
}
function snapshot(context, witness) { return withBudget(budget => questionSnapshot(context, witness, budget)); }

test('factored wire data expands to every exact v1 byte, including the header gap and original support', async () => {
  const { item, context, raw } = await fixture();
  withBudget((budget, charge) => {
    const v2 = factorNativeQuestion(item, context, charge), expanded = expandNativeQuestion(v2, context, charge);
    assert.equal(v2.schemaVersion, 'native-question-item/2'); assert(!Object.hasOwn(v2, 'lexicalInputHash'));
    assert.equal(JSON.stringify(expanded), raw);
    assert.equal(Buffer.byteLength(JSON.stringify([...context.interfaces.comparisons, item])), 8368);
    assert.equal(Buffer.byteLength(JSON.stringify([...context.interfaces.comparisons, v2])), 8081);
    assert.equal(Buffer.byteLength(JSON.stringify(v2)), 6812);
    assert(Buffer.byteLength(raw) > raw.length, 'UTF-8 source qualifications must use byte accounting.');
    assert(expanded.edges.some(edge => edge[8]?.status === 'gap' && edge[8].detail.includes('X-Grant-Tenant')));
    assert.deepEqual(expanded.originals, item.originals); assert(budget.stats().totalWork > 0);
  });
});

test('saved v1 reconstruction and prompts remain exact while the same complete path fits v2', async t => {
  const { context, witness, item } = await fixture(), folder = await mkdtemp(path.join(tmpdir(), 'native-v1-control-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const old = await loadNativeV1Control(folder);
  withBudget(budget => {
    const receipt = decodeNativeReceipt(Buffer.from(witness.receipt), witness.catalogId, budget);
    const v1 = compactQuestionPath(context, receipt, budget, 'native-question-item/1');
    assert.deepEqual(v1, witness.compact); assert.deepEqual(v1, old.compactQuestionPath(context, receipt, budget));
    assert.equal(preparedQuestionPrompt(context, item), old.preparedQuestionPrompt(context, item));
    assert.equal(preparedQuestionPrompt(context, null), witness.prompt);
    const v2 = compactQuestionPath(context, receipt, budget);
    assert.equal(v2.reason, null); assert(v2.item); assert(v2.derivedBytes <= 8192);
    assert.deepEqual(expandNativeQuestion(v2.item, context), item);
    assert.notEqual(preparedQuestionPrompt(context, v2.item), old.preparedQuestionPrompt(context, item));
  });
});

test('unknown and mixed prompt/item versions fail; both supported recorded versions remain explicit', async () => {
  const { context, witness, item } = await fixture();
  const v2 = withBudget((_, charge) => factorNativeQuestion(item, context, charge));
  assert.equal(compactVersionForPrompt('loredock-prepared-answer-v1'), 'native-question-item/1');
  assert.equal(compactVersionForPrompt('loredock-prepared-answer-v2'), 'native-question-item/2');
  assert.throws(() => compactVersionForPrompt('loredock-prepared-answer-v99'), code('QUESTION_NATIVE_FORMAT'));
  assert.throws(() => expandNativeQuestion({ ...v2, schemaVersion: 'unknown' }, context), code('QUESTION_NATIVE_FORMAT'));
  for (const [promptVersion, selected] of [['loredock-prepared-answer-v1', v2], ['loredock-prepared-answer-v2', item]]) {
    const value = snapshot(context, { ...witness, promptVersion, compact: { ...witness.compact, item: selected } });
    assert.throws(() => readQuestionSnapshot(value), code('QUESTION_COMPACT_VERSION'));
  }
  const unknown = snapshot(context, { ...witness, promptVersion: 'unknown' });
  assert.throws(() => readQuestionSnapshot(unknown), code('QUESTION_WITNESS_VERSION'));
});

test('header references reject bad indexes, extra fields, missing or duplicate mappings and changed source scope', async () => {
  const { item, context } = await fixture();
  const v2 = withBudget((_, charge) => factorNativeQuestion(item, context, charge));
  const edgeIndex = v2.edges.findIndex(edge => edge[8] && Object.hasOwn(edge[8], 'legacyHeader'));
  assert(edgeIndex >= 0);
  const otherComparison = (v2.edges[edgeIndex][8].legacyHeader + 1) % context.interfaces.comparisons.length;
  const mutations = [
    value => { value.edges[edgeIndex][8].legacyHeader = -1; },
    value => { value.edges[edgeIndex][8].legacyHeader = 1.5; },
    value => { value.edges[edgeIndex][8].legacyHeader = 99; },
    value => { value.edges[edgeIndex][8].legacyHeader = '1'; },
    value => { value.edges[edgeIndex][8].detail = 'Invented inline fallback.'; },
    value => { value.duplicateClues = []; },
    value => { value.duplicateClues.push(value.duplicateClues[0]); },
    value => { value.duplicateClues[0].push(0); },
    value => { value.duplicateClues[0][0] = otherComparison; },
    value => { value.duplicateClues[0][1] = -1; },
    value => { value.lexicalInputHash = context.inputHash; },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const value = structuredClone(v2); mutate(value);
    assert.throws(() => expandNativeQuestion(value, context), code('QUESTION_NATIVE_FORMAT'), 'mutation ' + index);
  }
  const changed = structuredClone(context), originalId = item.originals[item.nodes[item.edges[edgeIndex][1]][5][0]];
  changed.spans.find(span => span.id === originalId).path = 'another-file.ts';
  assert.throws(() => expandNativeQuestion(v2, changed), code('QUESTION_NATIVE_FORMAT'));
});

test('unmatched headers stay inline and formatting cannot reset the supplied work bound', async () => {
  const { item, context } = await fixture(), input = structuredClone(context);
  input.interfaces.comparisons = [];
  const { inputHash: _, ...content } = input; input.inputHash = hash(JSON.stringify(content));
  const semantic = { ...item, lexicalInputHash: input.inputHash, duplicateClues: [] };
  withBudget((_, charge) => {
    const v2 = factorNativeQuestion(semantic, input, charge);
    assert.deepEqual(v2.edges.map(edge => edge[8]), item.edges.map(edge => edge[8]));
    assert.deepEqual(expandNativeQuestion(v2, input), semantic);
  });
  const budget = new OperationBudget({ limits: { work: 0 } });
  try { assert.throws(() => factorNativeQuestion(item, context, n => budget.charge('receipt', n)), code('CAPTURE_WORK_LIMIT')); }
  finally { budget.close(); }
});

test('legacy comparison order changes references without changing expanded relationships', async () => {
  const { item, context } = await fixture(), input = structuredClone(context);
  input.interfaces.comparisons.reverse();
  const { inputHash: _, ...content } = input; input.inputHash = hash(JSON.stringify(content));
  const semantic = { ...item, lexicalInputHash: input.inputHash };
  withBudget((_, charge) => {
    const before = factorNativeQuestion(item, context, charge), reordered = factorNativeQuestion(semantic, input, charge);
    assert.notDeepEqual(reordered.duplicateClues, before.duplicateClues);
    assert.deepEqual(expandNativeQuestion(reordered, input), semantic);
    assert.deepEqual(reordered.originals, before.originals);
  });
});
