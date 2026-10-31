import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {digest} from './loredock-fixture.mjs';
import {sourceOrderCases} from '../fixtures/loredock-source-order/cases.mjs';

const priorities=['http-target','event-delivery','contract-match','contract-difference','setting-match','setting-difference'];
const compare=(a,b)=>a<b?-1:a>b?1:0;
const locator=ref=>JSON.stringify([ref.sourceName,ref.revision,ref.path,ref.startLine,ref.endLine,ref.contentHash,ref.spanHash]);

export async function verifySourceOrderContract() {
  const frozen=JSON.parse(await readFile(new URL('../fixtures/loredock-source-order/baseline.json',import.meta.url),'utf8'));
  for(const [file,hash] of Object.entries(frozen.sourceHashes))assert.equal(digest(await readFile(new URL('../'+file,import.meta.url))),hash,`Frozen ordering input changed: ${file}`);
  return frozen;
}

// Offline only: production admission, anchors, support selection and caps remain authoritative.
export function strongestLinkOrder(context,selection,links,selectCandidateLinks) {
  assert.ok(context.sources.length<=20);
  const ranking=context.sources.map((source,index)=>{
    const sources=[source,...context.sources.filter(other=>other.sourceId!==source.sourceId)];
    const admitted=selectCandidateLinks({...context,sources},selection,links).sources.find(row=>row.sourceId===source.sourceId);
    return {sourceId:source.sourceId,index,kind:admitted?.links[0]?.kind??null};
  });
  const rank=kind=>kind===null?priorities.length:priorities.indexOf(kind);
  for(const row of ranking)assert.ok(rank(row.kind)>=0);
  const ordered=[...ranking].sort((a,b)=>rank(a.kind)-rank(b.kind)||a.index-b.index);
  const sources=ordered.map(row=>context.sources[row.index]);
  return {selection:selectCandidateLinks({...context,sources},selection,links),
    eligibleOrder:ordered.filter(row=>row.kind!==null).map(({sourceId,kind})=>({sourceId,kind}))};
}

// Independently reconstruct bounded graph input, then require exact production equality.
export function sourceOrderInputs(catalog,context,declarations,code) {
  const links=[];
  for(const projection of [declarations,code])for(const edge of projection.edges) {
    if(!priorities.includes(edge.kind))continue;
    const from=projection.nodes.find(node=>node.id===edge.from),to=projection.nodes.find(node=>node.id===edge.to);
    if(from.sourceId===to.sourceId)continue;
    const evidence=[...new Set([...from.evidenceIds,...to.evidenceIds,...edge.evidenceIds])].map(id=>{
      const original=catalog.evidence(id),issued=projection.evidence[id];assert.equal(original.buildId,context.buildId);
      for(const key of ['sourceName','revision','path','startLine','endLine'])assert.equal(issued[key],original[key]);
      return Object.fromEntries(['id','sourceId','sourceName','revision','path','startLine','endLine','contentHash','spanHash'].map(key=>[key,original[key]]));
    }).sort((a,b)=>compare(locator(a),locator(b)));
    const endpoint=node=>({sourceId:node.sourceId,sourceName:node.sourceName,revision:node.revision,label:node.label,
      evidenceIds:[...node.evidenceIds].sort((a,b)=>compare(locator(evidence.find(ref=>ref.id===a)),locator(evidence.find(ref=>ref.id===b))))});
    links.push({id:edge.id,origin:projection===code?'code':'declaration',kind:edge.kind,status:edge.status,
      environment:edge.environment,from:endpoint(from),to:endpoint(to),reason:edge.reason,gaps:edge.gaps??[],evidence});
  }
  return links;
}

export function canonicalOrderedSources(sources) {
  return sources.map(source=>({source:source.sourceName,revision:source.revision,omittedLinks:source.omittedLinks,
    links:source.links.map(link=>{
      const evidence=link.evidence.map(({id,sourceId,...ref})=>ref);
      const endpoint=value=>({source:value.sourceName,label:value.label,evidence:value.evidenceIds.map(id=>{const {id:_,sourceId,...ref}=link.evidence.find(ref=>ref.id===id);return ref;})});
      return {kind:link.kind,origin:link.origin,status:link.status,environment:link.environment,reason:link.reason,gaps:link.gaps,
        from:endpoint(link.from),to:endpoint(link.to),evidence};
    })}));
}

