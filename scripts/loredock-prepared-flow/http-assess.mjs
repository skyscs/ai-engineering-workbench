// Independent retained HTTP checks. No application imports or new requests.
import assert from 'node:assert/strict';
import { readFile, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { hash } from './io.mjs';

const { thresholds } = JSON.parse(await readFile(new URL('../../fixtures/loredock-prepared-flow/protocol.json', import.meta.url)));
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ready = new RegExp('^/question-preparations/' + uuid + '$');
const review = new RegExp('^/question-preparations/' + uuid + '/review$');
const saved = new RegExp('^/answers/' + uuid + '$');

export async function assessHttpRecords({ events, readBody, lane, expectedNonSuccess = [] }) {
  assert(['resource', 'fault', 'accounting'].includes(lane));
  assert(Array.isArray(events) && events.length > 0);
  assert(Array.isArray(expectedNonSuccess) && expectedNonSuccess.length <= 64);
  const expected = new Map(), matched = new Set();
  for (const entry of expectedNonSuccess) {
    assert(entry && typeof entry === 'object');
    assert.deepEqual(Object.keys(entry).sort(), ['errorCode', 'id', 'method', 'route', 'status']);
    assert(typeof entry.id === 'string' && /^\d{5,}$/.test(entry.id) && !expected.has(entry.id));
    assert.equal(entry.status, 409);
    assert(entry.method === 'POST' && entry.route === '/prepared-answers' && entry.errorCode === 'ANSWER_WITNESS_LIMIT'
      || entry.method === 'GET' && ready.test(entry.route) && entry.errorCode === 'QUESTION_NOT_FOUND',
    'Only the declared history quota and missing-transient outcomes are supported.');
    expected.set(entry.id, entry);
  }
  const requests = new Map(), responses = new Set(), failed = new Set();
  const result = { lane, observations: [], failures: [], incomplete: [], coveredLimits: [],
    expectedNonSuccess,
    resourceQualification: false, modelEligibility: false, timingQualified: lane === 'resource', status: 'incomplete' };
  for (const event of events) {
    assert(event && typeof event.id === 'string' && /^\d{5,}$/.test(event.id));
    if (event.event === 'request') {
      assert.equal(event.id, String(requests.size + 1).padStart(5, '0'), 'HTTP request sequence changed.');
      assert(!requests.has(event.id));
      assert(typeof event.route === 'string' && event.route.startsWith('/') && typeof event.method === 'string');
      requests.set(event.id, event);
      continue;
    }
    assert(requests.has(event.id), 'HTTP terminal event has no request.');
    if (event.event === 'failure') {
      assert(!failed.has(event.id)); failed.add(event.id);
      assert(event.error && typeof event.error.message === 'string');
      result.failures.push({ id: event.id, reason: 'recorded-request-failure', error: event.error });
      continue;
    }
    assert.equal(event.event, 'response'); assert(!responses.has(event.id) && !failed.has(event.id));
    assert(Number.isSafeInteger(event.status) && event.status >= 100 && event.status <= 599);
    assert(Number.isSafeInteger(event.bytes) && event.bytes >= 0);
    assert(Number.isFinite(event.elapsedMs) && event.elapsedMs >= 0);
    responses.add(event.id);
    const request = requests.get(event.id), raw = await readBody(event.id);
    assert(Buffer.isBuffer(raw) && raw.length <= 2 * 1024 * 1024, 'Invalid retained response body.');
    const value = JSON.parse(raw.toString('utf8'));
    const redacted = request.route === '/session';
    if (redacted) assert(value.token === '[removed-session-token]', 'Session payload was not redacted.');
    else assert.equal(raw.length, event.bytes, 'Retained HTTP body length differs from its response event.');
    const limits = [];
    if (request.method === 'GET' && review.test(request.route)) limits.push(['bytes', 'reviewResponseBytes']);
    if (request.method === 'GET' && ready.test(request.route) || request.method === 'POST' && request.route === '/question-preparations') {
      limits.push(['bytes', 'readyStatusResponseBytes']);
      if (request.method === 'GET') limits.push(['elapsedMs', 'readyStatusHttpMs']);
    }
    if (request.method === 'GET' && saved.test(request.route) || request.method === 'POST' && request.route === '/prepared-answers') {
      limits.push(['bytes', 'answerResponseBytes']);
      if (request.method === 'GET') limits.push(['elapsedMs', 'savedAnswerHttpMs']);
    }
    if (request.method === 'GET' && request.route === '/answers') limits.push(['bytes', 'answerListResponseBytes'], ['elapsedMs', 'answerListHttpMs']);
    const checks = limits.map(([field, name]) => ({ name, value: event[field], limit: thresholds[name], withinLimit: event[field] <= thresholds[name] }));
    const expectation = expected.get(event.id);
    const expectedOutcome = Boolean(expectation && request.route === expectation.route && request.method === expectation.method
      && event.status === expectation.status && value?.error?.code === expectation.errorCode);
    if (expectedOutcome) matched.add(event.id);
    else if (expectation) result.failures.push({ id: event.id, reason: 'expected-outcome-mismatch', expected: expectation });
    result.observations.push({ id: event.id, route: request.route, method: request.method, status: event.status, expectedOutcome,
      bytes: event.bytes, retainedBytes: raw.length, rawSha256: hash(raw), redacted, elapsedMs: event.elapsedMs, checks });
    if (!expectedOutcome && (event.status < 200 || event.status >= 300)) result.failures.push({ id: event.id, reason: 'non-success-response', status: event.status });
  }
  for (const id of requests.keys()) if (!responses.has(id)) result.incomplete.push({ id, reason: failed.has(id) ? 'request-failed-before-response' : 'missing-terminal-response' });
  for (const id of expected.keys()) if (!responses.has(id)) result.incomplete.push({ id, reason: 'missing-expected-outcome' });
  result.matchedExpectedOutcomes = [...matched];
  const checks = result.observations.flatMap(row => row.checks);
  result.coveredLimits = [...new Set(checks.map(row => row.name))];
  if (checks.length === 0) result.incomplete.push({ reason: 'no-covered-response-limit' });
  result.status = result.incomplete.length ? 'incomplete' : lane !== 'resource' ? 'observed'
    : result.failures.length || checks.some(row => !row.withinLimit) ? 'failed' : 'passed';
  return result;
}

export async function assessRecordedHttp({ directory, processDirectory, lane, expectedNonSuccess = [] }) {
  for (const target of [directory, processDirectory]) assert(path.isAbsolute(target) && await realpath(target) === target);
  const processBytes = await readFile(path.join(processDirectory, 'process.json'));
  const processRecord = JSON.parse(processBytes);
  for (const flag of ['controlled', 'fault', 'accounting']) assert.equal(typeof processRecord[flag], 'boolean');
  assert(!(processRecord.fault && processRecord.accounting));
  const actualLane = processRecord.fault ? 'fault' : processRecord.accounting ? 'accounting' : 'resource';
  assert.equal(lane, actualLane, 'Declared lane differs from the retained process setup.');
  const exitBytes = await readFile(path.join(processDirectory, 'exit.json')), exit = JSON.parse(exitBytes);
  if (lane === 'resource') assert(exit.code === 0 && exit.signal === null && exit.spawnError === null, 'Resource HTTP requires a normal retained daemon exit.');
  const journal = path.join(directory, 'requests.jsonl');
  assert.equal(await realpath(journal), journal);
  const raw = await readFile(journal, 'utf8');
  assert(raw.endsWith('\n'), 'Truncated HTTP journal.');
  const result = await assessHttpRecords({ lane, expectedNonSuccess, events: raw.trimEnd().split('\n').map(JSON.parse), readBody: async id => {
    const file = path.join(directory, id + '.json'); assert.equal(await realpath(file), file);
    const info = await stat(file); assert(info.isFile() && info.size <= 2 * 1024 * 1024);
    return readFile(file);
  } });
  return { ...result, journalSha256: hash(raw), processRecordSha256: hash(processBytes), exitSha256: hash(exitBytes) };
}
