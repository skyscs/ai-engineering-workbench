// Fixed ordinary R14 cases; every actual preparation is retained, including the failed native positive.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { materialize, save, inventory, normalized, journal } from './io.mjs';
import { ordinaryCorpus, ordinaryCases, ordinaryReferences, ordinaryNote } from './ordinary-oracles.mjs';
import { oracleCase } from './oracle-case.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const log = journal(path.join(output, 'sequence.jsonl'));
const report = { errors: [], cases: [], modelCalls: 0, reservedFamilyReads: 0, resourceQualification: false };
try {
  log.append({ event: 'started', declaredOrder: ordinaryCases.map(row => row.id), preparationsEach: 1 });
  for (const expected of ordinaryCases) {
    const directory = path.join(output, expected.id); await mkdir(directory);
    const corpus = ordinaryCorpus(expected.variant), sources = await materialize(path.join(directory, 'sources'), corpus);
    await save(path.join(directory, 'sources.json'), sources);
    log.append({ event: 'case-started', id: expected.id });
    const value = await oracleCase({ directory: path.join(directory, 'case'), corpus, sources, expected,
      references: ordinaryReferences, engineerNote: ordinaryNote, noteTarget: { kind: 'http-target',
        from: { source: 'a-permit-ui', path: 'ui/request.ts' }, to: { source: 'b-permit-api', path: 'routes.json' }, requiredOriginals: ['request', 'header'] } });
    report.cases.push(value); log.append({ event: 'case-finished', id: expected.id, errors: value.errors, assessmentErrors: value.assessmentErrors });
    assert.deepEqual(value.errors, [], 'Unknown setup/lifecycle failure stops the remaining cases.');
    assert.equal(value.preparations, 1);
    // Only known independent assertion failures may continue; every such positive still fails the run.
    for (const error of value.assessmentErrors) assert.equal(error.code, 'ERR_ASSERTION');
    if (!value.passed) process.exitCode = 1;
  }
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  report.notRun = ordinaryCases.filter(row => !report.cases.some(value => value.id === row.id)).map(row => row.id);
  await save(path.join(output, 'retained-tree.json'), await inventory(output));
  await save(path.join(output, 'result.json'), report);
  log.append({ event: 'finished', failed: Boolean(process.exitCode) }); log.close();
}
console.log(JSON.stringify({ errors: report.errors, notRun: report.notRun, cases: report.cases.map(row => ({
  id: row.id, preparations: row.preparations, passed: row.passed, errors: row.errors, assessmentErrors: row.assessmentErrors })), resourceQualification: false }, null, 2));
