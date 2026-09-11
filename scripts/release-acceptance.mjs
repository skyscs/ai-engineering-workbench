import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createReleaseFixture, releaseSnapshot } from './release-fixtures.mjs';
import { CodexCliRuntime } from '../packages/ai/dist/index.js';
import { GitClient } from '../packages/git/dist/index.js';
import { openStorage } from '../packages/storage/dist/index.js';
import { RepositoryService } from '../apps/daemon/dist/repository-service.js';
import { WorktreeService } from '../apps/daemon/dist/worktree-service.js';
import { RuntimeService } from '../apps/daemon/dist/runtime-service.js';
import { exportReport } from '../apps/daemon/dist/report-export.js';

// Explicit opt-in; execute one case at a time and preserve each completed attempt.
if (process.env.AEW_REAL_RUNTIME !== '1' || !process.env.AEW_CODEX_HOME) throw new Error('Set AEW_REAL_RUNTIME=1 and AEW_CODEX_HOME explicitly. No inherited connection is used.');
const kind = process.argv[2];
const fixture = await createReleaseFixture(kind), baseline = await releaseSnapshot(fixture);
const dataRoot = path.join(fixture.root,'data');
const storage = openStorage({dataRoot}), git = new GitClient();
const repos = new RepositoryService(storage,git), worktrees = new WorktreeService(storage,git);
const service = new RuntimeService(storage,new CodexCliRuntime({timeoutMs:300000}),git);
let workspaceId, task;
const attempts = [];
async function terminal(id) {
  const deadline=Date.now()+315000;
  while(Date.now()<deadline) {
    const run=storage.tasks.getRun(workspaceId,task.id,id);
    if(!['queued','running'].includes(run.status)) return run;
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw new Error('Acceptance deadline exceeded.');
}
async function capture(id) {
  const run=await terminal(id), detail=storage.tasks.journal.detail(workspaceId,task.id,id);
  await writeFile(path.join(fixture.root,`attempt-${attempts.length+1}.json`),JSON.stringify(detail,null,2));
  attempts.push({id,status:run.status,errorCode:run.error?.code??null});
  console.log(JSON.stringify({kind,phase:'attempt-completed',...attempts.at(-1)}));
  assert.equal(run.status,'succeeded',`Run failed: ${run.error?.code}; inspect the local attempt file. No automatic retry.`);
  const report=storage.tasks.investigations.list(workspaceId,task.id)[0];
  const sources=[];
  for(const e of report.result.evidence) sources.push({id:e.id,...await service.readEvidence(workspaceId,task.id,report.id,e.id)});
  const exported=await exportReport(service,workspaceId,task.id,report.id);
  await writeFile(path.join(fixture.root,`report-v${report.version}.json`),JSON.stringify({report,sources},null,2));
  await writeFile(path.join(fixture.root,`report-v${report.version}.md`),exported.markdown);
  assert.deepEqual(await releaseSnapshot(fixture),baseline);
  return report;
}
try {
  workspaceId=storage.settings.createWorkspace({name:`Release acceptance: ${kind}`,connection:{name:'Explicit personal CLI connection',configHome:process.env.AEW_CODEX_HOME,executablePath:process.env.AEW_CODEX_EXECUTABLE||null}}).workspace.id;
  const profile=storage.settings.createModelProfile(workspaceId,{name:'Terra medium',modelIdentifier:'gpt-5.6-terra',reasoningEffort:'medium'});
  const repositoryIds=[];
  for(const r of fixture.repositories) repositoryIds.push((await repos.register(workspaceId,{name:r.name,source:r.source})).id);
  task=storage.tasks.create(workspaceId,{title:`Release ${kind} investigation`,description:fixture.description,repositoryIds});
  console.log(JSON.stringify({kind,fixture:fixture.root,workspaceId,taskId:task.id,phase:'prepared'}));
  const includeIncident=async()=>{
    const bytes=await readFile(fixture.artifact);
    const artifact=await storage.tasks.artifacts.import(workspaceId,task.id,{name:'incident.log',mimeType:'text/plain',size:bytes.length},new ReadableStream({start(c){c.enqueue(bytes);c.close();}}));
    storage.tasks.artifacts.selectContext(workspaceId,task.id,[{artifactId:artifact.id,start:0,end:bytes.length}]);
  };
  if(kind!=='revision') await includeIncident();
  assert.equal((await terminal(worktrees.start(workspaceId,task.id).id)).status,'succeeded');
  const first=await capture(service.startInvestigation(workspaceId,task.id,{modelProfileId:profile.id}).id);
  if(kind==='revision') {
    await includeIncident();
    const guard=()=>({requestId:randomUUID(),expectedContextRevision:storage.tasks.get(workspaceId,task.id).contextRevision});
    assert.equal(service.intervene(workspaceId,task.id,{type:'constraint',text:fixture.constraint,...guard()}).run,null);
    const revised=await capture(service.intervene(workspaceId,task.id,{type:'challenge',text:fixture.challenge,targetReportId:first.id,modelProfileId:profile.id,...guard()}).run.id);
    assert.equal(revised.previousVersionId,first.id); assert.ok(revised.triggeredByInterventionId);
    assert.deepEqual(storage.tasks.investigations.get(workspaceId,task.id,first.id).result,first.result);
    const run=storage.tasks.getRun(workspaceId,task.id,revised.stageRunId);
    assert.deepEqual(run.inputSnapshot.revision.previousReport.result,first.result);
    assert.deepEqual(run.inputSnapshot.constraints,[fixture.constraint]);
  }
  const reports=storage.tasks.investigations.list(workspaceId,task.id);
  const metadata=storage.tasks.journal.detail(workspaceId,task.id,reports[0].stageRunId).metadata;
  await service.close(); await worktrees.close(); await repos.close(); storage.close();
  const reopened=openStorage({dataRoot});
  try {
    assert.deepEqual(reopened.tasks.investigations.list(workspaceId,task.id),reports);
    const integrity = new DatabaseSync(reopened.paths.database, { readOnly: true });
    try {
      assert.deepEqual(integrity.prepare('PRAGMA integrity_check').all().map(r => r.integrity_check), ['ok']);
      assert.deepEqual(integrity.prepare('PRAGMA foreign_key_check').all(), []);
    } finally { integrity.close(); }
    const result={kind,attempts,versions:reports.length,reportIds:reports.map(r=>r.id),sourceStateUnchanged:true,restartPersistence:true,
      databaseIntegrity:true,allPublishedLocatorsReopened:true,markdownExports:true,explicitConfigurationDirectory:true,verifiedAccountIdentity:false,
      cliVersion:metadata.version,model:'gpt-5.6-terra',reasoningEffort:'medium',qualityReview:'pending manual review',expected:fixture.expected};
    await writeFile(path.join(fixture.root,'acceptance-result.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify({fixture:fixture.root,...result},null,2));
  } finally {reopened.close();}
} finally {await service.close();await worktrees.close();await repos.close();storage.close();}
