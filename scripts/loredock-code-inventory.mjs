import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setImmediate as yieldTurn} from 'node:timers/promises';
import {digest} from './loredock-fixture.mjs';
import {scaleGit} from './loredock-scale-fixture.mjs';

export const inventoryLimits={documents:10000,fileBytes:32768,fileSpans:8,textBytes:52428800,fileFactBytes:131072,factBytes:16777216,wallMs:300000};
const codePredicate="(lower(f.path) LIKE '%.ts' OR lower(f.path) LIKE '%.js' OR lower(f.path) LIKE '%.vue' OR lower(f.path) LIKE '%.java')";
const parserFiles=['apps/loredock/src/code-typescript.ts','apps/loredock/src/code-java.ts','apps/loredock/src/code-facts.ts','apps/loredock/src/http-headers.ts','pnpm-lock.yaml'];

export async function verifyCodeInventoryContract() {
  const frozen=JSON.parse(await readFile(new URL('../fixtures/loredock-code-inventory/baseline.json',import.meta.url),'utf8'));
  for(const [file,hash] of Object.entries(frozen.sourceHashes))assert.equal(digest(await readFile(new URL('../'+file,import.meta.url))),hash,`Frozen inventory input changed: ${file}`);
  assert.equal(digest(JSON.stringify(Object.fromEntries(parserFiles.map(file=>[file,frozen.sourceHashes[file]])))),frozen.parserFingerprint);
  assert.deepEqual(inventoryLimits,frozen.limits);return frozen;
}

export function codeFactRanges(content,facts) {
  const keys=new Set(facts.symbols.map(symbol=>symbol.key));assert.equal(keys.size,facts.symbols.length,'Duplicate parser symbol keys.');
  function range(fact) {
    assert.ok(Number.isSafeInteger(fact.start)&&Number.isSafeInteger(fact.end)&&fact.start>=0&&fact.end>fact.start&&fact.end<=content.length,'Invalid parser source range.');
    return {startLine:content.slice(0,fact.start).split('\n').length,endLine:content.slice(0,fact.end-1).split('\n').length,
      textHash:digest(content.slice(fact.start,fact.end))};
  }
  const symbols=facts.symbols.map(symbol=>({key:symbol.key,...range(symbol)}));
  const operations=facts.operations.map(operation=>{
    const owner=facts.symbols.find(symbol=>symbol.key===operation.owner);assert.ok(owner,'Unknown operation owner.');
    assert.ok(operation.start>=owner.start&&operation.end<=owner.end,'Operation is outside its owner.');
    return {owner:operation.owner,kind:operation.kind,...range(operation)};
  });
  for(const call of facts.calls)assert.ok(keys.has(call.owner),'Unknown call owner.');
  return {offsetEncoding:'UTF-16 code units',symbols,operations};
}

