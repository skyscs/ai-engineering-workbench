import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { qualificationCorpus } from '../../fixtures/loredock-streaming-qualification/corpus.mjs';
import { services } from '../loredock-streaming-snapshot/services.mjs';

export async function configuration(pathsPerSource) {
  const oracle = JSON.parse(await readFile(new URL('../../fixtures/loredock-streaming-qualification/oracle.json', import.meta.url)));
  const preflight = JSON.parse(await readFile(new URL('../../fixtures/loredock-streaming-qualification/preflight.json', import.meta.url)));
  const size = oracle.sizes.find(row => row.pathsPerSource === pathsPerSource); assert.ok(size);
  return { size, oracle, services, corpusFactory: () => qualificationCorpus(pathsPerSource),
    expectedCorpusHash: preflight.vectors.find(row => row.pathsPerSource === pathsPerSource).corpusHash };
}
