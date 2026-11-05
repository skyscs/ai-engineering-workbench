// Offline ordinary content bounds over copied retained catalogs; zero new candidate activity.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { inventory, save, normalized, journal } from './io.mjs';
import { inspectWitnessCatalog } from './content-assess.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const log = journal(path.join(output, 'sequence.jsonl'));
const report = { errors: [], cases: [], candidatePreparations: 0, controlledCalls: 0, modelCalls: 0, reservedFamilyReads: 0, resourceQualification: false };
const json = async file => JSON.parse(await readFile(file, 'utf8'));
try {
  log.append({ event: 'started', declaredOrder: ['warm-reference', 'history-20', 'history-64', 'purged-64'] });
  const warmRoot = '/home/toshiba/aew/task128-worker-accounting-case-first/run';
  const cold = await json(warmRoot + '/cold/result.json'), warm = await json(warmRoot + '/warm/result.json');
  const warmData = warmRoot + '/warm/data', purgedData = '/home/toshiba/aew/task128-catalog-faults-first/run/pending-purge/data';
  const cases = [{ id: 'warm-reference', checkpoint: { data: warmData, files: await inventory(warmData) }, expectedRows: 3,
    reviews: [{ name: 'cold', review: cold.prepared.review }, ...warm.repetitions.map(row => ({ name: 'warm-' + row.repetition, review: row.prepared.review }))] }];
  for (const rows of [20, 64]) cases.push({ id: 'history-' + rows,
    checkpoint: await json('/home/toshiba/aew/task128-ordered-history-second/run/capacity/checkpoint-' + rows + '.json'), expectedRows: rows });
  cases.push({ id: 'purged-64', checkpoint: { data: purgedData, files: await inventory(purgedData) }, expectedRows: 64 });
  for (const entry of cases) {
    log.append({ event: 'case-started', id: entry.id });
    const value = await inspectWitnessCatalog({ ...entry, directory: path.join(output, entry.id) });
    report.cases.push({ id: entry.id, value }); log.append({ event: 'case-finished', id: entry.id, errors: value.errors, status: value.assessment?.status });
    assert.deepEqual(value.errors, []); assert.equal(value.assessment.status, 'passed');
  }
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  await save(path.join(output, 'retained-tree.json'), await inventory(output)); await save(path.join(output, 'result.json'), report);
  log.append({ event: 'finished', failed: Boolean(process.exitCode) }); log.close();
}
console.log(JSON.stringify({ errors: report.errors, cases: report.cases.map(row => ({ id: row.id, status: row.value.assessment?.status,
  rows: row.value.assessment?.rows, purged: row.value.assessment?.purged, totalBytes: row.value.assessment?.totalBytes })), candidatePreparations: 0, resourceQualification: false }, null, 2));
