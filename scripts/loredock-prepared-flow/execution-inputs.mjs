// Data-only binding to the original frozen vectors and oracle. Never import the application here.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { corpusFactory } from '../../fixtures/loredock-prepared-flow/corpus.mjs';
import { matrixCatalogRoots, matrixWorkingRows } from './matrix-layout.mjs';

const oracle = JSON.parse(await readFile(new URL('../../fixtures/loredock-prepared-flow/oracle.json', import.meta.url)));
const freeze = JSON.parse(await readFile(new URL('../../fixtures/loredock-prepared-flow/freeze.json', import.meta.url)));
export const family = 'kiln-prepared-flow-127';
export const ownerOutput = '/home/toshiba/aew/task128-kiln-first';
export const claimPath = '/home/toshiba/aew/task128-kiln-first.claim.json';
export const catalogRoots = matrixCatalogRoots(oracle.cases.map(row => row.id));
export const workingRows = matrixWorkingRows(oracle.cases.map(row => row.id));

export function inputFor(size) {
  assert(['representative', 'near-limit'].includes(size));
  const corpus = corpusFactory(size), count = freeze.variants[size];
  assert.equal(Object.keys(corpus).length, count.sources);
  assert.equal(Object.values(corpus).flatMap(Object.keys).length, count.files);
  assert.equal(Object.values(corpus).flatMap(Object.keys).filter(file => /\.(java|js|ts|vue)$/.test(file)).length, count.eligibleCodeExtensions);
  return { corpus, expectedFiles: count.files, expectedCodeFiles: count.eligibleCodeExtensions,
    question: oracle.cases[0].question, expected: oracle.cases[0] };
}

export const definition = { inputFor, oracleInputFor: corpusFactory, oracles: oracle.cases,
  references: oracle.references, engineerNote: oracle.engineerNote, sourceName: 't-boundary-notes', reservedFamily: family,
  noteTarget: { kind: 'http-target', from: { source: 'a-kiln-console', path: 'src/queue.ts' },
    to: { source: 'b-firing-gateway', path: 'routes.json' }, requiredOriginals: ['request', 'header'] } };

export const executionPlan = { family, ownerOutput, claimPath, catalogRoots, workingRows,
  representative: freeze.variants.representative, nearLimit: freeze.variants['near-limit'],
  warmRepetitions: 3, oracleCases: oracle.cases.map(row => row.id), resourceQualification: false, modelEligibility: false,
  continuation: 'Only verified failed fresh analysis, measured threshold failures and source-assessment failures may continue after normal teardown. Missing functional checkpoints produce not-run cases. Unknown errors stop later cases. No retries.' };
