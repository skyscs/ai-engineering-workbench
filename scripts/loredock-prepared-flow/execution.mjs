// One sealed reserved sequence. Application imports occur only after the durable started record.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { save, normalized } from './io.mjs';
import { coordinateReserved, resourceCaseOrder } from './coordinator.mjs';
import { family, ownerOutput, claimPath, catalogRoots, workingRows, definition, executionPlan } from './execution-inputs.mjs';

const [output, manifestPath] = process.argv.slice(2);
assert.equal(process.argv.length, 4); assert.equal(output, path.join(ownerOutput, 'run'));
assert(path.isAbsolute(manifestPath ?? '') && path.resolve(manifestPath) === manifestPath);
await mkdir(output);
const report = { errors: [], resourceQualification: false, modelEligibility: false, modelCalls: 0,
  reservedFamily: family, reservedFamilyReads: null, familyConsumed: null };
let handlers;
try {
  await save(path.join(output, 'plan.json'), executionPlan);
  const cases = resourceCaseOrder.map((id, index) => ({ id, requires: [], independentAfterFailure: true, run: async args => {
    // The coordinator has already exclusively claimed the family and fsynced started.
    handlers ??= (await import('./matrix-cases.mjs')).matrixCases({ ownerOutput, catalogRoots, workingRows, ...definition });
    assert.deepEqual(handlers.map(row => row.id), resourceCaseOrder);
    return handlers[index].run(args);
  } }));
  report.matrix = await coordinateReserved({ directory: path.join(output, 'matrix'), family, claimPath, cases, manifestPath });
  report.familyConsumed = true;
  if (!report.matrix.allCasesPassed) process.exitCode = 1;
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally { await save(path.join(output, 'result.json'), report); }
console.log(JSON.stringify({ ...report, matrix: report.matrix?.cases.map(row => ({ id: row.id, status: row.status, details: row.details })) }, null, 2));
