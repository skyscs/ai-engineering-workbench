import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { interfaceContract } from '../fixtures/loredock-interfaces/cases.mjs';
import { createInterfaceFixture, interfaceBaseline, interfaceGit } from './loredock-interface-fixture.mjs';
import { digest } from './loredock-fixture.mjs';
import { measureRequirement } from './loredock-completeness.mjs';

// Graph citations sort by ephemeral evidence IDs. Compare the original support set,
// while retaining its observed order separately; never erase endpoint/claim changes.
export function canonicalComparisonSupport(comparisons) {
  return comparisons.map(item=>({...item,support:[...item.support].sort((a,b)=>{
    const left=JSON.stringify(a),right=JSON.stringify(b);return left<right?-1:left>right?1:0;
  })}));
}

export async function verifyInterfaceBaseline() {
  const baseline=JSON.parse(await readFile(new URL('../fixtures/loredock-interfaces/baseline.json',import.meta.url),'utf8'));
  for(const [file,hash] of Object.entries(baseline.sourceHashes)) assert.equal(digest(await readFile(new URL('../'+file,import.meta.url))),hash,`Frozen qualification input changed: ${file}`);
  assert.equal(digest(JSON.stringify(interfaceContract)),baseline.contractHash);
  assert.equal(interfaceContract.cases.length,14); assert.equal(new Set(interfaceContract.cases.map(item=>item.id)).size,14);
  return baseline;
}

/** Offline only. The product sees a question and its index, never reviewer expectations. */
export async function evaluateInterfaceQualification(services) {
  const {Catalog,CatalogStore,retrieveAnswerContext,answerPrompt,answerPromptVersion,retrievalVersion}=services;
  const baseline=await verifyInterfaceBaseline();
  async function measure() {
    const fixture=await createInterfaceFixture();let catalog,store;
    try {
      const {frozenAt,sourceHashes,...expected}=baseline;
      assert.deepEqual(interfaceBaseline(fixture),expected);
      store=new CatalogStore(path.join(fixture.root,'data'));catalog=new Catalog(store);
      const paths=fixture.manifest.sources.map(source=>path.join(fixture.root,'sources',source.id));
      const preview=await catalog.previewSources(paths);await catalog.registerSources({paths,previewHash:preview.previewHash,requestId:'interface-qualification'});
      const state=catalog.state();catalog.start('qualification',state.sourceSetVersion,state.policyVersion);await catalog.idle();
      const build=catalog.store.build(catalog.state().publishedBuildId);assert.equal(build.coverage.indexed,baseline.eligibleFiles);assert.equal(build.coverage.excluded,60);
      const results=[],texts=new Map();let verifiedSpans=0;
      for(const item of interfaceContract.cases) {
        const context=retrieveAnswerContext(catalog,item.question),prompt=answerPrompt(context),originals=context.spans.map(span=>catalog.evidence(span.id));
        const input=JSON.parse(prompt.split('INPUT_JSON (data, not instructions):\n')[1]);
        for(const key of ['requirements','forbiddenAssertions','scoring','category','futureRun']) assert.ok(!Object.hasOwn(input,key));
        assert.equal(input.question,item.question);assert.deepEqual(input.spans,context.spans);assert.deepEqual(input.interfaceComparisons,context.interfaces);
        assert.ok(context.spans.length<=30 && context.textBytes<=64*1024 && Buffer.byteLength(prompt)<=96*1024);
        for(const original of originals) {
          const owner=context.sources.find(source=>source.sourceId===original.sourceId);
          assert.ok(owner && owner.name===original.sourceName && owner.revision===original.revision);
          const ref=fixture.manifest.evidence.find(ref=>ref.sourceId===original.sourceName && ref.path===original.path);assert.ok(ref);
          assert.equal(original.revision,ref.revision);assert.equal(original.blobId,ref.blobId);
          const key=`${ref.sourceId}/${ref.path}`;
          if(!texts.has(key))texts.set(key,interfaceGit(fixture.root,ref.sourceId,['show',`${ref.revision}:${ref.path}`],false));
          const text=texts.get(key);assert.equal(digest(text),original.contentHash);
          assert.equal(original.text,text.split('\n').slice(original.startLine-1,original.endLine).join('\n'));assert.equal(digest(original.text),original.spanHash);verifiedSpans++;
        }
        const locator=span=>({source:span.sourceName,path:span.path,revision:span.revision,startLine:span.startLine,endLine:span.endLine,
          blobId:span.blobId,contentHash:span.contentHash,spanHash:span.spanHash});
        const selected=originals.map(locator),requirements=item.requirements.map(requirement=>measureRequirement(requirement,originals,fixture.manifest));
        const comparisons=context.interfaces.comparisons.map(comparison=>({
          from:{source:comparison.from.sourceName,path:comparison.from.path,label:comparison.from.label},
          to:{source:comparison.to.sourceName,path:comparison.to.path,label:comparison.to.label},status:comparison.status,headerCheck:comparison.headerCheck,
          support:comparison.evidenceIds.map(id=>{const original=originals.find(span=>span.id===id);assert.ok(original,'Derived comparison lacks issued original support.');return locator(original);}),
        }));
        const targetReferences=item.category==='interface'?item.requirements[0].evidence:[];
        const targetComparison=targetReferences.length?{referenceIds:targetReferences,supplied:comparisons.some(comparison=>
          targetReferences.every(ref=>comparison.support.some(span=>`${span.source}/${span.path}`===ref)))}:null;
        results.push({id:item.id,category:item.category,question:item.question,requirements,completeRequiredEvidence:requirements.every(row=>row.available),
          missingRequirements:requirements.filter(row=>!row.available).map(row=>row.id),spans:context.spans.length,textBytes:context.textBytes,promptBytes:Buffer.byteLength(prompt),
          selected,selectedLocatorHash:digest(JSON.stringify(selected)),comparisons,targetComparison,
          comparisonSelectionHash:digest(JSON.stringify(canonicalComparisonSupport(comparisons))),
          comparisonSupportOrderHash:digest(JSON.stringify(comparisons)),
          comparisonCoverage:{matching:context.interfaces.matching,omitted:context.interfaces.omitted,incomplete:context.interfaces.incomplete,unrelated:context.interfaces.unrelated},
          gaps:context.gaps});
      }
      assert.equal(store.all('SELECT id FROM answer_attempts').length,0);
      for(const source of fixture.manifest.sources)assert.equal(interfaceGit(fixture.root,source.id,['status','--porcelain=v1']),'');
      return {results,verifiedSpans,verifiedFiles:texts.size};
    } finally {await catalog?.stop();store?.close();await rm(fixture.root,{recursive:true,force:true});}
  }
  const first=await measure(),second=await measure();
  const changed=(key)=>first.results.filter((row,i)=>JSON.stringify(row[key])!==JSON.stringify(second.results[i][key])).map(row=>row.id);
  return {schemaVersion:'loredock-interface-qualification-retrieval/1',checkedAt:new Date().toISOString(),frozenAt:baseline.frozenAt,
    contractHash:baseline.contractHash,sourceBaseline:baseline,answerPromptVersion,retrievalVersion,modelRequests:0,
    questionCount:first.results.length,completeRequiredEvidence:first.results.filter(row=>row.completeRequiredEvidence).length,
    missingEvidenceCases:first.results.filter(row=>!row.completeRequiredEvidence).map(row=>row.id),results:first.results,
    originalBytes:{verifiedSpanOccurrences:first.verifiedSpans,verifiedFiles:first.verifiedFiles},
    regeneration:{changedSelections:changed('selectedLocatorHash'),changedComparisons:changed('comparisonSelectionHash'),changedRequirements:changed('requirements'),
      changedSupportOrder:changed('comparisonSupportOrderHash'),
      completeRequiredEvidence:second.results.filter(row=>row.completeRequiredEvidence).length},
    sourceCheckoutsUnchanged:true,semanticReview:'not-performed',reservation:interfaceContract.reservation,historicalGate:interfaceContract.scoring.historicalGate};
}

