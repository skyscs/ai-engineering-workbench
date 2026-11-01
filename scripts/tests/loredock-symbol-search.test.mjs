import assert from 'node:assert/strict';
import {test} from 'node:test';
import {symbolLookupCases} from '../../fixtures/loredock-symbol-search/cases.mjs';
import {verifySymbolSearchContract,verifySymbolNameAmendment,applySymbolNameErrata,symbolStageSequence,normalizeSymbolResult,assessSymbolQuery,summarizeSymbolPasses} from '../loredock-symbol-search-qualification.mjs';

test('symbol qualification freezes nine exact queries and the unchanged capacity input without querying production',async()=>{
  const frozen=await verifySymbolSearchContract();assert.equal(frozen.candidateFiles,3621);assert.equal(frozen.passes,2);
  assert.equal(frozen.initialIndexAttempts,1);assert.equal(frozen.analysisAttempts,1);assert.equal(frozen.modelRequests,0);
  assert.deepEqual(symbolLookupCases.slice(0,3).map(row=>row.query),['loadProbe000179','loadProbe100179','loadProbe190179']);
  assert.equal(symbolLookupCases.find(row=>row.query==='accept').expected.length,4);
  assert.equal(symbolLookupCases.find(row=>row.query==='OrderBadge').expectedGap,'unsupported-vue-envelope');
});

test('prospective Java-name amendment preserves the original oracle and changes exactly three qualified labels',async()=>{
  const {amendment,corrections}=await verifySymbolNameAmendment(),before=structuredClone(symbolLookupCases),amended=applySymbolNameErrata(symbolLookupCases,corrections);
  assert.equal(amendment.fullMeasurementsBeforeAmendment,0);assert.equal(corrections.length,3);assert.deepEqual(symbolLookupCases,before);
  assert.deepEqual(amended.map(row=>row.query),before.map(row=>row.query));
  assert.equal(amended.filter((row,index)=>JSON.stringify(row)!==JSON.stringify(before[index])).length,1);
  assert.deepEqual(amended.find(row=>row.id==='s05').expected.map(row=>row.symbol),['Orders.accept','synthetic.stock.StockProjection.accept','synthetic.shipping.Shipments.accept','synthetic.notifications.Notify.accept']);
  assert.throws(()=>applySymbolNameErrata(amended,corrections));
});

test('one-attempt symbol protocol skips dependent work and never retries errors or unpublished stages',async()=>{
  for(const status of ['paused','failed','interrupted','cancelled']) {
    const calls=[];
    let result=await symbolStageSequence(async()=>{calls.push('index');return {build:{published:false,status}};},async()=>{calls.push('analysis');},async()=>{calls.push('query');});
    assert.deepEqual(calls,['index']);assert.equal(result.analysis.status,'skipped');assert.equal(result.queries.status,'skipped');
    calls.length=0;
    result=await symbolStageSequence(async()=>{calls.push('index');return {build:{published:true}};},async()=>{calls.push('analysis');return {inventory:{published:false,status}};},async()=>{calls.push('query');});
    assert.deepEqual(calls,['index','analysis']);assert.equal(result.queries.status,'skipped');
  }
  const calls=[];const success=await symbolStageSequence(async()=>({build:{published:true,status:'partial'}}),async()=>({inventory:{published:true,status:'partial'}}),async()=>{calls.push('query');return {status:'available'};});
  assert.deepEqual(calls,['query']);assert.equal(success.queries.status,'available');
  const failed=await symbolStageSequence(async()=>{throw Object.assign(new Error('Owned failure'),{code:'FIXTURE_FAILURE'});},()=>assert.fail('No analysis after a failed index.'),()=>assert.fail('No query after a failed index.'));
  assert.equal(failed.initial.error.code,'FIXTURE_FAILURE');assert.equal(failed.queries.status,'skipped');
});

