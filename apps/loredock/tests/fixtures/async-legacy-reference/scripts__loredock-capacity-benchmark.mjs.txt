import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,rm,stat,readdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {capacityBaseline,createCapacityFixture} from './loredock-capacity-fixture.mjs';
import {verifyIncidentContract} from './loredock-incident-context.mjs';
import {routingCases} from '../fixtures/loredock-routing/cases.mjs';
import {digest} from './loredock-fixture.mjs';
import {scaleGit} from './loredock-scale-fixture.mjs';
import {capacityQuerySummary,compareCapacityQueries} from './loredock-capacity-audit.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const errorRecord=error=>({name:error.name??'Error',code:error.code??null,message:String(error.message??error)});
const json=value=>JSON.stringify(value,null,2)+'\n';
const sort=values=>values.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'));
const timed=fn=>{const start=performance.now(),value=fn();return {value,ms:performance.now()-start};};

export async function verifyCapacityContract() {
  const frozen=JSON.parse(await readFile(new URL('../fixtures/loredock-capacity/baseline.json',import.meta.url),'utf8'));
  for(const [file,hash] of Object.entries(frozen.sourceHashes))assert.equal(digest(await readFile(path.join(root,file))),hash,`Frozen workload changed: ${file}`);
  const parent=await verifyIncidentContract();assert.equal(parent.contractHash,frozen.incidentContractHash);
  assert.deepEqual(parent.sourceBaseline,frozen.parentBaseline);
  return frozen;
}

// Publication alone permits the single declared refresh. Never resume or retry a stage.
export async function capacityStageSequence(attempt) {
  const initial=await attempt('initial');
  const refresh=initial.build?.published?await attempt('refresh'):{stage:'refresh',status:'skipped',reason:'Initial index did not publish.'};
  return {initial,refresh};
}

function originalVerifier(fixture,catalog,build) {
  const refs=new Map(fixture.manifest.evidence.map(ref=>[`${ref.sourceId}/${ref.path}`,ref])),texts=new Map();
  let occurrences=0;
  function verify(id) {
    const span=catalog.evidence(id),owner=build.sources.find(source=>source.sourceId===span.sourceId);
    assert.equal(span.buildId,build.id);assert.equal(owner?.name,span.sourceName);assert.equal(owner?.revision,span.revision);
    const key=`${span.sourceName}/${span.path}`,ref=refs.get(key);assert.ok(ref,`Unmanifested original: ${key}`);
    assert.equal(span.revision,ref.revision);assert.equal(span.blobId,ref.blobId);assert.equal(span.contentHash,ref.contentHash);
    if(!texts.has(key))texts.set(key,scaleGit(fixture.root,span.sourceName,['show',`${span.revision}:${span.path}`],false));
    const text=texts.get(key);assert.equal(digest(text),span.contentHash);
    assert.equal(span.text,text.split('\n').slice(span.startLine-1,span.endLine).join('\n'));assert.equal(digest(span.text),span.spanHash);
    occurrences++;
    return {source:span.sourceName,path:span.path,revision:span.revision,blobId:span.blobId,
      startLine:span.startLine,endLine:span.endLine,contentHash:span.contentHash,spanHash:span.spanHash};
  }
  return {verify,stats:()=>({verifiedSpanOccurrences:occurrences,verifiedFiles:texts.size})};
}

function assess(item,selected,sources,manifest) {
  const missingRepositories=item.requiredRepositories.filter(source=>!sources.includes(source));
  const missingEvidence=item.evidence.filter(id=>{
    const ref=manifest.evidence.find(ref=>ref.id===id);assert.ok(ref,`Unknown expectation: ${id}`);
    return !selected.some(span=>span.source===ref.sourceId && span.path===ref.path && span.revision===ref.revision
      && span.contentHash===ref.contentHash && span.startLine<=ref.startLine && span.endLine>=ref.endLine);
  });
  return {candidates:sources,candidateCount:sources.length,maxCandidates:item.maxCandidates,missingRepositories,missingEvidence,
    criticalRecall:{found:item.requiredRepositories.length-missingRepositories.length,total:item.requiredRepositories.length},
    completeEvidence:!missingEvidence.length,withinCandidateBound:sources.length<=item.maxCandidates,
    scopeNecessaryConditionsMet:!missingRepositories.length&&sources.length<=item.maxCandidates};
}

