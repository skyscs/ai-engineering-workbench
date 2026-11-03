import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { allocationCorpus } from '../../fixtures/loredock-allocation-profile/corpus.mjs';
import { services } from '../loredock-capture-memory/services.mjs';
import { loadProfileOracle } from './inputs.mjs';

const oracle = await loadProfileOracle();
const preflight = JSON.parse(await readFile(new URL('../../fixtures/loredock-allocation-profile/preflight.json', import.meta.url)));
export const config = { oracle, size: oracle.sizes[0], corpusFactory: allocationCorpus,
  expectedCorpusHash: preflight.corpusHash, services, repositoryRoot: fileURLToPath(new URL('../../', import.meta.url)) };
