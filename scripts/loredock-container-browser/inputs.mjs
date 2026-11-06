import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { access, lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { digestFile, verifyTree } from '../loredock-browser-eligibility/verify.mjs';

function relativeName(name) {
  assert(typeof name === 'string' && name && !name.includes('\\') && !name.includes('\0')
    && !path.posix.isAbsolute(name) && path.posix.normalize(name) === name && !name.split('/').includes('..'));
}

async function directory(file, expected, owned) {
  assert.equal(expected.kind, 'directory');
  for (const key of ['mode', 'uid', 'gid']) assert(Number.isSafeInteger(expected[key]) && expected[key] >= 0);
  assert(expected.mode <= 0o7777);
  const stat = await lstat(file);
  assert(stat.isDirectory() && !stat.isSymbolicLink(), 'Expected a real directory: ' + file);
  const actual = { path: expected.path, kind: 'directory', mode: stat.mode & 0o7777, uid: stat.uid, gid: stat.gid };
  assert.deepEqual(actual, expected, 'Directory metadata changed: ' + file);
  if (owned) {
    assert.equal(stat.uid, process.geteuid(), 'Browser directory must belong to the runtime user.');
    assert.equal(stat.gid, process.getegid(), 'Browser directory must belong to the runtime group.');
    assert.equal(stat.mode & 0o500, 0o500, 'Browser owner needs read and traversal permission.');
  }
  await access(file, constants.R_OK | constants.X_OK);
  return { actual, dev: stat.dev, ino: stat.ino };
}

export async function verifyBrowserInputs(root, files, directories, parents = []) {
  assert(path.isAbsolute(root) && path.resolve(root) === root);
  assert.equal(await realpath(root), root, 'Input root or parent is redirected.');
  assert(Array.isArray(directories) && directories.length > 0 && directories.length <= 256);
  const expected = new Map();
  for (const row of directories) {
    relativeName(row.path); assert(!expected.has(row.path), 'Duplicate directory.'); expected.set(row.path, row);
  }
  assert(expected.has('.'), 'Root directory metadata is required.');
  const parentRows = [];
  const seenParents = new Set();
  for (const row of parents) {
    assert(path.isAbsolute(row.path) && path.resolve(row.path) === row.path && row.path !== root);
    assert(root.startsWith(row.path === '/' ? '/' : row.path + '/'));
    assert(!seenParents.has(row.path)); seenParents.add(row.path);
    parentRows.push((await directory(row.path, row, false)).actual);
  }
  const observed = new Map();
  async function walk(relative) {
    assert(expected.has(relative), 'Unexpected browser directory: ' + relative);
    const file = path.join(root, relative);
    observed.set(relative, await directory(file, expected.get(relative), true));
    const entries = await readdir(file, { withFileTypes: true });
    assert(entries.length <= 2000);
    for (const entry of entries) {
      assert(!entry.isSymbolicLink(), 'Browser input symlinks are not permitted.');
      if (entry.isDirectory()) await walk(relative === '.' ? entry.name : relative + '/' + entry.name);
      else assert(entry.isFile(), 'Unexpected browser input type.');
    }
  }
  await walk('.');
  assert.deepEqual([...observed.keys()].sort(), [...expected.keys()].sort(), 'Browser directory set changed.');
  await verifyTree(root, files);
  for (const [name, before] of observed) {
    const after = await directory(path.join(root, name), expected.get(name), true);
    assert.deepEqual(after, before, 'Directory identity changed during verification.');
  }
  return { directories: [...observed.values()].map(row => row.actual).sort((a, b) => a.path.localeCompare(b.path)), parents: parentRows };
}

export async function verifyRuntimeInputs() {
  assert.equal(process.versions.node, '22.23.2'); assert.deepEqual(process.execArgv, []);
  assert(!process.env.NODE_OPTIONS); assert.equal(process.getuid(), 1000); assert.equal(process.getgid(), 1000);
  const manifestPath = '/opt/workbench/control-inputs.json';
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.version, 'container-runtime-inputs/1');
  assert.deepEqual(manifest.browserParents.map(row => row.path), ['/', '/opt']);
  assert.equal(await digestFile('/opt/node/node'), manifest.nodeSha256);
  const browser = await verifyBrowserInputs('/opt/chrome', manifest.browserFiles, manifest.browserDirectories, manifest.browserParents);
  for (const row of manifest.scripts) assert.equal(await digestFile('/opt/workbench/' + row.path), row.sha256, row.path);
  return { verified: true, version: manifest.version, manifestSha256: await digestFile(manifestPath),
    uid: process.getuid(), gid: process.getgid(), nodeVersion: process.versions.node,
    browserFiles: manifest.browserFiles.length, browserDirectories: browser.directories,
    browserParents: browser.parents, scriptFiles: manifest.scripts.length };
}
