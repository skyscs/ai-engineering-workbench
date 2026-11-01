import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {boundaryReadme,boundaryShape} from '../fixtures/loredock-readme-boundary/corpus.mjs';
import {createScaleFixture,scaleGit} from './loredock-scale-fixture.mjs';
import {Catalog} from '../apps/loredock/dist/catalog.js';
import {CatalogStore} from '../apps/loredock/dist/store.js';
import {SourceGit} from '../apps/loredock/dist/git.js';
import {projectOrientation} from '../apps/loredock/dist/orientation.js';

const repo=fileURLToPath(new URL('../',import.meta.url)),output=process.argv[2];
assert.ok(output&&path.isAbsolute(output)&&process.argv.length===3,'Supply one absolute report directory, not a source/data path.');
const git=args=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
assert.equal(git(['status','--porcelain','--untracked-files=no']),'','Commit implementation before measurement.');
const digest=value=>createHash('sha256').update(value).digest('hex');
class CountingGit extends SourceGit {commands=0;async run(...args){this.commands++;return super.run(...args);}}
const sourceGit=new CountingGit(),inputs=new Map();let fixture,store,catalog;
const close=async()=>{if(store){await catalog.stop();store.close();store=undefined;}};
try {
  fixture=await createScaleFixture();await mkdir(output,{recursive:true});
  for(const source of fixture.manifest.sources){
    const input=boundaryReadme(source.id);inputs.set(source.id,input);
    await writeFile(path.join(fixture.root,'sources',source.id,'README.md'),input.content);
    scaleGit(fixture.root,source.id,['add','README.md']);scaleGit(fixture.root,source.id,['commit','-qm','Add owned README boundary input']);
  }
  const sourceState=()=>fixture.manifest.sources.map(({id})=>({id,revision:scaleGit(fixture.root,id,['rev-parse','HEAD']),status:scaleGit(fixture.root,id,['status','--porcelain'])}));
  const sources=sourceState();assert.equal(sources.length,20);assert.ok(sources.every(source=>source.status===''));
  const directory=path.join(fixture.root,'data');let evidenceCalls=0;
  const open=()=>{store=new CatalogStore(directory);catalog=new Catalog(store,sourceGit);const read=catalog.evidence.bind(catalog);catalog.evidence=(...args)=>{evidenceCalls++;return read(...args);};};open();
  for(const source of sources)await catalog.addSource(path.join(fixture.root,'sources',source.id));
  const index=async requestId=>{const p=catalog.state(),build=catalog.start(requestId,p.sourceSetVersion,p.policyVersion);await catalog.idle();const result=store.build(build.id);assert.equal(result.published,true);return result;};
  const first=await index('readme-boundary-first');
  assert.equal(first.coverage.indexed,fixture.manifest.evidence.length);
  const writes=()=>store.one('SELECT total_changes() AS n').n;
  function measure(buildId) {
    const before={git:sourceGit.commands,sql:writes(),evidence:evidenceCalls},start=performance.now(),value=projectOrientation(catalog,buildId),elapsedMs=performance.now()-start;
    const observation={elapsedMs,outputBytes:Buffer.byteLength(JSON.stringify(value)),documents:value.coverage.examinedDocuments,
      parsedBytes:value.coverage.parsedBytes,gitCalls:sourceGit.commands-before.git,sqliteWrites:writes()-before.sql,evidenceCalls:evidenceCalls-before.evidence};
    assert.equal(observation.gitCalls,0);assert.equal(observation.sqliteWrites,0);assert.equal(observation.evidenceCalls,160);
    assert.equal(observation.documents,20);assert.equal(observation.parsedBytes,655360);assert.ok(observation.outputBytes<=512*1024);
    return {value,observation};
  }
  function verify(value) {
    assert.equal(value.coverage.repositories,20);assert.equal(value.coverage.withContext,20);assert.equal(Object.keys(value.evidence).length,160);
    let count=0,omitted=0;const vector=[];
    for(const source of value.sources){
      const input=inputs.get(source.sourceName);assert.ok(input);assert.equal(source.context.text,input.expected.context);
      assert.equal(source.omittedSections,4);assert.equal(source.reading.length,1);assert.equal(source.reading[0].kind,'readme');
      const sections=source.sections.map(({evidenceIds,...section})=>({...section,parts:evidenceIds.map(id=>{
        const ref=value.evidence[id];assert.ok(ref);assert.equal(ref.sourceName,source.sourceName);assert.equal(ref.revision,source.revision);assert.equal(ref.path,'README.md');
        return {startLine:ref.startLine,endLine:ref.endLine};})}));
      assert.deepEqual(sections,input.sections);count+=sections.length;omitted+=source.omittedSections;
      vector.push({sourceName:source.sourceName,revision:source.revision,sections});
      for(const id of source.reading[0].evidenceIds){
        const ref=catalog.evidence(id);assert.equal(ref.sourceId,source.sourceId);assert.equal(ref.buildId,value.buildId);assert.equal(ref.path,'README.md');
        assert.equal(ref.revision,source.revision);assert.equal(ref.contentHash,input.sha256);
        assert.equal(ref.text,input.content.split('\n').slice(ref.startLine-1,ref.endLine).join('\n'));
      }
    }
    assert.deepEqual({count,omitted},{count:240,omitted:80});assert.ok(value.omissions['input-byte-limit']>0);
    return vector;
  }
  const measurements=[];let initial;
  for(let pass=0;pass<3;pass++){
    const run=measure(first.id);measurements.push(run.observation);
    if(initial)assert.deepEqual(run.value,initial);else initial=run.value;
  }
  const vector=verify(initial),second=await index('readme-boundary-refresh');
  assert.equal(second.refresh.reusedFiles,fixture.manifest.evidence.length);
  const refresh=measure(second.id);assert.deepEqual(verify(refresh.value),vector);
  assert.ok(Object.keys(refresh.value.evidence).every(id=>!initial.evidence[id]));
  const historical=measure(first.id);assert.equal(historical.value.stale,true);
  const logical=value=>{const {inputHash,stale,...rest}=value;return rest;};assert.deepEqual(logical(historical.value),logical(initial));
  assert.equal(store.one('SELECT count(*) AS n FROM answer_attempts').n,0);
  await close();open();
  const restarted=measure(second.id),oldRestarted=measure(first.id);
  assert.deepEqual(restarted.value,refresh.value);assert.deepEqual(oldRestarted.value,historical.value);assert.deepEqual(verify(restarted.value),vector);
  assert.equal(store.one('SELECT count(*) AS n FROM answer_attempts').n,0);assert.deepEqual(sourceState(),sources);
  const implementation={};for(const file of ['fixtures/loredock-readme-boundary/corpus.mjs','scripts/loredock-readme-boundary.mjs',
    'apps/loredock/src/orientation.ts','apps/loredock/src/readme-sections.ts','apps/loredock/src/map-document.ts'])implementation[file]=digest(await readFile(path.join(repo,file)));
  const result={schemaVersion:'loredock-readme-boundary/1',capturedAt:new Date().toISOString(),commit:git(['rev-parse','HEAD']),node:process.version,
    implementation,shape:boundaryShape,sources:sources.map(source=>({...source,readmeSha256:inputs.get(source.id).sha256})),
    modelRequests:0,measurements,firstProjectionWithinOneSecond:measurements[0].elapsedMs<=1000,
    index:{first,second},refresh:refresh.observation,historical:historical.observation,restart:restarted.observation,historicalRestart:oldRestarted.observation,
    stableRepeats:true,exactSectionVectors:true,allOriginalPartsVerified:true,newBuildEvidenceIds:true,historicalIdentityPreserved:true,
    restartIdentitiesPreserved:true,sourceCheckoutsUnchanged:true,initialOrientation:initial};
  await writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({output,elapsedMs:measurements.map(row=>row.elapsedMs),outputBytes:measurements[0].outputBytes,sections:240,omitted:80}));
}finally{await close();if(fixture)await rm(fixture.root,{recursive:true,force:true});}
