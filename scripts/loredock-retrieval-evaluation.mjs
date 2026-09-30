import { rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { retrieveAnswerContext, retrievalVersion } from '../apps/loredock/dist/answer-context.js';
import { createLoreDockFixture, repositoryIds } from './loredock-fixture.mjs';

// Oracle access belongs only to this offline evaluator. The retrieval service receives
// the question string, never expected answers, evidence keys or routing cases.
export async function evaluateRetrieval() {
  const fixture = await createLoreDockFixture();
  let store, catalog;
  try {
    store = new CatalogStore(path.join(fixture.root, 'catalog'));
    catalog = new Catalog(store);
    for (const id of repositoryIds) await catalog.addSource(path.join(fixture.root, 'sources', id));
    const state = catalog.state();
    catalog.start('evaluation', state.sourceSetVersion, state.policyVersion);
    await catalog.idle();
    const results = fixture.oracle.questions.map(question => {
      const context = retrieveAnswerContext(catalog, question.question);
      const retrieved = fixture.manifest.evidence.filter(expected => context.spans.some(span =>
        span.sourceName === expected.sourceId && span.revision === expected.revision && span.path === expected.path
        && span.startLine <= expected.startLine && span.endLine >= expected.endLine)).map(span => span.id);
      const missing = question.evidence.filter(id => !retrieved.includes(id));
      return { id: question.id, question: question.question, requiredEvidence: question.evidence, retrievedEvidence: retrieved,
        missingEvidence: missing, retrievalComplete: missing.length === 0,
        spans: context.spans.length, textBytes: context.textBytes, gaps: context.gaps,
        answerCorrectness: 'not-evaluated', unsupportedClaims: null, semanticReview: 'not-performed' };
    });
    return { schemaVersion: 'loredock-retrieval-evaluation/1', retrievalVersion,
      revisionVector: fixture.manifest.revisionVector, modelRequests: 0, modelUsage: null,
      scope: 'Lexical evidence recall only; not answer acceptance or routing evaluation.',
      questionCount: results.length, completeRetrievalCount: results.filter(item => item.retrievalComplete).length, results };
  } finally {
    await catalog?.stop(); store?.close(); await rm(fixture.root, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  console.log(JSON.stringify(await evaluateRetrieval(), null, 2));
}