function inspectQueries(services,fixture,catalog,build) {
  const {retrieveAnswerContext,sourceCandidatePreview,projectOrientation,codeFlows,declarationMap}=services;
  const {verify,stats}=originalVerifier(fixture,catalog,build);
  const capture=fn=>{try{return {status:'available',...fn()};}catch(error){return {status:'unavailable',error:errorRecord(error)};}};
  const orientation=capture(()=>{
    const {value,ms}=timed(()=>projectOrientation(catalog,build.id));
    const evidence=Object.values(value.evidence).map(ref=>verify(ref.id));
    return {ms,version:value.adapterVersion,coverage:value.coverage,limits:value.limits,omissions:value.omissions,gaps:value.gaps,
      sources:value.sources.map(source=>({source:source.sourceName,revision:source.revision,readme:source.readme,
        context:source.context?{...source.context,evidenceIds:undefined}:null,reading:source.reading.map(link=>({kind:link.kind,path:link.path,evidence:link.evidenceIds.map(verify)}))})),evidence};
  });
  const projections=Object.fromEntries([['code',codeFlows],['declarations',declarationMap]].map(([name,project])=>[name,capture(()=>{
    const {value,ms}=timed(()=>project(catalog,build.id));
    return {ms,version:value.adapterVersion,coverage:value.coverage,limits:value.limits,omissions:value.omissions,
      declarationOmissions:value.declarationOmissions??null,gaps:value.gaps,nodes:value.nodes.length,edges:value.edges.length,
      originals:sort(Object.values(value.evidence).map(ref=>verify(ref.id)))};
  })]));
  const questions=[...routingCases.map(row=>({...row,question:row.description,group:'incident'})),...fixture.probes.map(row=>({...row,group:'exact-symbol'}))];
  const results=questions.map(item=>({id:item.id,group:item.group,question:item.question,
    expectedDecision:item.decision??'investigate-candidates',expectedGap:item.gap??null,automaticRoutingDecision:'not-implemented',
    context:capture(()=>{
      const {value,ms}=timed(()=>retrieveAnswerContext(catalog,item.question,build.id));
      const selected=value.spans.map(span=>verify(span.id));
      assert.ok(value.spans.length<=value.limits.spans&&value.textBytes<=value.limits.textBytes);
      return {ms,selected,selectionHash:digest(JSON.stringify(selected)),textBytes:value.textBytes,limits:value.limits,
        terms:value.terms,expansionTerms:value.expansionTerms,mode:value.retrievalMode,gaps:value.gaps,
        ...assess(item,selected,[...new Set(selected.map(ref=>ref.source))],fixture.manifest)};
    }),
    preview:capture(()=>{
      const {value,ms}=timed(()=>sourceCandidatePreview(catalog,item.question,build.id));
      const source=row=>({source:row.sourceName,revision:row.revision,score:row.score,omittedSupport:row.omittedSupport,
        support:row.support.map(ref=>({...verify(ref.id),matchedTerms:ref.matchedTerms}))});
      const primary=value.suggested.map(source),otherMatches=value.otherMatches.map(source);
      const related=value.related.sources.map(row=>({source:row.sourceName,revision:row.revision,omittedLinks:row.omittedLinks,links:row.links.map(link=>{
        const endpoint=value=>({source:value.sourceName,revision:value.revision,label:value.label,evidence:value.evidenceIds.map(verify)});
        const endpoints=[endpoint(link.from),endpoint(link.to)];
        return {kind:link.kind,origin:link.origin,status:link.status,environment:link.environment,reason:link.reason,gaps:link.gaps,
          // Declaration comparisons are symmetric; code edges retain direction.
          endpoints:link.origin==='declaration'?sort(endpoints):endpoints,evidence:sort(link.evidence.map(ref=>verify(ref.id)))};
      })}));
      const selected=[...primary.flatMap(row=>row.support),...related.flatMap(row=>row.links.flatMap(link=>link.evidence))];
      const canonical={primary,otherMatches,related,selectionStatus:value.status,distinctiveTerms:value.distinctiveTerms,tiedAtLimit:value.tiedAtLimit};
      return {ms,...canonical,selectionHash:digest(JSON.stringify(canonical)),limits:value.limits,relatedLimits:value.related.limits,
        omissions:{matches:value.omittedMatches,sources:value.related.omittedSources,links:value.related.omittedLinks},
        gaps:value.gaps,relatedGaps:value.related.gaps,
        ...assess(item,selected,[...primary,...related].map(row=>row.source),fixture.manifest)};
    })}));
  const summary=capacityQuerySummary(results,fixture.probes);
  return {status:'available',orientation,projections,results,summary,...stats()};
}

