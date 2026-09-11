import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { FakeRuntime, type AIEvent } from '@aew/ai';
import { parseIntervention, type InvestigationResult, type ResultDependency, type StageRun } from '@aew/core';
import { openStorage } from '@aew/storage';
import { fixture, finished, goodEvents } from './runtime-fixture.js';

type Fixture = Awaited<ReturnType<typeof fixture>>;
const conclusion: InvestigationResult = { investigation:{summary:'Initial explanation.',timeline:[]},
  rootCause:{status:'insufficient_evidence',summary:'More evidence is required.',evidenceIds:[],unresolvedQuestions:['Which change introduced this?']},evidence:[] };
const events = (): AIEvent[] => [goodEvents[0]!, {type:'result',data:structuredClone(conclusion)}];
const reports = (f: Fixture) => f.storage.tasks.investigations.list(f.workspaceId,f.task.id);
const guard = (f: Fixture) => ({requestId:randomUUID(),expectedContextRevision:f.storage.tasks.get(f.workspaceId,f.task.id).contextRevision});
const constraint = (f: Fixture,text='Inspect history before drawing a conclusion.') => ({...guard(f),type:'constraint',text});
const challenge = (f: Fixture) => ({...guard(f),type:'challenge' as const,text:'The explanation is incomplete. Reconsider the relevant history.',targetReportId:reports(f)[0]!.id,modelProfileId:null});
async function initial(f: Fixture) { assert.equal((await finished(f,f.runtimeService.startInvestigation(f.workspaceId,f.task.id,{}).id)).status,'succeeded'); return reports(f)[0]!; }

test('constraints persist without AI; challenge snapshots exact v1 and human input, publishes linked v2 and carries constraints into later runs',async t=>{
  const output=events(), fake=new FakeRuntime(output), f=await fixture(t,fake);
  const added=f.runtimeService.intervene(f.workspaceId,f.task.id,constraint(f));
  assert.equal(added.run,null); assert.equal(fake.requests.length,0);
  const first=await initial(f); assert.equal(fake.requests[0]!.contextManifest.constraints.length,1);
  const input=challenge(f); output[1]={type:'result',data:{...conclusion,investigation:{summary:'Revised after reviewing the challenge; uncertainty remains.',timeline:[]}}};
  const submitted=f.runtimeService.intervene(f.workspaceId,f.task.id,input);
  assert.ok(submitted.run); assert.equal(submitted.run.previousVersionId,first.id); assert.equal(submitted.run.triggeredByInterventionId,submitted.intervention.id);
  assert.equal(reports(f)[0]!.status,'active'); assert.equal(reports(f).length,1);
  assert.equal((await finished(f,submitted.run.id)).status,'succeeded');
  const [second,old]=reports(f); assert.equal(second!.version,2); assert.equal(second!.previousVersionId,first.id);
  assert.equal(second!.triggeredByInterventionId,submitted.intervention.id); assert.equal(old!.status,'superseded'); assert.deepEqual(old!.result,first.result);
  const request=fake.requests[1]!;
  assert.equal(request.contextManifest.promptVersion,'investigation-v2');
  assert.deepEqual(request.contextManifest.revision!.previousReport.result,first.result);
  assert.equal(request.contextManifest.revision!.intervention.text,input.text);
  assert.match(request.instructions,/Inspect history before drawing a conclusion/); assert.match(request.instructions,/explanation is incomplete/);
  assert.equal(request.contextManifest.constraintSnapshots![0]!.sourceInterventionId,added.intervention.id);
  const later=await initial(f); assert.equal(later.version,3); assert.equal(later.triggeredByInterventionId,null);
  assert.equal(fake.requests[2]!.contextManifest.revision,null); assert.equal(fake.requests[2]!.contextManifest.constraints.length,1);
  const history=f.storage.tasks.interventions.history(f.workspaceId,f.task.id);
  assert.equal(history.find(i=>i.id===submitted.intervention.id)!.reportId,second!.id);
});