/** Offline experiment over an owned catalog; no product cache or source execution. */
export async function scanCodeInventory(services,catalog,fixture,parserFingerprint,options={}) {
  const {readMapDocument,typescriptFacts,javaFacts}=services,limits={...inventoryLimits,...options.limits};
  for(const key of Object.keys(limits))assert.ok(Number.isSafeInteger(limits[key])&&limits[key]>=0&&limits[key]<=inventoryLimits[key],`Invalid experiment limit: ${key}`);
  const build=catalog.readBuild(options.buildId),store=catalog.store,started=performance.now(),timings={metadataMs:0,validatedReadMs:0,gitReadMs:0,provenanceMs:0,parserMs:0,factValidationMs:0};
  const boundary=store.project();
  const timed=(key,fn)=>{const begin=performance.now();try{return fn();}finally{timings[key]+=performance.now()-begin;}};
  const provenance=fn=>{const before=timings.gitReadMs;try{return timed('provenanceMs',fn);}finally{timings.provenanceMs-=timings.gitReadMs-before;}};
  const files=timed('metadataMs',()=>store.all(`SELECT f.id,f.sourceId,bs.name AS sourceName,bs.revision,f.path,f.blob,f.contentHash,f.size,length(f.raw) AS storedBytes
    FROM files f JOIN sources src ON src.id=f.sourceId JOIN build_sources bs ON bs.buildId=f.buildId AND bs.sourceId=f.sourceId
    WHERE f.buildId=? AND f.status='indexed' AND src.status='active' AND ${codePredicate} ORDER BY bs.rowid,f.path`,build.id));
  assert.ok(files.length<=inventoryLimits.documents,'Owned index exceeds the experiment metadata bound.');
  const refs=new Map(fixture.manifest.evidence.map(ref=>[`${ref.sourceId}/${ref.path}`,ref]));
  const gitTexts=options.gitTexts??new Map(),records=[];let textBytes=0,factBytes=0,stopReason=null,verifiedSpans=0;
  let rssPeak=process.memoryUsage().rss,samples=1;const rssBefore=rssPeak;
  const sample=setInterval(()=>{rssPeak=Math.max(rssPeak,process.memoryUsage().rss);samples++;},100);
  const progress=setInterval(()=>options.progress?.({visited:records.length,total:files.length,elapsedMs:performance.now()-started}),20000);
  try {
    for(const [index,file] of files.entries()) {
      const row={source:file.sourceName,path:file.path,revision:file.revision,blobId:file.blob,contentHash:file.contentHash,sizeBytes:file.size,
        parser:file.path.endsWith('.java')?'java':'typescript',parserFingerprint,status:'unattempted',examined:false};
      records.push(row);
      if(!stopReason&&performance.now()-started>=limits.wallMs)stopReason='wall-time-limit';
      if(!stopReason&&index>=limits.documents)stopReason='document-limit';
      if(stopReason){row.reason=stopReason;continue;}
      try {
        assert.ok(Number.isSafeInteger(file.size)&&Number.isSafeInteger(file.storedBytes)&&file.size>=0&&file.storedBytes>=0,'Invalid source byte metadata.');
        if(Math.max(file.size,file.storedBytes)>limits.fileBytes){row.status='excluded';row.reason='file-byte-limit';continue;}
        const issued=timed('validatedReadMs',()=>store.all('SELECT id FROM spans WHERE fileId=? ORDER BY startLine LIMIT ?',file.id,limits.fileSpans+1));
        if(issued.length>limits.fileSpans){row.status='excluded';row.reason='file-span-limit';continue;}
        if(textBytes+Math.max(file.size,file.storedBytes)>limits.textBytes){stopReason='input-byte-limit';row.reason=stopReason;continue;}
        const document=timed('validatedReadMs',()=>readMapDocument(catalog,build.id,file,issued));
        const evidence=provenance(()=>{
          const expected=refs.get(`${file.sourceName}/${file.path}`);assert.ok(expected,'Unmanifested owned source.');
          assert.equal(file.revision,expected.revision);assert.equal(file.blob,expected.blobId);assert.equal(digest(document.raw),expected.contentHash);
          const key=`${fixture.root}/${file.sourceName}/${file.revision}/${file.path}`;
          if(!gitTexts.has(key))gitTexts.set(key,timed('gitReadMs',()=>scaleGit(fixture.root,file.sourceName,['show',`${file.revision}:${file.path}`],false)));
          const raw=gitTexts.get(key);assert.equal(digest(raw),expected.contentHash);assert.equal(document.raw.toString('utf8'),raw);
          return issued.map(({id})=>{
            const original=catalog.evidence(id);assert.equal(original.sourceId,file.sourceId);assert.equal(original.sourceName,file.sourceName);
            assert.equal(original.revision,file.revision);assert.equal(original.buildId,build.id);assert.equal(original.blobId,file.blob);
            assert.equal(original.text,raw.replaceAll('\r\n','\n').split('\n').slice(original.startLine-1,original.endLine).join('\n'));
            assert.equal(digest(original.text),original.spanHash);verifiedSpans++;
            return {source:original.sourceName,path:original.path,revision:original.revision,blobId:original.blobId,contentHash:original.contentHash,
              startLine:original.startLine,endLine:original.endLine,spanHash:original.spanHash};
          });
        });
        textBytes+=document.raw.length;
        const facts=timed('parserMs',()=>file.path.endsWith('.java')?javaFacts(document.content):typescriptFacts(document.content,file.path));
        row.examined=true;
        const ranges=timed('factValidationMs',()=>codeFactRanges(document.content,facts)),serialized=JSON.stringify(facts),bytes=Buffer.byteLength(serialized);
        Object.assign(row,{parserInputHash:digest(JSON.stringify({parserFingerprint,path:file.path,contentHash:file.contentHash})),factsHash:digest(serialized),
          serializedFactBytes:bytes,evidence});
        if(bytes>limits.fileFactBytes){row.status='facts-omitted';row.reason='file-fact-byte-limit';continue;}
        if(factBytes+bytes>limits.factBytes){row.status='facts-omitted';stopReason='fact-byte-limit';row.reason=stopReason;continue;}
        factBytes+=bytes;Object.assign(row,{status:'parsed',facts,ranges});
      } catch(error) {row.status='failed';row.error={code:error.code??null,message:String(error.message??error)};}
      finally {await yieldTurn();}
    }
  } finally {clearInterval(sample);clearInterval(progress);rssPeak=Math.max(rssPeak,process.memoryUsage().rss);samples++;}
  const current=store.project();
  assert.ok(current.policyVersion===boundary.policyVersion&&current.sourceSetVersion===boundary.sourceSetVersion,'Source authorization changed during code inventory.');
  const summarize=rows=>({candidates:rows.length,examined:rows.filter(row=>row.examined).length,retained:rows.filter(row=>row.status==='parsed').length,
    failed:rows.filter(row=>row.status==='failed').length,excluded:rows.filter(row=>row.status==='excluded').length,
    unattempted:rows.filter(row=>row.status==='unattempted').length,factsOmitted:rows.filter(row=>row.status==='facts-omitted').length,
    symbols:rows.reduce((sum,row)=>sum+(row.facts?.symbols.length??0),0),operations:rows.reduce((sum,row)=>sum+(row.facts?.operations.length??0),0),
    calls:rows.reduce((sum,row)=>sum+(row.facts?.calls.length??0),0),records:rows.reduce((sum,row)=>sum+Object.keys(row.facts?.records??{}).length,0),
    gaps:rows.flatMap(row=>row.facts?.gaps??[]).reduce((counts,gap)=>({...counts,[gap]:(counts[gap]??0)+1}),{})});
  return {schemaVersion:'loredock-code-inventory-pass/1',buildId:build.id,policyVersion:boundary.policyVersion,registryVersion:boundary.sourceSetVersion,
    limits,parserFingerprint,records,summary:summarize(records),textBytes,factBytes,
    bySource:Object.fromEntries([...new Set(files.map(file=>file.sourceName))].map(source=>[source,summarize(records.filter(row=>row.source===source))])),
    byParser:Object.fromEntries(['java','typescript'].map(parser=>[parser,summarize(records.filter(row=>row.parser===parser))])),
    verifiedSpans,wallMs:performance.now()-started,timings,processRss:{before:rssBefore,peakSampled:rssPeak,after:process.memoryUsage().rss,samples,intervalMs:100,
      scope:'Evaluator process only; excludes child Git memory. No forced GC or OS cache isolation.'}};
}
