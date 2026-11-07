import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Invert only the reviewed constructor dependency; every other historical byte stays pinned.
export function beforeControlledServer(file, raw) {
  if (file !== 'apps/loredock/src/server.ts') return raw;
  const originalHash = '1616b645be5b0e0bdbf8413a4cfd373015f37dbf13ab4e397f61d16c551ae3c7';
  const hash = value => createHash('sha256').update(value).digest('hex');
  if (hash(raw) === originalHash) return raw;
  let text = raw.toString();
  for (const [after, before] of [
    ["import type { TextRuntime } from '@aew/ai';\n", ''],
    ['port?: number; textRuntime?: TextRuntime }', 'port?: number }'],
    ['new Answers(this.catalog, this.options.textRuntime, this.preparations)', 'new Answers(this.catalog, undefined, this.preparations)'],
  ]) {
    assert.equal(text.split(after).length, 2, 'The controlled-server delta must occur exactly once.');
    text = text.replace(after, before);
  }
  assert.equal(hash(text), originalHash, 'Undeclared production server change.');
  return Buffer.from(text);
}
