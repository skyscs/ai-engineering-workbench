// Ordinary development controls. Never import the consumed kiln corpus or its oracle.
import assert from 'node:assert/strict';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { ordinaryReferences } from '../loredock-prepared-flow/ordinary-oracles.mjs';

export const family = 'ordinary-partial-inventory-diagnosis-01';
export const controls = [
  { id: 'completed', files: 12, codeFiles: 5, status: 'completed', gap: null },
  { id: 'constant', files: 13, codeFiles: 6, status: 'partial', gap: 'unsupported-typescript-profile' },
  { id: 'dynamic-request', files: 13, codeFiles: 6, status: 'partial', gap: 'dynamic-or-unsupported-http-request' },
  { id: 'no-analysis', files: 12, codeFiles: 5, status: 'unavailable', gap: null },
];
export const references = Object.fromEntries(['action', 'request', 'route', 'publish', 'subscribe', 'consumer', 'write', 'selector']
  .map(key => [key, ordinaryReferences[key]]));
export const question = 'How does apply call requestPermit, reach Grants.issue and pass PermitGranted to PermitWriter.onMessage and MongoCollection.replaceOne?';
export function inputFor(id) {
  const control = controls.find(row => row.id === id); assert(control, 'Unknown ordinary control.');
  const corpus = corpusFactory();
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui']['ui/' + name + '.vue'];
  if (id === 'constant') corpus['z-independent-notes']['diagnostics/flag.ts'] = 'export const observerFlag = 1;\n';
  if (id === 'dynamic-request') corpus['z-independent-notes']['diagnostics/endpoint.ts'] =
    'export function readOptionalSummary(destination: string) {\n  return fetch(destination, { method: "GET" });\n}\n';
  assert.equal(Object.keys(corpus).length, 4);
  assert.equal(Object.values(corpus).flatMap(Object.keys).length, control.files);
  assert.equal(Object.values(corpus).flatMap(Object.keys).filter(file => /\.(java|js|ts|vue)$/.test(file)).length, control.codeFiles);
  for (const reference of Object.values(references)) assert(corpus[reference.source]?.[reference.path]?.includes(reference.quote));
  return { corpus, expected: { id: 'O-' + id, question,
    prepared: id === 'no-analysis' ? 'unavailable-omission-required' : 'native-required',
    ...(id === 'no-analysis' ? { setup: 'catalog-only' } : {}), requiredOriginals: Object.keys(references),
    native: { sources: ['a-permit-ui', 'b-permit-api', 'c-permit-store'],
      requiredEdgeKinds: ['http-target', 'event-delivery', 'dispatch-candidate'], topic: 'permit.granted.v3' } } };
}
export const catalogRoots = [...controls.map(row => 'run/' + row.id + '/case/data'),
  'run/no-analysis/case/catalog-only-checkpoint'];
