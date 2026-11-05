// Fixed ordinary HTTP outcomes: two actual reopens and one offline quota observation.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { hash, inventory, journal, normalized, save } from './io.mjs';
import { reopenHistory } from './history-cases.mjs';
import { assessRecordedHttp } from './http-assess.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const log = journal(path.join(output, 'sequence.jsonl'));
const report = { errors: [], cases: [], newAnswerAdmissions: 0, modelCalls: 0, reservedFamilyReads: 0, resourceQualification: false };
const history = '/home/toshiba/aew/task128-ordered-history-second/run/capacity';
const json = async file => JSON.parse(await readFile(file, 'utf8'));
try {
  log.append({ event: 'started', declaredOrder: ['restart-20', 'restart-64', 'retained-quota'] });
  for (const rows of [20, 64]) {
    const id = 'restart-' + rows, directory = path.join(output, id);
    const checkpoint = await json(history + '/checkpoint-' + rows + '.json');
    log.append({ event: 'case-started', id });
    const value = await reopenHistory({ checkpoint, directory });
    const missing = value.observation.missingTransient;
    const expectedNonSuccess = [{ id: missing.id, route: '/question-preparations/' + checkpoint.readyId,
      method: 'GET', status: 409, errorCode: 'QUESTION_NOT_FOUND' }];
    await save(path.join(directory, 'expected-http-outcomes.json'), expectedNonSuccess);
    const before = await inventory(directory);
    const assessment = await assessRecordedHttp({ directory: path.join(directory, 'http'),
      processDirectory: path.join(directory, 'daemon'), lane: 'resource', expectedNonSuccess });
    assert.deepEqual(await inventory(directory), before);
    const response = assessment.observations.find(row => row.id === missing.id);
    assert.equal(response.rawSha256, missing.rawSha256); assert.equal(response.bytes, missing.bytes);
    assert.deepEqual(assessment.matchedExpectedOutcomes, [missing.id]);
    report.cases.push({ id, value, assessment });
    await save(path.join(directory, 'http-assessment.json'), assessment);
    log.append({ event: 'case-finished', id, status: assessment.status });
  }
  const directory = history + '/http-controlled-continuation', processDirectory = history + '/controlled-continuation';
  const expectedNonSuccess = [{ id: '00404', route: '/prepared-answers', method: 'POST', status: 409, errorCode: 'ANSWER_WITNESS_LIMIT' }];
  const before = { http: await inventory(directory), process: await inventory(processDirectory) };
  const rawReference = await readFile(history + '/result.json'), reference = JSON.parse(rawReference);
  await save(path.join(output, 'retained-quota-input.json'), { directory, processDirectory, expectedNonSuccess,
    before, referenceSha256: hash(rawReference), refusal: reference.refusal });
  log.append({ event: 'case-started', id: 'retained-quota' });
  const assessment = await assessRecordedHttp({ directory, processDirectory, lane: 'resource', expectedNonSuccess });
  assert.deepEqual({ http: await inventory(directory), process: await inventory(processDirectory) }, before);
  assert.equal(hash(await readFile(history + '/result.json')), hash(rawReference));
  const quota = assessment.observations.find(row => row.id === '00404');
  assert.equal(quota.rawSha256, reference.refusal.response.rawSha256); assert.equal(quota.bytes, reference.refusal.response.bytes);
  const request = (await readFile(directory + '/requests.jsonl', 'utf8')).trimEnd().split('\n').map(JSON.parse)
    .find(row => row.event === 'request' && row.id === '00404');
  assert.equal(request.body.requestId, 'owned-history-over-capacity');
  assert.deepEqual(assessment.matchedExpectedOutcomes, ['00404']);
  report.cases.push({ id: 'retained-quota', assessment, rawInputsUnchanged: true });
  await save(path.join(output, 'retained-quota-assessment.json'), assessment);
  log.append({ event: 'case-finished', id: 'retained-quota', status: assessment.status });
  if (report.cases.some(row => row.assessment.status !== 'passed')) process.exitCode = 1;
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  await save(path.join(output, 'result.json'), report);
  log.append({ event: 'finished', failed: Boolean(process.exitCode) }); log.close();
}
console.log(JSON.stringify({ errors: report.errors, cases: report.cases.map(row => ({ id: row.id,
  status: row.assessment.status, expected: row.assessment.matchedExpectedOutcomes,
  failures: row.assessment.failures, incomplete: row.assessment.incomplete,
  failedLimits: row.assessment.observations.flatMap(response => response.checks.filter(check => !check.withinLimit)) })),
  newAnswerAdmissions: 0, modelCalls: 0, reservedFamilyReads: 0, resourceQualification: false }, null, 2));