export function symmetricOrderedSources(sources) {
  return sources.map(source=>({...source,links:source.links.map(link=>{
    if(link.origin!=='declaration')return link;
    const {from,to,...rest}=link;return {...rest,endpoints:[from,to].sort((a,b)=>compare(JSON.stringify(a),JSON.stringify(b)))};
  })}));
}

export function sourceOrderExample(item,fresh=false) {
  const names=['a','b','c','d','e','f','g'],ids=new Map(names.map(name=>[name,fresh?randomUUID():name]));
  const sources=names.map(name=>({sourceId:ids.get(name),name:item.duplicateNames?'same-name':name,revision:'a'.repeat(40)}));
  const spans=sources.map((source,index)=>({id:fresh?randomUUID():`span-${index}`,sourceId:source.sourceId,sourceName:source.name,
    revision:source.revision,path:`src/${names[index]}.ts`,startLine:1,endLine:1,text:item.anchors.includes(names[index])?'SignalAmber':'unrelated',
    contentHash:'content',spanHash:'span'}));
  const endpoint=name=>{const ref=spans[names.indexOf(name)];return {sourceId:ref.sourceId,sourceName:ref.sourceName,revision:ref.revision,label:`Endpoint ${name}`,evidenceIds:[ref.id]};};
  const links=item.links.map(([from,to,kind],index)=>({id:fresh?randomUUID():`edge-${index}`,origin:['http-target','event-delivery'].includes(kind)?'code':'declaration',
    kind,status:kind.endsWith('difference')?'difference':'candidate',environment:null,from:endpoint(from),to:endpoint(to),
    reason:'Static reading clue only.',gaps:['Runtime binding is unknown.'],evidence:[spans[names.indexOf(from)],spans[names.indexOf(to)]]}));
  return {context:{sources,spans},selection:{suggested:item.seeds.map(name=>({sourceId:ids.get(name)})),distinctiveTerms:['amber']},links,
    name:id=>names.find(name=>ids.get(name)===id)};
}

export function evaluateSourceOrderExamples(selectCandidateLinks) {
  return sourceOrderCases.map(item=>{
    const input=sourceOrderExample(item),before=JSON.stringify(input),v1=selectCandidateLinks(input.context,input.selection,input.links);
    const proposal=strongestLinkOrder(input.context,input.selection,input.links,selectCandidateLinks).selection;
    assert.equal(JSON.stringify(input),before);
    const names=output=>output.sources.map(row=>input.name(row.sourceId));
    assert.deepEqual(names(proposal),item.expected,item.id);
    if(item.firstKinds)assert.deepEqual(proposal.sources[0].links.map(link=>link.kind),item.firstKinds);
    const criticalLoss=(item.critical??[]).filter(name=>names(v1).includes(name)&&!names(proposal).includes(name));
    assert.deepEqual(criticalLoss,item.expectedCriticalLoss??[],item.id);
    const fresh=sourceOrderExample(item,true);fresh.links.reverse();
    const regenerated=strongestLinkOrder(fresh.context,fresh.selection,fresh.links,selectCandidateLinks).selection;
    assert.deepEqual(regenerated.sources.map(row=>[fresh.name(row.sourceId),row.links.map(link=>link.kind)]),proposal.sources.map(row=>[input.name(row.sourceId),row.links.map(link=>link.kind)]));
    assert.equal(proposal.eligibleSources,v1.eligibleSources);assert.equal(proposal.eligibleLinks,v1.eligibleLinks);
    return {id:item.id,description:item.description,v1:names(v1),proposal:names(proposal),critical:item.critical??[],criticalLoss,
      eligibleSources:proposal.eligibleSources,omittedSources:proposal.omittedSources,omittedLinks:proposal.omittedLinks,
      repeatedWithFreshIdentities:true,mechanicsPassed:true};
  });
}