async function retained(store,buildId) {
  const rawBytes=store.one('SELECT coalesce(sum(length(raw)),0) bytes FROM files WHERE buildId=?',buildId).bytes;
  const spanTextBytes=store.one('SELECT coalesce(sum(length(CAST(s.text AS BLOB))),0) bytes FROM spans s JOIN files f ON f.id=s.fileId WHERE f.buildId=?',buildId).bytes;
  const allRawBytes=store.one('SELECT coalesce(sum(length(raw)),0) bytes FROM files').bytes;
  const allSpanTextBytes=store.one('SELECT coalesce(sum(length(CAST(text AS BLOB))),0) bytes FROM spans').bytes;
  store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  return {rawBytes,spanTextBytes,allRawBytes,allSpanTextBytes,databaseBytes:(await stat(path.join(store.directory,'loredock.db'))).size,
    schemaVersion:store.one('PRAGMA user_version').user_version};
}

export function compareCapacityStages(first,second) {
  return compareCapacityQueries(first,second);
}

async function implementationProvenance() {
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trimEnd();
  const files=git(['ls-files','apps/loredock/src','packages','package.json','pnpm-lock.yaml','scripts/loredock-capacity-benchmark.mjs','scripts/loredock-capacity-audit.mjs']).split('\n').filter(Boolean);
  const sourceHashes=Object.fromEntries(await Promise.all(files.map(async file=>[file,digest(await readFile(path.join(root,file)))])));
  const builtFiles=(await readdir(path.join(root,'apps/loredock/dist'))).filter(file=>file.endsWith('.js')).sort();
  const builtHashes=Object.fromEntries(await Promise.all(builtFiles.map(async file=>[file,digest(await readFile(path.join(root,'apps/loredock/dist',file)))])));
  return {commit:git(['rev-parse','HEAD']),workingTree:git(['status','--porcelain=v1']),sourceHashes,builtHashes,
    node:process.version,platform:process.platform,arch:process.arch,kernel:os.release(),cpuModel:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem()};
}

