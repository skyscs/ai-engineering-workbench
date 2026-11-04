import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nativeFinalCorpus } from '../../fixtures/loredock-native-final-qualification/corpus.mjs';

// Trusted frozen data only. Compiled services are fixed by the native worker.
export async function configuration(caseId) {
  assert.equal(caseId, 499);
  const oracle = JSON.parse(await readFile(new URL('../../fixtures/loredock-native-final-qualification/oracle.json', import.meta.url)));
  const preflight = JSON.parse(await readFile(new URL('../../fixtures/loredock-native-final-qualification/preflight.json', import.meta.url)));
  assert.deepEqual(oracle.size, preflight.size);
  return { size: preflight.size, corpusHash: preflight.corpusHash, corpusFactory: () => nativeFinalCorpus(499),
    oracle: oracle.content, complete: oracle.complete, watchdogs: oracle.watchdogs };
}
