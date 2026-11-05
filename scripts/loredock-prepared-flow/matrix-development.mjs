// One fixed ordinary R01-R15 run under the external owner. Never execute a reserved family here.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { save, normalized } from './io.mjs';
import { coordinateOrdinary } from './coordinator.mjs';
import { matrixCases } from './matrix-cases.mjs';
import { family, claimPath, catalogRoots, workingRows, definition } from './matrix-development-inputs.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
assert.equal(path.basename(output), 'run'); await mkdir(output);
const report = { errors: [], resourceQualification: false, modelEligibility: false, modelCalls: 0, reservedFamilyReads: 0 };
try {
  await save(path.join(output, 'plan.json'), { family, claimPath, catalogRoots, workingRows, ordinaryOnly: true,
    representativeFiles: 12, representativeSources: 4, nearLimitFiles: 10000, nearLimitSources: 20,
    warmRepetitions: 3, oracleCases: definition.oracles.map(row => row.id),
    continuation: 'Only known completed-analysis failures and measured threshold/source-assessment failures may continue after normal teardown. Functional checkpoint handoffs are explicitly revalidated; they do not erase resource failures.' });
  report.matrix = await coordinateOrdinary({ directory: path.join(output, 'matrix'), family, claimPath,
    cases: matrixCases({ ownerOutput: path.dirname(output), catalogRoots, workingRows, ...definition }) });
  if (!report.matrix.allCasesPassed) process.exitCode = 1;
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally { await save(path.join(output, 'result.json'), report); }
console.log(JSON.stringify({ errors: report.errors, cases: report.matrix?.cases.map(row => ({ id: row.id, status: row.status,
  reason: row.reason, details: row.details })), resourceQualification: false, modelEligibility: false, modelCalls: 0, reservedFamilyReads: 0 }, null, 2));
