import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hash, dataHashes } from '../loredock-capture-memory/fixture.mjs';
import { resourceFailures, validateObservation, validateProjection } from './validate.mjs';

// Owns one fixed sequential diagnostic. Inputs/entry-point identity belong to its caller.
export async function runAttribution({ root, output, oracle, corpusFactory, childArgs, identity, validateReceipt }) {
  assert.ok(path.isAbsolute(root) && path.isAbsolute(output));
  await mkdir(output);
  const report = { ...identity, createdAt: new Date().toISOString(), node: process.version,
    modelRequests: 0, oracle, processes: [], arms: [], parity: [], errors: [] };
  const began = performance.now(), errorText = error => ({ name: error.name, code: error.code ?? null, message: error.message, stack: error.stack });
  const save = () => writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(path.join(output, 'identity.json'), JSON.stringify(report, null, 2) + '\n'); await save();
  let owned, interrupted;
  function stopOwned(signal) { if (owned?.pid) { try { process.kill(-owned.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; } } }
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
    const stdout = openSync(path.join(sizeRoot, arm + '.stdout'), 'wx'), stderr = openSync(path.join(sizeRoot, arm + '.stderr'), 'wx');
    const args = childArgs(sizeRoot, arm, size), started = performance.now();
    const outcome = { arm, size: size.pathsPerSource, executable: process.execPath, args, environment: { nodeOptions: null, locale: 'C' }, startedAt: new Date().toISOString() };
    try {
      await new Promise(resolve => {
        let grace;
        owned = spawn(process.execPath, args, { cwd: root, detached: true, stdio: ['ignore', stdout, stderr], env: { PATH: process.env.PATH, LC_ALL: 'C' } });
        outcome.pid = owned.pid;
        const timer = setTimeout(() => { outcome.timeout = true; stopOwned('SIGTERM'); grace = setTimeout(() => stopOwned('SIGKILL'), 5000); },
          Math.min(remaining, arm === 'same-process' ? oracle.diagnostic.preparerWatchdogMs : oracle.diagnostic.readerWatchdogMs));
        owned.once('error', error => { outcome.spawnError = errorText(error); });
        owned.once('close', (code, signal) => { clearTimeout(timer); clearTimeout(grace); owned = undefined; outcome.exit = code; outcome.signal = signal; resolve(); });
      });
    } finally { closeSync(stdout); closeSync(stderr); }
    outcome.wallMs = performance.now() - started;
    await writeFile(path.join(sizeRoot, arm + '.exit.json'), JSON.stringify(outcome, null, 2) + '\n'); return outcome;
  }
  async function checkedArtifact(folder, ref) {
    const bytes = await readFile(path.join(folder, ref.file)); assert.equal(bytes.length, ref.bytes); assert.equal(hash(bytes), ref.sha256); return bytes.toString('utf8');
  }
  async function inspectArm(sizeRoot, arm, size, corpus, metadata) {
    const folder = path.join(sizeRoot, arm), raw = JSON.parse(await readFile(path.join(folder, 'result.json')));
    const result = { size: size.pathsPerSource, arm, workerErrors: raw.errors, operations: [], errors: [] }, values = new Map();
    try { assert.deepEqual(raw.initialHashes, metadata.initialHashes); assert.deepEqual(raw.operations.map(row => row.name), oracle.operations); assert.equal(raw.evicted, metadata.inventory.id); }
    catch (error) { result.errors.push(errorText(error)); }
    for (const row of raw.operations) {
      const item = { name: row.name, resources: { pass: false, failures: resourceFailures(row, oracle) }, integrity: { pass: false } };
      item.resources.pass = item.resources.failures.length === 0;
      try {
        assert.ok(!row.blocked, 'Blocked: ' + JSON.stringify(row.blocked));
        const value = JSON.parse(await checkedArtifact(folder, row.artifact));
        validateObservation(row, arm, oracle); assert.ok(value.result && !value.error && !value.observerError);
        if (row.receipt) {
          const text = await checkedArtifact(folder, row.receipt), saved = validateReceipt(text, row.name, oracle, size, corpus, metadata);
          assert.equal(value.result.receiptId, saved.receipt.receiptHash); values.set(row.name, { text, ...saved });
        } else if (row.name === 'page-4') {
          const p = value.result.projection; validateProjection(p); assert.equal(p.roots.offset, 4); assert.equal(p.roots.items.length, 1);
          const root = p.roots.items[0]; assert.deepEqual([root.sourceName, root.path, root.label, root.role], oracle.isolatedRoot);
          values.set(row.name, { text: JSON.stringify(p), projection: p });
        } else {
          assert.equal(row.name, 'history'); assert.equal(value.result.status, 'recorded'); assert.equal(value.result.currentApplicability, 'not-checked');
          assert.deepEqual(value.result.projection, values.get('first').projection);
          assert.deepEqual(value.result.originals, values.get('first').receipt.originals);
          assert.deepEqual(value.result.dependencies, values.get('first').receipt.dependencies);
        }
        if (row.name.startsWith('repeat-')) assert.equal(values.get(row.name).text, values.get('first').text);
        item.integrity.pass = true;
      } catch (error) { item.integrity.error = errorText(error); }
      result.operations.push(item);
    }
    report.arms.push(result); await save(); return values;
  }
  try {
    for (const size of oracle.sizes) {
      const sizeRoot = path.join(output, 'size-' + size.pathsPerSource); await mkdir(sizeRoot);
      let metadata, reference;
      for (const arm of oracle.arms) {
        if (arm !== 'same-process' && !metadata) { report.processes.push({ size: size.pathsPerSource, arm, blocked: 'No valid prepared snapshot.' }); await save(); continue; }
        if (arm !== 'same-process') {
          try {
            assert.deepEqual(await dataHashes(path.join(sizeRoot, 'initial-data')), metadata.initialHashes);
            assert.deepEqual(await dataHashes(path.join(sizeRoot, arm, 'data')), metadata.initialHashes);
          } catch (error) { report.processes.push({ size: size.pathsPerSource, arm, blocked: errorText(error) }); await save(); continue; }
        }
        const outcome = await launch(sizeRoot, arm, size); report.processes.push(outcome); await save();
        try {
          metadata = JSON.parse(await readFile(path.join(sizeRoot, 'metadata.json')));
          assert.deepEqual(await dataHashes(path.join(sizeRoot, 'initial-data')), metadata.initialHashes);
          const values = await inspectArm(sizeRoot, arm, size, corpusFactory(size.pathsPerSource), metadata);
          if (arm === 'same-process') reference = values;
          else {
            const comparison = { size: size.pathsPerSource, arm, pass: false };
            try { assert.ok(reference); for (const name of oracle.operations.filter(name => name !== 'history')) {
              assert.ok(reference.has(name) && values.has(name), 'Missing parity input: ' + name); assert.equal(values.get(name).text, reference.get(name).text, 'Exact cross-arm bytes: ' + name);
            } comparison.pass = true; } catch (error) { comparison.error = errorText(error); }
            report.parity.push(comparison); await save();
          }
        } catch (error) { report.errors.push({ size: size.pathsPerSource, arm, ...errorText(error) }); await save(); }
      }
    }
    const operations = report.arms.flatMap(arm => arm.operations);
    report.summary = { arms: report.arms.length, operations: operations.length, integrityPassed: operations.filter(row => row.integrity.pass).length,
      resourcePassed: operations.filter(row => row.resources.pass).length, parityPassed: report.parity.filter(row => row.pass).length,
      note: 'A diagnostic only. No prior resource gate or production promotion changes.' };
    report.failed = operations.length !== oracle.sizes.length * oracle.arms.length * oracle.operations.length || operations.some(row => !row.integrity.pass || !row.resources.pass)
      || report.arms.some(arm => arm.errors.length || arm.workerErrors.length) || report.parity.length !== oracle.sizes.length * (oracle.arms.length - 1) || report.parity.some(row => !row.pass)
      || report.errors.length > 0 || report.processes.some(row => row.exit !== 0 || row.timeout || row.blocked);
    await save(); return report;
  } finally { for (const [signal, listener] of listeners) process.off(signal, listener); }
}