test('duplicate requests, superseded targets and obsolete context are rejected without orphan interventions or extra AI runs',async t=>{
  const fake=new FakeRuntime(events()),f=await fixture(t,fake); const first=await initial(f);
  const input=challenge(f), run=f.runtimeService.intervene(f.workspaceId,f.task.id,input).run!;
  assert.throws(()=>f.runtimeService.intervene(f.workspaceId,f.task.id,input),{code:'CONFLICT'});
  await finished(f,run.id);
  assert.throws(()=>f.runtimeService.intervene(f.workspaceId,f.task.id,input),{code:'CONFLICT'});
  assert.throws(()=>f.runtimeService.intervene(f.workspaceId,f.task.id,{...challenge(f),targetReportId:first.id}),{code:'CONFLICT'});
  const stale=challenge(f), add=constraint(f); f.runtimeService.intervene(f.workspaceId,f.task.id,add);
  assert.throws(()=>f.runtimeService.intervene(f.workspaceId,f.task.id,add),{code:'CONFLICT'});
  assert.throws(()=>f.runtimeService.intervene(f.workspaceId,f.task.id,stale),{code:'CONFLICT'});
  assert.equal(fake.requests.length,2); assert.equal(f.storage.tasks.interventions.history(f.workspaceId,f.task.id).length,2);
  assert.equal(reports(f)[0]!.freshness,'stale');
});

test('failure, cancellation and publication rollback preserve the active report and expose failed revision history; retry is a fresh run',async t=>{
  const output=events(), f=await fixture(t,new FakeRuntime(output)); const first=await initial(f);
  output[1]={type:'result',data:{}};
  const failed=f.runtimeService.intervene(f.workspaceId,f.task.id,challenge(f)).run!;
  assert.equal((await finished(f,failed.id)).status,'failed'); assert.deepEqual(reports(f),[first]);
  output[1]={type:'result',data:conclusion};
  const cancelled=f.runtimeService.intervene(f.workspaceId,f.task.id,challenge(f)).run!;
  f.runtimeService.cancel(f.workspaceId,f.task.id,cancelled.id);
  assert.equal((await finished(f,cancelled.id)).status,'cancelled'); assert.deepEqual(reports(f),[first]);
  const db=new DatabaseSync(f.storage.paths.database);
  try {
    db.exec("CREATE TRIGGER reject_revision_output BEFORE UPDATE OF result_json ON run_execution BEGIN SELECT RAISE(ABORT, 'injected_failure'); END;");
    const broken=f.runtimeService.intervene(f.workspaceId,f.task.id,challenge(f)).run!;
    assert.equal((await finished(f,broken.id)).status,'failed'); assert.deepEqual(reports(f),[first]);
    assert.equal(f.storage.tasks.journal.detail(f.workspaceId,f.task.id,broken.id).result,null);
    db.exec('DROP TRIGGER reject_revision_output');
  } finally { db.close(); }
  const retried=f.runtimeService.intervene(f.workspaceId,f.task.id,challenge(f)).run!;
  assert.notEqual(retried.id,failed.id); assert.equal((await finished(f,retried.id)).status,'succeeded');
  assert.equal(reports(f)[0]!.version,2);
  const history=f.storage.tasks.interventions.history(f.workspaceId,f.task.id);
  assert.equal(history.length,4); assert.equal(history.filter(i=>i.reportId).length,1);
  assert.ok(history.some(i=>i.runId===failed.id && i.runStatus==='failed'));
});

test('context edits and deactivation are blocked during runs; inactive constraints stay in old snapshots and survive restart',async t=>{
  const fake=new FakeRuntime(events()),f=await fixture(t,fake);
  const added=f.runtimeService.intervene(f.workspaceId,f.task.id,constraint(f)); const first=await initial(f);
  const before=f.storage.tasks.getRun(f.workspaceId,f.task.id,first.stageRunId).inputSnapshot;
  const running=f.runtimeService.intervene(f.workspaceId,f.task.id,challenge(f)).run!;
  assert.throws(()=>f.runtimeService.intervene(f.workspaceId,f.task.id,constraint(f)),{code:'CONFLICT'});
  assert.throws(()=>f.storage.tasks.interventions.deactivate(f.workspaceId,f.task.id,added.intervention.constraintId!,guard(f)),{code:'CONFLICT'});
  assert.throws(()=>f.storage.tasks.artifacts.selectContext(f.workspaceId,f.task.id,[]),{code:'CONFLICT'});
  await finished(f,running.id);
  f.storage.tasks.interventions.deactivate(f.workspaceId,f.task.id,added.intervention.constraintId!,guard(f));
  assert.equal(reports(f)[0]!.freshness,'stale'); assert.equal(f.storage.tasks.interventions.constraints(f.workspaceId,f.task.id)[0]!.active,false);
  assert.deepEqual(f.storage.tasks.getRun(f.workspaceId,f.task.id,first.stageRunId).inputSnapshot,before);
  const next=await initial(f); assert.equal(fake.requests.at(-1)!.contextManifest.constraints.length,0); assert.equal(next.freshness,'fresh');
  // Persist an interrupted challenge without spending another model call.
  const pendingInput=challenge(f);
  const pending=f.storage.tasks.createRun(f.workspaceId,f.task.id,{stage:'investigation',modelProfileId:null,promptVersion:'investigation-v2',schemaVersion:'investigation-v1',challenge:pendingInput});
  const dataRoot=f.storage.paths.root; await f.runtimeService.close(); await f.service.close(); await f.repositories.close(); f.storage.close();
  const reopened=openStorage({dataRoot});
  try {
    assert.equal(reopened.tasks.getRun(f.workspaceId,f.task.id,pending.id).error!.code,'INTERRUPTED');
    assert.equal(reopened.tasks.interventions.constraints(f.workspaceId,f.task.id)[0]!.active,false);
    assert.equal(reopened.tasks.interventions.history(f.workspaceId,f.task.id)[0]!.runStatus,'failed');
    assert.deepEqual(reopened.tasks.investigations.get(f.workspaceId,f.task.id,first.id).result,first.result);
  } finally { reopened.close(); }
});

