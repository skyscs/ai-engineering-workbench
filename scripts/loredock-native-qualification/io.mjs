import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';

export async function readBounded(file, maximum = 1048576) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await handle.stat(); assert.ok(before.isFile() && before.size <= maximum);
    const bytes = Buffer.alloc(before.size + 1); let length = 0;
    while (length < bytes.length) { const item = await handle.read(bytes, length, bytes.length - length, length); if (!item.bytesRead) break; length += item.bytesRead; }
    const after = await handle.stat(); assert.equal(length, before.size);
    for (const key of ['size', 'mtimeMs', 'ctimeMs']) assert.equal(after[key], before[key]); return bytes.subarray(0, length);
  } finally { await handle.close(); }
}
export async function readJSON(file) { return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await readBounded(file))); }
export const normalized = error => ({ name: error.name, code: error.code ?? null, message: error.message, stack: error.stack,
  ...(error instanceof AggregateError ? { errors: error.errors.map(normalized) } : {}) });
