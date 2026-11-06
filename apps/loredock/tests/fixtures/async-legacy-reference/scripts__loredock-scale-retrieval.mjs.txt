import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { retrieveAnswerContext, retrievalVersion, answerLimits } from '../apps/loredock/dist/answer-context.js';
import { answerPrompt, answerPromptVersion } from '../apps/loredock/dist/answers.js';
import { createScaleFixture, scaleBaseline, scaleGit } from './loredock-scale-fixture.mjs';
import { digest } from './loredock-fixture.mjs';

// Only the offline evaluator sees expected evidence and uncertainty. Product retrieval
// receives a question and saved source index, with no oracle or fixture-specific hints.
async function measure() {
  const fixture = await createScaleFixture(); let store, catalog;
  try {
    store = new CatalogStore(path.join(fixture.root, 'data')); catalog = new Catalog(store);
    const paths = fixture.manifest.sources.map(source => path.join(fixture.root, 'sources', source.id));
    const preview = await catalog.previewSources(paths);
    await catalog.registerSources({ paths, previewHash: preview.previewHash, requestId: 'evaluation' });
    const state = catalog.state(); catalog.start('evaluation', state.sourceSetVersion, state.policyVersion); await catalog.idle();
    function inspect(question) {
      const context = retrieveAnswerContext(catalog, question);
      assert.ok(context.spans.length <= answerLimits.spans && context.textBytes <= answerLimits.textBytes);
      const originals = context.spans.map(span => catalog.evidence(span.id));
      const fingerprint = digest(JSON.stringify(originals.map(span => [span.sourceName, span.revision, span.path, span.startLine, span.endLine, span.contentHash, span.spanHash])));
      const representedSources = context.sources.filter(source => context.spans.some(span => span.sourceId === source.sourceId)).map(source => source.name);
      const promptBytes = Buffer.byteLength(answerPrompt(context)); assert.ok(promptBytes <= 96 * 1024);
      return { context, originals, fingerprint, representedSources, promptBytes };
    }
    const started = performance.now();
    const results = fixture.oracle.questions.map(question => {
      const read = inspect(question.question), { context } = read;
      const retrieved = fixture.manifest.evidence.filter(expected => read.originals.some(span => span.sourceName === expected.sourceId && span.revision === expected.revision
        && span.path === expected.path && span.contentHash === expected.contentHash && span.blobId === expected.blobId
        && span.startLine <= expected.startLine && span.endLine >= expected.endLine)).map(ref => ref.id);
      const missing = question.evidence.filter(id => !retrieved.includes(id));
      return { id: question.id, question: question.question, requiredEvidence: question.evidence, missingEvidence: missing,
        retrievalComplete: missing.length === 0, selectedLocatorHash: read.fingerprint, spans: context.spans.length,
        representedSources: read.representedSources.length, textBytes: context.textBytes, promptBytes: read.promptBytes,
        requiredUncertainty: question.requiredUncertainty, gaps: context.gaps };
    });
    const noHit = inspect('unmatchedvocabulary026');
    for (const source of fixture.manifest.sources) assert.equal(scaleGit(fixture.root, source.id, ['status', '--porcelain=v1']), '');
    return { baseline: scaleBaseline(fixture), questionCount: results.length, completeRetrievalCount: results.filter(result => result.retrievalComplete).length, results,
      noHits: { mode: noHit.context.retrievalMode, selectedLocatorHash: noHit.fingerprint, spans: noHit.context.spans.length, textBytes: noHit.context.textBytes,
        representedSources: noHit.representedSources, unrepresentedSources: noHit.context.sources.filter(source => !noHit.representedSources.includes(source.name)).map(source => source.name), gaps: noHit.context.gaps },
      retrievalMs: performance.now() - started };
  } finally { await catalog?.stop(); store?.close(); await rm(fixture.root, { recursive: true, force: true }); }
}
export async function evaluateScaleRetrieval() {
  const first = await measure(), second = await measure();
  assert.deepEqual(first.baseline, second.baseline);
  const changedSelections = first.results.filter((result, index) => result.selectedLocatorHash !== second.results[index].selectedLocatorHash).map(result => result.id);
  return { schemaVersion: 'loredock-scale-retrieval/1', checkedAt: new Date().toISOString(), retrievalVersion, answerPromptVersion,
    limits: answerLimits, ...first, regeneration: { completeRetrievalCount: second.completeRetrievalCount, changedSelections,
      noHitSelectionStable: first.noHits.selectedLocatorHash === second.noHits.selectedLocatorHash, retrievalMs: second.retrievalMs },
    modelRequests: 0, modelUsage: null, answerCorrectness: 'not-evaluated', semanticReview: 'not-performed', sourceCheckoutsUnchanged: true,
    scope: 'Exact original evidence recall and selection stability across fresh source IDs; not semantic answer, uncertainty compliance or routing acceptance.' };
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) console.log(JSON.stringify(await evaluateScaleRetrieval(), null, 2));
