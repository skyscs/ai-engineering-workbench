import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalCorpus } from '../../fixtures/loredock-canonical-qualification/corpus.mjs';
import { services } from '../loredock-canonical-facts/services.mjs';

export async function configuration(pathsPerSource) {
  assert.equal(pathsPerSource, 498);
  const oracle = JSON.parse(await readFile(new URL('../../fixtures/loredock-canonical-qualification/oracle.json', import.meta.url)));
  const preflight = JSON.parse(await readFile(new URL('../../fixtures/loredock-canonical-qualification/preflight.json', import.meta.url)));
  assert.deepEqual(preflight.size, oracle.sizes[0]);
  return { oracle, size: oracle.sizes[0], services, corpusFactory: () => canonicalCorpus(pathsPerSource), expectedCorpusHash: preflight.corpusHash };
}
