import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectCandidateLinks } from '../src/candidate-links.js';
// @ts-expect-error The independent offline qualification helper is plain JavaScript.
import { verifySourceOrderContract, evaluateSourceOrderExamples, strongestLinkOrder, sourceOrderExample } from '../../../scripts/loredock-source-order.mjs';
// @ts-expect-error Frozen qualification cases are plain JavaScript.
import { sourceOrderCases } from '../../../fixtures/loredock-source-order/cases.mjs';

test('frozen source ordering mechanics retain bounds and expose the critical configuration counterexample', async () => {
  await verifySourceOrderContract();
  const results = evaluateSourceOrderExamples(selectCandidateLinks) as { id: string; criticalLoss: string[] }[];
  assert.equal(results.length, 12);
  assert.deepEqual(results.filter(row => row.criticalLoss.length).map(row => [row.id, row.criticalLoss]), [['o12', ['b']]]);
});

test('offline source ordering still rejects foreign evidence and preserves original code direction', () => {
  const input = sourceOrderExample(sourceOrderCases[4]);
  const first = strongestLinkOrder(input.context, input.selection, input.links, selectCandidateLinks).selection;
  assert.equal(first.sources[0].links[0].from.sourceId, 'a'); assert.equal(first.sources[0].links[0].to.sourceId, 'b');
  const foreign = structuredClone(input.links); foreign[0].evidence[0].sourceId = 'foreign';
  assert.throws(() => strongestLinkOrder(input.context, input.selection, foreign, selectCandidateLinks), /original source evidence/);
  const changed = structuredClone(input.links); changed[0].evidence[0].spanHash = 'changed';
  assert.throws(() => strongestLinkOrder(input.context, input.selection, changed, selectCandidateLinks), /original source evidence/);
});
