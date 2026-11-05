// Ordinary R15 extraction: fixed cold/three warm flows, then one diagnostic replay of the first.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, save, inventory, journal, normalized } from './io.mjs';
import { coldCatalog, warmCatalog } from './cold-warm-cases.mjs';
import { accountWorker } from './worker-accounting-case.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const log = journal(path.join(output, 'sequence.jsonl'));
const report = { errors: [], cases: [], modelCalls: 0, reservedFamilyReads: 0, resourceQualification: false };
try {
  log.append({ event: 'started', declaredOrder: ['cold', 'warm-three', 'diagnostic-first-reference'] });
  const corpus = corpusFactory();
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const sources = await materialize(path.join(output, 'sources'), corpus);
  await save(path.join(output, 'sources.json'), sources);
  const question = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
  const assessment = { corpus, sources, expected: { prepared: 'native-required', native: {
    sources: ['a-permit-ui', 'b-permit-api', 'c-permit-store'], requiredEdgeKinds: ['http-target', 'event-delivery', 'dispatch-candidate'], topic: 'permit.granted.v3' } } };
  async function record(id, run) {
    log.append({ event: 'case-started', id }); const value = await run();
    report.cases.push({ id, value }); log.append({ event: 'case-finished', id, errors: value.errors });
    assert.deepEqual(value.errors, [], 'Functional prerequisites failed; remaining work is not retried.'); return value;
  }
  const cold = await record('cold', () => coldCatalog({ directory: path.join(output, 'cold'), sources, question,
    assessment, expectedFiles: 12, expectedCodeFiles: 5 }));
  const common = { checkpoint: cold.checkpoint, question, assessment };
  const warm = await record('warm-three', () => warmCatalog({ directory: path.join(output, 'warm'), ...common }));
  await record('diagnostic-first-reference', () => accountWorker({ directory: path.join(output, 'accounting'), ...common,
    ordinaryReference: warm.repetitions[0] }));
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  report.daemonMetricFailures = report.cases.flatMap(row => (row.value.daemon?.checks ?? []).filter(check => !check.passed).map(check => ({ id: row.id, ...check })));
  report.workFailures = report.cases.flatMap(row => (row.value.workChecks ?? []).filter(check => !check.passed));
  if (report.daemonMetricFailures.length || report.workFailures.length) process.exitCode = 1;
  await save(path.join(output, 'retained-tree.json'), await inventory(output));
  await save(path.join(output, 'result.json'), report);
  log.append({ event: 'finished', failed: Boolean(process.exitCode) }); log.close();
}
console.log(JSON.stringify({ errors: report.errors, completedCases: report.cases.map(row => row.id),
  daemonMetricFailures: report.daemonMetricFailures, workFailures: report.workFailures, resourceQualification: false }, null, 2));
