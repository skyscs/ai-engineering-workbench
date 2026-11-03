import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { terminalCorpus } from '../../fixtures/loredock-terminal-memory/corpus.mjs';
import { services } from '../loredock-streaming-snapshot/services.mjs';

export async function configuration(pathsPerSource) {
  assert.equal(pathsPerSource, 496);
  const oracle = JSON.parse(await readFile(new URL('../../fixtures/loredock-terminal-memory/oracle.json', import.meta.url)));
  const preflight = JSON.parse(await readFile(new URL('../../fixtures/loredock-terminal-memory/preflight.json', import.meta.url)));
  assert.deepEqual(preflight.size, oracle.sizes[0]);
  return { oracle, size: oracle.sizes[0], services, terminalLimits: oracle.terminal,
    corpusFactory: () => terminalCorpus(pathsPerSource), expectedCorpusHash: preflight.corpusHash };
}
