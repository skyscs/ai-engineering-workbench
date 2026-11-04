import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { preparedCorpus } from '../../fixtures/loredock-prepared-qualification/corpus.mjs';
import { services } from '../loredock-prepared-reads/services.mjs';

export async function configuration(pathsPerSource) {
  assert.equal(pathsPerSource, 492);
  const oracle = JSON.parse(await readFile(new URL('../../fixtures/loredock-prepared-qualification/oracle.json', import.meta.url)));
  const preflight = JSON.parse(await readFile(new URL('../../fixtures/loredock-prepared-qualification/preflight.json', import.meta.url)));
  assert.deepEqual(preflight.size, oracle.sizes[0]);
  return { oracle, size: oracle.sizes[0], services, corpusFactory: () => preparedCorpus(pathsPerSource), expectedCorpusHash: preflight.corpusHash };
}
