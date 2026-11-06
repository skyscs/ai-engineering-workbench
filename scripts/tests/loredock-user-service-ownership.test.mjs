import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('user-service ownership assessment runs twenty prospective offline cases', (t) => {
  const result = spawnSync('/usr/bin/python3', ['-I', '-B', fileURLToPath(
    new URL('../loredock-user-service-ownership/test_assess.py', import.meta.url))], {
    encoding: 'utf8', timeout: 15000, maxBuffer: 65536,
    env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stderr, /Ran 20 tests/);
  assert.match(result.stderr, /\nOK\s*$/);
  t.diagnostic(result.stderr);
});
