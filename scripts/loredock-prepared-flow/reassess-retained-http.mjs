// Read-only assessment of declared ordinary records; no daemon or candidate execution.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { assessRecordedHttp } from './http-assess.mjs';
import { hash, inventory, normalized, save } from './io.mjs';

const [manifest, output] = process.argv.slice(2);
assert(process.argv.length === 4);
for (const target of [manifest, output]) assert(path.isAbsolute(target ?? '') && path.resolve(target) === target);
const input = await readFile(manifest), datasets = JSON.parse(input);
assert(Array.isArray(datasets) && datasets.length > 0 && datasets.length <= 100);
assert.equal(new Set(datasets.map(row => row.id)).size, datasets.length);
for (const row of datasets) {
  assert(/^[a-z0-9-]+$/.test(row.id));
  for (const directory of [row.directory, row.processDirectory]) {
    assert(path.isAbsolute(directory) && path.resolve(directory) === directory);
    assert(output !== directory && !output.startsWith(directory + path.sep));
  }
}
await mkdir(output);
await save(path.join(output, 'inputs.json'), datasets);
const result = { manifestSha256: hash(input), cases: [], errors: [], resourceQualification: false,
  modelEligibility: false, newCandidateReads: 0, modelCalls: 0 };
for (const row of datasets) {
  const record = { id: row.id, input: row, errors: [] };
  try {
    const before = { http: await inventory(row.directory), process: await inventory(row.processDirectory) };
    await save(path.join(output, row.id + '-input-inventory.json'), before);
    try { record.assessment = await assessRecordedHttp(row); }
    finally {
      assert.deepEqual(await inventory(row.directory), before.http);
      assert.deepEqual(await inventory(row.processDirectory), before.process);
      record.rawInputsUnchanged = true;
    }
  } catch (error) { record.errors.push(normalized(error)); }
  result.cases.push(record); await save(path.join(output, row.id + '.json'), record);
}
const unsuccessful = result.cases.filter(row => row.errors.length || row.input.lane === 'resource' && row.assessment.status !== 'passed');
if (unsuccessful.length) process.exitCode = 1;
await save(path.join(output, 'result.json'), result);
console.log(JSON.stringify({ outcomes: result.cases.map(row => ({ id: row.id, errors: row.errors,
  status: row.assessment?.status, timingQualified: row.assessment?.timingQualified,
  responses: row.assessment?.observations.length, failedChecks: row.assessment?.observations.flatMap(response => response.checks.filter(check => !check.withinLimit)) })),
  resourceQualification: false, modelEligibility: false, newCandidateReads: 0, modelCalls: 0 }, null, 2));
