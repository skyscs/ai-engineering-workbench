import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { boundedWriteFinalCorpus } from '../../fixtures/loredock-bounded-write-final-qualification/corpus.mjs';

// Frozen trusted input. The accepted driver selects actual compiled services.
export async function configuration(caseId) {
  assert.equal(caseId, 500);
  const oracle = JSON.parse(await readFile(new URL('../../fixtures/loredock-bounded-write-final-qualification/oracle.json', import.meta.url)));
  const preflight = JSON.parse(await readFile(new URL('../../fixtures/loredock-bounded-write-final-qualification/preflight.json', import.meta.url)));
  assert.deepEqual(oracle.size, preflight.size);
  return { size: preflight.size, corpusHash: preflight.corpusHash, corpusFactory: () => boundedWriteFinalCorpus(500),
    oracle: oracle.content, complete: oracle.complete, watchdogs: oracle.watchdogs };
}
