import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CatalogStore} from '../apps/loredock/dist/store.js';
import {Catalog} from '../apps/loredock/dist/catalog.js';
import {CodeAnalysis} from '../apps/loredock/dist/code-analysis.js';
import {prepareDemo} from './loredock-demo.mjs';
import {auditHistory} from './loredock-history.mjs';
import {scaleGit} from './loredock-scale-fixture.mjs';

const output=process.argv[2],repo=fileURLToPath(new URL('../',import.meta.url));
assert.ok(output && path.isAbsolute(output) && process.argv.length===3,'Use one absolute report directory; no data/source path is accepted.');
const git=args=>execFileSync('git',['-C',repo,...args],{encoding:'utf8'}).trim();
assert.equal(git(['status','--porcelain','--untracked-files=no']),'','Commit the implementation before the compiled smoke.');
let root,store,catalog,analysis;
const close=async()=>{if(store){await analysis?.stop();await catalog?.stop();store.close();store=undefined;}};
try {
  await mkdir(output,{recursive:true});
  const demo=await prepareDemo({CatalogStore,Catalog,CodeAnalysis},{onProgress:event=>{if(event.root)root=event.root;}});
  store=new CatalogStore(demo.dataDirectory);catalog=new Catalog(store);analysis=new CodeAnalysis(catalog);
  const sources=store.sources().map(source=>source.name),sourceState=()=>sources.map(source=>[source,scaleGit(root,source,['rev-parse','HEAD']),scaleGit(root,source,['status','--porcelain'])]);
  const originalSources=sourceState(),builds=[demo.build.id];
  for(const request of ['second','third']) {
    const p=store.project(),build=catalog.start(request,p.sourceSetVersion,p.policyVersion);await catalog.idle();builds.push(build.id);
    analysis.start(request,build.id);await analysis.idle();
  }
  const p=store.project(),pending=store.start('pending',p.sourceSetVersion,p.policyVersion),live=auditHistory(demo.dataDirectory);
  assert.equal(live.referenceChecks.status,'passed');assert.equal(live.generations.total,4);
  assert.deepEqual(live.generations.items.map(row=>row.id),[...builds,pending.id]);
  assert.deepEqual(live.generations.items.map(row=>row.files.indexed),[79,79,79,0]);
  assert.deepEqual(live.generations.items.map(row=>row.incoming.reusedFiles),[79,79,0,0]);
  assert.deepEqual(live.generations.items.map(row=>row.incoming.baselineBuilds),[1,1,1,0]);
  assert.deepEqual(live.generations.items.map(row=>row.code.runs),[0,1,1,0]);
  assert.equal(store.buildRow(pending.id).status,'preparing');assert.equal(store.all('SELECT id FROM answer_attempts').length,0);
  await close();const names=['loredock.db','.owner.db'],before=await Promise.all(names.map(name=>readFile(path.join(demo.dataDirectory,name))));
  const command=['--silent','loredock:history','--data-dir',demo.dataDirectory];
  const history=JSON.parse(execFileSync('pnpm',command,{cwd:repo,encoding:'utf8'}));
  const {capturedAt:_liveTime,...liveContents}=live,{capturedAt:_closedTime,...closedContents}=history;
  assert.deepEqual(closedContents,liveContents);assert.deepEqual(await Promise.all(names.map(name=>readFile(path.join(demo.dataDirectory,name)))),before);
  assert.deepEqual(sourceState(),originalSources);
  const implementation={};for(const file of ['scripts/loredock-history.mjs','scripts/loredock-storage.mjs','scripts/loredock-history-smoke.mjs','scripts/loredock-demo.mjs']) {
    implementation[file]=createHash('sha256').update(await readFile(path.join(repo,file))).digest('hex');
  }
  const result={schemaVersion:'loredock-history-smoke/1',checkedAt:new Date().toISOString(),commit:git(['rev-parse','HEAD']),node:process.version,
    implementation,sources:20,modelRequests:0,usedPackageCommand:true,liveReadAgrees:true,mainAndOwnerBytesUnchanged:true,
    sourceCheckoutsUnchanged:true,pendingRecoveryStateUnchanged:true,history};
  await writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({passed:true,output,generations:history.generations.total,indexed:history.generations.items.map(row=>row.files.indexed)}));
} finally {await close();if(root)await rm(root,{recursive:true,force:true});}
