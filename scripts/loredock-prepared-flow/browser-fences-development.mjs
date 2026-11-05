// Ordinary later browser fences, using retained inputs from the independent R08 control.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { save, inventory, journal, normalized } from './io.mjs';
import { latePreparationAfterReview, lateHistoryAfterReview, lateHistoryAfterRevocation } from './browser-fence-cases.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const log = journal(path.join(output, 'sequence.jsonl'));
const report = { errors: [], cases: [], modelCalls: 0, reservedFamilyReads: 0, resourceQualification: false };
try {
  log.append({ event: 'started', declaredOrder: ['preparation-review', 'history-review', 'history-revoke'] });
  // This ordinary entry deliberately reuses complete stopped synthetic evidence, with no new admission.
  const prior = '/home/toshiba/aew/task128-network-cases-first/run';
  const base = JSON.parse(await readFile(path.join(prior, 'base/result.json'), 'utf8')).checkpoint;
  const history = JSON.parse(await readFile(path.join(prior, 'lost-admission/history-checkpoint.json'), 'utf8'));
  const question = history.saved.value.question;
  await save(path.join(output, 'inputs.json'), { base, history, question, sourceName: 'z-independent-notes' });
  for (const [id, execute, checkpoint] of [['preparation-review', latePreparationAfterReview, base],
    ['history-review', lateHistoryAfterReview, history], ['history-revoke', lateHistoryAfterRevocation, history]]) {
    log.append({ event: 'case-started', id });
    const value = await execute({ directory: path.join(output, id), checkpoint, question, sourceName: 'z-independent-notes' });
    report.cases.push({ id, value }); log.append({ event: 'case-finished', id, errors: value.errors });
    assert.deepEqual(value.errors, [], 'The case failed; complete partial output is retained.');
  }
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  await save(path.join(output, 'retained-tree.json'), await inventory(output, { recordSymlinks: true }));
  await save(path.join(output, 'result.json'), report);
  log.append({ event: 'finished', failed: Boolean(process.exitCode) }); log.close();
}
console.log(JSON.stringify({ errors: report.errors, completedCases: report.cases.map(row => row.id), resourceQualification: false }, null, 2));
