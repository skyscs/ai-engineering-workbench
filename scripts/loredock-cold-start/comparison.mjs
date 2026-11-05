// First ordinary comparison after direct CommonJS loading; preserve both startup and useful context.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { controls, inputFor, references, question } from '../loredock-partial-inventory/inputs.mjs';
import { observe } from '../loredock-partial-inventory/observe.mjs';
import { materialize, save, normalized, journal } from '../loredock-prepared-flow/io.mjs';

const output = process.argv[2], selected = controls.slice(0, 2);
assert.equal(process.argv.length, 3); assert(path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output); const log = journal(path.join(output, 'sequence.jsonl'));
const result = { cases: [], errors: [], functionalPassed: false, resourceQualification: false, modelCalls: 0, reservedFamilyReads: 0 };
try {
  await save(path.join(output, 'plan.json'), { order: selected.map(row => row.id),
    change: 'Load the unchanged CommonJS TypeScript compiler directly, preserving eager readiness and parser behavior.',
    repeatPolicy: 'One first production launch/preparation per declared control; no retries.',
    resourceQualification: false });
  for (const control of selected) {
    log.append({ event: 'case-started', id: control.id });
    const directory = path.join(output, control.id); await mkdir(directory);
    const { corpus, expected } = inputFor(control.id), sources = await materialize(path.join(directory, 'sources'), corpus);
    await save(path.join(directory, 'sources.json'), sources);
    const value = await observe({ directory: path.join(directory, 'case'), control, corpus, sources, expected, references, question });
    result.cases.push({ id: control.id, value });
    log.append({ event: 'case-finished', id: control.id, functionalPassed: value.functionalPassed });
    assert.deepEqual(value.errors, []);
  }
  result.functionalPassed = result.cases.length === 2 && result.cases.every(row => row.value.functionalPassed);
  if (!result.functionalPassed) process.exitCode = 1;
} catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
finally { await save(path.join(output, 'result.json'), result); log.close(); }
console.log(JSON.stringify({ ...result, cases: result.cases.map(row => ({ id: row.id,
  functionalPassed: row.value.functionalPassed, metrics: row.value.metrics, errors: row.value.errors,
  assessmentErrors: row.value.assessmentErrors })) }, null, 2));
