import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, type TestContext } from 'node:test';
import { GitClient, WorktreeGit, worktreePlan } from '@aew/git';
import { openStorage } from '@aew/storage';
import { FakeRuntime, RuntimeError, type AIRuntime } from '@aew/ai';
import { RuntimeService } from '../src/runtime-service.js';
import type { StageRun } from '@aew/core';
import { createApp } from '../src/app.js';
import { RepositoryService } from '../src/repository-service.js';
import { WorktreeService } from '../src/worktree-service.js';

import { fixture, finished, preview, goodEvents } from './runtime-fixture.js';

test('runtime API enforces session, CSRF, ownership, selected profiles and immutable context before publishing a preview', async(t)=>{
  const fake=new FakeRuntime(goodEvents), f=await fixture(t,fake,2), route=`${f.base}/runtime-runs`;
  const profile=f.storage.settings.createModelProfile(f.workspaceId,{name:'Selected',modelIdentifier:'opaque-fixture',reasoningEffort:'medium'});
  assert.equal((await f.request(route,'POST',{}, {cookie:''})).status,401);
  assert.equal((await f.request(route,'POST',{}, {'x-aew-csrf':''})).status,403);
  assert.equal((await f.request(route,'POST',{instructions:'arbitrary'})).status,400);
  assert.equal((await f.request(route,'POST',{modelProfileId:'missing'})).status,404);
  const bytes=Buffer.from('excluded prefix|included café|excluded suffix');
  const artifact=await f.storage.tasks.artifacts.import(f.workspaceId,f.task.id,{name:'selected.log',mimeType:'text/plain',size:bytes.length},new ReadableStream({start(c){c.enqueue(bytes);c.close();}}));
  const start=Buffer.byteLength('excluded prefix|'), end=start+Buffer.byteLength('included café');
  f.storage.tasks.artifacts.selectContext(f.workspaceId,f.task.id,[{artifactId:artifact.id,start,end}]);
  const started=await f.request(route,'POST',{modelProfileId:profile.id}); assert.equal(started.status,202);
  const run=await started.json() as StageRun;
  assert.equal((await f.request(route,'POST',{})).status,409);
  assert.equal((await finished(f,run.id)).status,'succeeded');
  const detail=f.storage.tasks.journal.detail(f.workspaceId,f.task.id,run.id);
  assert.deepEqual(detail.result,preview); assert.equal(detail.run.modelProfileId,profile.id);
  assert.match(fake.requests[0]!.instructions,/included café/); assert.doesNotMatch(fake.requests[0]!.instructions,/excluded prefix|excluded suffix/);
  assert.equal(fake.requests[0]!.contextManifest.context.entries[0]!.sha256,artifact.sha256);
  assert.equal(fake.requests.length,1); assert.equal(fake.requests[0]!.readRoots.length,2);
  assert.equal(fake.requests[0]!.profile!.modelIdentifier,'opaque-fixture');
  const response=await f.request(`${route}/${run.id}/events`); assert.equal(response.headers.get('content-type'),'text/event-stream');
  const text=await response.text(); assert.match(text,/id: 1/); assert.match(text,/event: complete/);
  const replay=await f.request(`${route}/${run.id}/events`,'GET',undefined,{'last-event-id':'1'});
  assert.doesNotMatch(await replay.text(),/id: 1\n/);
  assert.equal((await f.request(`${route}/${run.id}/events?after=-1`)).status,400);
  assert.equal((await f.request(`${route}/${run.id}/events`,'GET',undefined,{cookie:''})).status,401);
  assert.equal((await f.request(`${route}/${run.id}/cancel`,'POST',{})).status,200);
  assert.equal(f.storage.tasks.getRun(f.workspaceId,f.task.id,run.id).status,'succeeded');
});

test('runtime failure retains diagnostics and retry creates a fresh run',async(t)=>{
  const fake=new FakeRuntime(goodEvents.slice(0,2),new RuntimeError('PROCESS_FAILED','Synthetic failure.',{exitCode:7,stderr:'Fixture stderr.'})),f=await fixture(t,fake);
  const first=f.runtimeService.start(f.workspaceId,f.task.id,{});
  const failed=await finished(f,first.id); assert.equal(failed.status,'failed'); assert.equal(failed.error!.exitCode,7);
  assert.equal(f.storage.tasks.journal.detail(f.workspaceId,f.task.id,first.id).result,null);
  const second=f.runtimeService.start(f.workspaceId,f.task.id,{}); assert.notEqual(second.id,first.id); await finished(f,second.id);
  assert.equal(f.storage.tasks.get(f.workspaceId,f.task.id).status,'CONTEXT_READY');
});

test('browser disconnection does not cancel; explicit cancellation and shutdown wait for runtime ownership',async(t)=>{
  const fake=new FakeRuntime(goodEvents,null,signal=>new Promise(resolve=>{ if(signal.aborted)resolve(); else signal.addEventListener('abort',()=>resolve(),{once:true}); }));
  const f=await fixture(t,fake), run=f.runtimeService.start(f.workspaceId,f.task.id,{});
  const stream=await f.request(`${f.base}/runtime-runs/${run.id}/events`); const reader=stream.body!.getReader(); await reader.read(); await reader.cancel();
  assert.equal(f.storage.tasks.getRun(f.workspaceId,f.task.id,run.id).status,'running');
  f.runtimeService.cancel(f.workspaceId,f.task.id,run.id); f.runtimeService.cancel(f.workspaceId,f.task.id,run.id);
  assert.equal((await finished(f,run.id)).status,'cancelled');
  const next=f.runtimeService.start(f.workspaceId,f.task.id,{}); await f.runtimeService.close();
  assert.equal(f.storage.tasks.getRun(f.workspaceId,f.task.id,next.id).status,'cancelled');
  assert.equal(f.storage.tasks.journal.detail(f.workspaceId,f.task.id,next.id).result,null);
});

