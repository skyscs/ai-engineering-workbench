// Independent byte accounting over retained immutable inputs; no candidate producer or codec imports.
import assert from 'node:assert/strict';
import { mkdir, cp, readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { hash, inventory, save, normalized } from './io.mjs';

const { thresholds } = JSON.parse(await readFile(new URL('../../fixtures/loredock-prepared-flow/protocol.json', import.meta.url)));
const bytes = value => Buffer.byteLength(value, 'utf8');

export function assessPreparedContent({ contextJson, witnessJson, reviewedHash }) {
  assert.equal(typeof contextJson, 'string'); assert.equal(typeof witnessJson, 'string');
  const context = JSON.parse(contextJson), witness = JSON.parse(witnessJson);
  assert.equal(witness.schemaVersion, 'loredock-prepared-witness/1');
  assert.equal(witness.compositionVersion, 'loredock-prepared-question/1');
  assert.equal(witness.promptVersion, 'loredock-prepared-answer-v1');
  assert.equal(hash(JSON.stringify([witness.compositionVersion, contextJson, witnessJson])), reviewedHash);
  const { inputHash, ...body } = context;
  assert.equal(hash(JSON.stringify(body)), inputHash); assert.equal(witness.lexicalInputHash, inputHash);
  assert.equal(hash(witness.prompt), witness.promptHash);
  assert(Array.isArray(context.spans));
  assert.equal(new Set(context.spans.map(span => span.id)).size, context.spans.length);
  const originalBytes = context.spans.reduce((sum, span) => sum + bytes(span.text), 0);
  assert.equal(originalBytes, context.textBytes);
  const legacy = context.interfaces?.comparisons ?? []; assert(Array.isArray(legacy));
  const item = witness.compact.item;
  assert(item === null || typeof item === 'object' && !Array.isArray(item));
  const derivedBytes = bytes(JSON.stringify(item === null ? legacy : [...legacy, item]));
  if (item !== null) {
    assert.equal(item.schemaVersion, 'native-question-item/1');
    assert.equal(hash(JSON.stringify(item)), witness.compact.itemHash);
    assert.equal(derivedBytes, witness.compact.derivedBytes);
    assert.equal(witness.compact.promptHash, witness.promptHash); assert.equal(witness.compact.promptBytes, bytes(witness.prompt));
    for (const id of item.originals) assert(context.spans.some(span => span.id === id), 'A native identifier cannot replace an issued original.');
  }
  // The frozen snapshot representation reserves 1024 bytes beyond its serialized envelope.
  const retainedBytes = bytes(JSON.stringify({ contextJson, witnessJson, reviewedHash })) + 1024;
  const measured = { witnessRowBytes: bytes(witnessJson), retainedPreparationBytes: retainedBytes, promptBytes: bytes(witness.prompt),
    nativeAndLegacyDerivedBytes: derivedBytes, sourceEvidenceBytes: originalBytes, sourceEvidenceSpans: context.spans.length };
  const checks = Object.entries(measured).map(([metric, value]) => ({ metric, value, limit: thresholds[metric], passed: value <= thresholds[metric] }));
  return { status: checks.every(row => row.passed) ? 'passed' : 'failed', measured, checks, reviewedHash,
    contextSha256: hash(contextJson), witnessSha256: hash(witnessJson), nativePresent: item !== null,
    omittedAttemptedDerivedBytes: item === null ? witness.compact.derivedBytes ?? null : null,
    resourceQualification: false, sourceUsefulnessQualified: false };
}

export function assessWitnessRows(rows, expectedRows) {
  assert(Array.isArray(rows)); assert.equal(rows.length, expectedRows);
  assert.equal(new Set(rows.map(row => row.answerId)).size, rows.length);
  const observations = [], checks = [];
  let totalBytes = 0, purged = 0;
  for (const row of rows) {
    assert([0, 1].includes(row.purged)); assert(Number.isSafeInteger(row.witnessBytes) && row.witnessBytes >= 0);
    if (row.purged) {
      assert.equal(row.witnessJson, null); assert.equal(row.contextJson, null); assert.equal(row.witnessBytes, 0); purged++;
      observations.push({ answerId: row.answerId, purged: true }); continue;
    }
    assert.equal(hash(row.contextJson), row.contextHash); assert.equal(bytes(row.witnessJson), row.witnessBytes);
    const content = assessPreparedContent(row); observations.push({ answerId: row.answerId, purged: false, content });
    totalBytes += row.witnessBytes;
  }
  for (const [metric, value] of [['witnessRowsIncludingPurged', rows.length], ['witnessTotalBytes', totalBytes]])
    checks.push({ metric, value, limit: thresholds[metric], passed: value <= thresholds[metric] });
  return { status: checks.every(row => row.passed) && observations.every(row => row.purged || row.content.status === 'passed') ? 'passed' : 'failed',
    rows: rows.length, purged, totalBytes, observations, checks, resourceQualification: false };
}

export async function inspectWitnessCatalog({ directory, checkpoint, expectedRows, reviews = [] }) {
  await mkdir(directory);
  const report = { errors: [], resourceQualification: false }, data = path.join(directory, 'data');
  try {
    assert.deepEqual(await inventory(checkpoint.data), checkpoint.files);
    await save(path.join(directory, 'inputs.json'), { checkpoint, expectedRows, reviews });
    await cp(checkpoint.data, data, { recursive: true, force: false, errorOnExist: true });
    assert.deepEqual(await inventory(data), checkpoint.files);
    const database = new DatabaseSync(path.join(data, 'loredock.db'), { readOnly: true });
    try {
      assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
      assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
      const rows = database.prepare('SELECT w.answerId,w.purged,w.contextHash,w.reviewedHash,w.witness AS witnessJson,w.witnessBytes,a.context AS contextJson FROM answer_witnesses w JOIN answer_attempts a ON a.id=w.answerId ORDER BY w.answerId').all();
      report.assessment = assessWitnessRows(rows, expectedRows);
      report.boundReviews = reviews.map(({ name, review }) => {
        const matched = rows.find(row => !row.purged && row.reviewedHash === review.reviewedHash);
        assert(matched, 'No retained witness matches this exact reviewed identity: ' + name);
        assert.equal(matched.contextJson, JSON.stringify(review.context));
        const witness = JSON.parse(matched.witnessJson);
        assert.deepEqual(witness.compact, review.compact); assert.deepEqual(witness.selection, review.selection);
        assert.equal(witness.promptVersion, review.promptVersion);
        return { name, reviewedHash: review.reviewedHash, retainedAnswerId: matched.answerId, contextAndWitnessIdentity: true };
      });
    } finally { database.close(); }
  } catch (error) { report.errors.push(normalized(error)); }
  finally {
    try { assert.deepEqual(await inventory(checkpoint.data), checkpoint.files); report.inputUnchanged = true; }
    catch (error) { report.errors.push(normalized(error)); }
    await save(path.join(directory, 'result.json'), report);
  }
  return report;
}
