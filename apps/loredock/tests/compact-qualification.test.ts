import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { configuration } from './fixtures/compact-qualification-config.js';
// @ts-expect-error Generic offline coordinator; no frozen corpus/entry point.
import { runCompactQualification } from '../../../scripts/loredock-compact-qualification/coordinator.mjs';

async function execute(t: TestContext, mode: 'normal' | 'resource' | 'exit' | 'cleanup' | 'watchdog' | 'malformed') {
  const parent = await mkdtemp(path.join(tmpdir(), 'compact-qualification-')); let passed = false;
  t.after(async () => { if (passed) await rm(parent, { recursive: true, force: true }); else t.diagnostic(`Retained qualification regression: ${parent}`); });
  const config = await configuration(0), output = path.join(parent, 'run');
  const oracle = mode === 'resource' ? { ...config.oracle, resources: { ...config.oracle.resources, sampledRssMiB: 0 } }
    : mode === 'watchdog' ? { ...config.oracle, diagnostic: { preparerWatchdogMs: 100, readerWatchdogMs: 100, overallWatchdogMs: 5000 } } : config.oracle;
  const report = await runCompactQualification({ root: fileURLToPath(new URL('../../../', import.meta.url)), output,
    oracle, corpusFactory: config.corpusFactory, identity: { purpose: 'Independent tiny uninstrumented process regression.' },
    childArgs: (sizeRoot: string, arm: string) => ['exit', 'watchdog'].includes(mode)
      ? [fileURLToPath(new URL('./fixtures/compact-qualification-exit.mjs', import.meta.url)), mode === 'watchdog' ? 'hang' : 'exit']
      : [fileURLToPath(new URL('./fixtures/compact-qualification-child.mjs', import.meta.url)), sizeRoot, arm,
        fileURLToPath(new URL('./fixtures/compact-qualification-config.ts', import.meta.url)), mode === 'cleanup' ? '1' : '0',
        ...(mode === 'malformed' ? ['malformed-result'] : [])] });
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'result.json'), 'utf8')), report);
  return { report, output, pass: () => { passed = true; } };
}

test('compact qualification separates complete actual lifecycle content, resources, observations and raw parity', { timeout: 180000 }, async t => {
  const { report, pass } = await execute(t, 'normal');
  assert.equal(report.failed, false, JSON.stringify(report, null, 2));
  assert.equal(report.summary.arms, 2); assert.equal(report.summary.operations, 16);
  assert.equal(report.summary.supportPassed, 16); assert.equal(report.summary.usefulnessPassed, 14);
  assert.equal(report.summary.historyPassed, 2); assert.equal(report.summary.resourcePassed, 16);
  assert.equal(report.summary.completePathsPassed, 16); assert.equal(report.summary.observationsPassed, 16);
  assert.equal(report.summary.parityPassed, 7); assert.notEqual(report.processes[0].pid, report.processes[1].pid);
  for (const arm of report.arms) { assert.equal(arm.assessment.summary.rawRepeat.pass, 3); assert.equal(arm.assessment.lifecycle.state, 'pass'); }
  pass();
});

test('compact qualification retains every content and no-write gate when parent resources fail', { timeout: 180000 }, async t => {
  const { report, pass } = await execute(t, 'resource');
  assert.equal(report.failed, true); assert.equal(report.summary.resourcePassed, 0);
  assert.equal(report.summary.completePathsPassed, 16); assert.equal(report.summary.observationsPassed, 16);
  assert.equal(report.summary.supportPassed, 16); assert.equal(report.summary.usefulnessPassed, 14);
  assert.equal(report.summary.historyPassed, 2); assert.equal(report.summary.parityPassed, 7);
  assert.ok(report.processes.every((row: { exit: number }) => row.exit === 0)); pass();
});

test('preparation failure preserves exit/stderr and explicit dependent denominators', { timeout: 180000 }, async t => {
  const { report, output, pass } = await execute(t, 'exit');
  assert.equal(report.failed, true); assert.equal(report.processes[0].exit, 7);
  assert.ok(report.processes[1].blocked); assert.equal(report.summary.plannedArms, 2); assert.equal(report.summary.operations, 16);
  assert.equal(report.summary.resourcePassed, 0); assert.equal(report.summary.completePathsPassed, 0);
  assert.equal(report.summary.parityPassed, 0); assert.equal(report.parity[0].operations.length, 7);
  assert.ok(report.parity[0].operations.every((row: { state: string }) => row.state === 'blocked'));
  assert.equal(report.arms[1].assessment.summary.resources.blocked, 8);
  assert.ok(report.arms[1].completePaths.operations.every((row: { state: string }) => row.state === 'blocked'));
  assert.match(await readFile(path.join(output, 'size-0/same-process.stderr'), 'utf8'), /Deliberate independent qualification child failure/);
  pass();
});

test('cleanup failure rejects qualification while preserving prepared-copy and content evidence', { timeout: 180000 }, async t => {
  const { report, pass } = await execute(t, 'cleanup');
  assert.equal(report.failed, true); assert.equal(report.processes[0].exit, 1); assert.equal(report.processes[1].exit, 0);
  assert.equal(report.arms[0].assessment.lifecycle.state, 'fail'); assert.equal(report.arms[1].assessment.lifecycle.state, 'pass');
  assert.equal(report.summary.supportPassed, 16); assert.equal(report.summary.completePathsPassed, 16); assert.equal(report.summary.parityPassed, 7);
  assert.ok(report.arms[0].assessment.workerErrors.some((row: { phase: string }) => row.phase === 'cleanup')); pass();
});

test('a bounded watchdog retains signal/timeout and blocks unprepared dependencies', { timeout: 180000 }, async t => {
  const { report, pass } = await execute(t, 'watchdog');
  assert.equal(report.failed, true); assert.equal(report.processes[0].timeout, true); assert.equal(report.processes[0].signal, 'SIGTERM');
  assert.ok(report.processes[1].blocked); assert.equal(report.summary.operations, 16);
  assert.equal(report.summary.observationsPassed, 0); pass();
});

test('malformed stopped worker results cannot erase required operations or prevent a saved rejection', { timeout: 180000 }, async t => {
  const { report, pass } = await execute(t, 'malformed');
  assert.equal(report.failed, true); assert.equal(report.summary.operations, 16); assert.equal(report.summary.completePathsPassed, 0);
  assert.equal(report.processes.length, 2); assert.ok(report.processes.every((row: { exit: number }) => row.exit === 0));
  for (const arm of report.arms) {
    assert.match(arm.artifactError.message, /Malformed worker result/);
    assert.ok(arm.completePaths.operations.every((row: { state: string }) => row.state === 'blocked'));
  }
  pass();
});
