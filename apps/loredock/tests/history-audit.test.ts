import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdtemp,readFile,readdir,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {test,type TestContext} from 'node:test';
import {CatalogStore} from '../src/store.js';
import {Catalog} from '../src/catalog.js';
import {CodeAnalysis} from '../src/code-analysis.js';
import {Corrections} from '../src/corrections.js';
import {Reconciliation} from '../src/reconciliation.js';
import {codeFlows} from '../src/code-flows.js';
import {removeExternalSearchSchema} from './legacy-schema.js';
// @ts-expect-error Read-only diagnostic commands are plain JavaScript.
import {auditHistory,historyArguments,historyLimits} from '../../../scripts/loredock-history.mjs';
// @ts-expect-error Owned fixture generation is plain JavaScript.
import {createLoreDockFixture} from '../../../scripts/loredock-fixture.mjs';

async function setup(t:TestContext) {
  const fixture=await createLoreDockFixture(),directory=path.join(fixture.root,'history-data');
  const store=new CatalogStore(directory),catalog=new Catalog(store),analysis=new CodeAnalysis(catalog);let closed=false;
  const close=async()=>{if(!closed){await analysis.stop();await catalog.stop();store.close();closed=true;}};
  t.after(async()=>{await close();await rm(fixture.root,{recursive:true,force:true});});
  for(const name of ['portal','order-api','order-worker']) await catalog.addSource(path.join(fixture.root,'sources',name));
  const index=async(id:string)=>{const p=store.project(),build=catalog.start(id,p.sourceSetVersion,p.policyVersion);await catalog.idle();assert.ok(store.build(build.id).published);return build.id;};
  return {fixture,directory,store,catalog,analysis,index,close};
}