test('challenge and run insertion is atomic; SQL freezes provenance and rejects foreign report ownership',async t=>{
  const f=await fixture(t,new FakeRuntime(events())); const first=await initial(f), db=new DatabaseSync(f.storage.paths.database);
  try {
    const count=Number(db.prepare('SELECT COUNT(*) AS n FROM stage_runs').get()!.n);
    db.exec("CREATE TRIGGER reject_challenge_run BEFORE INSERT ON stage_runs WHEN NEW.triggered_by_intervention_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'injected_run_insert_failure'); END;");
    assert.throws(()=>f.runtimeService.intervene(f.workspaceId,f.task.id,challenge(f)),/injected_run_insert_failure/);
    assert.equal(f.storage.tasks.interventions.history(f.workspaceId,f.task.id).length,0);
    assert.equal(Number(db.prepare('SELECT COUNT(*) AS n FROM stage_runs').get()!.n),count);
    db.exec('DROP TRIGGER reject_challenge_run');
    const submitted=f.runtimeService.intervene(f.workspaceId,f.task.id,challenge(f)); await finished(f,submitted.run!.id);
    assert.throws(()=>db.prepare('UPDATE stage_runs SET previous_version_id = NULL WHERE id = ?').run(submitted.run!.id),/immutable/);
    assert.throws(()=>db.prepare("UPDATE interventions SET text = 'Changed' WHERE id = ?").run(submitted.intervention.id),/intervention_immutable/);
    const other=f.storage.tasks.create(f.workspaceId,{title:'Other task',description:'Independent context.',repositoryIds:f.task.repositoryIds});
    assert.throws(()=>db.prepare("INSERT INTO stage_runs (id,task_id,ai_connection_id,stage,status,input_snapshot,created_at,previous_version_id) VALUES (?, ?, ?, 'investigation', 'queued', '{}', 'now', ?)").run(randomUUID(),other.id,f.storage.settings.getWorkspace(f.workspaceId).connection.id,first.id),/run_revision_owner_mismatch/);
    const foreign=f.storage.settings.createWorkspace({name:'Foreign',connection:{name:'CLI'}});
    assert.throws(()=>f.runtimeService.intervene(foreign.workspace.id,f.task.id,challenge(f)),{code:'NOT_FOUND'});
    assert.deepEqual(reports(f).find(r=>r.id===first.id)!.result,first.result);
  } finally { db.close(); }
});

test('persistent dependency invalidation reaches transitive domain fixtures, terminates cycles and stays within task ownership',async t=>{
  const f=await fixture(t,new FakeRuntime(events())); const report=await initial(f), db=new DatabaseSync(f.storage.paths.database);
  try {
    const dependencies: ResultDependency[]=[{upstreamId:report.rootCauseId,dependentId:'fixture-plan'},
      {upstreamId:'fixture-plan',dependentId:'fixture-implementation'}, {upstreamId:'fixture-implementation',dependentId:'fixture-plan'},
      {upstreamId:'unrelated-input',dependentId:'unrelated-result'}];
    for (const d of dependencies) db.prepare('INSERT INTO result_dependencies VALUES (?, ?, ?)').run(f.task.id,d.dependentId,d.upstreamId);
    const other=f.storage.tasks.create(f.workspaceId,{title:'Other task',description:'Independent context.',repositoryIds:f.task.repositoryIds});
    db.prepare('INSERT INTO result_dependencies VALUES (?, ?, ?)').run(other.id,'foreign-result',report.rootCauseId);
    f.runtimeService.intervene(f.workspaceId,f.task.id,constraint(f));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM result_invalidations WHERE task_id = ?').get(other.id)!.n,0);
    const invalidated=db.prepare('SELECT result_id FROM result_invalidations WHERE task_id = ? ORDER BY result_id').all(f.task.id).map(r=>String(r.result_id));
    assert.deepEqual(invalidated,[report.id,report.rootCauseId,'fixture-plan','fixture-implementation'].sort());
    assert.equal(reports(f)[0]!.freshness,'stale');
    const second=await initial(f); assert.equal(second.freshness,'fresh');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM result_dependencies WHERE task_id = ? AND dependent_id = ?').get(f.task.id,second.rootCauseId)!.n,1);
  } finally { db.close(); }
});

