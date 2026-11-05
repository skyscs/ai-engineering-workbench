// Ordinary R12/R13 subset, reusing actual stopped history and cold inputs without new generation.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { save, inventory, journal, normalized } from './io.mjs';
import { originalFault, pendingPurgeRecovery } from './catalog-fault-cases.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const log = journal(path.join(output, 'sequence.jsonl'));
const report = { errors: [], cases: [], modelCalls: 0, reservedFamilyReads: 0, resourceQualification: false };
try {
  log.append({ event: 'started', declaredOrder: ['pending-purge', 'original-missing', 'original-corrupt'] });
  const base = JSON.parse(await readFile('/home/toshiba/aew/task128-inventory-eviction-first/run/base/result.json', 'utf8')).checkpoint;
  const history = JSON.parse(await readFile('/home/toshiba/aew/task128-ordered-history-second/run/capacity/checkpoint-64.json', 'utf8'));
  const question = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
  await save(path.join(output, 'inputs.json'), { base, history, question, sourceName: 'z-independent-notes' });
  const cases = [['pending-purge', () => pendingPurgeRecovery({ directory: path.join(output, 'pending-purge'), checkpoint: history, sourceName: 'z-independent-notes' })],
    ...['missing', 'corrupt'].map(kind => ['original-' + kind, () => originalFault({ directory: path.join(output, 'original-' + kind), checkpoint: base, question, kind })])];
  for (const [id, execute] of cases) {
    log.append({ event: 'case-started', id }); const value = await execute();
    report.cases.push({ id, value }); log.append({ event: 'case-finished', id, errors: value.errors });
    assert.deepEqual(value.errors, [], 'The case failed; complete partial output is retained.');
  }
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  await save(path.join(output, 'retained-tree.json'), await inventory(output));
  await save(path.join(output, 'result.json'), report);
  log.append({ event: 'finished', failed: Boolean(process.exitCode) }); log.close();
}
console.log(JSON.stringify({ errors: report.errors, completedCases: report.cases.map(row => row.id), resourceQualification: false }, null, 2));
