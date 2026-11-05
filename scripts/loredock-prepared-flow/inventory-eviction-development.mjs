// Ordinary inventory-eviction case with a fresh, explicitly resource-lane cold checkpoint.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, save, inventory, journal, normalized } from './io.mjs';
import { coldCatalog } from './cold-warm-cases.mjs';
import { inventoryEviction } from './inventory-eviction-case.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const log = journal(path.join(output, 'sequence.jsonl'));
const report = { errors: [], cases: [], modelCalls: 0, reservedFamilyReads: 0, resourceQualification: false };
try {
  log.append({ event: 'started', declaredOrder: ['cold-base', 'inventory-eviction'] });
  const corpus = corpusFactory();
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const sources = await materialize(path.join(output, 'sources'), corpus); await save(path.join(output, 'sources.json'), sources);
  const question = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
  const assessment = { corpus, sources, expected: { prepared: 'native-required', native: { sources: ['a-permit-ui', 'b-permit-api', 'c-permit-store'],
    requiredEdgeKinds: ['http-target', 'event-delivery', 'dispatch-candidate'], topic: 'permit.granted.v3' } } };
  log.append({ event: 'case-started', id: 'cold-base' });
  const base = await coldCatalog({ directory: path.join(output, 'base'), sources, question, assessment, expectedFiles: 12, expectedCodeFiles: 5 });
  report.cases.push({ id: 'cold-base', value: base }); assert.deepEqual(base.errors, []);
  log.append({ event: 'case-started', id: 'inventory-eviction' });
  const result = await inventoryEviction({ directory: path.join(output, 'eviction'), checkpoint: base.checkpoint, question, assessment });
  report.cases.push({ id: 'inventory-eviction', value: result }); assert.deepEqual(result.errors, []);
  report.baseMetricFailures = base.daemon.checks.filter(row => !row.passed);
  if (report.baseMetricFailures.length || !result.resourceSubsetPassed) process.exitCode = 1;
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  await save(path.join(output, 'retained-tree.json'), await inventory(output));
  await save(path.join(output, 'result.json'), report);
  log.append({ event: 'finished', failed: Boolean(process.exitCode) }); log.close();
}
console.log(JSON.stringify({ errors: report.errors, completedCases: report.cases.map(row => row.id),
  baseMetricFailures: report.baseMetricFailures, resourceQualification: false }, null, 2));