test('history reports a refresh chain, real reapplication, withdrawn review, all answer states and code facts without private content',async t=>{
  const s=await setup(t),first=await s.index('first'),graph=codeFlows(s.catalog),edge=graph.edges.find(edge=>edge.kind==='event-delivery')!;
  const corrections=new Corrections(s.catalog),note=corrections.save({requestId:'note',buildId:first,targetKind:'code-link',targetId:edge.id,
    projectionHash:graph.inputHash,expectedRevision:0,expectedPreviousId:null,action:'dispute',statement:'private-review-marker-雪',environment:'private-local'});
  const second=await s.index('second'),review=new Reconciliation(s.catalog),preview=review.preview(),entry=preview.entries[0]!;
  assert.equal(entry.status,'support-unchanged');const reapplied=review.reapply({requestId:'reapply',buildId:second,sourceCorrectionId:note.id,
    targetId:entry.current!.id,previewHash:preview.previewHash,expectedRevision:preview.revision});
  const currentGraph=codeFlows(s.catalog);corrections.save({requestId:'withdraw',buildId:second,targetKind:'code-link',targetId:reapplied.targetId,
    projectionHash:currentGraph.inputHash,expectedRevision:s.catalog.state().correctionRevision,expectedPreviousId:reapplied.id,action:'withdraw',statement:null,environment:null});
  const third=await s.index('third'),run=s.analysis.start('code',third);await s.analysis.idle();
  const inventory=s.analysis.get(run.id);
  for(const status of ['succeeded','failed','running']) s.store.run(`INSERT INTO answer_attempts
    (id,requestId,payloadHash,question,buildId,policyVersion,registryVersion,status,context,inputHash,connection,model,effort,promptVersion,schemaVersion,createdAt)
    VALUES (?,?,?,'private-question-marker',?,1,?,?,?,'hash','private-connection-marker','fixture','medium','fixture','fixture','now')`,
    status,status,'hash',first,s.store.project().sourceSetVersion,status,'private-context-marker');
  for(const id of ['succeeded','failed','running']) for(const source of s.store.sources()) s.store.run('INSERT INTO answer_sources VALUES (?,?)',id,source.id);
  const p=s.store.project(),pending=s.store.start('pending',p.sourceSetVersion,p.policyVersion);
  const report=auditHistory(s.directory),[a,b,c,d]=report.generations.items;
  assert.equal(report.schemaVersion,'loredock-history-audit/1');assert.equal(report.referenceChecks.status,'passed');
  assert.equal(report.generations.total,4);assert.equal(report.generations.omitted,0);
  assert.deepEqual(report.generations.items.map((row:{id:string})=>row.id),[first,second,third,pending.id]);
  assert.deepEqual([a.baselineBuildId,b.baselineBuildId,c.baselineBuildId,d.baselineBuildId],[null,first,second,third]);
  assert.deepEqual([a.incoming.baselineBuilds,b.incoming.baselineBuilds,c.incoming.baselineBuilds,d.incoming.baselineBuilds],[1,1,1,0]);
  assert.deepEqual([a.incoming.reusedFiles,b.incoming.reusedFiles,c.incoming.reusedFiles],[18,18,0]);assert.equal(c.current,true);
  assert.deepEqual(a.answers,{total:3,unfinished:1});assert.equal(a.review.sourceForReapplications,1);
  assert.equal(b.review.reappliedFromOtherBuilds,1);assert.equal(b.review.versions,2);assert.equal(b.review.withdrawals,1);
  assert.equal(c.code.runs,1);assert.ok(c.code.payloadBytes>0);assert.equal(d.status,'preparing');
  assert.equal(a.files.indexed,18);assert.equal(a.files.rawBytes,b.files.rawBytes);assert.equal(b.files.rawBytes,c.files.rawBytes);
  assert.equal(a.search.literalDocuments,a.spans.total);assert.equal(a.search.questionDocuments,a.spans.total);
  const serialized=JSON.stringify(report);for(const secret of ['private-',s.directory,'order-worker','OrderConsumer']) assert.ok(!serialized.includes(secret));
  assert.equal(s.store.buildRow(pending.id).status,'preparing');assert.deepEqual(s.analysis.get(run.id),inventory);
  assert.throws(()=>new CatalogStore(s.directory),/already in use/);
  const source=s.store.sources().find(source=>source.name==='portal')!;s.catalog.revoke(source.id);
  const revoked=auditHistory(s.directory),ra=revoked.generations.items[0];
  assert.ok(ra.files.rawBytes<a.files.rawBytes);assert.ok(ra.files.purged>0);assert.equal(ra.answers.total,3);
  assert.equal(ra.review.versions,a.review.versions);assert.equal(ra.review.purged,1);assert.equal(ra.incoming.reusedFiles,a.incoming.reusedFiles);
  assert.equal(revoked.generations.items[2].code.payloadBytes,0);
  const payload=revoked.generations.items.map((row:{files:unknown;spans:unknown})=>[row.files,row.spans]);
  s.catalog.updatePolicy(['config']);assert.deepEqual(auditHistory(s.directory).generations.items.map((row:{files:unknown;spans:unknown})=>[row.files,row.spans]),payload);
});

test('actual history CLI preserves closed schema-8/9 bytes and pending/paused recovery state',async t=>{
  for(const version of [8,9]) await t.test(`schema ${version}`,async sub=>{
    const s=await setup(sub),build=await s.index('first'),run=s.analysis.start('code',build);await s.analysis.idle();
    s.store.run("UPDATE code_analyses SET status='paused' WHERE id=?",run.id);
    const p=s.store.project(),pending=s.store.start('pending',p.sourceSetVersion,p.policyVersion);
    const file=s.store.one<{id:string}>('SELECT id FROM files WHERE raw IS NOT NULL LIMIT 1')!;
    const marker=Buffer.from('private-雪\u0000é');s.store.run('UPDATE files SET raw=? WHERE id=?',marker,file.id);
    const expected=s.store.all<{raw:Uint8Array|null}>('SELECT raw FROM files').reduce((sum,row)=>sum+(row.raw?.byteLength??0),0);
    if(version===8)removeExternalSearchSchema(s.store.db);await s.close();
    const names=['loredock.db','.owner.db'],before=await Promise.all(names.map(name=>readFile(path.join(s.directory,name))));
    const report=JSON.parse(execFileSync(process.execPath,[path.resolve('../../scripts/loredock-history.mjs'),'--data-dir',s.directory],{encoding:'utf8'}));
    assert.equal(report.databaseVersion,version);assert.equal(report.generations.items[0].files.rawBytes,expected);
    assert.equal(report.generations.items[0].code.unfinished,1);assert.equal(report.generations.items[1].status,'preparing');
    assert.deepEqual(await Promise.all(names.map(name=>readFile(path.join(s.directory,name)))),before);
    const db=new DatabaseSync(path.join(s.directory,'loredock.db'),{readOnly:true});
    try {assert.equal(db.prepare('PRAGMA user_version').get()!.user_version,version);assert.equal(db.prepare('SELECT status FROM builds WHERE id=?').get(pending.id)!.status,'preparing');}
    finally {db.close();}
  });
});

