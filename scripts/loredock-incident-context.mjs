import assert from 'node:assert/strict';
import {readFile,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {routingContract} from '../fixtures/loredock-routing/cases.mjs';
import {createScaleFixture,scaleBaseline,scaleGit} from './loredock-scale-fixture.mjs';
import {digest} from './loredock-fixture.mjs';

export async function verifyIncidentContract() {
  const frozen=JSON.parse(await readFile(new URL('../fixtures/loredock-routing/baseline.json',import.meta.url),'utf8'));
  assert.equal(digest(JSON.stringify(routingContract)),frozen.contractHash,'Frozen incident contract changed.');
  for(const [file,hash] of Object.entries(frozen.sourceHashes)) assert.equal(digest(await readFile(new URL('../'+file,import.meta.url))),hash,`Frozen input changed: ${file}`);
  assert.equal(routingContract.cases.length,10);assert.equal(new Set(routingContract.cases.map(row=>row.id)).size,10);
  for(const row of routingContract.cases) {
    assert.ok(row.requiredRepositories.length>0 && row.requiredRepositories.length<=row.maxCandidates && row.maxCandidates<20);
    assert.equal(new Set(row.requiredRepositories).size,row.requiredRepositories.length);
    assert.ok(row.evidence.length>0);assert.equal(row.decision,row.gap?'request-evidence':'investigate-candidates');
  }
  return frozen;
}

// A deliberately plain FTS baseline with the same tokenizer and span/byte caps.
// Its only input is the incident text and the same authorized published index.
export function keywordIncidentContext(catalog,question,questionTerms) {
  const build=catalog.build(catalog.state().publishedBuildId),terms=questionTerms(question);
  const expression=terms.map(term=>`"${term}"`).join(' OR ');
  const candidates=expression?catalog.store.all(`SELECT s.id,length(CAST(s.text AS BLOB)) AS bytes FROM question_search
    JOIN spans s ON s.id=question_search.spanId JOIN files f ON f.id=s.fileId JOIN sources src ON src.id=f.sourceId
    JOIN build_sources bs ON bs.buildId=f.buildId AND bs.sourceId=f.sourceId
    WHERE question_search MATCH ? AND f.buildId=? AND f.status='indexed' AND src.status='active'
    ORDER BY rank,bs.rowid,f.path,s.startLine LIMIT 120`,expression,build.id):[];
  const originals=[];let textBytes=0,omitted=0;
  for(const candidate of candidates) {
    if(originals.length>=30 || textBytes+candidate.bytes>64*1024){omitted++;continue;}
    const original=catalog.evidence(candidate.id);textBytes+=Buffer.byteLength(original.text);originals.push(original);
  }
  return {originals,terms,textBytes,omitted};
}

export async function evaluateIncidentContext(services) {
  const {Catalog,CatalogStore,retrieveAnswerContext,questionTerms,retrievalVersion}=services;
  const frozen=await verifyIncidentContract();
  async function measure() {
    const fixture=await createScaleFixture();let catalog,store;
    const texts=new Map();let verifiedSpanOccurrences=0;
    try {
      assert.deepEqual(scaleBaseline(fixture),frozen.sourceBaseline);
      const refs=new Map(fixture.manifest.evidence.map(ref=>[ref.id,ref]));
      const sourceNames=new Set(fixture.manifest.sources.map(source=>source.id));
      for(const row of routingContract.cases){for(const id of row.evidence)assert.ok(refs.has(id));for(const name of row.requiredRepositories)assert.ok(sourceNames.has(name));}
      store=new CatalogStore(path.join(fixture.root,'data'));catalog=new Catalog(store);
      const paths=fixture.manifest.sources.map(source=>path.join(fixture.root,'sources',source.id));
      const preview=await catalog.previewSources(paths);await catalog.registerSources({paths,previewHash:preview.previewHash,requestId:'incident-context'});
      const started=performance.now(),state=catalog.state();catalog.start('incident-context',state.sourceSetVersion,state.policyVersion);await catalog.idle();
      const indexMs=performance.now()-started,build=catalog.build(catalog.state().publishedBuildId);
      assert.equal(build.coverage.indexed,frozen.sourceBaseline.eligibleFiles);
      function inspect(originals,item) {
        const selected=[];
        for(const original of originals) {
          const owner=build.sources.find(source=>source.sourceId===original.sourceId);
          assert.equal(owner?.name,original.sourceName);assert.equal(owner?.revision,original.revision);
          const ref=fixture.manifest.evidence.find(ref=>ref.sourceId===original.sourceName && ref.path===original.path);assert.ok(ref);
          assert.equal(original.revision,ref.revision);assert.equal(original.blobId,ref.blobId);
          const key=`${original.sourceName}/${original.path}`;
          if(!texts.has(key))texts.set(key,scaleGit(fixture.root,original.sourceName,['show',`${original.revision}:${original.path}`],false));
          const text=texts.get(key);assert.equal(digest(text),original.contentHash);
          assert.equal(original.text,text.split('\n').slice(original.startLine-1,original.endLine).join('\n'));assert.equal(digest(original.text),original.spanHash);verifiedSpanOccurrences++;
          selected.push({source:original.sourceName,path:original.path,revision:original.revision,blobId:original.blobId,
            startLine:original.startLine,endLine:original.endLine,contentHash:original.contentHash,spanHash:original.spanHash});
        }
        const candidates=[...new Set(originals.map(span=>span.sourceName))];
        const missingRepositories=item.requiredRepositories.filter(name=>!candidates.includes(name));
        const missingEvidence=item.evidence.filter(id=>{const ref=refs.get(id);return !originals.some(span=>span.sourceName===ref.sourceId && span.path===ref.path
          && span.revision===ref.revision && span.contentHash===ref.contentHash && span.startLine<=ref.startLine && span.endLine>=ref.endLine);});
        return {candidates,candidateCount:candidates.length,maxCandidates:item.maxCandidates,withinCandidateBound:candidates.length<=item.maxCandidates,
          requiredRepositories:item.requiredRepositories,missingRepositories,criticalRecall:{found:item.requiredRepositories.length-missingRepositories.length,total:item.requiredRepositories.length},
          requiredEvidence:item.evidence,missingEvidence,completeEvidence:missingEvidence.length===0,
          scopeNecessaryConditionsMet:missingRepositories.length===0 && candidates.length<=item.maxCandidates,
          decision:'not-implemented',expectedDecision:item.decision,expectedGap:item.gap,
          selected,selectedLocatorHash:digest(JSON.stringify(selected))};
      }
      const results=[];
      for(const item of routingContract.cases) {
        let time=performance.now();const keyword=keywordIncidentContext(catalog,item.description,questionTerms),keywordMs=performance.now()-time;
        time=performance.now();const context=retrieveAnswerContext(catalog,item.description),contextMs=performance.now()-time;
        assert.equal(context.question,item.description);assert.ok(context.spans.length<=30 && context.textBytes<=64*1024);
        assert.deepEqual(context.review.notes,[]);
        const originals=context.spans.map(span=>catalog.evidence(span.id));
        results.push({id:item.id,category:item.category,incident:item.description,
          keyword:{...inspect(keyword.originals,item),spans:keyword.originals.length,textBytes:keyword.textBytes,queryMs:keywordMs,terms:keyword.terms,omitted:keyword.omitted},
          answerContext:{...inspect(originals,item),spans:context.spans.length,textBytes:context.textBytes,queryMs:contextMs,terms:context.terms,expansionTerms:context.expansionTerms,mode:context.retrievalMode,gaps:context.gaps}});
      }
      assert.equal(store.all('SELECT id FROM answer_attempts').length,0);
      for(const source of fixture.manifest.sources)assert.equal(scaleGit(fixture.root,source.id,['status','--porcelain=v1']),'');
      const retained={rawBytes:store.one('SELECT coalesce(sum(length(raw)),0) bytes FROM files').bytes,
        spanTextBytes:store.one('SELECT coalesce(sum(length(CAST(text AS BLOB))),0) bytes FROM spans').bytes};
      store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');retained.databaseBytes=(await stat(path.join(store.directory,'loredock.db'))).size;
      const summary=Object.fromEntries(['keyword','answerContext'].map(method=>[method,{
        cases:results.length,allCriticalRepositories:results.filter(row=>row[method].missingRepositories.length===0).length,
        withinCandidateBound:results.filter(row=>row[method].withinCandidateBound).length,
        scopeNecessaryConditionsMet:results.filter(row=>row[method].scopeNecessaryConditionsMet).length,
        completeEvidence:results.filter(row=>row[method].completeEvidence).length,
        criticalRecall:{found:results.reduce((sum,row)=>sum+row[method].criticalRecall.found,0),total:results.reduce((sum,row)=>sum+row[method].criticalRecall.total,0)},
        candidateCounts:results.map(row=>row[method].candidateCount),explicitDecisions:0,
      }]));
      return {results,summary,indexMs,retained,verifiedSpanOccurrences,verifiedFiles:texts.size};
    } finally {await catalog?.stop();store?.close();await rm(fixture.root,{recursive:true,force:true});}
  }
  const first=await measure(),second=await measure();
  return {schemaVersion:'loredock-incident-context-result/1',checkedAt:new Date().toISOString(),contractHash:frozen.contractHash,
    sourceBaseline:frozen.sourceBaseline,retrievalVersion,modelRequests:0,answerAttempts:0,...first,
    regeneration:Object.fromEntries(['keyword','answerContext'].map(method=>[method,{
      changedSelections:first.results.filter((row,i)=>row[method].selectedLocatorHash!==second.results[i][method].selectedLocatorHash).map(row=>row.id),summary:second.summary[method],
    }])),sourceCheckoutsUnchanged:true,routingAccepted:false,semanticReview:'not-performed',independentReview:'pending',
    scope:routingContract.reservation,limitation:'Owners of search hits are diagnostic candidates only. Neither measured path implements a routing/abstention decision; no root cause or modification targets were evaluated.'};
}

if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  assert.equal(process.argv.length,2,'Usage: node scripts/loredock-incident-context.mjs');
  const modules=await Promise.all(['catalog','store','answer-context'].map(name=>import(`../apps/loredock/dist/${name}.js`)));
  console.log(JSON.stringify(await evaluateIncidentContext(Object.assign({},...modules)),null,2));
}
