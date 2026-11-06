import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';

export async function digestFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file, { highWaterMark: 65536 })) hash.update(chunk);
  return hash.digest('hex');
}
export async function verifyTree(root, expected) {
  assert(path.isAbsolute(root) && path.resolve(root) === root);
  assert(Array.isArray(expected) && expected.length > 0 && expected.length <= 2000);
  const names = new Set();
  for (const row of expected) {
    assert(typeof row.path === 'string' && row.path && !row.path.includes('\\') && !row.path.includes('\0')
      && !path.posix.isAbsolute(row.path) && path.posix.normalize(row.path) === row.path && !row.path.split('/').includes('..'));
    assert(!names.has(row.path)); names.add(row.path);
    assert(Number.isSafeInteger(row.bytes) && row.bytes >= 0 && /^[0-9a-f]{64}$/.test(row.sha256));
  }
  const actual = [];
  async function walk(relative = '') {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = relative ? relative + '/' + entry.name : entry.name;
      assert(!entry.isSymbolicLink(), 'Input symlinks are not permitted.');
      if (entry.isDirectory()) await walk(name);
      else { assert(entry.isFile()); actual.push(name); assert(actual.length <= 2000); }
    }
  }
  await walk(); assert.deepEqual(actual.sort(), [...names].sort(), 'Installed file set changed.');
  for (const row of expected) {
    const file = path.join(root, row.path), before = await lstat(file);
    assert(before.isFile() && !before.isSymbolicLink()); assert.equal(before.size, row.bytes);
    if (row.mode !== undefined) assert.equal(before.mode & 0o777, row.mode);
    assert.equal(await digestFile(file), row.sha256, 'Input bytes changed: ' + row.path);
    const after = await lstat(file); assert.equal(after.dev, before.dev); assert.equal(after.ino, before.ino);
    assert.equal(after.size, before.size); assert.equal(after.mtimeMs, before.mtimeMs);
  }
}
