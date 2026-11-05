// Ordinary R08 subset; later review/scope faults are separate cases.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, save, inventory, journal, normalized } from './io.mjs';
import { coldCatalog } from './cold-warm-cases.mjs';
import { lostAdmissionResponse, lateReviewAfterQuestionEdit } from './network-cases.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const log = journal(path.join(output, 'sequence.jsonl'));
const report = { errors: [], cases: [], modelCalls: 0, reservedFamilyReads: 0, resourceQualification: false };
async function run(id, operation) {
  log.append({ event: 'case-started', id });
  const value = await operation(); report.cases.push({ id, value });
  log.append({ event: 'case-finished', id, errors: value.errors });
  assert.deepEqual(value.errors, [], 'The case failed; complete partial output is retained.'); return value;
}
try {
  log.append({ event: 'started', declaredOrder: ['cold-base', 'lost-admission', 'question-edit'] });
  const corpus = corpusFactory();
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const sources = await materialize(path.join(output, 'sources'), corpus);
  await save(path.join(output, 'sources.json'), sources);
  const question = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
  const base = await run('cold-base', () => coldCatalog({ directory: path.join(output, 'base'), sources, question,
    expectedFiles: 12, expectedCodeFiles: 5, assessment: { corpus, sources, expected: { prepared: 'native-required', native: {
      sources: ['a-permit-ui', 'b-permit-api', 'c-permit-store'], requiredEdgeKinds: ['http-target', 'event-delivery', 'dispatch-candidate'], topic: 'permit.granted.v3' } } } }));
  await run('lost-admission', () => lostAdmissionResponse({ directory: path.join(output, 'lost-admission'), checkpoint: base.checkpoint, question }));
  await run('question-edit', () => lateReviewAfterQuestionEdit({ directory: path.join(output, 'question-edit'), checkpoint: base.checkpoint,
    question, changedQuestion: 'A different question while the previous response is held' }));
  report.baseMetricFailures = base.daemon.checks.filter(row => !row.passed);
  if (report.baseMetricFailures.length) process.exitCode = 1;
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  await save(path.join(output, 'retained-tree.json'), await inventory(output, { recordSymlinks: true }));
  await save(path.join(output, 'result.json'), report);
  log.append({ event: 'finished', failed: Boolean(process.exitCode) }); log.close();
}
console.log(JSON.stringify({ errors: report.errors, completedCases: report.cases.map(row => row.id),
  baseMetricFailures: report.baseMetricFailures, resourceQualification: false }, null, 2));
