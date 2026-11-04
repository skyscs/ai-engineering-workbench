import assert from 'node:assert/strict';
import { configuration as base } from './compact-qualification-config.js';
// @ts-expect-error Independent tiny process configuration; no resource corpus.
import { createPreparedReads } from '../../../../scripts/loredock-prepared-reads/reuse.mjs';

export async function configuration(size: number) {
  assert.equal(size, 0); const config = await base(size);
  return { ...config, services: { ...config.services, ...createPreparedReads(config.services) } };
}
