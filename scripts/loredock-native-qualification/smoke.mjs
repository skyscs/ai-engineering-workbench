import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNativeQualification } from './coordinator.mjs';
import { configuration } from './development.mjs';
assert.equal(process.argv.length, 3, 'Provide one fresh absolute development-output directory.');
const output = process.argv[2]; assert.ok(path.isAbsolute(output) && path.resolve(output) === output); await mkdir(output);
const cases = [];
for (const caseId of [0, 1]) {
  const report = await runNativeQualification({ output: path.join(output, caseId ? 'incomplete' : 'complete'), config: configuration(caseId), caseId,
    configuration: fileURLToPath(new URL('./development.mjs', import.meta.url)) });
  cases.push({ caseId, ...report.summary, processes: report.processes.map(row => ({ pid: row.pid, exit: row.exit, signal: row.signal })),
    resourceFailures: report.arms.flatMap(arm => arm.assessment.observations).filter(row => row.resource.state !== 'pass').length });
}
const result = { schemaVersion: 'native-driver-development-smoke/1', node: process.version, modelRequests: 0, resourceQualification: false,
  functionalFailed: cases.some(row => row.functionalFailed), cases };
await writeFile(path.join(output, 'smoke.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
process.exitCode = result.functionalFailed ? 1 : 0;
