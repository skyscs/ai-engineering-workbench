import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { configuration } from './fixtures/terminal-memory-config.js';
// @ts-expect-error Owned generic diagnostic coordinator, never a frozen corpus or CLI.
import { runTerminalDiagnostic } from '../../../scripts/loredock-terminal-memory/coordinator.mjs';
// @ts-expect-error Additional offline exact-path checker on independent saved test data.
import { assessComplete } from '../../../scripts/loredock-terminal-memory/complete.mjs';

test('complete tiny lifecycle preserves ordinary checks before bounded terminal exports and separate parsers', { timeout: 120000 }, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'terminal-memory-process-')); let passed = false;
  t.after(async () => { if (passed) await rm(root, { recursive: true, force: true }); else t.diagnostic(`Retained terminal integration: ${root}`); });
  const config = await configuration(0), output = path.join(root, 'run');
  const report = await runTerminalDiagnostic({ output,
    childScript: fileURLToPath(new URL('./fixtures/terminal-memory-child.mjs', import.meta.url)),
    childArgs: [fileURLToPath(new URL('./fixtures/terminal-memory-config.ts', import.meta.url)), '0'],
    oracle: config.oracle, size: config.size, corpusFactory: config.corpusFactory,
    terminalLimits: { watchdogMs: 60000 }, selectors: [
      { label: 'file payloads', name: 'Object', properties: { schemaVersion: 'loredock-file-facts/1' } },
      { label: 'path services', name: 'CodePaths', properties: {} },
      { label: 'catalog stores', name: 'CatalogStore', properties: {} },
    ], identity: { purpose: 'Independent tiny full-process integration only.' } });
  assert.equal(report.failed, false, JSON.stringify(report, null, 2));
  assert.equal(report.diagnosticComplete, true); assert.equal(report.resourceAcceptance, false);
  assert.equal(report.assessment.operations.length, 8);
  assert.equal(report.assessment.summary.support.pass, 8); assert.equal(report.assessment.summary.history.pass, 1);
  assert.equal(report.assessment.summary.resources.pass, 8); assert.equal(report.assessment.summary.rawRepeat.pass, 3);
  assert.equal(report.completePaths.failed, false); assert.equal(report.completePaths.operations.length, 8);
  assert.equal(report.terminal.length, 2);
  assert.notEqual(report.process.pid, report.terminal[0].process.pid);
  assert.notEqual(report.terminal[0].process.pid, report.terminal[1].process.pid);
  for (const stage of report.terminal) {
    assert.equal(stage.process.exit, 0); assert.equal(stage.summary.resourceAcceptance, false);
    assert.equal(stage.summary.groups.length, 3); assert.ok(stage.summary.nodes > 0);
  }
  const firstStore = report.terminal[0].summary.groups[2], releasedStore = report.terminal[1].summary.groups[2];
  assert.ok(firstStore.count >= 1); assert.ok(releasedStore.count < firstStore.count, 'The runtime owning stack must be released.');
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'result.json'), 'utf8')), report);
  const workerRoot = path.join(output, 'worker/same-process'), raw = JSON.parse(await readFile(path.join(workerRoot, 'result.json'), 'utf8'));
  for (const mutate of [
    (value: typeof config.oracle.complete) => { value.flows[0]!.edges[2] = 'invented'; },
    (value: typeof config.oracle.complete) => { value.originals[0]![3] = 1; },
    (value: typeof config.oracle.complete) => { value.sources.pop(); },
  ]) {
    const expected = structuredClone(config.oracle.complete); mutate(expected);
    assert.equal((await assessComplete({ root: workerRoot, raw, expected })).failed, true);
  }
  passed = true;
});

test('terminal snapshots preserve an independent operation resource failure', { timeout: 120000 }, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'terminal-memory-resource-')); let passed = false;
  t.after(async () => { if (passed) await rm(root, { recursive: true, force: true }); else t.diagnostic(`Retained terminal integration: ${root}`); });
  const config = await configuration(0);
  const report = await runTerminalDiagnostic({ output: path.join(root, 'run'),
    childScript: fileURLToPath(new URL('./fixtures/terminal-memory-child.mjs', import.meta.url)),
    childArgs: [fileURLToPath(new URL('./fixtures/terminal-memory-config.ts', import.meta.url)), '0'],
    oracle: { ...config.oracle, resources: { ...config.oracle.resources, sampledRssMiB: 0 } },
    size: config.size, corpusFactory: config.corpusFactory,
    terminalLimits: { watchdogMs: 60000 }, selectors: [{ label: 'catalog stores', name: 'CatalogStore', properties: {} }] });
  assert.equal(report.failed, true); assert.equal(report.diagnosticComplete, true);
  assert.equal(report.process.exit, 0); assert.equal(report.assessment.summary.resources.fail, 8);
  assert.equal(report.assessment.summary.support.pass, 8); assert.equal(report.assessment.summary.usefulness.pass, 7);
  assert.equal(report.assessment.summary.history.pass, 1); assert.equal(report.assessment.summary.rawRepeat.pass, 3);
  assert.ok(report.terminal.every((stage: { state: string }) => stage.state === 'pass'));
  passed = true;
});

test('cleanup failure retains the first snapshot and blocks release completion', { timeout: 120000 }, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'terminal-memory-cleanup-')); let passed = false;
  t.after(async () => { if (passed) await rm(root, { recursive: true, force: true }); else t.diagnostic(`Retained terminal integration: ${root}`); });
  const config = await configuration(1);
  const report = await runTerminalDiagnostic({ output: path.join(root, 'run'),
    childScript: fileURLToPath(new URL('./fixtures/terminal-memory-child.mjs', import.meta.url)),
    childArgs: [fileURLToPath(new URL('./fixtures/terminal-memory-config.ts', import.meta.url)), '1'],
    oracle: config.oracle, size: config.size, corpusFactory: config.corpusFactory,
    terminalLimits: { watchdogMs: 60000 }, selectors: [{ label: 'path services', name: 'CodePaths', properties: {} }] });
  assert.equal(report.failed, true); assert.equal(report.diagnosticComplete, false); assert.equal(report.process.exit, 1);
  assert.equal(report.assessment.lifecycle.state, 'fail'); assert.equal(report.assessment.summary.support.pass, 8);
  assert.equal(report.terminal[0].state, 'pass'); assert.equal(report.terminal[1].state, 'fail');
  assert.ok(report.assessment.workerErrors.some((error: { phase: string; message: string }) =>
    error.phase === 'cleanup' && error.message === 'Deliberate terminal cleanup failure.'));
  await assert.rejects(readFile(path.join(root, 'run/worker/after-release.heapsnapshot')), { code: 'ENOENT' });
  passed = true;
});
