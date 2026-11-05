// Offline only: preserve original browser observations and earlier assessor outcomes.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { inventory, save, normalized } from './io.mjs';
import { assessRecordedBrowser } from './browser-assess.mjs';

const [output, input] = process.argv.slice(2);
assert(process.argv.length === 4 && [output, input].every(value => path.isAbsolute(value ?? '') && path.resolve(value) === value));
await mkdir(output);
const report = { input, errors: [], cases: [], newBrowserRuns: 0, modelCalls: 0, reservedFamilyReads: 0, resourceQualification: false };
const before = await inventory(input, { recordSymlinks: true });
try {
  for (const rows of [20, 64]) {
    const directory = path.join(input, 'run/history-' + rows);
    const assessment = await assessRecordedBrowser({ directory: path.join(directory, 'browser'), processDirectory: path.join(directory, 'daemon'), lane: 'resource' });
    report.cases.push({ rows, assessment }); if (assessment.status !== 'passed') process.exitCode = 1;
  }
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  try { assert.deepEqual(await inventory(input, { recordSymlinks: true }), before); report.rawInputUnchanged = true; }
  catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'result.json'), report);
}
console.log(JSON.stringify({ errors: report.errors, cases: report.cases.map(row => ({ rows: row.rows, status: row.assessment.status,
  failedChecks: row.assessment.checks.filter(check => !check.passed) })), newBrowserRuns: 0, resourceQualification: false }, null, 2));
