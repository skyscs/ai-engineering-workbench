import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {evaluateIncidentContext} from './loredock-incident-context.mjs';
import {capacityBaseline,createCapacityFixture} from './loredock-capacity-fixture.mjs';
import {verifyCapacityContract} from './loredock-capacity-benchmark.mjs';
import {scaleGit} from './loredock-scale-fixture.mjs';
import {digest} from './loredock-fixture.mjs';
import {routingCases} from '../fixtures/loredock-routing/cases.mjs';
import {verifySourceOrderContract,strongestLinkOrder,sourceOrderInputs,canonicalOrderedSources,symmetricOrderedSources,evaluateSourceOrderExamples} from './loredock-source-order.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const compare=(a,b)=>a<b?-1:a>b?1:0;
const sort=rows=>rows.sort((a,b)=>compare(JSON.stringify(a),JSON.stringify(b)));
const load=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
const originalLocator=ref=>({source:ref.source??ref.sourceName,path:ref.path,revision:ref.revision,
  startLine:ref.startLine,endLine:ref.endLine,contentHash:ref.contentHash,spanHash:ref.spanHash});

// Normalize both historical result layouts, retaining code direction and every locator.
function comparableSources(sources) {
  return sources.map(source=>({source:source.source,revision:source.revision,omittedLinks:source.omittedLinks,
    links:source.links.map(link=>{
      const endpoint=value=>({source:value.source,label:value.label,evidence:sort(value.evidence.map(originalLocator))});
      const endpoints=(link.endpoints??[link.from,link.to]).map(endpoint);
      return {kind:link.kind,origin:link.origin,status:link.status,environment:link.environment,reason:link.reason,gaps:link.gaps,
        endpoints:link.origin==='declaration'?sort(endpoints):endpoints,evidence:sort(link.evidence.map(originalLocator))};
    })}));
}
function primarySources(context,selection) {
  return selection.suggested.map(source=>({source:source.sourceName,revision:source.revision,score:source.score,omittedSupport:source.omittedSupport,
    support:source.support.map(ref=>({...originalLocator(context.spans.find(span=>span.id===ref.id)),matchedTerms:ref.matchedTerms}))}));
}
function summarize(rows,version) {
  return {cases:rows.length,criticalRecall:{found:rows.reduce((sum,row)=>sum+row[version].criticalRecall.found,0),total:rows.reduce((sum,row)=>sum+row[version].criticalRecall.total,0)},
    allCriticalRepositories:rows.filter(row=>!row[version].missingRequiredRepositories.length).length,
    withinCandidateBound:rows.filter(row=>row[version].withinCandidateBound).length,
    scopeNecessaryConditionsMet:rows.filter(row=>row[version].scopeNecessaryConditionsMet).length,
    candidateCounts:rows.map(row=>row[version].candidateCount)};
}

