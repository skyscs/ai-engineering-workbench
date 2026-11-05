import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { assessHttpRecords, assessRecordedHttp } from '../loredock-prepared-flow/http-assess.mjs';

const id = 'b5b539f7-d147-44ed-a9e5-0aa00e996cd6';
function input(route = '/answers', raw = Buffer.from('{"text":"é"}'), elapsedMs = 500) {
  return { lane: 'resource', readBody: async () => raw, events: [
    { event: 'request', id: '00001', route, method: 'GET' },
    { event: 'response', id: '00001', status: 200, bytes: raw.length, elapsedMs },
  ] };
}
test('HTTP checks use exact UTF-8 bytes and inclusive route-specific latency ceilings', async () => {
  const exact = await assessHttpRecords(input()); assert.equal(exact.status, 'passed');
  assert.deepEqual(exact.coveredLimits, ['answerListResponseBytes', 'answerListHttpMs']);
  assert.equal(exact.observations[0].bytes, 13); assert.equal(exact.resourceQualification, false);
  assert.equal((await assessHttpRecords(input('/answers', undefined, 500.01))).status, 'failed');
  assert.equal((await assessHttpRecords(input('/answers/' + id, undefined, 1500))).status, 'passed');
  assert.equal((await assessHttpRecords(input('/question-preparations/' + id, undefined, 250.01))).status, 'failed');
});
test('oversized complete bodies remain failed instead of becoming a successful truncated observation', async () => {
  const raw = Buffer.from(JSON.stringify('x'.repeat(65535)));
  const report = await assessHttpRecords(input('/answers', raw, 1));
  assert.equal(report.status, 'failed'); assert.equal(report.observations[0].retainedBytes, 65537);
  assert.equal(report.observations[0].checks[0].withinLimit, false);
});
test('missing responses, recorded failures and an empty measured scope cannot pass', async () => {
  const missing = input(); missing.events.pop();
  assert.equal((await assessHttpRecords(missing)).status, 'incomplete');
  const failed = input(); failed.events[1].status = 500;
  failed.events.push({ event: 'failure', id: '00001', error: { message: 'Unexpected HTTP failure.' } });
  const report = await assessHttpRecords(failed); assert.equal(report.status, 'failed'); assert.equal(report.failures.length, 2);
  assert.equal((await assessHttpRecords(input('/builds/' + id))).status, 'incomplete');
});
test('duplicate, reordered and byte-inconsistent HTTP records are rejected', async () => {
  const duplicate = input(); duplicate.events.push(duplicate.events[1]);
  await assert.rejects(assessHttpRecords(duplicate));
  const reordered = input(); reordered.events.reverse(); await assert.rejects(assessHttpRecords(reordered));
  const wrongBytes = input(); wrongBytes.events[1].bytes--; await assert.rejects(assessHttpRecords(wrongBytes));
  const wrongTime = input(); wrongTime.events[1].elapsedMs = NaN; await assert.rejects(assessHttpRecords(wrongTime));
});
test('fault and accounting observations cannot qualify resource timing', async () => {
  for (const lane of ['fault', 'accounting']) {
    const report = await assessHttpRecords({ ...input(), lane });
    assert.equal(report.status, 'observed'); assert.equal(report.timingQualified, false);
    assert.equal(report.resourceQualification, false); assert.equal(report.modelEligibility, false);
  }
});

