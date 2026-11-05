// Ordinary R11 validator subset. Each public mutation/fault uses a separate stopped copy.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { save, inventory, journal, normalized } from './io.mjs';
import { alternativeBuildCheckpoint, validatorBoundary } from './validator-cases.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const log = journal(path.join(output, 'sequence.jsonl'));
const report = { errors: [], cases: [], modelCalls: 0, reservedFamilyReads: 0, resourceQualification: false };
try {
  const base = JSON.parse(await readFile('/home/toshiba/aew/task128-inventory-eviction-first/run/base/result.json', 'utf8')).checkpoint;
  const question = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
  const boundaries = ['first-preflight', 'before-dispatch', 'before-publication'], kinds = ['review', 'policy', 'published-build'];
  log.append({ event: 'started', declaredOrder: ['alternative-build', ...boundaries.flatMap(boundary => kinds.map(kind => boundary + '-' + kind))] });
  await save(path.join(output, 'inputs.json'), { base, question });
  log.append({ event: 'case-started', id: 'alternative-build' });
  const alternative = await alternativeBuildCheckpoint({ directory: path.join(output, 'alternative-build'), checkpoint: base });
  report.cases.push({ id: 'alternative-build', value: alternative }); assert.deepEqual(alternative.errors, []);
  for (const boundary of boundaries) for (const kind of kinds) {
    const id = boundary + '-' + kind; log.append({ event: 'case-started', id });
    const value = await validatorBoundary({ directory: path.join(output, id), question, kind, boundary,
      checkpoint: kind === 'published-build' ? alternative.checkpoint : base });
    report.cases.push({ id, value }); log.append({ event: 'case-finished', id, errors: value.errors, observedBoundary: value.observedBoundary });
    assert.deepEqual(value.errors, [], 'The case failed; complete partial output is retained.');
    // A known missed first-preflight race remains incomplete; independent fixed cases still run once.
    if (!value.observedBoundary) process.exitCode = 1;
  }
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  await save(path.join(output, 'retained-tree.json'), await inventory(output));
  await save(path.join(output, 'result.json'), report);
  log.append({ event: 'finished', failed: Boolean(process.exitCode) }); log.close();
}
console.log(JSON.stringify({ errors: report.errors, outcomes: report.cases.map(row => ({ id: row.id, observedBoundary: row.value.observedBoundary })), resourceQualification: false }, null, 2));
