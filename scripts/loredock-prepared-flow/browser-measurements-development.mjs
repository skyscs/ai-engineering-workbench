// Reuse actual ordinary 20/64-row checkpoints; no new admission, reference generation or model.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { save, inventory, journal, normalized } from './io.mjs';
import { browserHistory } from './history-cases.mjs';
import { assessRecordedBrowser } from './browser-assess.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const log = journal(path.join(output, 'sequence.jsonl'));
const report = { errors: [], cases: [], modelCalls: 0, reservedFamilyReads: 0, resourceQualification: false };
try {
  log.append({ event: 'started', declaredOrder: [20, 64], idleMsEach: 30000 });
  for (const rows of [20, 64]) {
    const checkpoint = JSON.parse(await readFile('/home/toshiba/aew/task128-ordered-history-second/run/capacity/checkpoint-' + rows + '.json', 'utf8'));
    const directory = path.join(output, 'history-' + rows);
    log.append({ event: 'case-started', rows });
    const value = await browserHistory({ checkpoint, directory });
    const assessment = await assessRecordedBrowser({ directory: path.join(directory, 'browser'), processDirectory: path.join(directory, 'daemon'), lane: 'resource' });
    await save(path.join(directory, 'browser-assessment.json'), assessment);
    report.cases.push({ rows, value, assessment }); log.append({ event: 'case-finished', rows, status: assessment.status });
    if (assessment.status !== 'passed') process.exitCode = 1;
  }
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  await save(path.join(output, 'retained-tree.json'), await inventory(output, { recordSymlinks: true }));
  await save(path.join(output, 'result.json'), report);
  log.append({ event: 'finished', failed: Boolean(process.exitCode) }); log.close();
}
console.log(JSON.stringify({ errors: report.errors, cases: report.cases.map(row => ({ rows: row.rows, status: row.assessment.status,
  failedChecks: row.assessment.checks.filter(check => !check.passed), incomplete: row.assessment.incomplete })), resourceQualification: false }, null, 2));
