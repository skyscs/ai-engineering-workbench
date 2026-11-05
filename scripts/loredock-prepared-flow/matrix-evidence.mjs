// Offline assessment of one stopped case. Never open immutable input/checkpoint catalogs.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { assessDaemonSamples } from './cold-warm-cases.mjs';
import { assessRecordedHttp } from './http-assess.mjs';
import { assessRecordedBrowser } from './browser-assess.mjs';
import { assessWitnessRows } from './content-assess.mjs';

const json = async file => JSON.parse(await readFile(file, 'utf8'));
export async function matrixFiles(root) {
  const result = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (entry.name === 'profile' && path.basename(directory) === 'browser') continue;
        await visit(file);
      } else if (entry.isFile()) result.push(file);
    }
  }
  await visit(root); return result.sort();
}

export async function assessMatrixEvidence({ directory, ownerOutput, catalogRoots, workingRows, expectedHttp = {} }) {
  const files = await matrixFiles(directory), daemons = [], browsers = [];
  const report = { daemons, browsers, http: [], content: [], catalogRoots: [], failures: [], incomplete: [], controlledCalls: 0,
    modelCalls: 0, resourceQualification: false };
  const relative = file => path.relative(directory, file), ownerRelative = file => path.relative(ownerOutput, file);
  for (const file of files.filter(file => path.basename(file) === 'loredock.db')) {
    const root = ownerRelative(path.dirname(file)); assert(catalogRoots.includes(root), 'Undeclared actual catalog: ' + root);
    report.catalogRoots.push(root);
  }
  for (const file of files.filter(file => path.basename(file) === 'process.json')) {
    const processDirectory = path.dirname(file), process = await json(file);
    if (path.basename(processDirectory) === 'browser') { browsers.push({ directory: relative(processDirectory) }); continue; }
    for (const flag of ['controlled', 'fault', 'accounting']) assert.equal(typeof process[flag], 'boolean');
    assert(catalogRoots.includes(ownerRelative(process.env.LOREDOCK_DATA_DIR)), 'Daemon data root was not declared.');
    assert(Object.hasOwn(workingRows, ownerRelative(process.env.LOREDOCK_DATA_DIR)), 'Daemon cannot mutate a declared immutable checkpoint.');
    const exit = await json(path.join(processDirectory, 'exit.json'));
    assert.equal(exit.code, 0); assert.equal(exit.signal, null); assert.equal(exit.spawnError, null);
    const lane = process.fault ? 'fault' : process.accounting ? 'accounting' : 'resource';
    const raw = await readFile(path.join(processDirectory, 'memory-timer.jsonl'), 'utf8'); assert(raw.endsWith('\n'));
    const metrics = assessDaemonSamples(raw.trimEnd().split('\n').map(JSON.parse));
    const row = { directory: relative(processDirectory), data: process.env.LOREDOCK_DATA_DIR, lane, exit, metrics };
    if (lane === 'resource') {
      for (const check of metrics.checks) if (!check.passed) report.failures.push({ process: row.directory, ...check });
      if (!Number.isFinite(exit.shutdownMs) || exit.alreadyExited !== false) report.incomplete.push('Missing normal shutdown boundary: ' + row.directory);
      else if (exit.shutdownMs > 10000) report.failures.push({ process: row.directory, metric: 'shutdownMs', value: exit.shutdownMs, limit: 10000 });
    }
    if (process.controlled) {
      row.runtime = await json(path.join(processDirectory, 'runtime-stats.json'));
      for (const key of ['prepares', 'calls', 'closed']) assert(Number.isSafeInteger(row.runtime[key]) && row.runtime[key] >= 0);
      assert.equal(row.runtime.prepares, row.runtime.closed); report.controlledCalls += row.runtime.calls;
    }
    daemons.push(row);
  }
  function daemonFor(child) {
    const parent = path.dirname(child), base = path.basename(child);
    const candidates = daemons.filter(row => path.dirname(path.join(directory, row.directory)) === parent
      && (!base.startsWith('http-') || path.basename(row.directory) === base.slice(5)));
    assert.equal(candidates.length, 1, 'Ambiguous HTTP/browser process provenance: ' + child);
    return candidates[0];
  }
  const consumedExpectations = new Set();
  for (const file of files.filter(file => path.basename(file) === 'requests.jsonl')) {
    const httpDirectory = path.dirname(file), daemon = daemonFor(httpDirectory), name = relative(httpDirectory);
    const expectedNonSuccess = expectedHttp[name] ?? []; if (Object.hasOwn(expectedHttp, name)) consumedExpectations.add(name);
    const observation = await assessRecordedHttp({ directory: httpDirectory, processDirectory: path.join(directory, daemon.directory), lane: daemon.lane, expectedNonSuccess });
    report.http.push({ directory: name, observation });
    if (daemon.lane === 'resource') {
      report.failures.push(...observation.failures.map(row => ({ http: name, ...row })));
      report.incomplete.push(...observation.incomplete.map(row => ({ http: name, ...row })));
      for (const response of observation.observations) for (const check of response.checks)
        if (!check.withinLimit) report.failures.push({ http: name, request: response.id, ...check });
    }
  }
  assert.deepEqual([...consumedExpectations].sort(), Object.keys(expectedHttp).sort());
  for (const browser of browsers) {
    const browserDirectory = path.join(directory, browser.directory), daemon = daemonFor(browserDirectory);
    browser.observation = await assessRecordedBrowser({ directory: browserDirectory, processDirectory: path.join(directory, daemon.directory), lane: daemon.lane });
    if (daemon.lane === 'resource') {
      report.failures.push(...browser.observation.checks.filter(row => !row.passed).map(row => ({ browser: browser.directory, ...row })));
      report.incomplete.push(...browser.observation.incomplete.map(reason => ({ browser: browser.directory, reason })));
      if (browser.observation.api.http.status !== 'passed') report.incomplete.push('Browser HTTP did not pass: ' + browser.directory);
    }
  }
  // These are stopped working copies only, never any declared input/checkpoint root.
  for (const data of new Set(daemons.map(row => row.data))) {
    const root = ownerRelative(data), expectedRows = workingRows[root];
    const database = new DatabaseSync(path.join(data, 'loredock.db'), { readOnly: true });
    try {
      assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
      assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
      const rows = database.prepare('SELECT w.answerId,w.purged,w.contextHash,w.reviewedHash,w.witness AS witnessJson,w.witnessBytes,a.context AS contextJson FROM answer_witnesses w JOIN answer_attempts a ON a.id=w.answerId ORDER BY w.answerId').all();
      const observation = assessWitnessRows(rows, expectedRows); report.content.push({ root, observation });
      if (observation.status !== 'passed') report.failures.push({ catalog: root, reason: 'retained-content-bound-failed' });
    } finally { database.close(); }
  }
  return report;
}
