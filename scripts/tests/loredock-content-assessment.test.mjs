import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hash } from '../loredock-prepared-flow/io.mjs';
import { assessPreparedContent, assessWitnessRows, bindPreparedReview } from '../loredock-prepared-flow/content-assess.mjs';

function fixture({ text = 'Owned café "quotation".', prompt = 'Owned prompt.', compact } = {}) {
  const body = { spans: [{ id: 'original-1', text }], textBytes: Buffer.byteLength(text), interfaces: { comparisons: [] } };
  const context = { ...body, inputHash: hash(JSON.stringify(body)) }, contextJson = JSON.stringify(context);
  const witness = { schemaVersion: 'loredock-prepared-witness/1', compositionVersion: 'loredock-prepared-question/1',
    promptVersion: 'loredock-prepared-answer-v1', lexicalInputHash: context.inputHash, prompt, promptHash: hash(prompt),
    compact: compact ?? { item: null, reason: 'INVENTORY_UNAVAILABLE' } };
  const witnessJson = JSON.stringify(witness);
  return { contextJson, witnessJson, reviewedHash: hash(JSON.stringify([witness.compositionVersion, contextJson, witnessJson])) };
}
test('content bounds count UTF-8 and the escaped retained envelope with reserved metadata', () => {
  const input = fixture(), result = assessPreparedContent(input);
  assert.equal(result.status, 'passed'); assert.equal(result.resourceQualification, false);
  assert.equal(result.measured.sourceEvidenceBytes, Buffer.byteLength('Owned café "quotation".'));
  assert(result.measured.retainedPreparationBytes > Buffer.byteLength(input.contextJson) + Buffer.byteLength(input.witnessJson) + 1024);
  assert.equal(result.sourceUsefulnessQualified, false);
});
test('prompt and original byte ceilings are inclusive and keep overages failed', () => {
  for (const [field, limit, metric] of [['prompt', 98304, 'promptBytes'], ['text', 65536, 'sourceEvidenceBytes']]) {
    const accepted = assessPreparedContent(fixture({ [field]: 'x'.repeat(limit) }));
    assert.equal(accepted.status, 'passed'); assert.equal(accepted.measured[metric], limit);
    const failed = assessPreparedContent(fixture({ [field]: 'x'.repeat(limit + 1) }));
    assert.equal(failed.status, 'failed'); assert(failed.checks.some(row => row.metric === metric && !row.passed));
  }
});
test('omitted oversized derived content stays distinct from retained bytes and useful-source acceptance', () => {
  const result = assessPreparedContent(fixture({ compact: { item: null, reason: 'derived-size', derivedBytes: 9000 } }));
  assert.equal(result.measured.nativeAndLegacyDerivedBytes, 2); assert.equal(result.omittedAttemptedDerivedBytes, 9000);
  assert.equal(result.nativePresent, false); assert.equal(result.sourceUsefulnessQualified, false);
});
test('identity corruption and native-only citations cannot acquire content credit', () => {
  const input = fixture(); assert.throws(() => assessPreparedContent({ ...input, contextJson: input.contextJson + ' ' }));
  const item = { schemaVersion: 'native-question-item/1', originals: ['native-only'] };
  const compact = { item, itemHash: hash(JSON.stringify(item)), derivedBytes: Buffer.byteLength(JSON.stringify([item])),
    promptBytes: Buffer.byteLength('Owned prompt.'), promptHash: hash('Owned prompt.') };
  assert.throws(() => assessPreparedContent(fixture({ compact })), /issued original/);
});
test('purged witnesses still count toward capacity and inconsistent or duplicate rows fail', () => {
  const tombstones = Array.from({ length: 64 }, (_, i) => ({ answerId: 'owned-' + i, purged: 1, witnessBytes: 0, witnessJson: null, contextJson: null }));
  const accepted = assessWitnessRows(tombstones, 64); assert.equal(accepted.status, 'passed'); assert.equal(accepted.totalBytes, 0); assert.equal(accepted.purged, 64);
  assert.equal(assessWitnessRows([...tombstones, { ...tombstones[0], answerId: 'owned-64' }], 65).status, 'failed');
  assert.throws(() => assessWitnessRows([...tombstones, tombstones[0]], 65));
  assert.throws(() => assessWitnessRows([{ ...tombstones[0], witnessJson: 'Retained text.' }], 1));
  const content = fixture(); assert.throws(() => assessWitnessRows([{ answerId: 'owned', purged: 0, ...content,
    contextHash: hash(content.contextJson), witnessBytes: Buffer.byteLength(content.witnessJson) + 1 }], 1));
});

function bindingInput(options) {
  const content = fixture(options), witness = JSON.parse(content.witnessJson);
  return { row: { ...content, answerId: 'answer-1', purged: 0, contextHash: hash(content.contextJson),
    witnessBytes: Buffer.byteLength(content.witnessJson) }, review: { id: 'review-1', status: 'ready', reviewedHash: content.reviewedHash,
    context: JSON.parse(content.contextJson), compact: witness.compact, selection: witness.selection, promptVersion: witness.promptVersion } };
}
test('exact review binding proves content identity without inventing a unique owner', () => {
  const { row, review } = bindingInput();
  const result = bindPreparedReview([{ ...row, answerId: 'answer-2' }, row], review);
  assert.equal(result.status, 'passed'); assert.deepEqual(result.retainedAnswerIds, ['answer-1', 'answer-2']);
  assert.equal(result.transientOwnershipProven, false); assert.equal(result.resourceQualification, false);
  assert.equal(result.sourceUsefulnessQualified, false); assert.equal(result.content.reviewedHash, review.reviewedHash);
});
test('unmatched and purged previews remain unmeasured instead of borrowing another witness', () => {
  const { row, review } = bindingInput();
  for (const rows of [[], [{ ...row, reviewedHash: '0'.repeat(64) }], [{ ...row, purged: 1 }]]) {
    const result = bindPreparedReview(rows, review);
    assert.equal(result.status, 'incomplete'); assert.equal(result.content, null); assert.deepEqual(result.retainedAnswerIds, []);
  }
});
test('matching an echoed identity does not bypass witness or public-review integrity', () => {
  const { row, review } = bindingInput();
  for (const changed of [{ ...review, context: {} }, { ...review, compact: {} }, { ...review, selection: {} },
    { ...review, promptVersion: 'unknown' }, { ...review, status: 'preparing' }])
    assert.throws(() => bindPreparedReview([row], changed));
  assert.throws(() => bindPreparedReview([{ ...row, witnessJson: row.witnessJson + ' ' }], review));
  assert.throws(() => bindPreparedReview([row, row], review));
});
test('exact content binding preserves a measured limit violation', () => {
  const { row, review } = bindingInput({ prompt: 'x'.repeat(98305) });
  const result = bindPreparedReview([row], review);
  assert.equal(result.status, 'failed'); assert(result.content.checks.some(check => !check.passed));
});
