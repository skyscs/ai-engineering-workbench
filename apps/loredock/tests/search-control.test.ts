import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';
import {test} from 'node:test';
import {CatalogStore} from '../src/store.js';
import {Catalog} from '../src/catalog.js';
import {CodeAnalysis} from '../src/code-analysis.js';
import {retrieveAnswerContext, questionTerms} from '../src/answer-context.js';
// @ts-expect-error The isolated control experiment is plain JavaScript.
import {compareSearchControl, assessSearchControl, verifySearchControlContract} from '../../../scripts/loredock-search-control-study.mjs';
// @ts-expect-error The owned fixture generator is plain JavaScript.
import {createLoreDockFixture} from '../../../scripts/loredock-fixture.mjs';

test('the rebuild control rehearses all token, identity and query comparisons and rejects mutated raw results', async t => {
  await verifySearchControlContract(); const fixture = await createLoreDockFixture();
  t.after(() => rm(fixture.root, {recursive: true, force: true}));
  const result = await compareSearchControl({CatalogStore, Catalog, CodeAnalysis, retrieveAnswerContext, questionTerms}, fixture,
    {expectedFiles: 18, expectedCodeFiles: 5});
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
