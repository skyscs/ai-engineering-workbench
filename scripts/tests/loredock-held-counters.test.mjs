import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { assessMemoryReceipt, CONTRACT_ID, CONTRACT_SHA256 } from '../loredock-memory-receipts/assess.mjs';

const script = fileURLToPath(new URL('../loredock-held-counters/test_reader.py', import.meta.url));
const binding = { runId: '11111111-1111-4111-8111-111111111111', candidateSha256: 'a'.repeat(64) };
function python(args = []) {
  const result = spawnSync('/usr/bin/python3', ['-I', '-B', script, ...args], {
    encoding: 'utf8', timeout: 30000, maxBuffer: 1048576,
    env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result;
}

test('held counter readers preserve bounded bytes, identities, windows and descriptor ownership', t => {
  const result = python();
  assert.match(result.stderr, /Ran 28 tests/);
  assert.match(result.stderr, /\nOK\s*$/);
  t.diagnostic(result.stderr);
});

let fixtures;
function receipt(caseName) {
  fixtures ??= JSON.parse(python(['--emit-fixtures']).stdout);
  const fixture = fixtures[caseName];
  assert.equal(fixture.suppliedLifecycleIsSynthetic, true);
  const snapshot = (phase, role) => fixture[phase].observations[role].snapshot;
  const identity = snapshot('initial', 'run').identity;
  const environment = { mountId: identity.mountId,
    options: ['rw', 'nsdelegate', 'memory_hugetlb_accounting'], eventsMode: 'hierarchical' };
  // Lifecycle/environment declarations are synthetic inputs, not findings of the file reader.
  return {
    schemaVersion: 'loredock-memory-receipt/1', contract: { id: CONTRACT_ID, sha256: CONTRACT_SHA256 },
    run: { id: binding.runId, candidateSha256: binding.candidateSha256, bootId: identity.bootId,
      clockId: 'b'.repeat(64), acquiredAtNs: '1', firstChildAtNs: '200', lastExitAtNs: '400', retainedAtNs: '1000',
      allExited: true, forcedCleanup: false, fsynced: true, delegation: 'exclusive', counterMode: 'read-only-never-reset' },
    environment: { initial: environment, final: { ...environment } },
    scopes: Object.fromEntries(['run', 'daemon', 'browser'].map(role => [role,
      { initial: snapshot('initial', role), checkpoints: [], final: snapshot('final', role) }])),
    diagnostics: { heap: { coverage: 'unavailable', aggregateHeapPeakBytes: null, completeIsolateCoverage: false },
      rss: { coverage: 'unavailable', unavailableSamples: 1 } },
  };
}

test('complete temporary-file observations fit the existing assessor without granting live authority', () => {
  const result = assessMemoryReceipt(JSON.stringify(receipt('valid')), binding);
  assert.equal(result.status, 'PASS', JSON.stringify(result.reasons));
  assert.equal(result.offlineOnly, true);
  assert.equal(result.resourceQualification, false);
  assert.equal(result.axes.run.values.terminalPeakBytes, '500');
  for (const phase of ['initial', 'previous', 'final']) {
    assert.equal(fixtures.valid[phase].terminalEstablished, false);
    assert.equal(fixtures.valid[phase].ownershipEstablished, false);
  }
});

test('a complete observed excess survives another unavailable final counter', () => {
  const result = assessMemoryReceipt(JSON.stringify(receipt('breach-and-missing')), binding);
  assert.equal(result.status, 'FAIL');
  assert(result.reasons.some(row => row.code === 'CHARGED_MEMORY_EXCEEDED' && row.axis === 'daemon'));
  assert(result.reasons.some(row => row.code === 'RAW_READ_UNAVAILABLE' && row.axis === 'browser'));
});

test('a missing final peak is not replaced with the earlier complete observation', () => {
  const input = receipt('missing-final');
  assert.equal(fixtures['missing-final'].previous.observations.daemon.snapshot.raw['memory.peak'], '200\n');
  assert.equal(Object.hasOwn(input.scopes.daemon.final.raw, 'memory.peak'), false);
  const result = assessMemoryReceipt(JSON.stringify(input), binding);
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.axes.daemon.values.terminalPeakBytes, null);
});
