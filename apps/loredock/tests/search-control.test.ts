import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {test} from 'node:test';
// @ts-expect-error The isolated control experiment is plain JavaScript.
import {assessSearchControl, verifySearchControlContract} from '../../../scripts/loredock-search-control-study.mjs';
test('the archived rebuild control recounts all retained vectors and rejects mutated observations', async () => {
  await verifySearchControlContract();
  const result = JSON.parse(gunzipSync(await readFile(new URL('../../../docs/fixtures/loredock-search-control/raw-result.json.gz', import.meta.url))).toString()).result;
  assert.equal(result.error, undefined); assert.equal(result.summary.mechanical, true, JSON.stringify(result.summary));
  assert.equal(result.summary.queryComparisons, 112); assert.equal(result.summary.checks, 31);
  const token = structuredClone(result); token.stages[0].variants.external.vocabulary[0][3]++;
  assert.equal(assessSearchControl(token).mechanical, false);
  const identity = structuredClone(result); identity.stages[0].variants.external.documents[0][1] = 'incorrect-source-identity';
  assert.equal(assessSearchControl(identity).mechanical, false);
  const query = structuredClone(result); query.stages[1].variants.rebuilt.queries[0].result.context.question = 'Changed question';
  assert.equal(assessSearchControl(query).mechanical, false);
  const missing = structuredClone(result); delete missing.stages[1].variants.external;
  assert.equal(assessSearchControl(missing).mechanical, false);
  const omitted = structuredClone(result);
  for (const variant of ['unchanged','rebuilt','external']) delete omitted.stages[0].variants[variant].queries[0].result.context;
  assert.equal(assessSearchControl(omitted).mechanical, false);
  const threshold = structuredClone(result);
  threshold.stages[0].variants.external.allocation.totalBytes = threshold.stages[0].variants.rebuilt.allocation.totalBytes;
  assert.equal(assessSearchControl(threshold).mechanical, true); assert.equal(assessSearchControl(threshold).passed, false);
});
