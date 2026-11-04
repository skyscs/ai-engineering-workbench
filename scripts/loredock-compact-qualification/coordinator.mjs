import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { constants, openSync, closeSync } from 'node:fs';
import { mkdir, open, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dataHashes } from '../loredock-capture-memory/fixture.mjs';
import { assessArm, compareArms } from '../loredock-qualification-assessment/assess.mjs';
import { assessComplete } from '../loredock-terminal-memory/complete.mjs';
import { validateObservation } from '../loredock-streaming-qualification/validate.mjs';

async function readJSON(file) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await handle.stat(); assert.ok(info.isFile() && info.size <= 1024 * 1024, 'Worker JSON exceeds its finite regular-file bound.');
    const bytes = Buffer.alloc(info.size + 1); let length = 0;
    while (length < bytes.length) {
      const result = await handle.read(bytes, length, bytes.length - length, length);
      if (!result.bytesRead) break; length += result.bytesRead;
    }
    assert.equal(length, info.size);
    return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, length)));
  } finally { await handle.close(); }
}

// Task 089: original uninstrumented worker with independent stopped-byte assessment.
// Never imports a frozen family; process failures cannot become missing denominators.
export async function runCompactQualification({ root, output, oracle, corpusFactory, childArgs, identity }) {
  assert.ok(path.isAbsolute(root) && path.isAbsolute(output));
  assert.deepEqual(oracle.arms, ['same-process', 'reopened-process']);
  await mkdir(output);
  const report = { ...identity, createdAt: new Date().toISOString(), node: process.version,
    modelRequests: 0, oracle, processes: [], arms: [], parity: [], errors: [] };
  const began = performance.now(), errorText = error => ({ name: error.name, code: error.code ?? null, message: error.message, stack: error.stack });
  const save = () => writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(path.join(output, 'identity.json'), JSON.stringify(report, null, 2) + '\n'); await save();
  let owned, interrupted;
  function stopOwned(signal) { if (owned?.pid) { try { process.kill(-owned.pid, signal); }
    catch (error) { if (error.code !== 'ESRCH') report.errors.push({ phase: 'process-stop', ...errorText(error) }); } } }
  const listeners = ['SIGTERM', 'SIGINT'].map(signal => [signal, () => {
    interrupted = signal; report.errors.push({ phase: 'coordinator', signal });
    const child = owned; stopOwned('SIGTERM');
    if (child) setTimeout(() => { if (owned === child) stopOwned('SIGKILL'); }, 5000).unref();
  }]);
  for (const [signal, listener] of listeners) process.on(signal, listener);
  async function launch(sizeRoot, arm, size) {
    const remaining = oracle.diagnostic.overallWatchdogMs - (performance.now() - began);
    if (interrupted) return { arm, size: size.pathsPerSource, blocked: 'Coordinator interrupted: ' + interrupted };
    if (remaining <= 0) return { arm, size, blocked: 'Overall watchdog exhausted.' };
    const args = childArgs(sizeRoot, arm, size), started = performance.now();
    const outcome = { arm, size: size.pathsPerSource, executable: process.execPath, args, environment: { nodeOptions: null, locale: 'C' }, startedAt: new Date().toISOString() };
    let stdout, stderr;
    try {
      stdout = openSync(path.join(sizeRoot, arm + '.stdout'), 'wx'); stderr = openSync(path.join(sizeRoot, arm + '.stderr'), 'wx');
      await new Promise(resolve => {
        let grace;
        owned = spawn(process.execPath, args, { cwd: root, detached: true, stdio: ['ignore', stdout, stderr], env: { PATH: process.env.PATH, LC_ALL: 'C' } });
        outcome.pid = owned.pid;
        const timer = setTimeout(() => { outcome.timeout = true; stopOwned('SIGTERM'); grace = setTimeout(() => stopOwned('SIGKILL'), 5000); },
          Math.min(remaining, arm === 'same-process' ? oracle.diagnostic.preparerWatchdogMs : oracle.diagnostic.readerWatchdogMs));
        owned.once('error', error => { outcome.spawnError = errorText(error); });
        owned.once('close', (code, signal) => { clearTimeout(timer); clearTimeout(grace); owned = undefined; outcome.exit = code; outcome.signal = signal; resolve(); });
      });
    } catch (error) { outcome.spawnError = errorText(error); }
    finally { for (const descriptor of [stdout, stderr]) if (descriptor !== undefined) try { closeSync(descriptor); }
      catch (error) { report.errors.push({ phase: 'process-descriptor-close', ...errorText(error) }); } }
    outcome.wallMs = performance.now() - started;
    await writeFile(path.join(sizeRoot, arm + '.exit.json'), JSON.stringify(outcome, null, 2) + '\n'); return outcome;
  }
  try {
    for (const size of oracle.sizes) {
      const sizeRoot = path.join(output, 'size-' + size.pathsPerSource); await mkdir(sizeRoot);
      let metadata, reference, candidate;
      for (const arm of oracle.arms) {
        let outcome;
        if (arm !== 'same-process') {
          try {
            assert.ok(metadata, 'No valid prepared snapshot.');
            assert.deepEqual(await dataHashes(path.join(sizeRoot, 'initial-data')), metadata.initialHashes);
            assert.deepEqual(await dataHashes(path.join(sizeRoot, arm, 'data')), metadata.initialHashes);
          } catch (error) { outcome = { arm, size: size.pathsPerSource, blocked: errorText(error) }; }
        }
        if (!outcome) try { outcome = await launch(sizeRoot, arm, size); }
        catch (error) { outcome = { arm, size: size.pathsPerSource, spawnError: errorText(error) }; }
        report.processes.push(outcome); await save();
        const folder = path.join(sizeRoot, arm);
        let raw = { operations: [], errors: [] }, artifactError;
        try {
          metadata = await readJSON(path.join(sizeRoot, 'metadata.json'));
          assert.deepEqual(await dataHashes(path.join(sizeRoot, 'initial-data')), metadata.initialHashes);
          const observed = await readJSON(path.join(folder, 'result.json'));
          assert.ok(observed && typeof observed === 'object' && !Array.isArray(observed)
            && Array.isArray(observed.operations) && Array.isArray(observed.errors) && Array.isArray(observed.lifecycle), 'Malformed worker result.');
          raw = observed;
        } catch (error) { artifactError = errorText(error); }
        const assessed = await assessArm({ root: folder, arm, raw, process: outcome, oracle, size,
          corpus: corpusFactory(size.pathsPerSource), metadata });
        const completePaths = await assessComplete({ root: folder, raw, expected: oracle.complete });
        for (const item of completePaths.operations) if (!raw.operations.some(row => row?.name === item.name)) {
          item.state = 'blocked'; item.reason = 'operation-unavailable';
        }
        const observations = oracle.operations.map(name => {
          try {
            const rows = raw.operations.filter(row => row?.name === name);
            if (!rows.length) return { name, state: 'blocked', reason: 'operation-unavailable' };
            assert.equal(rows.length, 1);
            validateObservation(rows[0], arm, oracle);
            return { name, state: 'pass' };
          } catch (error) { return { name, state: 'fail', error: errorText(error) }; }
        });
        report.arms.push({ size: size.pathsPerSource, arm, assessment: assessed.report, completePaths, observations,
          artifactError: artifactError ?? null });
        if (arm === 'same-process') reference = assessed; else candidate = assessed;
        await save();
      }
      report.parity.push({ size: size.pathsPerSource, operations: reference && candidate ? compareArms(reference, candidate) : [],
        blocked: !reference || !candidate }); await save();
    }
    const rows = report.arms.flatMap(arm => arm.assessment.operations);
    report.summary = { plannedArms: oracle.sizes.length * oracle.arms.length, arms: report.arms.length,
      plannedOperations: oracle.sizes.length * oracle.arms.length * oracle.operations.length, operations: rows.length,
      supportPassed: rows.filter(row => row.dimensions.support.state === 'pass').length,
      usefulnessPassed: rows.filter(row => row.dimensions.usefulness.state === 'pass').length,
      historyPassed: rows.filter(row => row.dimensions.history.state === 'pass').length,
      resourcePassed: rows.filter(row => row.dimensions.resources.state === 'pass').length,
      completePathsPassed: report.arms.flatMap(arm => arm.completePaths.operations).filter(row => row.state === 'pass').length,
      observationsPassed: report.arms.flatMap(arm => arm.observations).filter(row => row.state === 'pass').length,
      parityPassed: report.parity.flatMap(row => row.operations).filter(row => row.state === 'pass').length,
      note: 'Fresh uninstrumented qualification only. Historical failures and production consumers remain unchanged.' };
    report.failed = report.arms.length !== report.summary.plannedArms || rows.length !== report.summary.plannedOperations
      || report.arms.some(arm => arm.artifactError || arm.assessment.failed || arm.completePaths.failed || arm.observations.some(row => row.state !== 'pass'))
      || report.parity.length !== oracle.sizes.length || report.parity.some(row => row.blocked || row.operations.length !== 7 || row.operations.some(row => row.state !== 'pass'))
      || report.errors.length > 0 || report.processes.some(row => row.exit !== 0 || row.signal !== null || row.timeout || row.blocked || row.spawnError);
    await save(); return report;
  } finally { for (const [signal, listener] of listeners) process.off(signal, listener); }
}
