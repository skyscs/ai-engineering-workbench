import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Catalog} from '../src/catalog.js';
import {CatalogStore} from '../src/store.js';
import {retrieveAnswerContext,questionTerms,retrievalVersion} from '../src/answer-context.js';
// @ts-expect-error Explicit model-free evaluation scripts are plain JavaScript.
import {evaluateIncidentContext} from '../../../scripts/loredock-incident-context.mjs';
// @ts-expect-error Reviewer expectations never enter product inputs.
import {routingCases} from '../../../fixtures/loredock-routing/cases.mjs';

test('incident baseline keeps original ownership, fresh-ID stability and absent routing decisions explicit',async()=>{
  const questions:string[]=[];
  const report=await evaluateIncidentContext({Catalog,CatalogStore,questionTerms,retrievalVersion,
    retrieveAnswerContext:(catalog:Catalog,question:string)=>{questions.push(question);return retrieveAnswerContext(catalog,question);}});
  const expected=routingCases.map((row:{description:string})=>row.description);
  assert.deepEqual(questions,[...expected,...expected]);
  assert.equal(report.modelRequests,0);assert.equal(report.answerAttempts,0);assert.equal(report.routingAccepted,false);
  assert.equal(report.results.length,10);assert.equal(report.sourceBaseline.sourceCount,20);
  assert.equal(report.sourceCheckoutsUnchanged,true);assert.ok(report.verifiedSpanOccurrences>0 && report.verifiedFiles>0);
  for(const method of ['keyword','answerContext']) {
    assert.deepEqual(report.regeneration[method].changedSelections,[]);
    assert.deepEqual(report.regeneration[method].summary,report.summary[method]);
    assert.equal(report.summary[method].explicitDecisions,0);
    for(const row of report.results) {
      const result=row[method];
      assert.equal(result.decision,'not-implemented');
      assert.equal(result.candidateCount,new Set(result.candidates).size);
      assert.ok(result.spans<=30 && result.textBytes<=64*1024);
      assert.equal(result.criticalRecall.found,result.requiredRepositories.length-result.missingRepositories.length);
      assert.ok(result.selected.every((span:{source:string})=>result.candidates.includes(span.source)));
    }
  }
  assert.equal(report.independentReview,'pending');assert.equal(report.semanticReview,'not-performed');
});
