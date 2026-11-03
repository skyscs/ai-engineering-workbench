import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { limitsFor } from './limits.mjs';

export async function readSnapshot(root, ref, reduced) {
  const limits = limitsFor(reduced);
  assert.ok(path.isAbsolute(root) && await realpath(root) === root);
  assert.match(ref.file, /^(after-history|after-release)\.heapsnapshot$/);
  assert.ok(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= limits.fileBytes);
  assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  const file = await open(path.join(root, ref.file), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await file.stat(); assert.ok(info.isFile() && info.size === ref.bytes);
    const bytes = Buffer.alloc(ref.bytes + 1); let used = 0;
    while (used < bytes.length) { const result = await file.read(bytes, used, bytes.length - used, used);
      if (!result.bytesRead) break; used += result.bytesRead; }
    const after = await file.stat(); assert.equal(used, ref.bytes); assert.equal(after.size, info.size); assert.equal(after.mtimeMs, info.mtimeMs);
    const result = bytes.subarray(0, used);
    assert.equal(createHash('sha256').update(result).digest('hex'), ref.sha256); return result;
  } finally { await file.close(); }
}
