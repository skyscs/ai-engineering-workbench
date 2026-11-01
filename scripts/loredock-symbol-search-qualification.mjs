import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {symbolLookupCases} from '../fixtures/loredock-symbol-search/cases.mjs';
import {createCapacityFixture,capacityBaseline} from './loredock-capacity-fixture.mjs';
import {verifyCapacityContract} from './loredock-capacity-benchmark.mjs';
import {scaleGit} from './loredock-scale-fixture.mjs';
import {digest} from './loredock-fixture.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const json=value=>JSON.stringify(value,null,2)+'\n';
const errorRecord=error=>({name:error.name??'Error',code:error.code??null,message:String(error.message??error)});
const sorted=values=>values.toSorted((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'));
const capture=async fn=>{try{return await fn();}catch(error){return {status:'unavailable',error:errorRecord(error)};}};

export async function verifySymbolSearchContract({implementation=false}={}) {
  const frozen=JSON.parse(await readFile(new URL('../fixtures/loredock-symbol-search/baseline.json',import.meta.url),'utf8'));
  const hashes={...frozen.sourceHashes,...(implementation?frozen.productHashes:{})};
  for(const [file,hash] of Object.entries(hashes))assert.equal(digest(await readFile(path.join(root,file))),hash,`Frozen symbol qualification input changed: ${file}`);
  assert.equal(symbolLookupCases.length,frozen.queriesPerPass);assert.equal(new Set(symbolLookupCases.map(row=>row.id)).size,frozen.queriesPerPass);
  await verifyCapacityContract();return frozen;
}

export async function verifySymbolNameAmendment() {
  const amendment=JSON.parse(await readFile(new URL('../fixtures/loredock-symbol-search/amendment.json',import.meta.url),'utf8'));
  assert.equal(digest(await readFile(new URL('../fixtures/loredock-symbol-search/baseline.json',import.meta.url))),amendment.originalBaselineHash);
  for(const [file,hash] of Object.entries(amendment.sourceHashes))assert.equal(digest(await readFile(path.join(root,file))),hash,`Frozen name amendment changed: ${file}`);
  const {corrections}=JSON.parse(await readFile(new URL('../fixtures/loredock-symbol-search/qualified-name-errata.json',import.meta.url),'utf8'));
  return {amendment,corrections};
}

export function applySymbolNameErrata(cases,corrections) {
  const result=structuredClone(cases);
  for(const correction of corrections) {
    const item=result.find(item=>item.id===correction.id);assert.ok(item);
    const matches=item.expected.filter(expected=>expected.source===correction.source&&expected.path===correction.path&&expected.symbol===correction.from);
    assert.equal(matches.length,1,'A prospective name correction must identify exactly one unchanged expected symbol.');matches[0].symbol=correction.to;
  }
  return result;
}

export async function symbolStageSequence(index,analyze,query) {
  const initial=await capture(index);
  if(!initial.build?.published)return {initial,analysis:{status:'skipped',reason:'The single initial index did not publish.'},queries:{status:'skipped',reason:'No published index.'}};
  const analysis=await capture(()=>analyze(initial.build));
  const queries=analysis.inventory?.published?await capture(()=>query(initial.build,analysis.inventory))
    :{status:'skipped',reason:'The single durable analysis did not publish.'};
  return {initial,analysis,queries};
}

export function normalizeSymbolResult(value) {
  return {schemaVersion:value.schemaVersion,query:value.query,status:value.status,reason:value.reason,
    inventory:value.inventory?{fingerprint:value.inventory.fingerprint,policyVersion:value.inventory.policyVersion,registryVersion:value.inventory.registryVersion}:null,
    limits:value.limits,partial:value.partial,coverage:value.coverage,limitation:value.limitation,
    matches:value.matches.map(match=>({source:match.sourceName,path:match.path,revision:match.revision,blob:match.blob,contentHash:match.contentHash,
      name:match.name,qualifiedName:match.qualifiedName,role:match.role,range:match.range,status:match.status,
      evidence:match.evidence.map(({id:_id,...ref})=>ref)}))};
}

export function assessSymbolQuery(item,value,{candidateFiles,unsupportedFiles,gapMessages,lookupLimits}) {
  const actual=value.matches.map(match=>({source:match.sourceName,path:match.path,symbol:match.qualifiedName})),coverage=value.coverage;
  return {expectedMatches:item.expected,actualMatches:actual,exactMatches:isDeepStrictEqual(sorted(actual),sorted(item.expected)),
    completeScan:value.status==='available'&&coverage?.candidateFiles===candidateFiles&&coverage.retainedFiles===candidateFiles
      &&coverage.scannedFiles===candidateFiles&&coverage.scanComplete===true&&!coverage.timeStopped,
    completeOutput:coverage?.matchingSymbols===value.matches.length&&coverage.omittedMatches===0&&!coverage.outputLimited,
    limitsPreserved:isDeepStrictEqual(value.limits,lookupLimits)&&value.matches.length<=lookupLimits.matches&&Buffer.byteLength(JSON.stringify(value))<=lookupLimits.outputBytes,
    gapsExplicit:value.partial===true&&coverage?.filesWithSyntaxGaps===unsupportedFiles&&coverage.syntaxGapMessages===gapMessages
      &&value.limitation.includes('No match does not establish absence')};
}

export function summarizeSymbolPasses(passes,cases,targetMs,expectation) {
  const rows=passes.flatMap(pass=>pass.queries),available=rows.filter(row=>row.status==='available'),times=available.map(row=>row.ms).sort((a,b)=>a-b);
  const mechanical=row=>{
    const item=cases.find(item=>item.id===row.id);if(!item||row.status!=='available'||!row.response||row.originalsVerified!==true)return false;
    const assessment=assessSymbolQuery(item,row.response,expectation);
    return ['exactMatches','completeScan','completeOutput','limitsPreserved','gapsExplicit'].every(key=>assessment[key]===true);
  };
  const differences=cases.filter(item=>{
    const first=passes[0]?.queries.find(row=>row.id===item.id),second=passes[1]?.queries.find(row=>row.id===item.id);
    return !first?.response||!second?.response||!isDeepStrictEqual(normalizeSymbolResult(first.response),normalizeSymbolResult(second.response));
  }).map(row=>row.id);
  const expected=cases.length*2,complete=passes.length===2&&passes.every(pass=>pass.queries.length===cases.length
    &&new Set(pass.queries.map(row=>row.id)).size===cases.length&&cases.every(item=>pass.queries.some(row=>row.id===item.id)));
  return {expectedQueries:expected,recordedQueries:rows.length,availableQueries:available.length,
    mechanicallyPassingQueries:rows.filter(mechanical).length,repeatDifferences:differences,
    mechanicalChecksPassed:complete&&rows.every(mechanical)&&differences.length===0,
    timing:{targetMs,medianMs:times.length?(times[Math.floor((times.length-1)/2)]+times[Math.ceil((times.length-1)/2)])/2:null,
      maxMs:times.length?times.at(-1):null,allQueriesWithinTarget:complete&&available.length===expected&&times.every(ms=>ms<=targetMs)}};
}

function originalVerifier(fixture,catalog,analysis,inventory,build) {
  const texts=new Map();let spans=0;
  return {verify(value) {
    assert.equal(value.buildId,build.id);assert.equal(value.inventory?.id,inventory.id);assert.equal(value.inventory.fingerprint,inventory.fingerprint);
    const originals=[];
    for(const match of value.matches) {
      assert.equal(match.status,'syntax-only');const key=`${match.sourceName}/${match.path}`;
      const ref=fixture.manifest.evidence.find(ref=>ref.sourceId===match.sourceName&&ref.path===match.path);assert.ok(ref,`Unmanifested symbol: ${key}`);
      const owner=build.sources.find(source=>source.sourceId===match.sourceId);assert.equal(owner?.name,match.sourceName);
      assert.equal(match.revision,ref.revision);assert.equal(match.blob,ref.blobId);assert.equal(match.contentHash,ref.contentHash);
      if(!texts.has(key))texts.set(key,scaleGit(fixture.root,match.sourceName,['show',`${match.revision}:${match.path}`],false));
      const text=texts.get(key);assert.equal(digest(text),ref.contentHash);
      const file=analysis.file(inventory.id,match.fileId),symbol=file.facts.symbols.find(symbol=>symbol.qualifiedName===match.qualifiedName
        &&digest(text.slice(symbol.start,symbol.end))===match.range.textHash);assert.ok(symbol,'Symbol range is unsupported by the original Git text.');
      assert.equal(text.slice(0,symbol.start).split('\n').length,match.range.startLine);
      assert.equal(text.slice(0,symbol.end-1).split('\n').length,match.range.endLine);assert.ok(match.evidence.length>0);
      for(const cited of match.evidence) {
        const original=catalog.evidence(cited.id);assert.equal(original.buildId,build.id);assert.equal(original.sourceId,match.sourceId);
        assert.equal(original.path,match.path);assert.equal(original.revision,match.revision);assert.equal(original.blobId,match.blob);
        assert.equal(original.contentHash,match.contentHash);assert.equal(original.startLine,cited.startLine);assert.equal(original.endLine,cited.endLine);
        assert.equal(original.text,text.split('\n').slice(original.startLine-1,original.endLine).join('\n'));
        assert.equal(digest(original.text),original.spanHash);assert.ok(cited.startLine<=match.range.endLine&&cited.endLine>=match.range.startLine);spans++;
      }
      originals.push({source:match.sourceName,path:match.path,revision:match.revision,blob:match.blob,contentHash:match.contentHash,range:match.range,spans:match.evidence.length});
    }
    return originals;
  },stats:()=>({verifiedSpanOccurrences:spans,verifiedFiles:texts.size})};
}

export async function qualifySymbolSearch(services,output,{smoke=false}={}) {
  const frozen=await verifySymbolSearchContract({implementation:true}),capacity=await verifyCapacityContract();
  const amendment=await verifySymbolNameAmendment();
  const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const files=['scripts/loredock-symbol-search-qualification.mjs',...((await readdir(path.join(root,'apps/loredock/dist'))).filter(file=>file.endsWith('.js')).map(file=>'apps/loredock/dist/'+file)),
    'apps/loredock/node_modules/typescript/lib/typescript.js'];
  const implementation={commit,node:process.version,typescriptVersion:JSON.parse(await readFile(path.join(root,'apps/loredock/node_modules/typescript/package.json'),'utf8')).version,
    hashes:Object.fromEntries(await Promise.all(files.map(async file=>[file,digest(await readFile(path.join(root,file)))])))};
  await mkdir(output);const checkpoint=(name,value)=>writeFile(path.join(output,name+'.json'),json(value));
  if(!smoke) {
    assert.equal(execFileSync('git',['status','--porcelain=v1','--untracked-files=all'],{cwd:root,encoding:'utf8'}),'','Commit the reviewed harness before the full measurement.');
    await mkdir(path.join(root,'.loredock-evaluations'),{recursive:true});
    await writeFile(path.join(root,'.loredock-evaluations/task048-symbols.json'),json({commit,output,startedAt:new Date().toISOString()}),{flag:'wx'});
  }
  await checkpoint('contract',{frozen,amendment,implementation,smoke,startedAt:new Date().toISOString()});
  let fixture,catalog,store,analysis;let peakRss=process.memoryUsage().rss;
  const sample=()=>{peakRss=Math.max(peakRss,process.memoryUsage().rss);};const timer=setInterval(sample,100);
  try {
    let began=performance.now();fixture=await createCapacityFixture(smoke?5:180);const fixtureMs=performance.now()-began,baseline=capacityBaseline(fixture);
    if(!smoke)for(const key of Object.keys(baseline))assert.deepEqual(baseline[key],capacity[key]);
    store=new services.CatalogStore(path.join(fixture.root,'data'));catalog=new services.Catalog(store);analysis=new services.CodeAnalysis(catalog);
    const paths=fixture.manifest.sources.map(source=>path.join(fixture.root,'sources',source.id)),preview=await catalog.previewSources(paths);
    await catalog.registerSources({paths,previewHash:preview.previewHash,requestId:'symbols'});
    const cases=structuredClone(symbolLookupCases);
    if(smoke)for(const item of cases.slice(0,3)) {item.query=item.query.replace(/0179$/,'0004');for(const expected of item.expected){expected.symbol=item.query;expected.path='load/probe-0004.ts';}}
    const amendedCases=applySymbolNameErrata(cases,amendment.corrections);
    const expectation={...frozen,candidateFiles:smoke?121:frozen.candidateFiles};let graphCheck=null,verifiedOriginals=null;
    const stages=await symbolStageSequence(async()=>{
      const state=catalog.state();began=performance.now();const started=catalog.start('symbols',state.sourceSetVersion,state.policyVersion);
      const progress=setInterval(()=>process.stderr.write(`Index: ${store.build(started.id).coverage.indexed} files indexed.\n`),20000);
      try{await catalog.idle();}finally{clearInterval(progress);}
      const value={status:'available',ms:performance.now()-began,build:store.build(started.id)};await checkpoint('index',value);return value;
    },async build=>{
      began=performance.now();const started=analysis.start('symbols',build.id);await analysis.idle();
      const value={status:'available',ms:performance.now()-began,inventory:analysis.get(started.id)};await checkpoint('analysis',value);return value;
    },async(build,inventory)=>{
      const graph=services.codeFlows(catalog,build.id),outside=cases.filter(item=>item.outsideDefaultGraph);
      graphCheck={adapterVersion:graph.adapterVersion,coverage:graph.coverage,
        absentExpected:outside.every(item=>item.expected.every(expected=>!graph.nodes.some(node=>node.kind==='symbol'&&node.sourceName===expected.source&&node.path===expected.path&&node.label===expected.symbol)))};
      const verifier=originalVerifier(fixture,catalog,analysis,inventory,build),passes=[];
      for(let pass=1;pass<=frozen.passes;pass++) {
        const queries=[];
        for(const item of cases) {
          sample();const rssBefore=process.memoryUsage().rss,start=performance.now();let row;
          try {
            const response=await services.lookupCodeSymbols(analysis,item.query,build.id),ms=performance.now()-start;
            row={id:item.id,query:item.query,status:'available',ms,rssBefore,rssAfter:process.memoryUsage().rss,responseBytes:Buffer.byteLength(JSON.stringify(response)),response};
            await checkpoint(`pass-${pass}-${item.id}-raw`,row);
            row.originals=verifier.verify(response);row.originalsVerified=true;row.assessment=assessSymbolQuery(item,response,expectation);
            row.amendedAssessment=assessSymbolQuery(amendedCases.find(candidate=>candidate.id===item.id),response,expectation);
          }catch(error){row={ms:performance.now()-start,rssBefore,rssAfter:process.memoryUsage().rss,...row,id:item.id,query:item.query,status:'unavailable',error:errorRecord(error)};}
          sample();queries.push(row);await checkpoint(`pass-${pass}-${item.id}`,row);
          process.stderr.write(`Pass ${pass}, ${item.id}: ${row.status}; ${row.ms===undefined?'no result':Math.round(row.ms)+' ms'}.\n`);
        }
        passes.push({pass,queries});await checkpoint(`pass-${pass}`,passes.at(-1));
      }
      verifiedOriginals=verifier.stats();return {status:'available',passes,summary:summarizeSymbolPasses(passes,cases,frozen.queryTargetMs,expectation),
        amendedSummary:summarizeSymbolPasses(passes,amendedCases,frozen.queryTargetMs,expectation)};
    });
    const sourceCheckoutsUnchanged=fixture.manifest.sources.every(source=>scaleGit(fixture.root,source.id,['status','--porcelain=v1'])===''
      &&scaleGit(fixture.root,source.id,['rev-parse','HEAD'])===source.revision);
    const answerAttempts=store.one('SELECT count(*) count FROM answer_attempts').count;sample();
    const result={schemaVersion:'loredock-symbol-search-qualification/1',checkedAt:new Date().toISOString(),smoke,frozen,amendment,implementation,sourceBaseline:baseline,
      fixtureMs,stages,graphCheck,verifiedOriginals,sampledPeakRssBytes:peakRss,memoryScope:'Shared evaluator process, sampled every 100 ms and at query boundaries; includes fixture/index allocations.',
      sourceCheckoutsUnchanged,modelRequests:0,answerAttempts,mechanicalQualificationPassed:stages.queries.summary?.mechanicalChecksPassed===true&&graphCheck?.absentExpected===true&&sourceCheckoutsUnchanged&&answerAttempts===0,
      amendedMechanicalQualificationPassed:stages.queries.amendedSummary?.mechanicalChecksPassed===true&&graphCheck?.absentExpected===true&&sourceCheckoutsUnchanged&&answerAttempts===0,
      semanticAcceptance:false,independentReview:'pending',limitation:'Known simple synthetic source volume and a mechanical oracle; not representative framework cost, independent semantic acceptance or a production latency commitment.'};
    await checkpoint('result',result);return result;
  }catch(error){await checkpoint('failure',{error:errorRecord(error),implementation,smoke});throw error;}
  finally{clearInterval(timer);await analysis?.stop();await catalog?.stop();store?.close();if(fixture)await rm(fixture.root,{recursive:true,force:true});}
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  assert.ok(process.argv.length===3||(process.argv.length===4&&process.argv[3]==='--smoke'),'Usage: node scripts/loredock-symbol-search-qualification.mjs NEW_OUTPUT_DIRECTORY [--smoke]');
  const modules=await Promise.all(['catalog','store','code-analysis','code-symbols','code-flows'].map(name=>import(`../apps/loredock/dist/${name}.js`)));
  const result=await qualifySymbolSearch(Object.assign({},...modules),path.resolve(process.argv[2]),{smoke:process.argv[3]==='--smoke'});
  console.log(json({output:path.resolve(process.argv[2]),smoke:result.smoke,mechanicalQualificationPassed:result.mechanicalQualificationPassed,summary:result.stages.queries.summary??null,
    amendedMechanicalQualificationPassed:result.amendedMechanicalQualificationPassed,amendedSummary:result.stages.queries.amendedSummary??null,
    sampledPeakRssBytes:result.sampledPeakRssBytes,verifiedOriginals:result.verifiedOriginals}));
}
