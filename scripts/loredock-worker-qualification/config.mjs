import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { workerCorpus } from '../../fixtures/loredock-worker-qualification/corpus.mjs';
import { services } from '../loredock-worker-reads/services.mjs';

export async function configuration(pathsPerSource) {
  assert.equal(pathsPerSource, 498);
  const oracle = JSON.parse(await readFile(new URL('../../fixtures/loredock-worker-qualification/oracle.json', import.meta.url)));
  const preflight = JSON.parse(await readFile(new URL('../../fixtures/loredock-worker-qualification/preflight.json', import.meta.url)));
  assert.deepEqual(preflight.size, oracle.sizes[0]);
  return { oracle, size: oracle.sizes[0], services, corpusFactory: () => workerCorpus(pathsPerSource), expectedCorpusHash: preflight.corpusHash };
}
