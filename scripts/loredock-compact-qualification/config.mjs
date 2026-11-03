import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compactCorpus } from '../../fixtures/loredock-compact-qualification/corpus.mjs';
import { services } from '../loredock-compact-payloads/services.mjs';

export async function configuration(pathsPerSource) {
  assert.equal(pathsPerSource, 494);
  const oracle = JSON.parse(await readFile(new URL('../../fixtures/loredock-compact-qualification/oracle.json', import.meta.url)));
  const preflight = JSON.parse(await readFile(new URL('../../fixtures/loredock-compact-qualification/preflight.json', import.meta.url)));
  assert.deepEqual(preflight.size, oracle.sizes[0]);
  return { oracle, size: oracle.sizes[0], services, corpusFactory: () => compactCorpus(pathsPerSource), expectedCorpusHash: preflight.corpusHash };
}