function example() {
  const item={id:'owned',query:'accept',expected:[{source:'order-api',path:'Orders.java',symbol:'Orders.accept'}]};
  const expectation={candidateFiles:3621,unsupportedFiles:6,gapMessages:7,lookupLimits:{queryBytes:200,matches:20,outputBytes:262144,wallMs:5000}};
  const response={schemaVersion:'loredock-code-symbols/1',buildId:'build-a',query:'accept',status:'available',reason:null,inventory:{id:'run-a',fingerprint:'parser',policyVersion:1,registryVersion:2},
    limits:expectation.lookupLimits,partial:true,limitation:'No match does not establish absence.',coverage:{candidateFiles:3621,retainedFiles:3621,scannedFiles:3621,scanComplete:true,timeStopped:false,
      matchingSymbols:1,omittedMatches:0,outputLimited:false,filesWithSyntaxGaps:6,syntaxGapMessages:7},
    matches:[{id:'match-a',fileId:'file-a',sourceId:'source-a',sourceName:'order-api',path:'Orders.java',revision:'rev',blob:'blob',contentHash:'hash',name:'accept',qualifiedName:'Orders.accept',role:'java-method',
      range:{startLine:2,endLine:5,textHash:'range-hash'},status:'syntax-only',evidence:[{id:'span-a',sourceName:'order-api',path:'Orders.java',revision:'rev',startLine:1,endLine:8}]}]};
  const row={id:item.id,status:'available',ms:100,originalsVerified:true,response,assessment:assessSymbolQuery(item,response,expectation)};
  return {item,expectation,response,row};
}

test('qualification rejects incomplete scans, incorrect owners, missing gaps and failed original verification',()=>{
  const {item,expectation,response,row}=example();
  assert.equal(Object.entries(row.assessment).filter(([key])=>!['expectedMatches','actualMatches'].includes(key)).every(([,value])=>value===true),true);
  for(const mutate of [value=>value.matches[0].sourceName='foreign',value=>value.coverage.scannedFiles=100,value=>value.coverage.timeStopped=true,
    value=>value.coverage.omittedMatches=1,value=>value.partial=false,value=>value.coverage.syntaxGapMessages=6,value=>value.limits.matches=21]) {
    const changed=structuredClone(response);mutate(changed);const assessment=assessSymbolQuery(item,changed,expectation);
    assert.ok(Object.values(assessment).includes(false));
  }
  const passes=[{queries:[row]},{queries:[structuredClone(row)]}];let summary=summarizeSymbolPasses(passes,[item],5500,expectation);
  assert.equal(summary.mechanicalChecksPassed,true);assert.equal(summary.timing.allQueriesWithinTarget,true);
  passes[1].queries[0].originalsVerified=false;summary=summarizeSymbolPasses(passes,[item],5500,expectation);assert.equal(summary.mechanicalChecksPassed,false);
  passes[1].queries[0].originalsVerified=true;passes[1].queries[0].ms=5501;summary=summarizeSymbolPasses(passes,[item],5500,expectation);
  assert.equal(summary.mechanicalChecksPassed,true);assert.equal(summary.timing.allQueriesWithinTarget,false);assert.equal(summary.timing.maxMs,5501);
  passes[1].queries[0]={id:item.id,status:'unavailable',error:{message:'Owned error'}};
  summary=summarizeSymbolPasses(passes,[item],5500,expectation);assert.equal(summary.availableQueries,1);assert.equal(summary.mechanicalChecksPassed,false);
  assert.equal(summary.timing.allQueriesWithinTarget,false);assert.deepEqual(summary.repeatDifferences,[item.id]);
});

test('repeat comparison removes generated IDs but retains source, range, support, parser and coverage differences',()=>{
  const {response,item,row,expectation}=example(),other=structuredClone(response);
  other.buildId='build-b';other.inventory.id='run-b';other.matches[0].id='match-b';other.matches[0].fileId='file-b';other.matches[0].sourceId='source-b';other.matches[0].evidence[0].id='span-b';
  assert.deepEqual(normalizeSymbolResult(response),normalizeSymbolResult(other));
  for(const mutate of [value=>value.matches[0].path='Other.java',value=>value.matches[0].range.textHash='changed',value=>value.matches[0].evidence[0].revision='new',
    value=>value.inventory.fingerprint='new-parser',value=>value.coverage.scannedFiles=100]) {
    const changed=structuredClone(other);mutate(changed);
    const summary=summarizeSymbolPasses([{queries:[row]},{queries:[{...row,response:changed}]}],[item],5500,expectation);
    assert.deepEqual(summary.repeatDifferences,[item.id]);assert.equal(summary.mechanicalChecksPassed,false);
  }
  assert.equal(summarizeSymbolPasses([{queries:[row]},{queries:[]}],[item],5500,expectation).mechanicalChecksPassed,false);
  const wrong=structuredClone(row);wrong.response.matches[0].sourceName='foreign';
  assert.equal(summarizeSymbolPasses([{queries:[wrong]},{queries:[wrong]}],[item],5500,expectation).mechanicalChecksPassed,false,'Recompute from raw results, not previously recorded pass flags.');
});
