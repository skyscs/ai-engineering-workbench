// Supplemental offline evidence only. Never rerun or rewrite the consumed ordinary matrix.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { inventory, save, hash, normalized } from './io.mjs';
import { inspectWitnessCatalog } from './content-assess.mjs';
import { assessLifetimes } from './lifetime-assess.mjs';
import { resourceCaseOrder } from './coordinator.mjs';

const output = process.argv[2], source = '/home/toshiba/aew/task128-matrix-first';
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
assert(!output.startsWith(source + path.sep)); await mkdir(output);
const report = { errors: [], candidatePreparations: 0, controlledCalls: 0, modelCalls: 0,
  reservedFamilyReads: 0, resourceQualification: false, modelEligibility: false };
const json = async file => JSON.parse(await readFile(file, 'utf8'));
let before;
try {
  before = await inventory(source, { recordSymlinks: true });
  await save(path.join(output, 'input-inventory.json'), before);
  const root = path.join(source, 'run/matrix'), matrix = await json(path.join(root, 'result.json'));
  assert.equal(matrix.family, 'ordinary-matrix-integration-01'); assert.equal(matrix.allCasesPassed, false);
  assert.equal(matrix.modelEligibility, false); assert.deepEqual(matrix.errors, []);
  assert.deepEqual(matrix.cases.map(row => row.id), resourceCaseOrder);
  for (const row of matrix.cases) for (const artifact of row.artifacts ?? []) {
    const raw = await readFile(path.join(root, row.id, artifact.path));
    assert.equal(raw.length, artifact.bytes); assert.equal(hash(raw), artifact.sha256);
  }
  report.originalOutcomes = matrix.cases.map(row => ({ id: row.id, status: row.status }));
  report.originalResultSha256 = before['run/matrix/result.json'].sha256;
  const cold = await json(path.join(root, 'R01-representative-cold/cold/result.json'));
  const warm = await json(path.join(root, 'R03-fixed-warm-flow/representative/result.json'));
  const diagnostic = await json(path.join(root, 'R15-accounting/representative-worker/result.json'));
  const reviews = [{ name: 'R01-cold', review: cold.prepared.review },
    ...warm.repetitions.map(row => ({ name: 'R03-warm-' + row.repetition, review: row.prepared.review }))];
  // Use original retained browser response bytes, not the parsed convenience copy.
  const browser = path.join(root, 'R06-expiry/expiry/browser');
  const events = (await readFile(path.join(browser, 'events.jsonl'), 'utf8')).trimEnd().split('\n').map(JSON.parse);
  const expiry = new Map();
  for (const row of events.filter(row => row.event === 'api-body' && !row.redacted)) {
    assert.match(row.file, /^raw-response-[a-f0-9]{64}\.json$/);
    const raw = await readFile(path.join(browser, row.file));
    assert.equal(raw.length, row.bytes); assert.equal(hash(raw), row.rawSha256);
    const body = JSON.parse(raw.toString('utf8'));
    if (body.status === 'ready' && body.context) {
      if (expiry.has(body.id)) assert.deepEqual(expiry.get(body.id), body);
      expiry.set(body.id, body);
    }
  }
  assert.equal(expiry.size, 1); reviews.push({ name: 'R06-unadmitted-expiry', review: [...expiry.values()][0] });
  const oracleCase = await json(path.join(root, 'R14-oracle-preconditions/case-assessment.json'));
  assert.equal(oracleCase.steps.length, 10);
  for (const step of oracleCase.steps) {
    assert.match(step.result, /^D\d{2}-[a-z-]+\/case\/result\.json$/);
    const value = await json(path.join(root, 'R14-oracle-preconditions', step.result));
    assert.deepEqual(value.errors, []); assert.equal(value.preparations, 1);
    reviews.push({ name: 'R14-' + value.id, review: value.review });
  }
  const data = path.join(root, 'R03-fixed-warm-flow/representative/data');
  const checkpoint = { data, files: await inventory(data), kind: 'stopped-ordinary-warm', lane: 'resource' };
  report.content = await inspectWitnessCatalog({ directory: path.join(output, 'content'), checkpoint,
    expectedRows: 3, reviews, allowUnmatchedReviews: true });
  assert.deepEqual(report.content.errors, []); assert.equal(report.content.inputUnchanged, true);
  report.lifetime = assessLifetimes({ cold, warm, diagnostic });
  assert.deepEqual(report.lifetime, await json(path.join(root, 'R15-accounting/representative-lifetime.json')));
  report.scope = 'Exact R01/R03 content matches against one declared warm catalog, unmatched R06/R14 observations, and existing R15 enclosing lifetime bounds. No other case or missing operation work is credited.';
  report.coverage = { bound: report.content.boundReviews.filter(row => row.status !== 'incomplete').map(row => row.name),
    unmatched: report.content.boundReviews.filter(row => row.status === 'incomplete').map(row => row.name),
    missingNearLimit: ['cold checkpoint', 'three warm flows', 'worker accounting', 'history and list accounting'],
    operationWorkComplete: false, privateBoundaryCoverageComplete: false, transientOwnershipProven: false };
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  try { assert(before); assert.deepEqual(await inventory(source, { recordSymlinks: true }), before); report.originalInputsUnchanged = true; }
  catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'result.json'), report);
}
console.log(JSON.stringify({ errors: report.errors, coverage: report.coverage, lifetimeStatus: report.lifetime?.status,
  originalInputsUnchanged: report.originalInputsUnchanged, candidatePreparations: 0, controlledCalls: 0,
  modelCalls: 0, reservedFamilyReads: 0, resourceQualification: false, modelEligibility: false }, null, 2));
