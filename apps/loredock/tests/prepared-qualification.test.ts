import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { configuration } from './fixtures/prepared-qualification-config.js';
// @ts-expect-error Unchanged generic coordinator, no frozen resource input.
import { runCompactQualification } from '../../../scripts/loredock-compact-qualification/coordinator.mjs';

test('prepared reads complete both actual tiny worker lifecycles with independent exact gates', { timeout: 180000 }, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'prepared-qualification-')); let passed = false;
  t.after(async () => { if (passed) await rm(root, { recursive: true, force: true }); else t.diagnostic(`Retained prepared qualification: ${root}`); });
  const config = await configuration(0);
  const report = await runCompactQualification({ root: fileURLToPath(new URL('../../../', import.meta.url)), output: path.join(root, 'run'),
    oracle: config.oracle, corpusFactory: config.corpusFactory, identity: { purpose: 'Independent tiny prepared-read process integration.' },
    childArgs: (sizeRoot: string, arm: string) => [fileURLToPath(new URL('./fixtures/compact-qualification-child.mjs', import.meta.url)),
      sizeRoot, arm, fileURLToPath(new URL('./fixtures/prepared-qualification-config.ts', import.meta.url)), '0'] });
  assert.equal(report.summary.plannedArms, 2); assert.equal(report.summary.arms, 2); assert.equal(report.summary.operations, 16);
  for (const key of ['supportPassed', 'completePathsPassed', 'observationsPassed']) assert.equal(report.summary[key], 16);
  assert.equal(report.summary.usefulnessPassed, 14); assert.equal(report.summary.historyPassed, 2); assert.equal(report.summary.parityPassed, 7);
  assert.notEqual(report.processes[0].pid, report.processes[1].pid);
  let resourceFailures = 0;
  assert.deepEqual(report.errors, []); assert.equal(report.processes.length, 2);
  for (const process of report.processes) { assert.equal(process.exit, 0); assert.equal(process.signal, null); assert.ok(!process.timeout && !process.spawnError && !process.blocked); }
  for (const arm of report.arms) {
    const raw = JSON.parse(await readFile(path.join(root, 'run/size-0', arm.arm, 'result.json'), 'utf8'));
    assert.equal(raw.operations.length, 8);
    for (const operation of raw.operations) for (const key of ['wallMs', 'maxSliceMs', 'peakRssMiB', 'heapGrowthMiB'])
      assert.ok(Number.isFinite(operation[key]) && operation[key] >= 0, `Invalid ${key} observation.`);
    assert.equal(arm.artifactError, null); assert.equal(arm.completePaths.failed, false);
    assert.equal(arm.assessment.summary.rawRepeat.pass, 3); assert.equal(arm.assessment.lifecycle.state, 'pass');
    assert.deepEqual(arm.assessment.workerErrors, []);
    for (const row of arm.assessment.operations) for (const [name, value] of Object.entries(row.dimensions)) {
      const dimension = value as { state: string };
      if (name === 'resources') {
        assert.ok(['pass', 'fail'].includes(dimension.state)); if (dimension.state === 'fail') resourceFailures++;
      } else assert.ok(['pass', 'not-applicable'].includes(dimension.state), JSON.stringify({ name, value }));
    }
  }
  // CI proves the lifecycle and scoring contract, not scheduler-sensitive resources.
  // Keep any measured resource rejection and require its overall propagation.
  assert.equal(report.summary.resourcePassed, 16 - resourceFailures);
  assert.equal(report.failed, resourceFailures > 0);
  passed = true;
});
