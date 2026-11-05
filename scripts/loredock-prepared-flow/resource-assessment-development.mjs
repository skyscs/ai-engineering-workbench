// Actual ordinary production reopens under the externally declared catalog/storage bounds.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { save, inventory, journal, normalized } from './io.mjs';
import { reopenHistory } from './history-cases.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const log = journal(path.join(output, 'sequence.jsonl'));
const report = { errors: [], cases: [], modelCalls: 0, reservedFamilyReads: 0, resourceQualification: false };
try {
  log.append({ event: 'started', declaredOrder: [20, 64], declaredCatalogRoots: ['run/restart-20/data', 'run/restart-64/data'] });
  for (const rows of [20, 64]) {
    const checkpoint = JSON.parse(await readFile('/home/toshiba/aew/task128-ordered-history-second/run/capacity/checkpoint-' + rows + '.json', 'utf8'));
    log.append({ event: 'case-started', rows });
    const value = await reopenHistory({ checkpoint, directory: path.join(output, 'restart-' + rows) });
    report.cases.push({ rows, value }); log.append({ event: 'case-finished', rows });
  }
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  await save(path.join(output, 'retained-tree.json'), await inventory(output));
  await save(path.join(output, 'result.json'), report);
  log.append({ event: 'finished', failed: Boolean(process.exitCode) }); log.close();
}
console.log(JSON.stringify({ errors: report.errors, cases: report.cases.map(row => row.rows), resourceQualification: false }, null, 2));
