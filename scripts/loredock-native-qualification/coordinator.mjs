import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataHashes } from '../loredock-capture-memory/fixture.mjs';
import { assessNativeArm, combineNativeArms } from './assessment.mjs';
import { readJSON, normalized } from './io.mjs';

// Trusted developer driver. Output must be a fresh owned directory; children use
// compiled service modules. Child override/watchdog reductions exist for regression tests.
export async function runNativeQualification({ output, config, configuration, caseId = 0,
  child = fileURLToPath(new URL('./child.mjs', import.meta.url)), signal, watchdogs = {} }) {
  assert.ok(path.isAbsolute(output) && path.resolve(output) === output && path.isAbsolute(configuration) && path.isAbsolute(child));
  assert.ok(signal === undefined || signal instanceof AbortSignal); assert.ok(Number.isSafeInteger(caseId) && caseId >= 0);
  const deadlines = { preparer: 60000, reader: 60000, overall: 180000, grace: 1000, ...watchdogs };
  for (const [key, value] of Object.entries(deadlines)) assert.ok(['preparer', 'reader', 'overall', 'grace'].includes(key) && Number.isSafeInteger(value) && value > 0
    && value <= ({ preparer: 60000, reader: 60000, overall: 180000, grace: 1000 })[key]);
  await mkdir(output);
  const report = { schemaVersion: 'native-qualification-coordinator/1', node: process.version, modelRequests: 0,
    output, caseId, resourceQualification: false, processes: [], arms: [], errors: [], summary: null };
  const save = () => writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
  const began = performance.now(); let owned, interrupted, graceTimer;
  function stop(signal) {
    if (owned?.pid) try { process.kill(-owned.pid, signal); } catch (error) { if (error.code !== 'ESRCH') report.errors.push({ phase: 'kill', ...normalized(error) }); }
  }
  const interrupt = reason => {
    interrupted = reason; stop('SIGTERM'); const target = owned;
    if (target) { clearTimeout(graceTimer); graceTimer = setTimeout(() => { if (owned === target) stop('SIGKILL'); }, deadlines.grace); }
  };
  const abort = () => interrupt('Caller cancelled the coordinator.');
  const listeners = ['SIGINT', 'SIGTERM'].map(name => [name, () => interrupt(name)]);
  for (const [name, listener] of listeners) process.on(name, listener); signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  async function launch(arm) {
    const remaining = deadlines.overall - (performance.now() - began);
    if (interrupted || remaining <= 0) return { arm, blocked: interrupted ?? 'Overall watchdog expired.' };
    const args = [child, output, arm, configuration, String(caseId)], started = performance.now();
    const outcome = { arm, executable: process.execPath, args, nodeOptions: null }; let stdout, stderr;
    try {
      stdout = openSync(path.join(output, arm + '.stdout'), 'wx'); stderr = openSync(path.join(output, arm + '.stderr'), 'wx');
      await new Promise(resolve => {
        owned = spawn(process.execPath, args, { cwd: fileURLToPath(new URL('../../', import.meta.url)), detached: true,
          stdio: ['ignore', stdout, stderr], env: { PATH: process.env.PATH, LC_ALL: 'C' } }); outcome.pid = owned.pid;
        const timer = setTimeout(() => { outcome.timeout = true; stop('SIGTERM');
          const target = owned; graceTimer = setTimeout(() => { if (owned === target) stop('SIGKILL'); }, deadlines.grace);
        }, Math.min(remaining, arm === 'same-process' ? deadlines.preparer : deadlines.reader));
        owned.once('error', error => { outcome.spawnError = normalized(error); });
        owned.once('close', (exit, signal) => { clearTimeout(timer); clearTimeout(graceTimer); owned = undefined; outcome.exit = exit; outcome.signal = signal; resolve(); });
      });
    } catch (error) { outcome.spawnError = normalized(error); }
    finally {
      for (const fd of [stdout, stderr]) if (fd !== undefined) try { closeSync(fd); } catch (error) { report.errors.push({ phase: 'descriptor-close', ...normalized(error) }); }
    }
    outcome.wallMs = performance.now() - started; await writeFile(path.join(output, arm + '.exit.json'), JSON.stringify(outcome, null, 2)); return outcome;
  }
  await save(); const assessed = []; let metadata;
  try {
    for (const arm of ['same-process', 'reopened-process']) {
      let outcome;
      if (arm === 'reopened-process') try {
        assert.ok(metadata); assert.deepEqual(await dataHashes(path.join(output, 'initial-data')), metadata.initialHashes);
        assert.deepEqual(await dataHashes(path.join(output, arm, 'data')), metadata.initialHashes);
      } catch (error) { outcome = { arm, blocked: normalized(error) }; }
      if (!outcome) outcome = await launch(arm); report.processes.push(outcome); await save();
      let raw = { operations: [], errors: [] }, artifactError;
      try {
        const pins = await readJSON(path.join(output, 'metadata.json'));
        if (metadata) assert.deepEqual(pins, metadata); else metadata = pins;
        assert.deepEqual(await dataHashes(path.join(output, 'initial-data')), metadata.initialHashes);
        raw = await readJSON(path.join(output, arm, 'result.json'));
      } catch (error) { artifactError = normalized(error); }
      const value = await assessNativeArm({ root: path.join(output, arm), arm, raw, outcome, metadata, config });
      if (artifactError) { value.report.functionalFailed = true; value.report.failed = true; }
      assessed.push(value); report.arms.push({ arm, artifactError: artifactError ?? null, assessment: value.report }); await save();
    }
    report.summary = combineNativeArms(assessed); report.summary.failed ||= report.errors.length > 0;
    report.summary.functionalFailed ||= report.errors.length > 0;
  } catch (error) {
    report.errors.push({ phase: 'coordinator', ...normalized(error) });
    report.summary = { failed: true, functionalFailed: true, plannedOperations: 16, requiredComparisons: 7, blocked: 'Incomplete coordinator assessment.' };
  } finally {
    if (owned) stop('SIGKILL'); clearTimeout(graceTimer);
    for (const [name, listener] of listeners) process.removeListener(name, listener); signal?.removeEventListener('abort', abort);
    await save();
  }
  return report;
}
