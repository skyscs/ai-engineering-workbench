import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {evaluateIncidentContext} from './loredock-incident-context.mjs';
import {routingCases} from '../fixtures/loredock-routing/cases.mjs';
import {digest} from './loredock-fixture.mjs';
import {scaleGit} from './loredock-scale-fixture.mjs';
import {Catalog} from '../apps/loredock/dist/catalog.js';
import {CatalogStore} from '../apps/loredock/dist/store.js';
import {retrieveAnswerContext,questionTerms,retrievalVersion} from '../apps/loredock/dist/answer-context.js';
import {selectSourceCandidates,candidateVersion} from '../apps/loredock/dist/source-candidates.js';
import {candidateLinkContext} from '../apps/loredock/dist/candidate-links.js';

const frozen=JSON.parse(await readFile(new URL('../fixtures/loredock-candidate-links/baseline.json',import.meta.url),'utf8'));
for(const [file,hash] of Object.entries(frozen.sourceHashes))assert.equal(digest(await readFile(new URL('../'+file,import.meta.url))),hash);
const lexicalBaseline=JSON.parse(await readFile(new URL('../docs/fixtures/loredock-source-candidates/candidate-result.json',import.meta.url),'utf8'));
const contextBaseline=JSON.parse(await readFile(new URL('../docs/fixtures/loredock-incident-context/retrieval-result.json',import.meta.url),'utf8'));
const measurements=[];let verifiedLinkedOccurrences=0;
const baseline=await evaluateIncidentContext({Catalog,CatalogStore,questionTerms,retrievalVersion,
  retrieveAnswerContext:(catalog,question)=>{
    const context=retrieveAnswerContext(catalog,question),before=JSON.stringify(context),selection=selectSourceCandidates(context),started=performance.now();
    const links=candidateLinkContext(catalog,context,selection),linkMs=performance.now()-started;
    assert.equal(JSON.stringify(context),before);
    for(const source of links.sources)for(const link of source.links)for(const ref of link.evidence){
      const original=catalog.evidence(ref.id);assert.equal(original.sourceId,ref.sourceId);assert.equal(original.buildId,context.buildId);
      const text=scaleGit(path.dirname(catalog.store.directory),ref.sourceName,['show',`${ref.revision}:${ref.path}`],false);
      assert.equal(digest(text),ref.contentHash);assert.equal(digest(text.split('\n').slice(ref.startLine-1,ref.endLine).join('\n')),ref.spanHash);
      verifiedLinkedOccurrences++;
    }
    const lexical={status:selection.status,suggested:selection.suggested.map(row=>({source:row.sourceName,revision:row.revision,score:row.score,
      support:row.support.map(ref=>{const original=context.spans.find(span=>span.id===ref.id);return {path:original.path,startLine:original.startLine,endLine:original.endLine,
        spanHash:original.spanHash,matchedTerms:ref.matchedTerms};}),omittedSupport:row.omittedSupport})),
      otherMatches:selection.otherMatches.map(row=>row.sourceName),tiedAtLimit:selection.tiedAtLimit};
    const canonical=links.sources.map(source=>({source:source.sourceName,revision:source.revision,omittedLinks:source.omittedLinks,
      links:source.links.map(link=>{const evidence=link.evidence.map(({id,sourceId,...ref})=>ref);
        const endpoint=value=>({source:value.sourceName,label:value.label,evidence:value.evidenceIds.map(id=>{const {id:_,sourceId,...ref}=link.evidence.find(ref=>ref.id===id);return ref;})});
        return {kind:link.kind,origin:link.origin,status:link.status,environment:link.environment,reason:link.reason,gaps:link.gaps,from:endpoint(link.from),to:endpoint(link.to),evidence};})}));
    measurements.push({question,lexicalHash:digest(JSON.stringify(lexical)),primary:selection.suggested.map(row=>row.sourceName),related:canonical,
      eligibleSources:links.eligibleSources,eligibleLinks:links.eligibleLinks,omittedSources:links.omittedSources,omittedLinks:links.omittedLinks,
      projections:Object.fromEntries(Object.entries(links.projections).map(([key,{inputHash,...projection}])=>[key,projection])),linkMs});
    return context;
  }});
const results=routingCases.map((item,index)=>{
  const first=measurements[index],second=measurements[index+routingCases.length];
  assert.equal(first.lexicalHash,lexicalBaseline.results[index].selectionHash);assert.equal(first.lexicalHash,second.lexicalHash);
  const selected=[...first.primary,...first.related.map(source=>source.source)];
  const missing=item.requiredRepositories.filter(source=>!selected.includes(source));
  const canonical=({linkMs,question,related,...row})=>({...row,related:related.map(source=>({...source,links:source.links.map(link=>{
    if(link.origin!=='declaration')return link;
    const {from,to,...rest}=link;
    // Left/right order of a symmetric declaration comparison is not dependency direction.
    return {...rest,endpoints:[from,to].sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:JSON.stringify(a)>JSON.stringify(b)?1:0)};
  })}))});
  return {id:item.id,incident:item.description,...first,union:selected,candidateCount:selected.length,maxCandidates:item.maxCandidates,
    criticalRecall:{found:item.requiredRepositories.length-missing.length,total:item.requiredRepositories.length},missingRequiredRepositories:missing,
    withinCandidateBound:selected.length<=item.maxCandidates,scopeNecessaryConditionsMet:!missing.length&&selected.length<=item.maxCandidates,
    changedAcrossFreshGenerations:!isDeepStrictEqual(canonical(first),canonical(second)),
    declarationSideRepresentationChanged:!isDeepStrictEqual(first.related,second.related),
    regeneratedRelated:second.related,
    expectedDecision:item.decision,expectedGap:item.gap,automaticRoutingDecision:'not-implemented'};
});
for(const method of ['keyword','answerContext'])assert.deepEqual(baseline.summary[method],contextBaseline.summary[method]);
assert.deepEqual(baseline.results.map(row=>row.answerContext.selectedLocatorHash),contextBaseline.results.map(row=>row.answerContext.selectedLocatorHash));
console.log(JSON.stringify({schemaVersion:'loredock-candidate-links-evaluation/1',checkedAt:new Date().toISOString(),frozenDesign:frozen,candidateVersion,
  modelRequests:0,answerAttempts:0,results,summary:{cases:results.length,allCriticalRepositories:results.filter(row=>!row.missingRequiredRepositories.length).length,
    criticalRecall:{found:results.reduce((sum,row)=>sum+row.criticalRecall.found,0),total:results.reduce((sum,row)=>sum+row.criticalRecall.total,0)},
    withinCandidateBound:results.filter(row=>row.withinCandidateBound).length,scopeNecessaryConditionsMet:results.filter(row=>row.scopeNecessaryConditionsMet).length,
    candidateCounts:results.map(row=>row.candidateCount),changedAcrossFreshGenerations:results.filter(row=>row.changedAcrossFreshGenerations).map(row=>row.id),
    declarationSideRepresentationChanges:results.filter(row=>row.declarationSideRepresentationChanged).map(row=>row.id)},
  verifiedLinkedOccurrences,originalContextUnchanged:true,lexicalSelectionUnchanged:true,routingAccepted:false,independentReview:'pending',
  scope:'Observed synthetic development incidents. Additional original-evidence links are reading clues, not automatic routing or causal conclusions.'},null,2));