export async function runCapacityBenchmark(services,outputDirectory) {
  const frozen=await verifyCapacityContract(),implementation=await implementationProvenance();
  // An explicit new directory prevents accidental overwrite of a prior run.
  await mkdir(outputDirectory);
  const checkpoint=(name,value)=>writeFile(path.join(outputDirectory,name+'.json'),json(value));
  await checkpoint('contract',{frozen,implementation,startedAt:new Date().toISOString()});
  const generations=[];
  for(let generation=1;generation<=2;generation++) {
    const started=performance.now(),fixture=await createCapacityFixture();let catalog,store;
    const report={generation,generationMs:performance.now()-started,stages:{}};
    try {
      const actual=capacityBaseline(fixture);
      for(const key of Object.keys(actual))assert.deepEqual(actual[key],frozen[key],`Frozen full workload mismatch: ${key}`);
      store=new services.CatalogStore(path.join(fixture.root,'data'));catalog=new services.Catalog(store);
      report.limits=catalog.state().limits;
      const registrationStarted=performance.now(),paths=fixture.manifest.sources.map(source=>path.join(fixture.root,'sources',source.id));
      const preview=await catalog.previewSources(paths);
      await catalog.registerSources({paths,previewHash:preview.previewHash,requestId:'capacity-registration'});
      report.registrationMs=performance.now()-registrationStarted;
      report.stages=await capacityStageSequence(async stage=>{
        const state=catalog.state(),rssBefore=process.memoryUsage().rss;let rssPeak=rssBefore,samples=1;
        const sample=setInterval(()=>{rssPeak=Math.max(rssPeak,process.memoryUsage().rss);samples++;},100);
        const begin=performance.now();let buildId;
        const progress=setInterval(()=>process.stderr.write(`Generation ${generation} ${stage}: ${Math.round(performance.now()-begin)} ms; ${buildId?catalog.store.build(buildId).coverage.indexed:0} indexed files.\n`),20000);
        let result;
        try {
          const pending=catalog.start(`capacity-${stage}`,state.sourceSetVersion,state.policyVersion);buildId=pending.id;
          await catalog.idle();
          const indexMs=performance.now()-begin,build=catalog.store.build(buildId);
          rssPeak=Math.max(rssPeak,process.memoryUsage().rss);samples++;
          result={stage,indexMs,build,processRss:{before:rssBefore,peakSampled:rssPeak,after:process.memoryUsage().rss,samples,intervalMs:100,
            scope:'Evaluator process during indexing only; excludes child Git memory. No OS cache isolation or forced GC.'},retained:await retained(store,buildId)};
        } catch(error) {result={stage,error:errorRecord(error),build:buildId?catalog.store.build(buildId):null};}
        finally {clearInterval(sample);clearInterval(progress);}
        // Persist indexing outcomes before expensive query/provenance inspection.
        report.stages[stage]=result;await checkpoint(`generation-${generation}`,report);
        result.queries=result.build?.published?inspectQueries(services,fixture,catalog,result.build):{status:'unavailable',reason:'Index did not publish.'};
        await checkpoint(`generation-${generation}`,report);
        process.stderr.write(`Generation ${generation} ${stage}: ${result.build?.status??'error'}; ${result.build?.coverage.indexed??0} indexed files.\n`);
        return result;
      });
      report.refreshComparison=compareCapacityStages(report.stages.initial,report.stages.refresh);
      report.answerAttempts=store.one('SELECT count(*) count FROM answer_attempts').count;assert.equal(report.answerAttempts,0);
      for(const source of fixture.manifest.sources)assert.equal(scaleGit(fixture.root,source.id,['status','--porcelain=v1']),'');
      report.sourceCheckoutsUnchanged=true;
      await checkpoint(`generation-${generation}`,report);generations.push(report);
    } finally {await catalog?.stop();store?.close();await rm(fixture.root,{recursive:true,force:true});}
  }
  const result={schemaVersion:'loredock-capacity-result/2',checkedAt:new Date().toISOString(),frozen,implementation,
    versions:{retrieval:services.retrievalVersion,candidates:services.candidateVersion},generations,
    regeneration:Object.fromEntries(['initial','refresh'].map(stage=>[stage,compareCapacityStages(generations[0].stages[stage],generations[1].stages[stage])])),
    modelRequests:0,routingAccepted:false,semanticReview:'not-performed',independentReview:'pending',
    limitation:'Synthetic source volume measures neither full framework cost nor semantic/private-project readiness. Published partial indexes and bounded projection omissions remain explicit.'};
  await checkpoint('result',result);return result;
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  assert.equal(process.argv.length,3,'Usage: node scripts/loredock-capacity-benchmark.mjs NEW_OUTPUT_DIRECTORY');
  const modules=await Promise.all(['catalog','store','answer-context','source-candidates','orientation','code-flows','system-map'].map(name=>import(`../apps/loredock/dist/${name}.js`)));
  console.log(json(await runCapacityBenchmark(Object.assign({},...modules),path.resolve(process.argv[2]))));
}