test('intervention API enforces supported actions, session/CSRF, limits, target ownership and model selection',async t=>{
  const fake=new FakeRuntime(events()),f=await fixture(t,fake); await initial(f);
  const route=`${f.base}/interventions`;
  assert.equal((await f.request(route,'POST',constraint(f),{cookie:''})).status,401);
  assert.equal((await f.request(route,'POST',constraint(f),{'x-aew-csrf':''})).status,403);
  for(const type of ['ask','add_context','override']) {
    const response=await f.request(route,'POST',{...constraint(f),type}); assert.equal(response.status,400);
    assert.equal((await response.json() as {error:{code:string}}).error.code,'UNSUPPORTED_ACTION');
  }
  assert.throws(()=>parseIntervention({...constraint(f),text:'x'.repeat(8193)}),{code:'INVALID_INPUT'});
  assert.throws(()=>parseIntervention({...constraint(f),requestId:'bad'}),{code:'INVALID_INPUT'});
  assert.equal((await f.request(route,'POST',{...challenge(f),targetReportId:randomUUID()})).status,409);
  assert.equal((await f.request(route,'POST',{...challenge(f),modelProfileId:randomUUID()})).status,404);
  assert.equal((await f.request(route,'POST',constraint(f))).status,201);
  const profile=f.storage.settings.createModelProfile(f.workspaceId,{name:'Revision',modelIdentifier:'selected-revision-model',reasoningEffort:'medium'});
  const response=await f.request(route,'POST',{...challenge(f),modelProfileId:profile.id}); assert.equal(response.status,202);
  const body=await response.json() as {run:StageRun}; await finished(f,body.run.id);
  assert.equal(fake.requests.at(-1)!.profile!.modelIdentifier,'selected-revision-model');
  assert.equal((await f.request(route)).status,200);
  assert.equal((await f.request(route,'GET',undefined,{cookie:''})).status,401);
  const id=f.storage.tasks.interventions.constraints(f.workspaceId,f.task.id)[0]!.id;
  assert.equal((await f.request(`${f.base}/constraints/${id}/deactivate`,'POST',guard(f))).status,201);
});

test('constraint limits and injected storage failures do not leave partial history or increment context',async t=>{
  const f=await fixture(t,new FakeRuntime(events())),db=new DatabaseSync(f.storage.paths.database);
  try {
    const before=f.storage.tasks.get(f.workspaceId,f.task.id).contextRevision;
    db.exec("CREATE TRIGGER reject_constraint BEFORE INSERT ON task_constraints BEGIN SELECT RAISE(ABORT, 'injected_constraint_failure'); END;");
    assert.throws(()=>f.runtimeService.intervene(f.workspaceId,f.task.id,constraint(f)),/injected_constraint_failure/);
    assert.equal(f.storage.tasks.interventions.history(f.workspaceId,f.task.id).length,0);
    assert.equal(f.storage.tasks.get(f.workspaceId,f.task.id).contextRevision,before);
    db.exec('DROP TRIGGER reject_constraint');
    for(let i=0;i<4;i++) f.runtimeService.intervene(f.workspaceId,f.task.id,constraint(f,'x'.repeat(8192)));
    assert.throws(()=>f.runtimeService.intervene(f.workspaceId,f.task.id,constraint(f,'overflow')),{code:'CONFLICT'});
    for(const c of f.storage.tasks.interventions.constraints(f.workspaceId,f.task.id)) f.storage.tasks.interventions.deactivate(f.workspaceId,f.task.id,c.id,guard(f));
    for(let i=0;i<32;i++) f.runtimeService.intervene(f.workspaceId,f.task.id,constraint(f,`Rule ${i}`));
    assert.throws(()=>f.runtimeService.intervene(f.workspaceId,f.task.id,constraint(f,'One too many')),{code:'CONFLICT'});
    assert.equal(f.storage.tasks.interventions.constraints(f.workspaceId,f.task.id).filter(c=>c.active).length,32);
  } finally { db.close(); }
});
