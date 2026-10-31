import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { retrieveAnswerContext, questionTerms, retrievalVersion } from '../src/answer-context.js';
import { selectSourceCandidates } from '../src/source-candidates.js';
import { candidateLinkContext, selectCandidateLinks } from '../src/candidate-links.js';
import { declarationMap } from '../src/system-map.js';
import { codeFlows } from '../src/code-flows.js';
import { searchText } from '../src/search-text.js';
// @ts-expect-error The frozen offline qualifier is plain JavaScript.
import { verifyPrecisionContract, qualifyLinkPrecision } from '../../../scripts/loredock-link-precision.mjs';

test('frozen relationship subjects reject incidental prose, settings, types and substring matches', async () => {
  const report = await verifyPrecisionContract(searchText) as { passed: number; results: { id: string; expected: boolean; actual: boolean }[] };
  assert.equal(report.results.length, 16);
  for (const row of report.results) assert.equal(row.actual, row.expected, row.id);
});

test('offline precision comparison preserves production reconstruction and original synthetic baselines', async () => {
  const report = await qualifyLinkPrecision({ Catalog, CatalogStore, retrieveAnswerContext, questionTerms, retrievalVersion,
    selectSourceCandidates, candidateLinkContext, selectCandidateLinks, declarationMap, codeFlows, searchText }) as {
      productionReconstructionEqual: boolean; originalContextUnchanged: boolean; lexicalSelectionUnchanged: boolean; modelRequests: number;
      productionPolicyChanged: boolean; summary: Record<string, { changedAcrossFreshGenerations: string[] }>; verifiedOriginalOccurrences: number;
    };
  assert.equal(report.productionReconstructionEqual, true); assert.equal(report.originalContextUnchanged, true);
  assert.equal(report.lexicalSelectionUnchanged, true); assert.equal(report.modelRequests, 0); assert.equal(report.productionPolicyChanged, false);
  assert.ok(report.verifiedOriginalOccurrences > 0);
  for (const result of Object.values(report.summary)) assert.deepEqual(result.changedAcrossFreshGenerations, []);
});
