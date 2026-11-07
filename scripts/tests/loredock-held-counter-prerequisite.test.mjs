import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { assessRetainedCounterRun } from '../loredock-held-counter-prerequisite/assess.mjs';

const script = fileURLToPath(new URL('../loredock-held-counter-prerequisite/test_probe.py', import.meta.url));
const binding = { runId: '11111111-1111-4111-8111-111111111111', candidateSha256: 'a'.repeat(64) };
function python(args = []) {
  const result = spawnSync('/usr/bin/python3', ['-I', '-B', script, ...args], {
    encoding: 'utf8', timeout: 30000, maxBuffer: 2097152,
    env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result;
}

test('counter prerequisite admission, wait, retention and FD isolation pass offline Python checks', t => {
  const result = python();
  assert.match(result.stderr, /Ran 16 tests/);
  assert.match(result.stderr, /\nOK\s*$/);
  t.diagnostic(result.stderr);
});

let fixtures;
function records(name) {
  fixtures ??= JSON.parse(python(['--emit-fixtures']).stdout);
  const fixture = fixtures[name];
  assert.equal(fixture.syntheticLifecycle, true);
  assert.equal(fixture.calls, 1);
  // Ownership and outside service closure are declarations in this offline fixture only.
  return { ...fixture.records,
    'ownership-assessment.json': JSON.stringify({ status: 'PASS' }),
    'assessment.json': JSON.stringify({ status: fixture.code === 0 ? 'PASS' : 'UNAVAILABLE',
      manifestSha256: binding.candidateSha256, inputsUnchanged: true, ownedGroupEmpty: true,
      forcedCleanup: false, counterAcquisitionEstablished: fixture.code === 0 }),
  };
}

test('complete retained synthetic records fit the unchanged assessor without qualification', () => {
  const result = assessRetainedCounterRun(records('valid'), binding);
  assert.equal(result.status, 'PASS', JSON.stringify(result.reasons));
  assert.equal(result.memoryAssessment.axes.run.values.terminalPeakBytes, '500');
  assert.equal(result.rawDiagnosticAssessment.status, 'UNAVAILABLE');
  assert.equal(result.offlineOnly, true);
  assert.equal(result.executorQualified, false);
  assert.equal(result.resourceQualification, false);
});

test('missing final fields and missing normal wait remain unavailable', () => {
  for (const name of ['missing-final', 'failed-wait', 'lost-retention']) {
    const result = assessRetainedCounterRun(records(name), binding);
    assert.equal(result.status, 'UNAVAILABLE', name);
  }
});

test('known excess survives another missing counter and later retention failure', () => {
  for (const name of ['breach-and-missing', 'breach-lost-retention']) {
    const result = assessRetainedCounterRun(records(name), binding);
    assert.equal(result.status, 'FAIL', name);
    assert(result.memoryAssessment.reasons.some(row => row.code === 'CHARGED_MEMORY_EXCEEDED'));
    assert(result.reasons.some(row => row.status === 'UNAVAILABLE'));
  }
});

test('canonical Unicode preserves a known pressure event beside an invalid event line', () => {
  const result = assessRetainedCounterRun(records('unicode-and-breach'), binding);
  assert.equal(result.status, 'FAIL');
  assert(result.memoryAssessment.reasons.some(row => row.code === 'MEMORY_PRESSURE_EVENT'));
  assert(result.memoryAssessment.reasons.some(row => row.code === 'EVENT_FORMAT'));
  assert(!result.memoryAssessment.reasons.some(row => row.code === 'RECEIPT_ENCODING'));
});

test('lost receipt still exposes a retained raw breach and never supplies a success', () => {
  for (const [name, status] of [['valid', 'UNAVAILABLE'], ['breach-lost-retention', 'FAIL']]) {
    const input = records(name);
    delete input['memory-receipt.json'];
    const result = assessRetainedCounterRun(input, binding);
    assert.equal(result.status, status);
    assert.notEqual(result.memoryAssessment.status, 'PASS');
    assert.notEqual(result.rawDiagnosticAssessment.status, 'PASS');
  }
});

test('changed inventory, time, receipt projection and candidate binding cannot pass', () => {
  const mutations = [input => { input['counter-initial.json'] += ' '; },
    input => { delete input['counter-raw-inventory.json']; },
    input => { const row = JSON.parse(input['counter-lifetime.json']); row.creationLowerBoundNs = '0'; input['counter-lifetime.json'] = JSON.stringify(row); },
    input => { const row = JSON.parse(input['counter-retention.json']); row.receiptRetainedAtNs = '0'; input['counter-retention.json'] = JSON.stringify(row); },
    input => { const row = JSON.parse(input['memory-receipt.json']); row.scopes.run.final.raw['memory.peak'] = '400\n'; input['memory-receipt.json'] = JSON.stringify(row); }];
  for (const mutate of mutations) {
    const input = records('valid');
    mutate(input);
    assert.equal(assessRetainedCounterRun(input, binding).status, 'UNAVAILABLE');
  }
  assert.equal(assessRetainedCounterRun(records('valid'), { ...binding, candidateSha256: 'c'.repeat(64) }).status, 'UNAVAILABLE');
});

test('offline retained record capacity and encoding are bounded', () => {
  for (const input of [null, [], { 'bad/name.json': '{}' }, { 'large.json': 'x'.repeat(1048577) },
    { 'first.json': 'x'.repeat(1048576), 'second.json': 'x'.repeat(1048576), 'third.json': '{}' }]) {
    assert.equal(assessRetainedCounterRun(input, binding).status, 'UNAVAILABLE');
  }
  assert.equal(assessRetainedCounterRun({ 'bad.json': '{' }, binding).status, 'UNAVAILABLE');
});

test('outside CLI binds the manifest and claim and retains evidence acquisition errors', () => {
  const directory = mkdtempSync(join(tmpdir(), 'loredock-counter-offline-'));
  try {
    const output = join(directory, 'first');
    mkdirSync(output);
    const manifest = JSON.stringify({ schemaVersion: 'loredock-held-counter-prerequisite/1',
      runId: binding.runId, unit: 'synthetic.service', output, candidateHead: 'synthetic' });
    const hash = createHash('sha256').update(manifest).digest('hex');
    const path = join(directory, 'manifest.json');
    writeFileSync(path, manifest);
    writeFileSync(output + '.claim', JSON.stringify({ manifestSha256: hash, unit: 'synthetic.service' }));
    // The old fixture receipt deliberately has a different manifest binding: no live authority.
    for (const [name, raw] of Object.entries(records('valid'))) writeFileSync(join(output, name), raw);
    symlinkSync(join(directory, 'absent'), join(output, 'unreadable.json'));
    const result = spawnSync(process.execPath, [fileURLToPath(new URL(
      '../loredock-held-counter-prerequisite/postprocess.mjs', import.meta.url)), path, hash],
    { encoding: 'utf8', timeout: 10000, maxBuffer: 1048576, env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' } });
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.manifestSha256, hash);
    assert.equal(report.assessment.status, 'UNAVAILABLE');
    assert.equal(report.errors.length, 1);
    assert.equal(report.errors[0].path, 'unreadable.json');
    assert(report.inventory.some(row => row.path === 'counter-final.json'));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
