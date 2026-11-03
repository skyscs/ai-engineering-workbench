import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOwnedChild } from '../loredock-terminal-ownership/process.mjs';
import { limitsFor } from '../loredock-terminal-ownership/limits.mjs';
import { assessArm } from '../loredock-qualification-assessment/assess.mjs';
import { assessComplete } from './complete.mjs';

const parser = fileURLToPath(new URL('./parse-child.mjs', import.meta.url));
async function jsonFile(file, maximum = 1024 * 1024) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await handle.stat(); assert.ok(info.isFile() && info.size <= maximum);
    const bytes = Buffer.alloc(info.size + 1); let length = 0;
    while (length < bytes.length) { const result = await handle.read(bytes, length, bytes.length - length, length);
      if (!result.bytesRead) break; length += result.bytesRead; }
    assert.equal(length, info.size);
    const raw = bytes.subarray(0, length);
    return { value: JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw)),
      bytes: length, sha256: createHash('sha256').update(raw).digest('hex') };
  } finally { await handle.close(); }
}
const errorText = error => ({ name: error.name, code: error.code ?? null, message: error.message, stack: error.stack });

// One diagnostic lifecycle only; expected corpus construction and heap parsing occur after exit.
export async function runTerminalDiagnostic({ output, childScript, childArgs, oracle, size, corpusFactory, selectors,
  terminalLimits = {}, identity = {}, signal }) {
  assert.ok(path.isAbsolute(output)); const limits = limitsFor(terminalLimits);
  await mkdir(output);
  const report = { ...identity, schemaVersion: 'loredock-terminal-memory-diagnostic/1', resourceAcceptance: false,
    createdAt: new Date().toISOString(), node: process.version, v8: process.versions.v8, modelRequests: 0,
    oracle, size, selectors, limits, terminal: [], errors: [] };
  const save = () => writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(path.join(output, 'identity.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); await save();
  const workerRoot = path.join(output, 'worker');
  const onSignal = () => controller.abort(), controller = new AbortController();
  const inherited = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  for (const name of ['SIGINT', 'SIGTERM']) process.on(name, onSignal);
  try {
    report.process = await runOwnedChild({ script: childScript, args: childArgs, output: workerRoot, limits, signal: inherited }); await save();
    const metadata = await jsonFile(path.join(workerRoot, 'metadata.json'));
    const worker = await jsonFile(path.join(workerRoot, 'same-process', 'result.json'));
    report.metadata = { bytes: metadata.bytes, sha256: metadata.sha256 };
    report.worker = { bytes: worker.bytes, sha256: worker.sha256 };
    report.assessment = (await assessArm({ root: path.join(workerRoot, 'same-process'), arm: 'same-process', raw: worker.value,
      process: { ...report.process, arm: 'same-process' }, oracle, size, corpus: corpusFactory(), metadata: metadata.value })).report;
    report.completePaths = await assessComplete({ root: path.join(workerRoot, 'same-process'), raw: worker.value, expected: oracle.complete });
    await save();
    const stages = ['after-history', 'after-release'];
    try {
      assert.deepEqual(worker.value.terminal.map(row => row.stage), stages);
      const names = worker.value.lifecycle.map(row => row.stage);
      const ordered = ['terminal-history-before', 'terminal-history-after', 'closure-before', 'closure-after', 'terminal-release-before', 'terminal-release-after'];
      let previous = -1;
      for (const name of ordered) { const at = names.indexOf(name); assert.ok(at > previous && names.lastIndexOf(name) === at, 'Terminal lifecycle order is incomplete.'); previous = at; }
    } catch (error) { report.errors.push({ phase: 'terminal-lifecycle', ...errorText(error) }); }
    for (const stage of stages) {
      const item = { stage, state: 'blocked' }; report.terminal.push(item);
      try {
        const matches = worker.value.terminal.filter(row => row.stage === stage); assert.equal(matches.length, 1);
        const reference = matches[0]; assert.equal(reference.file, stage + '.heapsnapshot');
        assert.equal(reference.backendCollection, true); assert.equal(reference.resourceAcceptance, false);
        assert.ok(Number.isFinite(reference.wallMs) && reference.wallMs >= 0);
        for (const endpoint of ['before', 'after']) for (const key of ['rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers'])
          assert.ok(Number.isSafeInteger(reference[endpoint][key]) && reference[endpoint][key] >= 0);
        item.reference = reference;
        const parsedRoot = path.join(output, 'parse-' + stage), parseLimits = { ...limits, watchdogMs: Math.min(60000, limits.watchdogMs) };
        item.process = await runOwnedChild({ script: parser, args: [workerRoot, JSON.stringify(reference), JSON.stringify(selectors), JSON.stringify(parseLimits)],
          output: parsedRoot, limits: parseLimits, signal: inherited });
        assert.equal(item.process.failed, false, 'Bounded offline heap parser failed.');
        const summary = await jsonFile(path.join(parsedRoot, 'summary.json'), limits.summaryBytes + 1);
        item.summary = summary.value; item.summaryIdentity = { bytes: summary.bytes, sha256: summary.sha256 }; item.state = 'pass';
      } catch (error) { item.state = 'fail'; item.error = errorText(error); }
      await save();
    }
  } catch (error) { report.errors.push({ phase: 'coordinator', ...errorText(error) }); }
  finally { for (const name of ['SIGINT', 'SIGTERM']) process.off(name, onSignal); }
  report.diagnosticComplete = report.terminal.length === 2 && report.terminal.every(row => row.state === 'pass') && report.errors.length === 0 && !report.process?.failed;
  report.failed = !report.diagnosticComplete || report.assessment?.failed !== false || report.completePaths?.failed !== false;
  await save(); return report;
}
