import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateIncidentContext} from './loredock-incident-context.mjs';
import {routingCases} from '../fixtures/loredock-routing/cases.mjs';
import {digest} from './loredock-fixture.mjs';
import {Catalog} from '../apps/loredock/dist/catalog.js';
import {CatalogStore} from '../apps/loredock/dist/store.js';
import {retrieveAnswerContext,questionTerms,retrievalVersion} from '../apps/loredock/dist/answer-context.js';
import {selectSourceCandidates,candidateVersion} from '../apps/loredock/dist/source-candidates.js';

const frozen=JSON.parse(await readFile(new URL('../fixtures/loredock-candidates/baseline.json',import.meta.url),'utf8'));
for(const [file,hash] of Object.entries(frozen.sourceHashes))assert.equal(digest(await readFile(new URL('../'+file,import.meta.url))),hash);
const measurements=[];
const baseline=await evaluateIncidentContext({Catalog,CatalogStore,questionTerms,retrievalVersion,
  retrieveAnswerContext:(catalog,question)=>{
    const context=retrieveAnswerContext(catalog,question),before=JSON.stringify(context),selection=selectSourceCandidates(context);
    assert.equal(JSON.stringify(context),before);
    measurements.push({question,selection,spans:context.spans});return context;
  }});
const canonical=measurement=>({status:measurement.selection.status,suggested:measurement.selection.suggested.map(row=>({
  source:row.sourceName,revision:row.revision,score:row.score,support:row.support.map(ref=>{
    const original=measurement.spans.find(span=>span.id===ref.id);assert.equal(original.sourceId,row.sourceId);
    return {path:original.path,startLine:original.startLine,endLine:original.endLine,spanHash:original.spanHash,matchedTerms:ref.matchedTerms};
  }),omittedSupport:row.omittedSupport,
})),otherMatches:measurement.selection.otherMatches.map(row=>row.sourceName),tiedAtLimit:measurement.selection.tiedAtLimit});
const results=routingCases.map((item,index)=>{
  const measurement=measurements[index],selected=canonical(measurement),owners=selected.suggested.map(row=>row.source);
  assert.equal(item.description,measurement.question);
  const missing=item.requiredRepositories.filter(name=>!owners.includes(name));
  return {id:item.id,incident:item.description,...selected,maxCandidates:item.maxCandidates,candidateCount:owners.length,
    missingRequiredRepositories:missing,criticalRecall:{found:item.requiredRepositories.length-missing.length,total:item.requiredRepositories.length},
    withinCandidateBound:owners.length<=item.maxCandidates,scopeNecessaryConditionsMet:missing.length===0 && owners.length<=item.maxCandidates,
    expectedDecision:item.decision,expectedGap:item.gap,automaticRoutingDecision:'not-implemented',
    selectionHash:digest(JSON.stringify(selected))};
});
const changed=results.filter((row,index)=>row.selectionHash!==digest(JSON.stringify(canonical(measurements[index+routingCases.length])))).map(row=>row.id);
const original=JSON.parse(await readFile(new URL('../docs/fixtures/loredock-incident-context/retrieval-result.json',import.meta.url),'utf8'));
for(const method of ['keyword','answerContext'])assert.deepEqual(baseline.summary[method],original.summary[method]);
assert.deepEqual(baseline.results.map(row=>row.answerContext.selectedLocatorHash),original.results.map(row=>row.answerContext.selectedLocatorHash));
console.log(JSON.stringify({schemaVersion:'loredock-candidate-evaluation/1',checkedAt:new Date().toISOString(),candidateVersion,
  frozenDesign:frozen,modelRequests:0,answerAttempts:0,results,
  summary:{cases:results.length,allCriticalRepositories:results.filter(row=>!row.missingRequiredRepositories.length).length,
    criticalRecall:{found:results.reduce((n,row)=>n+row.criticalRecall.found,0),total:results.reduce((n,row)=>n+row.criticalRecall.total,0)},
    withinCandidateBound:results.filter(row=>row.withinCandidateBound).length,scopeNecessaryConditionsMet:results.filter(row=>row.scopeNecessaryConditionsMet).length,
    candidateCounts:results.map(row=>row.candidateCount)},
  regeneration:{changedSelections:changed},originalContextUnchanged:true,baselineSummary:baseline.summary,
  originalVerification:{spanOccurrences:baseline.verifiedSpanOccurrences,files:baseline.verifiedFiles},
  routingAccepted:false,independentReview:'pending',scope:'A frozen general lexical policy evaluated on observed development incidents. Fresh adversarial cases test mechanics, not blind semantic quality. Missing implementation and causal routing remain unresolved.'},null,2));
