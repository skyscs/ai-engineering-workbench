// One fixed ordinary four-control diagnosis under the external owner. No answer admission or models.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { materialize, save, normalized, journal } from '../loredock-prepared-flow/io.mjs';
import { oracleCase } from '../loredock-prepared-flow/oracle-case.mjs';
import { family, controls, inputFor, catalogRoots, references, question } from './inputs.mjs';
import { observe } from './observe.mjs';

const output = process.argv[2];
assert.equal(process.argv.length, 3); assert(path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const log = journal(path.join(output, 'sequence.jsonl'));
const result = { family, cases: [], errors: [], functionalPassed: false, resourceQualification: false,
  modelEligibility: false, modelCalls: 0, reservedFamilyReads: 0 };
try {
  await save(path.join(output, 'plan.json'), { family, controls, catalogRoots, question, references,
    preparationsPerControl: 1, repeatPolicy: 'Execute each declared ordinary control once. Preserve first failures; no retries.',
    runningGuard: 'The public running-analysis guard is source-reviewed; these small terminal controls do not claim an observed active-analysis boundary.' });
  log.append({ event: 'started', family, order: controls.map(row => row.id) });
  for (const control of controls) {
    const directory = path.join(output, control.id); await mkdir(directory);
    const { corpus, expected } = inputFor(control.id), sources = await materialize(path.join(directory, 'sources'), corpus);
    await save(path.join(directory, 'sources.json'), sources);
    log.append({ event: 'case-started', id: control.id });
    const args = { directory: path.join(directory, 'case'), control, corpus, sources, expected, references, question };
    const value = control.id === 'no-analysis' ? await oracleCase(args) : await observe(args);
    result.cases.push({ id: control.id, value });
    log.append({ event: 'case-finished', id: control.id, functionalPassed: value.functionalPassed ?? value.passed, errors: value.errors });
    assert.deepEqual(value.errors, [], 'An unknown observation/teardown failure stops the remaining controls.');
    // A retained usefulness failure permits the next independent fresh control; it is never rewritten.
  }
  result.functionalPassed = result.cases.length === 4 && result.cases.every(row => row.value.functionalPassed ?? row.value.passed);
  if (!result.functionalPassed) process.exitCode = 1;
} catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  await save(path.join(output, 'result.json'), result);
  log.append({ event: 'finished', functionalPassed: result.functionalPassed, errors: result.errors,
    resourceQualification: false, modelCalls: 0, reservedFamilyReads: 0 }); log.close();
}
console.log(JSON.stringify({ ...result, cases: result.cases.map(row => ({ id: row.id, functionalPassed: row.value.functionalPassed ?? row.value.passed,
  errors: row.value.errors, assessmentErrors: row.value.assessmentErrors, assessment: row.value.assessment,
  coverage: row.value.processing, qualifications: row.value.qualifications })) }, null, 2));
