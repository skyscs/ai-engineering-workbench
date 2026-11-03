import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { open, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { hash, receiptLimits } from './codec.mjs';

// Read only a stopped, caller-owned worker directory. Never follow recorded result.file.
export async function readArtifact(root, ref) {
  assert.ok(path.isAbsolute(root) && root === path.resolve(root), 'Use a canonical owned artifact root.');
  assert.ok(ref && typeof ref.file === 'string' && /^raw\/[a-zA-Z0-9_-]+\.json$/.test(ref.file), 'Invalid artifact reference.');
  assert.ok(Number.isSafeInteger(ref.bytes) && ref.bytes >= 0 && ref.bytes <= receiptLimits.receiptBytes * 2, 'Invalid artifact byte bound.');
  assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  for (const directory of [root, path.join(root, 'raw')]) {
    const stat = await lstat(directory);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && await realpath(directory) === directory, 'Artifact directories must not contain symlinks.');
  }
  const file = await open(path.join(root, ref.file), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await file.stat();
    assert.ok(before.isFile() && before.size === ref.bytes, 'Artifact length or file type mismatch.');
    // A growing file cannot turn the declared bound into an unbounded readFile allocation.
    const bytes = Buffer.alloc(ref.bytes + 1); let length = 0;
    while (length < bytes.length) {
      const chunk = await file.read(bytes, length, bytes.length - length, length);
      if (!chunk.bytesRead) break; length += chunk.bytesRead;
    }
    const after = await file.stat();
    assert.equal(length, ref.bytes); assert.equal(after.size, before.size); assert.equal(after.mtimeMs, before.mtimeMs);
    const result = bytes.subarray(0, length); assert.equal(hash(result), ref.sha256, 'Artifact hash mismatch.');
    return result;
  } finally { await file.close(); }
}
