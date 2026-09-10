import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { verifiedVersion, verifyProfile } from '../runtime-preflight.mjs';

test('default selection is explicit; named profiles require a readable separate file', async (t) => {
  const codexHome = await mkdtemp(path.join(tmpdir(), 'aew-profile-test-'));
  t.after(() => rm(codexHome, { recursive: true, force: true }));
  const options = { version: verifiedVersion, codexHome };
  assert.deepEqual(await verifyProfile(options), { selection: 'default', profile: null });
  // A legacy table must not make a missing modern profile appear valid.
  await writeFile(path.join(codexHome, 'config.toml'), '[profiles.corporate]\nmodel="fixture"\n');
  await assert.rejects(verifyProfile({ ...options, profile: 'corporate' }), { code: 'missing_profile' });
  await writeFile(path.join(codexHome, 'corporate.config.toml'), 'model="fixture"\n');
  assert.deepEqual(await verifyProfile({ ...options, profile: 'corporate' }),
    { selection: 'named', profile: 'corporate' });
});

test('unverified versions, path traversal and non-regular profiles are rejected', async (t) => {
  const codexHome = await mkdtemp(path.join(tmpdir(), 'aew-profile-test-'));
  t.after(() => rm(codexHome, { recursive: true, force: true }));
  const options = { version: verifiedVersion, codexHome };
  await assert.rejects(verifyProfile({ ...options, version: 'codex-cli 0.1.0' }), { code: 'unsupported_version' });
  for (const profile of ['', '../auth', '/tmp/profile', 'two words', 'a.b', 3]) {
    await assert.rejects(verifyProfile({ ...options, profile }), { code: 'invalid_profile' });
  }
  await mkdir(path.join(codexHome, 'directory.config.toml'));
  await writeFile(path.join(codexHome, 'target.toml'), 'model="fixture"\n');
  await symlink('target.toml', path.join(codexHome, 'linked.config.toml'));
  for (const profile of ['directory', 'linked']) {
    await assert.rejects(verifyProfile({ ...options, profile }), { code: 'unsupported_profile_file' });
  }
});
