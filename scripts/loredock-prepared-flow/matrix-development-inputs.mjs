// Ordinary integration rehearsal: the small original control plus the unchanged sparse near-limit shape.
import assert from 'node:assert/strict';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { ordinaryCorpus, ordinaryCases, ordinaryReferences, ordinaryNote } from './ordinary-oracles.mjs';
import { matrixCatalogRoots, matrixWorkingRows } from './matrix-layout.mjs';

export const family = 'ordinary-matrix-integration-01';
export const claimPath = '/home/toshiba/aew/task128-matrix-first.claim.json';
export const catalogRoots = matrixCatalogRoots(ordinaryCases.map(row => row.id));
export const workingRows = matrixWorkingRows(ordinaryCases.map(row => row.id));
export function inputFor(size) {
  assert(['representative', 'near-limit'].includes(size));
  const corpus = corpusFactory();
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  if (size === 'near-limit') {
    for (let i = 1; i <= 16; i++) corpus['m-padding-' + String(i).padStart(2, '0')] = { 'README.md': '# Ordinary padding\n' };
    for (const files of Object.values(corpus)) for (let i = Object.keys(files).length; i < 500; i++)
      files['padding/constant-' + String(i).padStart(4, '0') + '.ts'] = 'export const padding' + i + ' = 1;\n';
  }
  const expectedFiles = size === 'representative' ? 12 : 10000;
  assert.equal(Object.values(corpus).reduce((sum, files) => sum + Object.keys(files).length, 0), expectedFiles);
  return { corpus, expectedFiles, expectedCodeFiles: Object.values(corpus).flatMap(Object.keys).filter(file => /\.(java|js|ts|vue)$/.test(file)).length,
    question: 'How does apply reach PermitWriter.onMessage through permit.granted.v3?',
    expected: { prepared: 'native-required', native: { sources: ['a-permit-ui', 'b-permit-api', 'c-permit-store'],
      requiredEdgeKinds: ['http-target', 'event-delivery', 'dispatch-candidate'], topic: 'permit.granted.v3' } } };
}
export const definition = { inputFor, oracleInputFor: ordinaryCorpus, oracles: ordinaryCases,
  sourceName: 'z-independent-notes', references: ordinaryReferences, engineerNote: ordinaryNote,
  noteTarget: { kind: 'http-target', from: { source: 'a-permit-ui', path: 'ui/request.ts' },
    to: { source: 'b-permit-api', path: 'routes.json' }, requiredOriginals: ['request', 'header'] } };
