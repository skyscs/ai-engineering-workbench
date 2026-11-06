import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { adapt } from '../loredock-container-browser/adapter.mjs';

for (const [name, description] of [
  ['normal', 'persists and verifies the exact ID before one start and confirms actual exit'],
  ['ambiguous_create', 'does not retry or start after losing the create response'],
  ['configuration_mismatch', 'refuses unexpected root execution before start'],
  ['persistence_failure', 'cannot start before the durable identity receipt is saved'],
  ['ambiguous_start', 'stops only the verified ID after an ambiguous start without retry'],
  ['interruption', 'waits for stopped state after TERM and KILL on interruption'],
  ['unavailable_daemon', 'preserves unconfirmed cleanup when the daemon becomes unavailable'],
  ['no_execution_receipt', 'does not treat an unstarted object as a successful execution'],
  ['created_profile', 'refuses an already unconfined created object'],
  ['runtime_profile', 'retains a runtime profile failure while confirming exact-ID cleanup'],
  ['missing_runtime_profile', 'rejects missing applied profile metadata after start'],
]) test('container owner ' + description, () => {
  const result = spawnSync('python3', ['-I', '-S', '-B', fileURLToPath(new URL('../loredock-container-browser/owner-tests.py', import.meta.url)),
    'Ownership.test_' + name], { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 });
  assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stdout + result.stderr);
});

for (const name of ['enforced_default', 'missing_or_wrong_profile', 'missing_or_relaxed_restriction'])
  test('container applied security ' + name.replaceAll('_', ' '), () => {
    const result = spawnSync('python3', ['-I', '-S', '-B', fileURLToPath(new URL('../loredock-container-browser/owner-tests.py', import.meta.url)),
      'AppliedSecurity.test_' + name], { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 });
    assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stdout + result.stderr);
  });

test('container first launch rejects changed, duplicate, escaping and redirected inputs', () => {
  const result = spawnSync('python3', ['-I', '-S', '-B', fileURLToPath(new URL('../loredock-container-browser/owner-tests.py', import.meta.url)),
    'LaunchInputs.test_changed_or_redirected_inputs'], { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 });
  assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('container browser adapter preserves the fixed source and declares only prospective changes', async () => {
  const original = await readFile(new URL('../loredock-prepared-flow/browser.mjs', import.meta.url), 'utf8');
  const result = adapt(original, new URL('../loredock-prepared-flow/', import.meta.url));
  assert.equal(result.record.nominalCadenceMs, 50); assert.equal(result.record.actualMaximumGapMs, 100);
  assert.equal(result.record.browserFlagsChanged, false); assert.equal(result.record.rssAccountingChanged, false);
  assert.equal(result.source.match(/const args = \[[\s\S]*?about:blank'\];/)[0], original.match(/const args = \[[\s\S]*?about:blank'\];/)[0]);
  assert(result.source.includes('memoryTimer = setInterval(() => { void sample(); }, 50)'));
  assert.throws(() => adapt(original + '\n', new URL('../loredock-prepared-flow/', import.meta.url)));
});
