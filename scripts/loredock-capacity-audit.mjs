import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {routingCases} from '../fixtures/loredock-routing/cases.mjs';
import {digest} from './loredock-fixture.mjs';

export function capacityQueryAvailable(value,method) {
  // Result v1 accidentally used the candidate-selection status as its wrapper status.
  return !value?.error && (value?.status==='available' || method==='preview'&&['suggestions','unresolved'].includes(value?.status));
}

export function capacityQuerySummary(results,probes) {
  const expectations=[...routingCases,...probes];
  return Object.fromEntries(['incident','exact-symbol'].map(group=>[group,Object.fromEntries(['context','preview'].map(method=>{
    const all=results.filter(row=>row.group===group),available=all.filter(row=>capacityQueryAvailable(row[method],method));
    const scores=available.map(row=>{
      const expected=expectations.find(item=>item.id===row.id);assert.ok(expected);
      const candidates=row[method].candidates,missing=expected.requiredRepositories.filter(source=>!candidates.includes(source));
      return {found:expected.requiredRepositories.length-missing.length,complete:!missing.length,bounded:candidates.length<=expected.maxCandidates,
        completeEvidence:row[method].completeEvidence};
    });
    return [method,{cases:all.length,available:available.length,allCriticalRepositories:scores.filter(row=>row.complete).length,
      completeEvidence:scores.filter(row=>row.completeEvidence).length,withinCandidateBound:scores.filter(row=>row.bounded).length,
      scopeNecessaryConditionsMet:scores.filter(row=>row.complete&&row.bounded).length,
      criticalRecall:{found:scores.reduce((sum,row)=>sum+row.found,0),total:all.reduce((sum,row)=>sum+expectations.find(item=>item.id===row.id).requiredRepositories.length,0)},
      candidateCounts:all.map(row=>row[method].candidateCount??null)}];
  }))]));
}

export function compareCapacityQueries(first,second) {
  if(first?.queries?.status!=='available'||second?.queries?.status!=='available')return {status:'unavailable'};
  const a=first.queries,b=second.queries;
  const set=value=>value?.map(row=>JSON.stringify(row)).sort();
  return {status:'available',changedContextOrderOrSelection:a.results.filter((row,i)=>row.context.selectionHash!==b.results[i]?.context.selectionHash).map(row=>row.id),
    changedContextSets:a.results.filter((row,i)=>!isDeepStrictEqual(set(row.context.selected),set(b.results[i]?.context.selected))).map(row=>row.id),
    changedCandidateSelections:a.results.filter((row,i)=>row.preview.selectionHash!==b.results[i]?.preview.selectionHash).map(row=>row.id),
    unavailableQueries:a.results.filter((row,i)=>['context','preview'].some(key=>!capacityQueryAvailable(row[key],key)||!capacityQueryAvailable(b.results[i]?.[key],key))).map(row=>row.id),
    orientationChanged:!isDeepStrictEqual(a.orientation.sources,b.orientation.sources),
    changedProjectionOriginals:['code','declarations'].filter(key=>!isDeepStrictEqual(a.projections[key].originals,b.projections[key].originals))};
}

export async function auditCapacityResult(file) {
  const bytes=await readFile(file),raw=JSON.parse(bytes),frozen=JSON.parse(await readFile(new URL('../fixtures/loredock-capacity/baseline.json',import.meta.url),'utf8'));
  assert.ok(['loredock-capacity-result/1','loredock-capacity-result/2'].includes(raw.schemaVersion));
  assert.deepEqual(raw.frozen,frozen);assert.equal(raw.generations.length,2);assert.equal(raw.modelRequests,0);
  const stages=[];
  for(const generation of raw.generations)for(const stage of ['initial','refresh']) {
    const value=generation.stages[stage];
    if(value.queries?.status!=='available'){stages.push({generation:generation.generation,stage,status:'unavailable'});continue;}
    const results=value.queries.results;assert.equal(results.length,13);assert.equal(new Set(results.map(row=>row.id)).size,13);
    for(const row of results) {
      if(capacityQueryAvailable(row.context,'context'))assert.equal(digest(JSON.stringify(row.context.selected)),row.context.selectionHash);
      if(capacityQueryAvailable(row.preview,'preview')) {
        const {primary,otherMatches,related,distinctiveTerms,tiedAtLimit}=row.preview;
        const canonical={primary,otherMatches,related,
          ...raw.schemaVersion.endsWith('/1')?{status:row.preview.status}:{selectionStatus:row.preview.selectionStatus},distinctiveTerms,tiedAtLimit};
        assert.equal(digest(JSON.stringify(canonical)),row.preview.selectionHash);
      }
    }
    stages.push({generation:generation.generation,stage,status:'available',summary:capacityQuerySummary(results,frozen.probes),
      unavailableQueries:results.filter(row=>['context','preview'].some(method=>!capacityQueryAvailable(row[method],method))).map(row=>row.id)});
  }
  return {schemaVersion:'loredock-capacity-audit/1',rawResultHash:digest(bytes),checkedAt:new Date().toISOString(),stages,
    refreshComparisons:raw.generations.map(generation=>({generation:generation.generation,...compareCapacityQueries(generation.stages.initial,generation.stages.refresh)})),
    regeneration:Object.fromEntries(['initial','refresh'].map(stage=>[stage,compareCapacityQueries(raw.generations[0].stages[stage],raw.generations[1].stages[stage])])),
    selectionHashesVerified:true,modelRequests:0,newIndexingAttempts:0,
    correction:raw.schemaVersion.endsWith('/1')?'The raw preview status contains suggestions/unresolved instead of available. Its preview summary and unavailableQueries aggregate are incorrect. This audit recounts the retained per-case candidate lists; raw selections, timings and hashes are unchanged.':null};
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  assert.equal(process.argv.length,3,'Usage: node scripts/loredock-capacity-audit.mjs RAW_RESULT_JSON');
  console.log(JSON.stringify(await auditCapacityResult(process.argv[2]),null,2));
}
