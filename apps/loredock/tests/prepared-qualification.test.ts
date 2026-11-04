import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
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
  assert.equal(report.failed, false, JSON.stringify(report, null, 2));
  assert.equal(report.summary.plannedArms, 2); assert.equal(report.summary.arms, 2); assert.equal(report.summary.operations, 16);
  for (const key of ['supportPassed', 'completePathsPassed', 'observationsPassed', 'resourcePassed']) assert.equal(report.summary[key], 16);
  assert.equal(report.summary.usefulnessPassed, 14); assert.equal(report.summary.historyPassed, 2); assert.equal(report.summary.parityPassed, 7);
  assert.notEqual(report.processes[0].pid, report.processes[1].pid);
  for (const arm of report.arms) { assert.equal(arm.assessment.summary.rawRepeat.pass, 3); assert.equal(arm.assessment.lifecycle.state, 'pass'); }
  passed = true;
});
