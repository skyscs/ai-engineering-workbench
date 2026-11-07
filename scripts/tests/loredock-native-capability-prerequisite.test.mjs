import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('native capability reduction gates direct birth through intercepted self-only operations', (t) => {
  const result = spawnSync('/usr/bin/python3', ['-I', '-B', fileURLToPath(
    new URL('../loredock-native-capability-prerequisite/test_probe.py', import.meta.url))], {
    encoding: 'utf8', timeout: 30000, maxBuffer: 65536,
    env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stderr, /Ran 4 tests/);
  assert.match(result.stderr, /\nOK\s*$/);
  assert.match(result.stdout, /Capability boundary cases passed: 26/);
  t.diagnostic(result.stderr + result.stdout);
});
