import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dataHashes, hash } from '../loredock-capture-memory/fixture.mjs';
import { normalizedError } from './sample.mjs';
import { summarizeProfile } from './summary.mjs';
import { validateReceipt } from '../loredock-memory-attribution/validate.mjs';

// One preparer and one reader. No automatic retry or profile-driven resource acceptance.
export async function runProfile({ output, root, oracle, corpusFactory, childArgs, identity }) {
  assert.ok(path.isAbsolute(output) && path.isAbsolute(root)); await mkdir(output);
  const report = { ...identity, createdAt: new Date().toISOString(), node: process.version, v8: process.versions.v8,
    oracle, modelRequests: 0, processes: [], errors: [], integrity: { pass: false }, resourceAcceptance: 'not-evaluated-profiled' };
  const save = () => writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(path.join(output, 'identity.json'), JSON.stringify(report, null, 2) + '\n'); await save();
  const began = performance.now(); let owned, interrupted;
  const stop = signal => { if (owned?.pid) { try { process.kill(-owned.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; } } };
  const listeners = ['SIGTERM', 'SIGINT'].map(signal => [signal, () => {
    interrupted = signal; report.errors.push({ phase: 'coordinator', signal }); const child = owned; stop('SIGTERM');
    if (child) setTimeout(() => { if (owned === child) stop('SIGKILL'); }, 5000).unref();
  }]);
  for (const [signal, listener] of listeners) process.on(signal, listener);
  async function launch(role) {
    const remaining = oracle.profile.overallWatchdogMs - (performance.now() - began);
    if (interrupted || remaining <= 0) return { role, blocked: interrupted ?? 'Overall watchdog exhausted.' };
    const stdout = openSync(path.join(output, role + '.stdout'), 'wx'); let stderr;
    const args = childArgs(output, role), outcome = { role, executable: process.execPath, args,
      environment: { nodeOptions: null, locale: 'C' }, startedAt: new Date().toISOString() };
    try {
      stderr = openSync(path.join(output, role + '.stderr'), 'wx');
      await new Promise(resolve => {
        let grace;
        owned = spawn(process.execPath, args, { cwd: root, detached: true, stdio: ['ignore', stdout, stderr], env: { PATH: process.env.PATH, LC_ALL: 'C' } });
        outcome.pid = owned.pid;
        const timer = setTimeout(() => { outcome.timeout = true; stop('SIGTERM'); grace = setTimeout(() => stop('SIGKILL'), 5000); },
          Math.min(remaining, role === 'prepare' ? oracle.profile.preparerWatchdogMs : oracle.profile.readerWatchdogMs));
        owned.once('error', error => { outcome.spawnError = normalizedError(error); });
        owned.once('close', (code, signal) => { clearTimeout(timer); clearTimeout(grace); owned = undefined; outcome.exit = code; outcome.signal = signal; resolve(); });
      });
    } finally { closeSync(stdout); if (stderr !== undefined) closeSync(stderr); }
    await writeFile(path.join(output, role + '.exit.json'), JSON.stringify(outcome, null, 2) + '\n'); return outcome;
  }
  async function artifact(reference) {
    const bytes = await readFile(path.join(output, 'read', reference.file));
    assert.equal(bytes.length, reference.bytes); assert.equal(hash(bytes), reference.sha256); return bytes.toString('utf8');
  }
  try {
    const preparation = await launch('prepare'); report.processes.push(preparation); await save();
    if (preparation.exit !== 0 || preparation.timeout || preparation.blocked) {
      report.processes.push({ role: 'read', blocked: 'Preparation did not complete.' });
    } else {
      const prepared = JSON.parse(await readFile(path.join(output, 'prepare', 'result.json')));
      assert.deepEqual(prepared.errors, []);
      const metadata = JSON.parse(await readFile(path.join(output, 'metadata.json')));
      assert.deepEqual(await dataHashes(path.join(output, 'initial-data')), metadata.initialHashes);
      assert.deepEqual(await dataHashes(path.join(output, 'read', 'data')), metadata.initialHashes);
      const reader = await launch('read'); report.processes.push(reader); await save();
      const read = JSON.parse(await readFile(path.join(output, 'read', 'result.json')));
      // Independently verify raw return semantics even when profiling/child cleanup failed.
      try {
        const value = JSON.parse(await artifact(read.artifacts.capture)), text = await artifact(read.artifacts.receipt);
        assert.equal(value.actionError, null); assert.equal(value.result.status, 'captured');
        assert.deepEqual(read.initialHashes, metadata.initialHashes);
        for (const key of ['gitCalls', 'writeCalls', 'changedRows']) assert.equal(value.before[key], value.after[key]);
        assert.equal(value.legacyBefore, value.legacyAfter);
        const metrics = value.result.metrics;
        assert.equal(metrics.pathWork, value.sums.path); assert.equal(metrics.receiptWork, value.sums.receipt);
        assert.equal(metrics.totalWork, value.sums.path + value.sums.receipt); assert.ok(metrics.totalWork <= oracle.limits.work);
        for (const key of ['projectionBytes', 'receiptBytes', 'textBytes', 'spans', 'sources']) assert.ok(metrics[key] <= oracle.limits[key]);
        const saved = validateReceipt(text, 'first', oracle, oracle.sizes[0], corpusFactory(), metadata);
        assert.equal(value.result.receiptId, saved.receipt.receiptHash);
        report.integrity = { pass: true, originals: saved.receipt.originals.length, facts: saved.projection.coverage.factEntries,
          files: saved.projection.coverage.scannedFiles, metrics };
      } catch (error) { report.integrity.error = normalizedError(error); }
      try {
        const profile = JSON.parse(await artifact(read.artifacts.profile));
        const summary = summarizeProfile(profile, oracle.profile, identity.repositoryRoot ?? root);
        assert.deepEqual(summary, JSON.parse(await artifact(read.artifacts.summary)));
        assert.equal(read.profileValid, true); assert.deepEqual(read.errors, []);
        const value = JSON.parse(await artifact(read.artifacts.capture)); assert.deepEqual(value.profilerErrors, []);
        report.profile = { pass: true, sampleReferenceStatus: summary.sampleReferenceStatus,
          nodes: summary.nodes, samples: summary.samples, unmappedSamples: summary.unmappedSamples,
          unmappedSampleBytes: summary.unmappedSampleBytes, totalSelfBytes: summary.totalSelfBytes, sampleBytes: summary.sampleBytes,
          backendStopForcesGC: oracle.profile.backendStopForcesGC, backendExportAllocationsIncluded: oracle.profile.backendExportAllocationsIncluded };
      } catch (error) { report.profile = { pass: false, error: normalizedError(error) }; }
      assert.deepEqual(await dataHashes(path.join(output, 'initial-data')), metadata.initialHashes);
    }
  } catch (error) { report.errors.push({ phase: 'coordinator', ...normalizedError(error) }); }
  finally {
    for (const [signal, listener] of listeners) process.off(signal, listener);
    report.failed = !report.integrity.pass || !report.profile?.pass || report.errors.length > 0
      || report.processes.length !== 2 || report.processes.some(row => row.exit !== 0 || row.timeout || row.blocked);
    await save();
  }
  return report;
}