export async function qualifySourceOrder(services,outputDirectory) {
  const {Catalog,CatalogStore,retrieveAnswerContext,selectSourceCandidates,selectCandidateLinks,candidateLinkContext,declarationMap,codeFlows}=services;
  const frozen=await verifySourceOrderContract(),capacity=await verifyCapacityContract();
  const examples=evaluateSourceOrderExamples(selectCandidateLinks),oldSmall=await load('docs/fixtures/loredock-dojo-exports/candidate-result.json');
  const oldVolume=await load('docs/fixtures/loredock-capacity/raw-result.json'),oldContext=await load('docs/fixtures/loredock-incident-context/retrieval-result.json');
  await mkdir(outputDirectory);
  const checkpoint=(name,value)=>writeFile(path.join(outputDirectory,name+'.json'),JSON.stringify(value,null,2)+'\n');
  const implementation={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    sourceHashes:Object.fromEntries(await Promise.all(['scripts/loredock-source-order.mjs','scripts/loredock-source-order-qualification.mjs'].map(async file=>[file,digest(await readFile(path.join(root,file)))])))};
  await checkpoint('contract',{frozen,implementation,examples,startedAt:new Date().toISOString()});
  let verifiedOriginalOccurrences=0;const verifiedFiles=new Set(),gitTexts=new Map();
  function observe(catalog,fixture,item) {
    const context=retrieveAnswerContext(catalog,item.question??item.description),before=JSON.stringify(context),selection=selectSourceCandidates(context);
    const declarations=declarationMap(catalog,context.buildId),code=codeFlows(catalog,context.buildId);assert.equal(code.adapterVersion,'pilot-code-v3');
    const links=sourceOrderInputs(catalog,context,declarations,code),v1=selectCandidateLinks(context,selection,links);
    const {projections,gaps,...actual}=candidateLinkContext(catalog,context,selection);assert.deepEqual(v1,actual);
    const {selection:proposal,eligibleOrder}=strongestLinkOrder(context,selection,links,selectCandidateLinks);
    assert.equal(proposal.eligibleSources,v1.eligibleSources);assert.equal(proposal.eligibleLinks,v1.eligibleLinks);
    function verify(id) {
      const original=catalog.evidence(id),owner=context.sources.find(source=>source.sourceId===original.sourceId);
      assert.equal(owner?.name,original.sourceName);assert.equal(owner?.revision,original.revision);assert.equal(original.buildId,context.buildId);
      const ref=fixture.manifest.evidence.find(ref=>ref.sourceId===original.sourceName&&ref.path===original.path);assert.ok(ref);
      assert.equal(original.revision,ref.revision);assert.equal(original.blobId,ref.blobId);assert.equal(original.contentHash,ref.contentHash);
      const key=`${fixture.root}/${original.sourceName}/${original.revision}/${original.path}`;
      if(!gitTexts.has(key))gitTexts.set(key,scaleGit(fixture.root,original.sourceName,['show',`${original.revision}:${original.path}`],false));
      const text=gitTexts.get(key);assert.equal(digest(text),original.contentHash);
      assert.equal(original.text,text.split('\n').slice(original.startLine-1,original.endLine).join('\n'));assert.equal(digest(original.text),original.spanHash);
      verifiedOriginalOccurrences++;verifiedFiles.add(key);return originalLocator(original);
    }
    const originals=context.spans.map(span=>verify(span.id));
    for(const output of [v1,proposal])for(const source of output.sources)for(const link of source.links)for(const ref of link.evidence) {
      assert.deepEqual(verify(ref.id),originalLocator(ref));
    }
    assert.equal(JSON.stringify(context),before);
    const primary=primarySources(context,selection);
    const assess=output=>{
      const related=canonicalOrderedSources(output.sources),union=[...primary.map(row=>row.source),...related.map(row=>row.source)];
      const missing=item.requiredRepositories.filter(source=>!union.includes(source));
      return {related,union,candidateCount:union.length,maxCandidates:item.maxCandidates,missingRequiredRepositories:missing,
        criticalRecall:{found:item.requiredRepositories.length-missing.length,total:item.requiredRepositories.length},
        withinCandidateBound:union.length<=item.maxCandidates,scopeNecessaryConditionsMet:!missing.length&&union.length<=item.maxCandidates,
        eligibleSources:output.eligibleSources,eligibleLinks:output.eligibleLinks,omittedSources:output.omittedSources,omittedLinks:output.omittedLinks};
    };
    const base=assess(v1),ordered=assess(proposal);
    return {context,row:{id:item.id,question:context.question,primary,contextOriginals:originals,contextSelectionHash:digest(JSON.stringify(originals)),
      v1:base,proposal:ordered,addedSources:ordered.union.filter(source=>!base.union.includes(source)),removedSources:base.union.filter(source=>!ordered.union.includes(source)),
      criticalLoss:item.requiredRepositories.filter(source=>base.union.includes(source)&&!ordered.union.includes(source)),
      eligibleOrder:eligibleOrder.map(({sourceId,kind})=>({source:context.sources.find(source=>source.sourceId===sourceId).name,kind})),
      projections:Object.fromEntries(Object.entries(projections).map(([key,{inputHash,...value}])=>[key,value])),gaps,
      automaticRoutingDecision:'not-implemented',expectedGap:item.gap??null}};
  }

  const smallRows=[],fixtures=new WeakMap();
  const baseline=await evaluateIncidentContext({...services,retrieveAnswerContext:(catalog,question)=>{
    if(!fixtures.has(catalog)) {const directory=path.dirname(catalog.store.directory);fixtures.set(catalog,{root:directory,manifest:JSON.parse(readFileSync(path.join(directory,'manifest.json'),'utf8'))});}
    const item=routingCases.find(item=>item.description===question);assert.ok(item);
    const {context,row}=observe(catalog,fixtures.get(catalog),item);smallRows.push(row);return context;
  }});
  const originalContextBaselineUnchanged=isDeepStrictEqual(baseline.summary,oldContext.summary)
    &&isDeepStrictEqual(baseline.results.map(row=>row.answerContext.selectedLocatorHash),oldContext.results.map(row=>row.answerContext.selectedLocatorHash));
  const first=smallRows.slice(0,10),second=smallRows.slice(10);assert.equal(second.length,10);
  const changedSmallBaseline=first.filter((row,index)=>!isDeepStrictEqual(row.primary.map(source=>source.source),oldSmall.results[index].primary)
    ||!isDeepStrictEqual(comparableSources(row.v1.related),comparableSources(oldSmall.results[index].related))).map(row=>row.id);
  const canonical=row=>({...row,v1:{...row.v1,related:symmetricOrderedSources(row.v1.related)},proposal:{...row.proposal,related:symmetricOrderedSources(row.proposal.related)}});
  const small={results:first,regeneratedResults:second,summary:{v1:summarize(first,'v1'),proposal:summarize(first,'proposal')},
    changedAcrossFreshGenerations:first.filter((row,index)=>!isDeepStrictEqual(canonical(row),canonical(second[index]))).map(row=>row.id),
    originalContextBaselineUnchanged,productionBaselineUnchanged:!changedSmallBaseline.length,changedSmallBaseline};
  await checkpoint('small',small);process.stderr.write('Two small generations and production baseline comparisons complete.\n');

  const fixture=await createCapacityFixture();let catalog,store,volume;
  try {
    const actual=capacityBaseline(fixture);for(const key of Object.keys(actual))assert.deepEqual(actual[key],capacity[key]);
    store=new CatalogStore(path.join(fixture.root,'data'));catalog=new Catalog(store);
    const paths=fixture.manifest.sources.map(source=>path.join(fixture.root,'sources',source.id)),preview=await catalog.previewSources(paths);
    await catalog.registerSources({paths,previewHash:preview.previewHash,requestId:'source-order-volume'});
    const state=catalog.state(),started=catalog.start('source-order-volume',state.sourceSetVersion,state.policyVersion);
    const progress=setInterval(()=>process.stderr.write(`Volume index: ${catalog.store.build(started.id).coverage.indexed} files indexed.\n`),20000);
    try {await catalog.idle();} finally {clearInterval(progress);}
    const build=catalog.store.build(started.id);volume={build,limits:state.limits,initialAttempts:1,refreshAttempts:0};await checkpoint('volume',volume);
    if(build.published) {
      const questions=[...routingCases,...fixture.probes],results=[];
      for(const [index,item] of questions.entries()) {
        const {row}=observe(catalog,fixture,item),old=oldVolume.generations[0].stages.initial.queries.results[index];
        assert.equal(row.id,old.id);
        row.baselineComparison={originalContextUnchanged:isDeepStrictEqual(row.contextOriginals,old.context.selected.map(originalLocator)),
          primaryUnchanged:isDeepStrictEqual(row.primary,old.preview.primary.map(source=>({...source,support:source.support.map(ref=>({...originalLocator(ref),matchedTerms:ref.matchedTerms}))}))),
          relatedUnchanged:isDeepStrictEqual(comparableSources(row.v1.related),comparableSources(old.preview.related))};
        results.push(row);await checkpoint('volume',{...volume,status:'measuring',results});
      }
      volume={...volume,status:'available',results,summary:Object.fromEntries([['incident',results.slice(0,10)],['exact-symbol',results.slice(10)]].map(([group,rows])=>[group,{v1:summarize(rows,'v1'),proposal:summarize(rows,'proposal')} ])),
        originalContextBaselineUnchanged:results.every(row=>row.baselineComparison.originalContextUnchanged),
        primaryBaselineUnchanged:results.every(row=>row.baselineComparison.primaryUnchanged),productionBaselineUnchanged:results.every(row=>row.baselineComparison.relatedUnchanged)};
    } else volume={...volume,status:'unavailable',reason:'The single initial volume index did not publish; no resume or retry.'};
    assert.equal(store.one('SELECT count(*) count FROM answer_attempts').count,0);
    for(const source of fixture.manifest.sources)assert.equal(scaleGit(fixture.root,source.id,['status','--porcelain=v1']),'');
    await checkpoint('volume',volume);
  } finally {await catalog?.stop();store?.close();await rm(fixture.root,{recursive:true,force:true});}
  const criticalLosses={examples:examples.filter(row=>row.criticalLoss.length).map(row=>({id:row.id,sources:row.criticalLoss})),
    small:first.filter(row=>row.criticalLoss.length).map(row=>({id:row.id,sources:row.criticalLoss})),
    volume:(volume.results??[]).filter(row=>row.criticalLoss.length).map(row=>({id:row.id,sources:row.criticalLoss}))};
  const result={schemaVersion:'loredock-source-order-qualification/1',checkedAt:new Date().toISOString(),frozen,implementation,examples,small,volume,
    criticalLosses,unconditionalPromotionAccepted:!Object.values(criticalLosses).some(rows=>rows.length)&&volume.status==='available',
    verifiedOriginalOccurrences,verifiedFilesAcrossGenerations:verifiedFiles.size,productionReconstructionEqual:true,sourceCheckoutsUnchanged:true,
    modelRequests:0,answerAttempts:0,productionPolicyChanged:false,independentReview:'pending',routingAccepted:false,
    limitation:'Clue kind is a reading heuristic, not relevance or confidence. Normalized mechanics and observed synthetic incidents do not establish independent semantic acceptance.'};
  await checkpoint('result',result);return result;
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  assert.equal(process.argv.length,3,'Usage: node scripts/loredock-source-order-qualification.mjs NEW_OUTPUT_DIRECTORY');
  const modules=await Promise.all(['catalog','store','answer-context','source-candidates','candidate-links','system-map','code-flows'].map(name=>import(`../apps/loredock/dist/${name}.js`)));
  console.log(JSON.stringify(await qualifySourceOrder(Object.assign({},...modules),path.resolve(process.argv[2])),null,2));
}
