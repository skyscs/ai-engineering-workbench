import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, corpusFactory } from './fixtures/memory-runner-config.js';
// @ts-expect-error Generic coordinator only; no frozen corpus or opt-in probe imports.
import { runAttribution } from '../../../scripts/loredock-memory-attribution/coordinator.mjs';
// @ts-expect-error Generic receipt validation against independently supplied expectations.
import { validateReceipt } from '../../../scripts/loredock-memory-attribution/validate.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const child = fileURLToPath(new URL('../../../scripts/loredock-memory-runner/child.mjs', import.meta.url));
const configuration = fileURLToPath(new URL('./fixtures/memory-runner-config.ts', import.meta.url));
const selectedRequiredNodes = [
  ['a-locker-client', 'ui/AABook.vue', 'symbol', 'book', 'vue-action'],
  ['a-locker-client', 'ui/reserve.ts', 'http-request', 'POST /lockers/reservations', null],
  ['b-locker-api', 'routes.json', 'handler-reference', 'Reservations.reserve', null],
  ['b-locker-api', 'Reservations.java', 'symbol', 'Reservations.reserve', 'java-method'],
  ['b-locker-api', 'Reservations.java', 'event-publish', 'Publish LockerReserved', null],
  ['c-locker-store', 'LockerWriter.java', 'event-subscribe', 'Subscribe via KafkaSubscriber', null],
  ['c-locker-store', 'LockerWriter.java', 'document-write', 'MongoCollection.replaceOne', null],
];
const oracle = { ...config.oracle, sizes: [{ ...config.size, pathsPerSource: 0 }],
  operations: ['first', 'repeat-1', 'repeat-2', 'repeat-3', 'selected', 'page-4', 'isolated', 'history'],
  topic: 'locker.reserved.v2', environment: 'regression', rootCount: 5, defaultFlows: 2, selectedFlows: 1,
  defaultOriginals: 10, isolatedOriginals: 5, uncitedSource: 'not-in-this-regression', isolated: { reason: 'unresolved-import' },
  selectedRequiredNodes, requiredNodes: [...selectedRequiredNodes, ['a-locker-client', 'ui/BBHold.vue', 'symbol', 'hold', 'vue-action']],
  // Intentionally fail the coordinator resource gate; child operation budgets remain unchanged.
  limits: { ...config.oracle.limits, wallMs: 0 },
  resources: { ...config.oracle.resources, maxSliceMs: 150, sampledRssMiB: 384, sampledHeapGrowthMiB: 64 },
  diagnostic: { ...config.oracle.diagnostic, preparerWatchdogMs: 60000, readerWatchdogMs: 60000, overallWatchdogMs: 180000 },
};

test('coordinator retains failed resource gates alongside complete independent integrity and process parity', { timeout: 200000 }, async t => {
  const folder = await mkdtemp(path.join(tmpdir(), 'attribution-coordinator-')); let passed = false;
  t.after(async () => { if (passed) await rm(folder, { recursive: true, force: true }); else t.diagnostic(`Retained coordinator artifacts: ${folder}`); });
  const output = path.join(folder, 'run');
  const report = await runAttribution({ root, output, oracle, corpusFactory, validateReceipt, identity: { schemaVersion: 'independent-coordinator-regression/1' },
    childArgs: (sizeRoot: string, arm: string) => ['--import', 'tsx', child, sizeRoot, arm, configuration] });
  assert.equal(report.failed, true); assert.deepEqual(report.errors, []);
  assert.equal(report.summary.operations, 24); assert.equal(report.summary.integrityPassed, 24);
  assert.equal(report.summary.resourcePassed, 0); assert.equal(report.summary.parityPassed, 2);
  for (const arm of report.arms) { assert.deepEqual(arm.errors, []); assert.deepEqual(arm.workerErrors, []); }
  for (const process of report.processes) {
    assert.equal(process.exit, 0); assert.equal(process.signal, null); assert.equal(process.timeout, undefined);
    assert.ok((await readFile(path.join(output, 'size-0', process.arm + '.stdout'), 'utf8')).includes('"operations":8'));
  }
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'result.json'), 'utf8')), report);
  passed = true;
});

test('coordinator preserves failed child stderr and blocks readers without a prepared snapshot', async t => {
  const folder = await mkdtemp(path.join(tmpdir(), 'attribution-child-error-')); t.after(() => rm(folder, { recursive: true, force: true }));
  const output = path.join(folder, 'run');
  const report = await runAttribution({ root, output, oracle, corpusFactory, validateReceipt, identity: {},
    childArgs: () => ['-e', 'process.stderr.write("Independent child failure\\n"); process.exitCode = 7;'] });
  assert.equal(report.failed, true); assert.equal(report.processes[0].exit, 7);
  assert.equal(report.summary.operations, 0); assert.equal(report.errors.length, 1);
  assert.equal(report.processes[1].blocked, 'No valid prepared snapshot.');
  assert.equal(report.processes[2].blocked, 'No valid prepared snapshot.');
  assert.equal(await readFile(path.join(output, 'size-0', 'same-process.stderr'), 'utf8'), 'Independent child failure\n');
});

test('coordinator watchdog records termination without restarting an owned child', { timeout: 15000 }, async t => {
  const folder = await mkdtemp(path.join(tmpdir(), 'attribution-watchdog-')); t.after(() => rm(folder, { recursive: true, force: true }));
  const output = path.join(folder, 'run');
  const report = await runAttribution({ root, output,
    oracle: { ...oracle, diagnostic: { ...oracle.diagnostic, preparerWatchdogMs: 10 } },
    corpusFactory, validateReceipt, identity: {}, childArgs: () => ['-e', 'setInterval(() => {}, 1000);'] });
  assert.equal(report.failed, true); assert.equal(report.processes[0].timeout, true);
  assert.ok(['SIGTERM', 'SIGKILL'].includes(report.processes[0].signal));
  assert.equal(report.processes.filter((row: { pid?: number }) => row.pid).length, 1);
  assert.equal(report.processes[1].blocked, 'No valid prepared snapshot.');
  assert.equal(report.processes[2].blocked, 'No valid prepared snapshot.');
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'size-0', 'same-process.exit.json'), 'utf8')), report.processes[0]);
});
