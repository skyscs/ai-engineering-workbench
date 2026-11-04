import assert from 'node:assert/strict';
import { corpusFactory, expectations } from '../loredock-native-assessment/fixture.mjs';
import { hash } from '../loredock-native-assessment/schema.mjs';
import { ceilings, resources } from './assessment.mjs';
const ui = 'a-permit-ui', api = 'b-permit-api', store = 'c-permit-store';
const rootEntries = [['AAApply', 'apply'], ['BBRenew', 'renew'], ['CCRetry', 'retry'], ['DDConfirm', 'confirm']];
const roots = rootEntries.map(([file, action]) => [ui, `ui/${file}.vue`, action, 'vue-action']);
const isolatedRoot = [ui, 'ui/ZZLocate.vue', 'locate', 'vue-action'];
const downstream = [
  [ui, 'ui/request.ts', 'symbol', 'requestPermit', 'function'],
  [ui, 'ui/request.ts', 'http-request', 'POST /permits/grants', null],
  [api, 'routes.json', 'route', 'POST /permits/grants', null],
  [api, 'routes.json', 'handler-reference', 'Grants.issue', null],
  [api, 'Grants.java', 'symbol', 'Grants.issue', 'java-method'],
  [api, 'Grants.java', 'event-publish', 'Publish PermitGranted', null],
  [store, 'PermitWriter.java', 'event-subscribe', 'Subscribe via KafkaSubscriber', null],
  [store, 'PermitWriter.java', 'symbol', 'PermitWriter.onMessage', 'java-method'],
  [store, 'PermitWriter.java', 'document-write', 'MongoCollection.replaceOne', null],
];
const edges = ['calls', 'performs', 'http-target', 'routes-to', 'implements', 'performs', 'event-delivery', 'dispatch-candidate', 'performs'];
export function configuration(caseId) {
  assert.ok(caseId === 0 || caseId === 1); const incomplete = caseId === 1, corpus = corpusFactory(incomplete), expected = expectations(incomplete);
  const originalRanges = rootEntries.map(([file]) => [ui, `ui/${file}.vue`, 1, 7]);
  originalRanges.push([ui, 'ui/request.ts', 1, 4], [api, 'routes.json', 1, 1], [api, 'contracts/PermitGranted.json', 1, 1], [api, 'Grants.java', 1, 11]);
  if (!incomplete) originalRanges.push([store, 'contracts/PermitGranted.json', 1, 1], [store, 'PermitWriter.java', 1, 14]);
  // The incomplete route does not need either contract, so only seven originals remain.
  const originals = incomplete ? originalRanges.filter(row => row[1] !== 'contracts/PermitGranted.json') : originalRanges;
  return { corpusFactory: () => corpus, corpusHash: hash(JSON.stringify(corpus)),
    size: { ...expected.size, bytes: Object.values(corpus).flatMap(files => Object.values(files)).reduce((sum, text) => sum + Buffer.byteLength(text), 0) },
    oracle: { ...expected.oracle, selectedRoot: roots[0], limits: ceilings, resources },
    complete: { sources: Object.keys(corpus), roots, isolatedRoot,
      flows: roots.slice(0, 2).map(root => ({ nodes: [[...root.slice(0, 2), 'symbol', ...root.slice(2)], ...downstream.slice(0, incomplete ? 6 : 9)], edges: edges.slice(0, incomplete ? 6 : 9) })),
      originals, isolatedOriginals: [...rootEntries.map(([file]) => [ui, `ui/${file}.vue`, 1, 7]), [ui, 'ui/ZZLocate.vue', 1, 6]] } };
}
