// Fixed ordinary permit sizes. This is not the reserved matrix or a qualification.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, save, inventory, journal, normalized } from './io.mjs';
import { coldCatalog, warmCatalog } from './cold-warm-cases.mjs';

const output = process.argv[2], unscaled = process.argv[3] === '--unscaled-control';
assert(process.argv.length === (unscaled ? 4 : 3) && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const sizes = unscaled ? [12] : [240, 10000], declaredCases = ['cold', 'warm'].flatMap(kind => sizes.map(size => kind + '-' + size));
const report = { errors: [], cases: [], declaredCases, control: unscaled ? 'original-four-source-control' : 'twenty-source-sparse-scaling',
  modelCalls: 0, reservedFamilyReads: 0, resourceQualification: false };
const log = journal(path.join(output, 'sequence.jsonl'));
const inputs = [], question = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
try {
  log.append({ event: 'started', sizes, sourcesEach: unscaled ? 4 : 20, warmRepetitionsEach: 3 });
  for (const total of sizes) {
    const directory = path.join(output, 'input-' + total); await mkdir(directory);
    const corpus = corpusFactory();
    for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
    if (!unscaled) {
      for (let i = 1; i <= 16; i++) corpus['m-padding-' + String(i).padStart(2, '0')] = { 'README.md': '# Ordinary padding\n' };
      for (const files of Object.values(corpus)) for (let i = Object.keys(files).length; i < total / 20; i++)
        files['padding/constant-' + String(i).padStart(4, '0') + '.ts'] = 'export const padding' + i + ' = 1;\n';
    }
    const sources = await materialize(path.join(directory, 'sources'), corpus);
    await save(path.join(directory, 'sources.json'), sources);
    const expectedCodeFiles = sources.originals.filter(row => /\.(java|js|ts|vue)$/.test(row.path)).length;
    assert.equal(sources.originals.length, total); assert.equal(sources.paths.length, unscaled ? 4 : 20);
    const assessment = { corpus, sources, expected: { prepared: 'native-required', native: {
      sources: ['a-permit-ui', 'b-permit-api', 'c-permit-store'], requiredEdgeKinds: ['http-target', 'event-delivery', 'dispatch-candidate'], topic: 'permit.granted.v3' } } };
    inputs.push({ total, sources, assessment, expectedCodeFiles });
  }
  // Both cold observations precede any warm lifetime. No selection of the best repeat.
  for (const input of inputs) {
    const id = 'cold-' + input.total; log.append({ event: 'case-started', id });
    const value = await coldCatalog({ directory: path.join(output, id), ...input, question, expectedFiles: input.total });
    report.cases.push({ id, value }); log.append({ event: 'case-finished', id, errors: value.errors });
    assert.deepEqual(value.errors, [], 'Cold functional prerequisites failed; remaining work is not retried.');
    input.checkpoint = value.checkpoint;
  }
  for (const input of inputs) {
    const id = 'warm-' + input.total; log.append({ event: 'case-started', id });
    const value = await warmCatalog({ directory: path.join(output, id), ...input, question });
    report.cases.push({ id, value }); log.append({ event: 'case-finished', id, errors: value.errors });
    assert.deepEqual(value.errors, [], 'Warm functional prerequisites failed; remaining work is not retried.');
  }
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  report.daemonMetricFailures = report.cases.flatMap(row => (row.value.daemon?.checks ?? []).filter(check => !check.passed).map(check => ({ id: row.id, ...check })));
  if (report.daemonMetricFailures.length) process.exitCode = 1;
  report.notRun = declaredCases.filter(id => !report.cases.some(row => row.id === id)).map(id => ({ id, reason: 'earlier-functional-failure' }));
  await save(path.join(output, 'retained-tree.json'), await inventory(output));
  await save(path.join(output, 'result.json'), report);
  log.append({ event: 'finished', failed: Boolean(process.exitCode) }); log.close();
}
console.log(JSON.stringify({ errors: report.errors, cases: report.cases.map(row => row.id),
  daemonMetricFailures: report.daemonMetricFailures, resourceQualification: false }, null, 2));
