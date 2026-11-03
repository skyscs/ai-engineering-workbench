import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './fixtures/streaming-snapshot-config.js';
import { oracle } from './fixtures/streaming-qualification-config.js';
// @ts-expect-error Generic qualification coordinator only; no frozen corpus or probe.
import { runQualification } from '../../../scripts/loredock-streaming-qualification/coordinator.mjs';
// @ts-expect-error Independent original-supported receipt validation.
import { validateReceipt } from '../../../scripts/loredock-streaming-qualification/validate.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const child = fileURLToPath(new URL('../../../scripts/loredock-streaming-qualification/child.mjs', import.meta.url));
const configuration = fileURLToPath(new URL('./fixtures/streaming-qualification-config.ts', import.meta.url));
test('both qualification lifecycles omit instrumentation and preserve integrity independently of failed resources', { timeout: 150000 }, async t => {
  const folder = await mkdtemp(path.join(tmpdir(), 'streaming-qualification-regression-')); let passed = false;
  t.after(async () => { if (passed) await rm(folder, { recursive: true, force: true }); else t.diagnostic(`Retained qualification regression: ${folder}`); });
  const output = path.join(folder, 'run');
  const report = await runQualification({ root, output, oracle: { ...oracle, limits: { ...oracle.limits, wallMs: 0 } },
    corpusFactory: config.corpusFactory, validateReceipt, identity: { schemaVersion: 'independent-streaming-regression/1' },
    childArgs: (sizeRoot: string, arm: string) => ['--import', 'tsx', child, sizeRoot, arm, configuration, '0'] });
  assert.equal(report.failed, true); assert.deepEqual(report.errors, []);
  assert.equal(report.summary.operations, 16); assert.equal(report.summary.integrityPassed, 16);
  assert.equal(report.summary.resourcePassed, 0); assert.equal(report.summary.parityPassed, 1);
  assert.equal(report.processes.length, 2); assert.notEqual(report.processes[0].pid, report.processes[1].pid);
  for (const process of report.processes) {
    assert.equal(process.exit, 0); assert.equal(process.signal, null);
    const worker = JSON.parse(await readFile(path.join(output, 'size-0', process.arm, 'result.json'), 'utf8'));
    assert.deepEqual(worker.errors, []);
    for (const operation of worker.operations) assert.deepEqual(operation.instrumentation, { enabled: false, phases: [], queries: [], prepareCalls: 0 });
  }
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'result.json'), 'utf8')), report);
  passed = true;
});

test('qualification retains failed or timed-out preparation and never retries a blocked reader', { timeout: 15000 }, async t => {
  const folder = await mkdtemp(path.join(tmpdir(), 'streaming-qualification-failure-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  for (const timeout of [false, true]) {
    const output = path.join(folder, String(timeout));
    const report = await runQualification({ root, output,
      oracle: { ...oracle, diagnostic: { ...oracle.diagnostic, preparerWatchdogMs: timeout ? 10 : 10000 } },
      corpusFactory: config.corpusFactory, validateReceipt, identity: {},
      childArgs: () => ['-e', timeout ? 'setInterval(() => {}, 1000);' : 'process.stderr.write("Independent qualification failure\\n"); process.exitCode = 7;'] });
    assert.equal(report.failed, true); assert.equal(report.summary.operations, 0);
    assert.equal(report.processes.length, 2); assert.equal(report.processes[1].blocked, 'No valid prepared snapshot.');
    if (timeout) { assert.equal(report.processes[0].timeout, true); assert.ok(['SIGTERM', 'SIGKILL'].includes(report.processes[0].signal)); }
    else { assert.equal(report.processes[0].exit, 7);
      assert.equal(await readFile(path.join(output, 'size-0', 'same-process.stderr'), 'utf8'), 'Independent qualification failure\n'); }
  }
});
