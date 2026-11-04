import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fields, hash, hex, limits, number, text } from './schema.mjs';

// Stopped caller-owned output only; no live import or source-directory authorization.
export async function readArtifact(root, ref, { afterStat } = {}) {
  assert.ok(typeof root === 'string' && path.isAbsolute(root) && path.resolve(root) === root);
  fields(ref, { file: text(128, 1), bytes: number(limits.receiptBytes), sha256: hex });
  assert.match(ref.file, /^raw\/[A-Za-z0-9_-]+\.json$/);
  for (const directory of [root, path.join(root, 'raw')]) {
    const stat = await lstat(directory); assert.ok(stat.isDirectory() && !stat.isSymbolicLink()); assert.equal(await realpath(directory), directory);
  }
  const file = await open(path.join(root, ref.file), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await file.stat(); assert.ok(before.isFile()); assert.equal(before.size, ref.bytes);
    await afterStat?.();
    const bytes = Buffer.alloc(ref.bytes + 1); let length = 0;
    while (length < bytes.length) { const read = await file.read(bytes, length, bytes.length - length, length); if (!read.bytesRead) break; length += read.bytesRead; }
    const after = await file.stat(); assert.equal(length, ref.bytes);
    for (const key of ['size', 'mtimeMs', 'ctimeMs', 'dev', 'ino']) assert.equal(before[key], after[key]);
    const result = bytes.subarray(0, length); assert.equal(hash(result), ref.sha256); return result;
  } finally { await file.close(); }
}
