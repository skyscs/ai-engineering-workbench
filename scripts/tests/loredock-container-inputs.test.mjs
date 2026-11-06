import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyBrowserInputs } from '../loredock-container-browser/inputs.mjs';

async function fixture(t) {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'aew-browser-inputs-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = path.join(parent, 'chrome'); await mkdir(root, { mode: 0o755 });
  await mkdir(path.join(root, 'empty'), { mode: 0o700 });
  await writeFile(path.join(root, 'browser'), 'unchanged', { mode: 0o644 });
  const directories = [];
  for (const name of ['.', 'empty']) {
    const stat = await lstat(path.join(root, name));
    directories.push({ path: name, kind: 'directory', mode: stat.mode & 0o7777, uid: stat.uid, gid: stat.gid });
  }
  const files = [{ path: 'browser', bytes: 9, mode: 0o644, sha256: createHash('sha256').update('unchanged').digest('hex') }];
  return { parent, root, files, directories, verify: () => verifyBrowserInputs(root, files, directories) };
}

test('container inputs include readable empty directories under the actual user', async t => {
  const f = await fixture(t), result = await f.verify();
  assert.deepEqual(result.directories, f.directories);
});

for (const key of ['uid', 'gid', 'mode']) test('container inputs reject matching file hashes with changed directory ' + key, async t => {
  const f = await fixture(t); f.directories[1][key] += 1;
  await assert.rejects(f.verify(), /Directory metadata changed/);
});

test('container inputs reject unreadable directories even when metadata and file hashes match', async t => {
  const f = await fixture(t); await chmod(path.join(f.root, 'empty'), 0);
  f.directories[1].mode = 0;
  try { await assert.rejects(f.verify(), /owner needs read and traversal/); }
  finally { await chmod(path.join(f.root, 'empty'), 0o700); }
});

test('container inputs reject an extra empty directory', async t => {
  const f = await fixture(t); await mkdir(path.join(f.root, 'extra'));
  await assert.rejects(f.verify(), /Unexpected browser directory/);
});

test('container inputs reject a missing empty directory', async t => {
  const f = await fixture(t); await rm(path.join(f.root, 'empty'), { recursive: true });
  await assert.rejects(f.verify(), /directory set changed/);
});

test('container inputs reject changed file bytes with unchanged directory metadata', async t => {
  const f = await fixture(t); await writeFile(path.join(f.root, 'browser'), 'different');
  await assert.rejects(f.verify(), /Input bytes changed/);
});

test('container inputs reject redirected roots, parents and child directories', async t => {
  const f = await fixture(t); const link = path.join(f.parent, 'link'); await symlink(f.root, link);
  await assert.rejects(verifyBrowserInputs(link, f.files, f.directories), /redirected/);
  const parentLink = path.join(f.parent, 'parent-link'); await symlink(f.parent, parentLink);
  await assert.rejects(verifyBrowserInputs(path.join(parentLink, 'chrome'), f.files, f.directories), /redirected/);
  await rename(path.join(f.root, 'empty'), path.join(f.parent, 'moved'));
  await symlink(path.join(f.parent, 'moved'), path.join(f.root, 'empty'));
  await assert.rejects(f.verify(), /symlinks are not permitted/);
});

test('container inputs reject malformed and duplicate directory records', async t => {
  const f = await fixture(t);
  for (const name of ['../escape', '/absolute', 'empty/../empty', 'empty/', 'empty\\child'])
    await assert.rejects(verifyBrowserInputs(f.root, f.files, [f.directories[0], { ...f.directories[1], path: name }]));
  await assert.rejects(verifyBrowserInputs(f.root, f.files, [...f.directories, f.directories[1]]), /Duplicate/);
  await assert.rejects(verifyBrowserInputs(f.root, f.files, [f.directories[1]]), /Root directory/);
});

test('container inputs verify declared parent metadata', async t => {
  const f = await fixture(t), stat = await lstat(f.parent);
  const parent = { path: f.parent, kind: 'directory', mode: stat.mode & 0o7777, uid: stat.uid, gid: stat.gid };
  assert.deepEqual((await verifyBrowserInputs(f.root, f.files, f.directories, [parent])).parents, [parent]);
  await assert.rejects(verifyBrowserInputs(f.root, f.files, f.directories, [{ ...parent, mode: 0 }]), /Directory metadata/);
});