test('dirty or changed worktrees fail before model invocation',async(t)=>{
  const fake=new FakeRuntime(goodEvents), f=await fixture(t,fake);
  const tree=f.storage.tasks.worktrees.list(f.workspaceId,f.task.id)[0]!;
  writeFileSync(path.join(tree.worktreePath!,'file'),'unexpected modification');
  const run=f.runtimeService.start(f.workspaceId,f.task.id,{});
  assert.equal((await finished(f,run.id)).status,'failed'); assert.equal(fake.requests.length,0);
});

test('result publication rolls back on database failure and a terminal cancellation cannot be overwritten',async(t)=>{
  const f=await fixture(t), db=new DatabaseSync(f.storage.paths.database);
  db.exec("CREATE TRIGGER reject_runtime_success BEFORE UPDATE OF status ON stage_runs WHEN NEW.status = 'succeeded' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END");
  const run=f.runtimeService.start(f.workspaceId,f.task.id,{}); assert.equal((await finished(f,run.id)).status,'failed');
  assert.equal(f.storage.tasks.journal.detail(f.workspaceId,f.task.id,run.id).result,null);
  db.exec('DROP TRIGGER reject_runtime_success'); db.close();
  const next=f.storage.tasks.createRun(f.workspaceId,f.task.id,{stage:'investigation',modelProfileId:null,promptVersion:'fixture',schemaVersion:'fixture'});
  f.storage.tasks.transitionRun(f.workspaceId,f.task.id,next.id,'cancelled');
  assert.equal(f.storage.tasks.journal.succeed(f.workspaceId,f.task.id,next.id,preview).status,'cancelled');
  assert.equal(f.storage.tasks.journal.detail(f.workspaceId,f.task.id,next.id).result,null);
});

test('persisted event limits, immutable metadata and interruption survive restart without another model request',async(t)=>{
  const f=await fixture(t), tasks=f.storage.tasks;
  const run=tasks.createRun(f.workspaceId,f.task.id,{stage:'investigation',modelProfileId:null,promptVersion:'fixture',schemaVersion:'fixture'});
  tasks.transitionRun(f.workspaceId,f.task.id,run.id,'running'); tasks.journal.metadata(f.workspaceId,f.task.id,run.id,{version:'fixture'});
  assert.throws(()=>tasks.journal.metadata(f.workspaceId,f.task.id,run.id,{version:'changed'}),/run_metadata_immutable/);
  tasks.journal.append(f.workspaceId,f.task.id,run.id,'progress',{message:'x'.repeat(10*1024**2)});
  tasks.journal.append(f.workspaceId,f.task.id,run.id,'progress',{message:'omitted'});
  const before=tasks.journal.events(f.workspaceId,f.task.id,run.id); assert.equal(before.length,2); assert.equal(before[1]!.type,'truncated');
  await f.runtimeService.close(); await f.service.close(); f.storage.close();
  const reopened=openStorage({dataRoot:path.join(f.root,'data')});
  try {
    assert.equal(reopened.tasks.getRun(f.workspaceId,f.task.id,run.id).error!.code,'INTERRUPTED');
    assert.deepEqual(reopened.tasks.journal.events(f.workspaceId,f.task.id,run.id),before);
    assert.equal(reopened.tasks.journal.detail(f.workspaceId,f.task.id,run.id).result,null);
  } finally { reopened.close(); }
});

test('unbound tasks cannot start AI and explicit home binding is blocked during preparation',async(t)=>{
  const f=await fixture(t), storage=f.storage;
  const owner=storage.settings.createWorkspace({name:'Unbound',connection:{name:'Choose a home'}}).workspace.id;
  const source=path.join(f.root,'source 0');
  const repo=await f.repositories.register(owner,{name:'Source',source});
  const task=storage.tasks.create(owner,{title:'Unbound task',description:'Synthetic context.',repositoryIds:[repo.id]});
  const run=storage.tasks.createRun(owner,task.id,{stage:'context_preparation',modelProfileId:null,promptVersion:'fixture',schemaVersion:'fixture'});
  assert.throws(()=>storage.settings.updateConnection(owner,{name:'Premature binding',configHome:f.root}),{code:'BOUNDARY_LOCKED'});
  storage.tasks.transitionRun(owner,task.id,run.id,'cancelled');
  assert.equal((await f.request(`/api/workspaces/${owner}/tasks/${task.id}/runtime-runs`,'POST',{})).status,409);
  assert.equal(storage.tasks.detail(owner,task.id).latestRun!.id,run.id);
  const response=await f.request(`/api/workspaces/${owner}/connection`,'PUT',{name:'Explicit home',configHome:f.root});
  assert.equal(response.status,200);
  assert.equal(storage.settings.getWorkspace(owner).connection.configHome,f.root);
});