test('generation detail is bounded while dependencies from omitted generations still count',async t=>{
  const directory=await mkdtemp(path.join(tmpdir(),'loredock-history-bounds-'));
  const store=new CatalogStore(directory);t.after(async()=>{store.close();await rm(directory,{recursive:true,force:true});});const ids=Array.from({length:1001},()=>randomUUID());
  store.transaction(()=>{ids.forEach((id,index)=>store.run(`INSERT INTO builds
    (id,requestId,payloadHash,status,policyVersion,sourceSetVersion,policy,createdAt,published,extractorVersion,baselineBuildId)
    VALUES (?,?,?,'completed',1,1,'{}',?,1,'fixture',?)`,id,`request-${index}`,'hash','2026-11-01T00:00:00.000Z',index?ids[index-1]!:null));
    store.run('UPDATE project SET publishedBuildId=?',ids.at(-1)!);});
  const report=auditHistory(directory);assert.equal(report.generations.total,1001);assert.equal(report.generations.reported,1000);
  assert.equal(report.generations.omitted,1);assert.equal(report.generations.complete,false);
  assert.equal(report.generations.items.at(-1).incoming.baselineBuilds,1);assert.equal(report.generations.items.some((row:{current:boolean})=>row.current),false);
  assert.ok(Buffer.byteLength(JSON.stringify(report,null,2)+'\n')<=historyLimits.outputBytes);
});

test('dangling references and malformed metadata report inconsistency without leaking malformed values',async t=>{
  const s=await setup(t),id=await s.index('first');s.store.db.exec('PRAGMA foreign_keys=OFF');
  s.store.run("UPDATE project SET publishedBuildId='private-pointer-marker'");
  s.store.run("UPDATE builds SET baselineBuildId='private-baseline-marker',createdAt='private-date-marker',status='private-status-marker',published=9 WHERE id=?",id);
  const report=auditHistory(s.directory);assert.equal(report.referenceChecks.status,'inconsistent');assert.ok(report.referenceChecks.foreignKeyViolations>0);
  assert.equal(report.referenceChecks.currentPointerMissing,true);assert.equal(report.referenceChecks.currentPointerMalformed,true);
  assert.equal(report.referenceChecks.invalidReportedMetadata,1);assert.equal(report.generations.items[0].createdAt,null);
  assert.equal(report.generations.items[0].baselineBuildId,null);assert.equal(report.generations.items[0].status,'unrecognized');
  assert.ok(!JSON.stringify(report).includes('private-'));
});

test('history handles empty catalogs and rejects missing, foreign, unsupported, symlinked and invalid inputs',async t=>{
  const directory=await mkdtemp(path.join(tmpdir(),'loredock-history-invalid-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  assert.throws(()=>auditHistory('relative'),/absolute/);assert.throws(()=>auditHistory(directory),/not found/);assert.deepEqual(await readdir(directory),[]);
  await writeFile(path.join(directory,'workbench.db'),'owned sentinel');assert.throws(()=>auditHistory(directory),/Workbench/);await rm(path.join(directory,'workbench.db'));
  const store=new CatalogStore(directory);assert.equal(auditHistory(directory).generations.total,0);store.db.exec('PRAGMA user_version=10');store.close();
  const file=path.join(directory,'loredock.db'),before=await readFile(file);assert.throws(()=>auditHistory(directory),/schema 8 or 9/);assert.deepEqual(await readFile(file),before);
  await symlink(file,path.join(directory,'.owner.db-wal'));assert.throws(()=>auditHistory(directory),/regular files/);
  for(const args of [[],['--data-dir','relative'],['--data-dir',directory,'--delete']])assert.throws(()=>historyArguments(args),/Usage/);
  assert.equal(historyArguments(['--data-dir',directory]),directory);
});