function negative(kind = 'transient') {
  const quota = kind === 'quota', route = quota ? '/prepared-answers' : '/question-preparations/' + id;
  const errorCode = quota ? 'ANSWER_WITNESS_LIMIT' : 'QUESTION_NOT_FOUND';
  const example = input(route, Buffer.from(JSON.stringify({ error: { code: errorCode } })), 10);
  example.events[0].method = quota ? 'POST' : 'GET'; example.events[1].status = 409;
  example.expectedNonSuccess = [{ id: '00001', route, method: example.events[0].method, status: 409, errorCode }];
  return example;
}
test('history quota and missing-transient outcomes require an exact declared request and keep byte/time checks', async () => {
  for (const kind of ['transient', 'quota']) {
    const example = negative(kind), accepted = await assessHttpRecords(example);
    assert.equal(accepted.status, 'passed'); assert.deepEqual(accepted.matchedExpectedOutcomes, ['00001']);
    assert.equal(accepted.observations[0].expectedOutcome, true); assert.equal(accepted.resourceQualification, false);
    assert.equal((await assessHttpRecords({ ...example, expectedNonSuccess: [] })).status, 'failed');
    if (kind === 'transient') {
      example.events[1].elapsedMs = 250.01;
      assert.equal((await assessHttpRecords(example)).status, 'failed');
    }
    const raw = Buffer.from(JSON.stringify({ error: { code: example.expectedNonSuccess[0].errorCode }, text: 'x'.repeat(1310720) }));
    example.readBody = async () => raw; example.events[1].bytes = raw.length;
    assert.equal((await assessHttpRecords(example)).status, 'failed');
  }
});
test('expected error declarations cannot mask another request, wrong code/status/method/route or a missing outcome', async () => {
  for (const [mutate, status] of [
    [value => { value.events[1].status = 200; }, 'failed'],
    [value => { value.events[1].status = 500; }, 'failed'],
    [value => { value.events[0].method = 'POST'; }, 'incomplete'],
    [value => { value.events[0].route = '/answers'; }, 'failed'],
    [value => { const raw = Buffer.from('{"error":{"code":"WRONG_CODE"}}'); value.readBody = async () => raw; value.events[1].bytes = raw.length; }, 'failed'],
  ]) {
    const example = negative(); mutate(example);
    const result = await assessHttpRecords(example);
    assert.equal(result.status, status); assert(result.failures.some(row => row.reason === 'expected-outcome-mismatch'));
  }
  const wrongId = negative(); wrongId.expectedNonSuccess[0].id = '00002';
  const missing = await assessHttpRecords(wrongId);
  assert.equal(missing.status, 'incomplete'); assert(missing.failures.some(row => row.reason === 'non-success-response'));
  assert(missing.incomplete.some(row => row.reason === 'missing-expected-outcome'));
  const repeated = negative(); repeated.events.push(...repeated.events.map(row => ({ ...row, id: '00002' })));
  assert.equal((await assessHttpRecords(repeated)).status, 'failed');
  const failed = negative(); failed.events.push({ event: 'failure', id: '00001', error: { message: 'Retained client failure.' } });
  assert.equal((await assessHttpRecords(failed)).status, 'failed');
});
test('broad, duplicate and unsupported negative declarations are rejected before reading response bodies', async () => {
  for (const mutate of [
    value => { value.expectedNonSuccess.push(value.expectedNonSuccess[0]); },
    value => { value.expectedNonSuccess[0].allowError = true; },
    value => { value.expectedNonSuccess[0].status = 500; },
    value => { value.expectedNonSuccess[0].errorCode = 'INTERNAL_ERROR'; },
    value => { value.expectedNonSuccess[0].route = '/question-preparations/*'; },
    value => { delete value.expectedNonSuccess[0].id; },
  ]) {
    const example = negative(); mutate(example); let reads = 0;
    example.readBody = async () => { reads++; throw new Error('Unexpected body read.'); };
    await assert.rejects(assessHttpRecords(example)); assert.equal(reads, 0);
  }
});

test('retained files bind the lane, require complete raw evidence and preserve session redaction', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-http-assess-'));
  t.diagnostic('Retained HTTP-assessor test: ' + root);
  const directory = path.join(root, 'http'), processDirectory = path.join(root, 'daemon');
  await mkdir(directory); await mkdir(processDirectory);
  const meta = path.join(processDirectory, 'process.json'), journal = path.join(directory, 'requests.jsonl');
  const example = input(), raw = await example.readBody();
  const content = example.events.map(row => JSON.stringify(row) + '\n').join('');
  await writeFile(meta, JSON.stringify({ controlled: true, fault: false, accounting: true }));
  await writeFile(path.join(processDirectory, 'exit.json'), JSON.stringify({ code: 0, signal: null, spawnError: null }));
  await writeFile(journal, content); await writeFile(path.join(directory, '00001.json'), raw);
  await assert.rejects(assessRecordedHttp({ directory, processDirectory, lane: 'resource' }), /Declared lane differs/);
  const report = await assessRecordedHttp({ directory, processDirectory, lane: 'accounting' });
  assert.equal(report.status, 'observed'); assert.equal(report.timingQualified, false);
  assert.equal(await readFile(journal, 'utf8'), content);
  // Keep the valid input separately before exercising malformed/incomplete copies.
  await writeFile(path.join(root, 'complete-journal.jsonl'), content);
  await writeFile(path.join(root, 'complete-body.json'), raw);
  await writeFile(path.join(root, 'observation.json'), JSON.stringify(report));
  await writeFile(journal, content.trimEnd());
  await assert.rejects(assessRecordedHttp({ directory, processDirectory, lane: 'accounting' }), /Truncated HTTP journal/);
  await writeFile(path.join(root, 'truncated-journal.jsonl'), content.trimEnd());
  await writeFile(journal, content); await unlink(path.join(directory, '00001.json'));
  await assert.rejects(assessRecordedHttp({ directory, processDirectory, lane: 'accounting' }), error => error.code === 'ENOENT');
  const session = input('/session', Buffer.from('{"token":"[removed-session-token]"}'));
  session.events[1].bytes = 999;
  const redacted = await assessHttpRecords(session);
  assert(redacted.observations[0].redacted); assert.equal(redacted.status, 'incomplete');
  await assert.rejects(assessHttpRecords(input('/session', Buffer.from('{"token":"incorrect-placeholder"}'))), /Session payload was not redacted/);
});
