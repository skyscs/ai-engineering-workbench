import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { assessMemoryReceipt, CONTRACT_ID, CONTRACT_SHA256 } from '../loredock-memory-receipts/assess.mjs';

const script = fileURLToPath(new URL('../loredock-staged-counters/test_reader.py', import.meta.url));
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

test('staged readers retain initial boundaries, descriptors, partial data and one-shot lifecycle', t => {
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
  const initial = role => fixture[role === 'run' ? 'rootInitial' : 'rolesInitial'].observations[role].snapshot;
  const identity = initial('run').identity;
  const environment = { mountId: identity.mountId,
    options: ['rw', 'nsdelegate', 'memory_hugetlb_accounting'], eventsMode: 'hierarchical' };
  // These lifecycle/environment/fsync declarations are synthetic, not reader findings.
  return {
    schemaVersion: 'loredock-memory-receipt/1', contract: { id: CONTRACT_ID, sha256: CONTRACT_SHA256 },
    run: { id: binding.runId, candidateSha256: binding.candidateSha256, bootId: identity.bootId,
      clockId: 'b'.repeat(64), acquiredAtNs: fixture.rootInitial.acquiredAtNs,
      firstChildAtNs: '200', lastExitAtNs: '400', retainedAtNs: '1000',
      allExited: true, forcedCleanup: false, fsynced: true, delegation: 'exclusive', counterMode: 'read-only-never-reset' },
    environment: { initial: environment, final: { ...environment } },
    scopes: Object.fromEntries(['run', 'daemon', 'browser'].map(role => [role,
      { initial: initial(role), checkpoints: [], final: fixture.final.observations[role].snapshot }])),
    diagnostics: { heap: { coverage: 'unavailable', aggregateHeapPeakBytes: null, completeIsolateCoverage: false },
      rss: { coverage: 'unavailable', unavailableSamples: 1 } },
  };
}

test('separate initial windows and unchanged setup peak fit the frozen assessor', () => {
  const input = receipt('valid');
  assert(BigInt(input.scopes.run.initial.window.toNs) < BigInt(input.scopes.daemon.initial.window.fromNs));
  const result = assessMemoryReceipt(JSON.stringify(input), binding);
  assert.equal(result.status, 'PASS', JSON.stringify(result.reasons));
  assert.equal(result.axes.run.values.terminalPeakBytes, '520192');
  assert.equal(result.offlineOnly, true);
  assert.equal(result.resourceQualification, false);
  for (const phase of ['rootInitial', 'rolesInitial', 'final']) {
    assert.equal(fixtures.valid[phase].terminalEstablished, false);
    assert.equal(fixtures.valid[phase].ownershipEstablished, false);
    assert.equal(Object.hasOwn(fixtures.valid[phase], 'fsynced'), false);
  }
  input.run.acquiredAtNs = input.scopes.daemon.initial.window.fromNs;
  const lateBoundary = assessMemoryReceipt(JSON.stringify(input), binding);
  assert.equal(lateBoundary.status, 'UNAVAILABLE');
  assert(lateBoundary.reasons.some(row => row.code === 'INITIAL_READ_ORDER'));
});

test('a complete root breach survives an unavailable final role field', () => {
  const result = assessMemoryReceipt(JSON.stringify(receipt('breach-and-missing')), binding);
  assert.equal(result.status, 'FAIL');
  assert(result.reasons.some(row => row.code === 'CHARGED_MEMORY_EXCEEDED' && row.axis === 'run'));
  assert(result.reasons.some(row => row.code === 'RAW_READ_UNAVAILABLE' && row.axis === 'browser'));
});

test('a missing final root peak is never replaced by its original zero sample', () => {
  const input = receipt('missing-final');
  assert.equal(input.scopes.run.initial.raw['memory.peak'], '0\n');
  assert.equal(Object.hasOwn(input.scopes.run.final.raw, 'memory.peak'), false);
  const result = assessMemoryReceipt(JSON.stringify(input), binding);
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.axes.run.values.terminalPeakBytes, null);
});
