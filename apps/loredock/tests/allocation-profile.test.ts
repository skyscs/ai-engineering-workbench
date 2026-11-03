import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './fixtures/allocation-profile-config.js';
// @ts-expect-error Generic profile coordinator only; no frozen corpus or opt-in entry point.
import { runProfile } from '../../../scripts/loredock-allocation-profile/coordinator.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const child = fileURLToPath(new URL('../../../scripts/loredock-allocation-profile/child.mjs', import.meta.url));
const configuration = fileURLToPath(new URL('./fixtures/allocation-profile-config.ts', import.meta.url));
test('fresh profile reader preserves complete original-supported receipt and inspectable allocation data', { timeout: 200000 }, async t => {
  const folder = await mkdtemp(path.join(tmpdir(), 'capture-profile-regression-')); let passed = false;
  t.after(async () => { if (passed) await rm(folder, { recursive: true, force: true }); else t.diagnostic(`Retained first profile regression: ${folder}`); });
  const output = path.join(folder, 'run');
  const report = await runProfile({ root, output, oracle: config.oracle, corpusFactory: config.corpusFactory,
    identity: { repositoryRoot: config.repositoryRoot },
    childArgs: (output: string, role: string) => ['--import', 'tsx', child, output, role, configuration] });
  assert.equal(report.failed, false, JSON.stringify(report)); assert.deepEqual(report.errors, []);
  assert.equal(report.integrity.pass, true); assert.equal(report.integrity.facts, 21); assert.equal(report.integrity.originals, 10);
  assert.equal(report.profile.pass, true); assert.ok(report.profile.nodes > 0 && report.profile.samples > 0);
  assert.equal(report.profile.sampleReferenceStatus, report.profile.unmappedSamples ? 'partial-unmapped-samples' : 'complete');
  assert.equal(report.profile.backendStopForcesGC, true); assert.equal(report.profile.backendExportAllocationsIncluded, true);
  assert.equal(report.resourceAcceptance, 'not-evaluated-profiled');
  assert.notEqual(report.processes[0].pid, report.processes[1].pid);
  for (const process of report.processes) { assert.equal(process.exit, 0); assert.equal(process.signal, null); }
  const captured = JSON.parse(await readFile(path.join(output, 'read', 'capture.json'), 'utf8'));
  assert.equal(captured.parameters.includeObjectsCollectedByMajorGC, true);
  assert.equal(captured.parameters.includeObjectsCollectedByMinorGC, true);
  assert.equal(captured.result.status, 'captured'); assert.equal(captured.actionError, null); assert.deepEqual(captured.profilerErrors, []);
  const profile = JSON.parse(await readFile(path.join(output, 'read', 'allocation.heapprofile'), 'utf8'));
  assert.equal(profile.samples.length, report.profile.samples);
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'result.json'), 'utf8')), report);
  passed = true;
});

test('profile preparation failure or watchdog preserves exits and prevents a reader restart', { timeout: 15000 }, async t => {
  const folder = await mkdtemp(path.join(tmpdir(), 'capture-profile-failure-')); t.after(() => rm(folder, { recursive: true, force: true }));
  for (const mode of ['failure', 'timeout']) {
    const output = path.join(folder, mode);
    const report = await runProfile({ root, output,
      oracle: { ...config.oracle, profile: { ...config.oracle.profile, preparerWatchdogMs: mode === 'timeout' ? 10 : 10000 } },
      corpusFactory: config.corpusFactory, identity: {}, childArgs: () => ['-e', mode === 'timeout'
        ? 'setInterval(() => {}, 1000);' : 'process.stderr.write("Independent preparation failure\\n"); process.exitCode = 7;'] });
    assert.equal(report.failed, true); assert.equal(report.integrity.pass, false);
    assert.equal(report.processes[1].blocked, 'Preparation did not complete.'); assert.equal(report.processes.length, 2);
    if (mode === 'failure') {
      assert.equal(report.processes[0].exit, 7);
      assert.equal(await readFile(path.join(output, 'prepare.stderr'), 'utf8'), 'Independent preparation failure\n');
    } else { assert.equal(report.processes[0].timeout, true); assert.ok(['SIGTERM', 'SIGKILL'].includes(report.processes[0].signal)); }
    assert.deepEqual(JSON.parse(await readFile(path.join(output, 'prepare.exit.json'), 'utf8')), report.processes[0]);
  }
});
