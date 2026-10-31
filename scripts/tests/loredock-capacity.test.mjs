import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import {test} from 'node:test';
import {capacityFile,capacityWorkload} from '../../fixtures/loredock-capacity/workload.mjs';
import {createCapacityFixture,capacityBaseline} from '../loredock-capacity-fixture.mjs';
import {verifyCapacityContract,capacityStageSequence,compareCapacityStages} from '../loredock-capacity-benchmark.mjs';
import {scaleGit} from '../loredock-scale-fixture.mjs';
import {digest} from '../loredock-fixture.mjs';
import {auditCapacityResult,capacityQueryAvailable,capacityQuerySummary} from '../loredock-capacity-audit.mjs';

test('frozen capacity workload has exact byte volume, unique symbols and unchanged parent contract',async()=>{
  const frozen=await verifyCapacityContract(),symbols=new Set();let bytes=0;
  for(let source=0;source<20;source++)for(let file=0;file<180;file++) {
    const row=capacityFile(source,file);assert.equal(Buffer.byteLength(row.text),2048);
    assert.match(row.text,/^export function loadProbe\d{6}\(\)/);assert.equal(row.path,`load/probe-${String(file).padStart(4,'0')}.ts`);
    assert.ok(!symbols.has(row.symbol));symbols.add(row.symbol);bytes+=Buffer.byteLength(row.text);
  }
  assert.equal(symbols.size,3600);assert.equal(bytes,7372800);assert.equal(frozen.eligibleFiles,3679);assert.equal(frozen.eligibleBytes,bytes+16869);
  for(const args of [[-1,0],[20,0],[0,180],[0,1.5]])assert.throws(()=>capacityFile(...args));
  assert.equal(capacityWorkload.fileBytes,2048);
});

test('small CI shape preserves original Git blobs and excluded canaries across independent generations',async t=>{
  const first=await createCapacityFixture(2);t.after(()=>rm(first.root,{recursive:true,force:true}));
  const second=await createCapacityFixture(2);t.after(()=>rm(second.root,{recursive:true,force:true}));
  assert.deepEqual(capacityBaseline(first),capacityBaseline(second));assert.deepEqual(first.manifest,second.manifest);
  assert.equal(first.manifest.evidence.length,119);assert.equal(first.manifest.coverage.excludedFiles,60);
  for(const source of first.manifest.sources) {
    assert.equal(scaleGit(first.root,source.id,['rev-parse','HEAD^']),first.parentBaseline.revisionVector[source.id]);
    const added=scaleGit(first.root,source.id,['diff','--name-only','HEAD^','HEAD']).split('\n');
    assert.deepEqual(added,['load/probe-0000.ts','load/probe-0001.ts']);
    for(const ref of first.manifest.evidence.filter(ref=>ref.sourceId===source.id)) {
      assert.equal(digest(scaleGit(first.root,source.id,['show',`${ref.revision}:${ref.path}`],false)),ref.contentHash);
      assert.equal(scaleGit(first.root,source.id,['rev-parse',`${ref.revision}:${ref.path}`]),ref.blobId);
    }
    assert.equal(scaleGit(first.root,source.id,['status','--porcelain=v1']),'');
  }
  for(const probe of first.probes)assert.ok(first.manifest.evidence.some(ref=>ref.id===probe.evidence[0]));
});

test('capacity protocol skips unpublished work and never retries failed or paused attempts',async()=>{
  for(const status of ['paused','failed','interrupted','cancelled']) {
    const calls=[];const result=await capacityStageSequence(async stage=>{calls.push(stage);return {build:{status,published:false}};});
    assert.deepEqual(calls,['initial']);assert.equal(result.refresh.status,'skipped');
    assert.deepEqual(compareCapacityStages(result.initial,result.refresh),{status:'unavailable'});
  }
  for(const status of ['completed','partial']) {
    const calls=[];await capacityStageSequence(async stage=>{calls.push(stage);return {build:{status,published:true}};});
    assert.deepEqual(calls,['initial','refresh']);
  }
});

test('capacity availability is independent from selection status and totals are recounted from retained candidates',()=>{
  const probes=[{id:'capacity-0',requiredRepositories:['portal'],maxCandidates:2}];
  const available={status:'available',selectionStatus:'suggestions',candidates:['portal'],candidateCount:1,completeEvidence:true,
    criticalRecall:{found:0,total:99},scopeNecessaryConditionsMet:false};
  const legacy={...available,status:'suggestions'};
  for(const preview of [available,legacy]) {
    const result=capacityQuerySummary([{id:'capacity-0',group:'exact-symbol',context:available,preview}],probes)['exact-symbol'].preview;
    assert.equal(result.available,1);assert.deepEqual(result.criticalRecall,{found:1,total:1});assert.equal(result.scopeNecessaryConditionsMet,1);
  }
  assert.equal(capacityQueryAvailable({status:'unresolved'},'preview'),true);
  assert.equal(capacityQueryAvailable({status:'suggestions'},'context'),false);
  assert.equal(capacityQueryAvailable({status:'suggestions',error:{message:'Failed'}},'preview'),false);
  const failed=capacityQuerySummary([{id:'capacity-0',group:'exact-symbol',context:available,preview:{status:'unavailable',error:{message:'Failed'}}}],probes);
  assert.equal(failed['exact-symbol'].preview.available,0);assert.deepEqual(failed['exact-symbol'].preview.criticalRecall,{found:0,total:1});
});

test('retained capacity audit verifies raw selections and recounts all four stages without new indexing',async()=>{
  const base=new URL('../../docs/fixtures/loredock-capacity/',import.meta.url);
  const audit=await auditCapacityResult(new URL('raw-result.json',base));
  const recorded=JSON.parse(await readFile(new URL('audit-result.json',base),'utf8'));
  const {checkedAt:_a,...current}=audit,{checkedAt:_b,...prior}=recorded;assert.deepEqual(current,prior);
  assert.equal(audit.newIndexingAttempts,0);assert.equal(audit.stages.length,4);
  for(const stage of audit.stages) {
    assert.equal(stage.summary.incident.preview.available,10);assert.deepEqual(stage.summary.incident.preview.criticalRecall,{found:21,total:22});
    assert.equal(stage.summary['exact-symbol'].preview.available,3);assert.deepEqual(stage.unavailableQueries,[]);
  }
  for(const comparison of audit.refreshComparisons) {
    assert.equal(comparison.changedContextOrderOrSelection.length,5);assert.deepEqual(comparison.changedContextSets,[]);
    assert.deepEqual(comparison.changedCandidateSelections,[]);
  }
});
