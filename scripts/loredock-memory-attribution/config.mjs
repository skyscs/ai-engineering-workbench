import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { attributionCorpus } from '../../fixtures/loredock-memory-attribution/corpus.mjs';
import { services } from '../loredock-capture-memory/services.mjs';

export async function configuration(pathsPerSource) {
  const oracle = JSON.parse(await readFile(new URL('../../fixtures/loredock-memory-attribution/oracle.json', import.meta.url)));
  const preflight = JSON.parse(await readFile(new URL('../../fixtures/loredock-memory-attribution/preflight.json', import.meta.url)));
  const size = oracle.sizes.find(row => row.pathsPerSource === pathsPerSource);
  assert.ok(size);
  // Fresh readers load fixed expectations but never construct or retain the source corpus.
  return { size, oracle, corpusFactory: () => attributionCorpus(pathsPerSource), services,
    expectedCorpusHash: preflight.vectors.find(row => row.pathsPerSource === pathsPerSource).corpusHash };
}
