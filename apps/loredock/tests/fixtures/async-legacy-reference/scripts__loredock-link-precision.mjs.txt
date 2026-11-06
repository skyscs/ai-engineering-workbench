import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {evaluateIncidentContext} from './loredock-incident-context.mjs';
import {scaleGit} from './loredock-scale-fixture.mjs';
import {digest} from './loredock-fixture.mjs';
import {routingCases} from '../fixtures/loredock-routing/cases.mjs';
import {precisionCases} from '../fixtures/loredock-link-precision/cases.mjs';

// Offline proposal only. Production v1 admission remains unchanged.
export function structuralSubject(kind, terms, from, to, searchText) {
  let subjects=[];
  if(kind==='http-target')subjects=[from.path,to.path];
  else if(kind==='event-delivery')subjects=[from.payloadType];
  else if(kind==='contract-match'||kind==='contract-difference') {
    for(const endpoint of [from,to]) {
      subjects.push(endpoint.name);
      try {const fields=JSON.parse(endpoint.fields);if(fields&&typeof fields==='object'&&!Array.isArray(fields))subjects.push(...Object.keys(fields));}catch{}
    }
  } else return false;
  const words=new Set(searchText(subjects.filter(value=>typeof value==='string').join(' ')).match(/[\p{L}\p{N}_]+/gu)??[]);
  return terms.some(term=>words.has(term));
}

export async function verifyPrecisionContract(searchText) {
  const frozen=JSON.parse(await readFile(new URL('../fixtures/loredock-link-precision/baseline.json',import.meta.url),'utf8'));
  for(const [file,hash] of Object.entries(frozen.sourceHashes))assert.equal(digest(await readFile(new URL('../'+file,import.meta.url))),hash);
  const results=precisionCases.map(row=>({id:row.id,expected:row.accept,actual:structuralSubject(row.kind,row.terms,row.from,row.to,searchText),reason:row.reason}));
  return {frozen,results,passed:results.filter(row=>row.expected===row.actual).length};
}

const locator=ref=>JSON.stringify([ref.sourceName,ref.revision,ref.path,ref.startLine,ref.endLine,ref.contentHash,ref.spanHash]);
const compare=(a,b)=>a<b?-1:a>b?1:0;
// Reconstruct the complete bounded input independently; assert equality with production v1 below.
function relationshipInputs(catalog,context,declarations,code) {
  const supported=new Set(['http-target','event-delivery','contract-match','contract-difference','setting-match','setting-difference']);
  const rows=[];
  for(const projection of [declarations,code])for(const edge of projection.edges) {
    if(!supported.has(edge.kind))continue;
    const from=projection.nodes.find(node=>node.id===edge.from),to=projection.nodes.find(node=>node.id===edge.to);
    if(from.sourceId===to.sourceId)continue;
    const evidence=[...new Set([...from.evidenceIds,...to.evidenceIds,...edge.evidenceIds])].map(id=>{
      const original=catalog.evidence(id),issued=projection.evidence[id];assert.equal(original.buildId,context.buildId);
      for(const key of ['sourceName','revision','path','startLine','endLine'])assert.equal(issued[key],original[key]);
      return Object.fromEntries(['id','sourceId','sourceName','revision','path','startLine','endLine','contentHash','spanHash'].map(key=>[key,original[key]]));
    }).sort((a,b)=>compare(locator(a),locator(b)));
    const endpoint=node=>({sourceId:node.sourceId,sourceName:node.sourceName,revision:node.revision,label:node.label,
      evidenceIds:[...node.evidenceIds].sort((a,b)=>compare(locator(evidence.find(ref=>ref.id===a)),locator(evidence.find(ref=>ref.id===b))))});
    rows.push({fromProperties:from.properties,toProperties:to.properties,link:{id:edge.id,origin:projection===code?'code':'declaration',
      kind:edge.kind,status:edge.status,environment:edge.environment,from:endpoint(from),to:endpoint(to),reason:edge.reason,gaps:edge.gaps??[],evidence}});
  }
  return rows;
}
function canonicalSources(sources) {
  return sources.map(source=>({source:source.sourceName,revision:source.revision,omittedLinks:source.omittedLinks,
    links:source.links.map(link=>{
      const evidence=link.evidence.map(({id,sourceId,...ref})=>ref);
      const endpoint=value=>({source:value.sourceName,label:value.label,evidence:value.evidenceIds.map(id=>{const {id:_,sourceId,...ref}=link.evidence.find(ref=>ref.id===id);return ref;})});
      return {kind:link.kind,origin:link.origin,status:link.status,environment:link.environment,reason:link.reason,gaps:link.gaps,from:endpoint(link.from),to:endpoint(link.to),evidence};
    })}));
}
function symmetricSources(sources) {
  return sources.map(source=>({...source,links:source.links.map(link=>{
    if(link.origin!=='declaration')return link;
    const {from,to,...rest}=link;return {...rest,endpoints:[from,to].sort((a,b)=>compare(JSON.stringify(a),JSON.stringify(b)))};
  })}));
}
function lexicalHash(context,selection) {
  return digest(JSON.stringify({status:selection.status,suggested:selection.suggested.map(row=>({source:row.sourceName,revision:row.revision,score:row.score,
    support:row.support.map(ref=>{const original=context.spans.find(span=>span.id===ref.id);return {path:original.path,startLine:original.startLine,endLine:original.endLine,
      spanHash:original.spanHash,matchedTerms:ref.matchedTerms};}),omittedSupport:row.omittedSupport})),otherMatches:selection.otherMatches.map(row=>row.sourceName),tiedAtLimit:selection.tiedAtLimit}));
}

