// Offline attribution only: read a retained ordinary result; never run the application.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [input, output] = process.argv.slice(2);
assert.equal(process.argv.length, 4);
assert(path.isAbsolute(input ?? '') && path.isAbsolute(output ?? ''));
const raw = await readFile(input), result = JSON.parse(raw), review = result.review;
assert.equal(result.id, 'D01-complete-path');
assert.deepEqual(result.errors, []); assert.equal(result.passed, false);
assert.equal(review.status, 'ready'); assert.equal(review.compact.item, null);
assert.equal(review.compact.reason, 'derived-size');
const bytes = value => Buffer.byteLength(JSON.stringify(value));
const comparisons = review.context.interfaces.comparisons, compact = review.compact;
const legacyBytes = bytes(comparisons);
assert.equal(legacyBytes, review.context.interfaces.comparisonBytes);
assert.equal(compact.derivedBytes, legacyBytes + compact.attemptedBytes + 1);
const comparisonRows = comparisons.map((row, index) => ({ index, id: row.id, bytes: bytes(row),
  fieldBytes: Object.fromEntries(Object.entries(row).map(([key, value]) => [key, bytes({ [key]: value }) - 1])),
  headerBytes: bytes(row.headerCheck) }));
const references = compact.duplicateClues.map(clue => {
  const index = comparisons.findIndex(row => row.id === clue.legacyId);
  assert(index >= 0 && Number.isSafeInteger(clue.nativeEdge) && clue.nativeEdge >= 0);
  const original = comparisons[index].headerCheck;
  const proposed = { legacyHeader: index };
  // Demonstrate a lossless component round trip, without fabricating a native item.
  assert.deepEqual(comparisons[proposed.legacyHeader].headerCheck, original);
  return { legacyIndex: index, nativeEdge: clue.nativeEdge, headerBytes: bytes(original), referenceBytes: bytes(proposed),
    savedBytes: bytes(original) - bytes(proposed), preservedHeader: original };
});
const tuples = references.map(row => [row.legacyIndex, row.nativeEdge]);
assert.deepEqual(tuples.map(([legacyIndex, nativeEdge]) => ({ legacyId: comparisons[legacyIndex].id, nativeEdge })), compact.duplicateClues);
const headerSaving = references.reduce((sum, row) => sum + row.savedBytes, 0);
const lexicalBindingSaving = bytes({ lexicalInputHash: review.context.inputHash }) - 1;
const clueSaving = bytes(compact.duplicateClues) - bytes(tuples);
const limit = review.context.interfaces.limits.comparisonBytes;
const alternatives = [
  { name: 'Reference identical legacy headers', savedBytes: headerSaving },
  { name: 'Obtain lexical binding from enclosing context', savedBytes: lexicalBindingSaving },
  { name: 'Both header and lexical factoring', savedBytes: headerSaving + lexicalBindingSaving },
  { name: 'Header, lexical and duplicate-clue tuple factoring', savedBytes: headerSaving + lexicalBindingSaving + clueSaving },
].map(row => ({ ...row, projectedBytes: compact.derivedBytes - row.savedBytes,
  projectedHeadroom: limit - compact.derivedBytes + row.savedBytes, completeItemObserved: false }));
const report = { schemaVersion: 'retained-native-size-diagnosis/1',
  input: { path: input, bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex') },
  recorded: { nativeBytes: compact.attemptedBytes, legacyBytes, joiningBytes: 1,
    combinedBytes: compact.derivedBytes, limit, excess: compact.derivedBytes - limit,
    completeNativeItemRetained: false, originalPositivePassed: false },
  comparisonRows, references, lexicalBindingSaving, duplicateClueSaving: clueSaving, alternatives,
  limitations: ['The discarded complete native item and receipt were transient and are absent from this retained review.',
    'Savings describe known repeated components under the unchanged serializer, not a reconstructed complete item or an observed product repair.',
    'A new wire format and prompt require explicit versioning, old saved-witness compatibility and fresh prospective controls.',
    'No parser, model, resource or whole-flow acceptance follows from this offline calculation.'],
  applicationRuns: 0, modelCalls: 0, reservedFamilyReads: 0, resourceQualification: false };
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