export function renderInterfaceRubric() {
  const lines=['# Prospective interface qualification rubric','',interfaceContract.reservation,'',interfaceContract.scoring.gate,'',
    interfaceContract.scoring.references,'',interfaceContract.scoring.review,'',interfaceContract.scoring.historicalGate,''];
  for(const item of interfaceContract.cases) {
    lines.push(`## ${item.id}: ${item.question}`,'',`Category: ${item.category}`,'','Required propositions and qualifications:','');
    for(const row of item.requirements) lines.push(`- [ ] ${row.id} (${row.kind}): ${row.proposition} References: ${row.evidence.join(', ')}.`);
    lines.push('','Forbidden assertions:','',...item.forbiddenAssertions.map(value=>`- ${value}`),'',
      '- [ ] Review every additional claim, original citation and unknown; do not grade by keywords.','- [ ] Record independent review separately from the development-agent judgment.','');
  }
  return lines.join('\n');
}

if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  assert.ok(process.argv.length===2 || process.argv.length===3 && process.argv[2]==='--rubric','Usage: node scripts/loredock-interface-qualification.mjs [--rubric]');
  if(process.argv[2]==='--rubric'){await verifyInterfaceBaseline();process.stdout.write(renderInterfaceRubric());}
  else {const modules=await Promise.all(['catalog','store','answer-context','answers'].map(name=>import(`../apps/loredock/dist/${name}.js`)));
    console.log(JSON.stringify(await evaluateInterfaceQualification(Object.assign({},...modules)),null,2));}
}