export async function qualifyLinkPrecision(services) {
  const {retrieveAnswerContext,selectSourceCandidates,candidateLinkContext,selectCandidateLinks,declarationMap,codeFlows,searchText}=services;
  const examples=await verifyPrecisionContract(searchText),measurements=[];let verifiedOriginalOccurrences=0;
  const oldLinks=JSON.parse(await readFile(new URL('../docs/fixtures/loredock-candidate-links/candidate-result.json',import.meta.url),'utf8'));
  const oldLexical=JSON.parse(await readFile(new URL('../docs/fixtures/loredock-source-candidates/candidate-result.json',import.meta.url),'utf8'));
  const oldContext=JSON.parse(await readFile(new URL('../docs/fixtures/loredock-incident-context/retrieval-result.json',import.meta.url),'utf8'));
  const baseline=await evaluateIncidentContext({...services,retrieveAnswerContext:(catalog,question)=>{
    const context=retrieveAnswerContext(catalog,question),before=JSON.stringify(context),selection=selectSourceCandidates(context);
    const declarations=declarationMap(catalog,context.buildId),code=codeFlows(catalog,context.buildId);
    assert.equal(code.adapterVersion,'pilot-code-v2','Task 038 qualification requires pilot-code-v2. Use its retained report or frozen implementation; current adapter measurements need a separate report.');
    const rows=relationshipInputs(catalog,context,declarations,code),v1=selectCandidateLinks(context,selection,rows.map(row=>row.link));
    const {projections,gaps,...actual}=candidateLinkContext(catalog,context,selection);assert.deepEqual(v1,actual);
    const admitted=rows.filter(row=>structuralSubject(row.link.kind,selection.distinctiveTerms,row.fromProperties,row.toProperties,searchText));
    const proposal=selectCandidateLinks(context,selection,admitted.map(row=>row.link));
    for(const output of [v1,proposal])for(const source of output.sources)for(const link of source.links)for(const ref of link.evidence) {
      const original=catalog.evidence(ref.id);assert.equal(original.sourceId,ref.sourceId);assert.equal(original.buildId,context.buildId);
      const text=scaleGit(path.dirname(catalog.store.directory),ref.sourceName,['show',`${ref.revision}:${ref.path}`],false);
      assert.equal(digest(text),ref.contentHash);assert.equal(digest(text.split('\n').slice(ref.startLine-1,ref.endLine).join('\n')),ref.spanHash);verifiedOriginalOccurrences++;
    }
    assert.equal(JSON.stringify(context),before);
    const canonical=output=>({related:canonicalSources(output.sources),eligibleSources:output.eligibleSources,eligibleLinks:output.eligibleLinks,
      omittedSources:output.omittedSources,omittedLinks:output.omittedLinks});
    measurements.push({question,primary:selection.suggested.map(row=>row.sourceName),lexicalHash:lexicalHash(context,selection),
      v1:canonical(v1),proposal:canonical(proposal),coverage:Object.fromEntries(Object.entries(projections).map(([key,{inputHash,...value}])=>[key,value]))});
    return context;
  }});
  const results=routingCases.map((item,index)=>{
    const first=measurements[index],second=measurements[index+routingCases.length];assert.equal(first.question,item.description);
    assert.equal(first.lexicalHash,oldLexical.results[index].selectionHash);assert.equal(first.lexicalHash,second.lexicalHash);
    assert.deepEqual(first.primary,oldLinks.results[index].primary);
    assert.deepEqual(symmetricSources(first.v1.related),symmetricSources(oldLinks.results[index].related));
    const assess=output=>{
      const union=[...first.primary,...output.related.map(source=>source.source)],missing=item.requiredRepositories.filter(source=>!union.includes(source));
      return {...output,union,candidateCount:union.length,maxCandidates:item.maxCandidates,missingRequiredRepositories:missing,
        criticalRecall:{found:item.requiredRepositories.length-missing.length,total:item.requiredRepositories.length},
        withinCandidateBound:union.length<=item.maxCandidates,scopeNecessaryConditionsMet:!missing.length&&union.length<=item.maxCandidates};
    };
    const v1=assess(first.v1),proposal=assess(first.proposal);
    const changed=version=>!isDeepStrictEqual({...first[version],related:symmetricSources(first[version].related)},
      {...second[version],related:symmetricSources(second[version].related)});
    return {id:item.id,incident:item.description,primary:first.primary,v1,proposal,
      removedSources:v1.union.filter(source=>!proposal.union.includes(source)),addedSources:proposal.union.filter(source=>!v1.union.includes(source)),
      changedAcrossFreshGenerations:{v1:changed('v1'),proposal:changed('proposal')},coverage:first.coverage,
      automaticRoutingDecision:'not-implemented',expectedGap:item.gap};
  });
  for(const method of ['keyword','answerContext'])assert.deepEqual(baseline.summary[method],oldContext.summary[method]);
  assert.deepEqual(baseline.results.map(row=>row.answerContext.selectedLocatorHash),oldContext.results.map(row=>row.answerContext.selectedLocatorHash));
  const summarize=version=>({allCriticalRepositories:results.filter(row=>!row[version].missingRequiredRepositories.length).length,
    criticalRecall:{found:results.reduce((sum,row)=>sum+row[version].criticalRecall.found,0),total:results.reduce((sum,row)=>sum+row[version].criticalRecall.total,0)},
    withinCandidateBound:results.filter(row=>row[version].withinCandidateBound).length,scopeNecessaryConditionsMet:results.filter(row=>row[version].scopeNecessaryConditionsMet).length,
    candidateCounts:results.map(row=>row[version].candidateCount),changedAcrossFreshGenerations:results.filter(row=>row.changedAcrossFreshGenerations[version]).map(row=>row.id)});
  return {schemaVersion:'loredock-link-precision-qualification/1',checkedAt:new Date().toISOString(),examples,results,
    summary:{v1:summarize('v1'),proposal:summarize('proposal')},verifiedOriginalOccurrences,productionReconstructionEqual:true,
    originalContextUnchanged:true,lexicalSelectionUnchanged:true,modelRequests:0,answerAttempts:0,productionPolicyChanged:false,
    independentReview:'pending',routingAccepted:false,
    scope:'Frozen normalized subject examples and observed synthetic incidents. This offline proposal trades contextual links for narrower reading scope; it is not automatic routing or independent semantic acceptance.'};
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  const modules=await Promise.all(['catalog','store','answer-context','source-candidates','candidate-links','system-map','code-flows','search-text'].map(name=>import(`../apps/loredock/dist/${name}.js`)));
  console.log(JSON.stringify(await qualifyLinkPrecision(Object.assign({},...modules)),null,2));
}
