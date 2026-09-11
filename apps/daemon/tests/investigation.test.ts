import assert from 'node:assert/strict';
import { chmodSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { FakeRuntime, type AIEvent } from '@aew/ai';
import type { Evidence, InvestigationResult } from '@aew/core';
import { validateInvestigation } from '@aew/workflow';
import { openStorage } from '@aew/storage';
import { fixture, finished, goodEvents } from './runtime-fixture.js';

type Fixture = Awaited<ReturnType<typeof fixture>>;
function fileEvidence(f: Fixture): Evidence {
  const tree = f.storage.tasks.worktrees.list(f.workspaceId, f.task.id)[0]!;
  return { id: 'e1', kind: 'repository_file', description: 'Pinned source.', repositoryId: tree.repositoryId,
    revision: tree.resolvedCommitSha, path: 'file', lineStart: 1, lineEnd: 1,
    artifactId: null, sha256: null, byteStart: null, byteEnd: null };
}
function result(evidence: Evidence[]): InvestigationResult {
  const ids = evidence.map(e => e.id);
  return { investigation: { summary: 'Historical analysis.', timeline: [{ description: 'The pinned source demonstrates the behavior.', evidenceIds: ids }] },
    rootCause: { status: 'identified', summary: 'The recorded source explains the regression.', evidenceIds: ids, unresolvedQuestions: [] }, evidence };
}
function output(events: AIEvent[], value: unknown) {
  events.splice(0, events.length, goodEvents[0]!, { type: 'result', data: value });
}
async function run(f: Fixture) {
  const run = f.runtimeService.startInvestigation(f.workspaceId, f.task.id, {});
  return finished(f, run.id);
}

test('investigation publishes one immutable pair, reads pinned evidence, versions and preserves old reports across retry and context edits', async t => {
  const events: AIEvent[] = [], fake = new FakeRuntime(events), f = await fixture(t, fake, 2);
  output(events, result([fileEvidence(f)]));
  const started = f.runtimeService.startInvestigation(f.workspaceId, f.task.id, {});
  assert.equal(f.storage.tasks.get(f.workspaceId, f.task.id).status, 'INVESTIGATING');
  assert.equal((await finished(f, started.id)).status, 'succeeded');
  assert.equal(f.storage.tasks.get(f.workspaceId, f.task.id).status, 'ROOT_CAUSE_READY');
  const first = f.storage.tasks.investigations.list(f.workspaceId, f.task.id)[0]!;
  assert.equal(first.version, 1); assert.notEqual(first.rootCauseId, first.id); assert.equal(first.stageRunId, started.id);
  assert.equal(first.freshness, 'fresh'); assert.equal(first.status, 'active');
  const source = await f.runtimeService.readEvidence(f.workspaceId, f.task.id, first.id, 'e1');
  assert.equal(source.text, '1: committed'); assert.doesNotMatch(source.text, /dirty/);
  assert.match(fake.requests[0]!.instructions, /Do not implement/); assert.match(fake.requests[0]!.instructions, /"constraints":\[\]/);
  assert.equal(fake.requests[0]!.outputSchemaVersion, 'investigation-v1');
  assert.equal((await run(f)).status, 'succeeded');
  const reports = f.storage.tasks.investigations.list(f.workspaceId, f.task.id);
  assert.equal(reports.length, 2); assert.equal(reports[0]!.version, 2); assert.equal(reports[1]!.status, 'superseded');
  assert.deepEqual(reports[1]!.result, first.result);
  f.storage.tasks.artifacts.selectContext(f.workspaceId, f.task.id, []);
  assert.equal(f.storage.tasks.investigations.get(f.workspaceId, f.task.id, first.id).freshness, 'stale');
  const db = new DatabaseSync(f.storage.paths.database);
  try {
    assert.throws(() => db.prepare('UPDATE investigation_reports SET result_json = ? WHERE id = ?').run('{}', first.id), /investigation_report_immutable/);
    assert.throws(() => db.prepare('DELETE FROM investigation_reports WHERE id = ?').run(first.id), /investigation_report_retained/);
  } finally { db.close(); }
  const interrupted = f.storage.tasks.createRun(f.workspaceId, f.task.id, {stage:'investigation', modelProfileId:null, promptVersion:'investigation-v1', schemaVersion:'investigation-v1'});
  f.storage.tasks.transitionRun(f.workspaceId, f.task.id, interrupted.id, 'running');
  assert.equal(f.storage.tasks.get(f.workspaceId, f.task.id).status, 'INVESTIGATING');
  await f.runtimeService.close(); await f.service.close(); await f.repositories.close(); f.storage.close();
  const reopened = openStorage({ dataRoot: path.join(f.root, 'data') });
  try {
    assert.equal(reopened.tasks.getRun(f.workspaceId, f.task.id, interrupted.id).error!.code, 'INTERRUPTED');
    assert.equal(reopened.tasks.get(f.workspaceId, f.task.id).status, 'ROOT_CAUSE_READY');
    assert.deepEqual(reopened.tasks.investigations.get(f.workspaceId, f.task.id, first.id).result, first.result); }
  finally { reopened.close(); }
});

test('malformed pairs and missing or fabricated evidence fail without replacing a successful report', async t => {
  const events: AIEvent[] = [], f = await fixture(t, new FakeRuntime(events));
  const valid = result([fileEvidence(f)]); output(events, valid); assert.equal((await run(f)).status, 'succeeded');
  const first = f.storage.tasks.investigations.list(f.workspaceId, f.task.id)[0]!;
  const mutations: unknown[] = [ {}, { ...valid, rootCause: { ...valid.rootCause, evidenceIds: [] } },
    { ...valid, evidence: [valid.evidence[0]!, valid.evidence[0]!] },
    { ...valid, rootCause: { ...valid.rootCause, evidenceIds: ['unknown'] } },
    ...[{ path: '../file' }, { path: '/etc/passwd' }, { path: 'missing' }, { lineEnd: 2 },
      { repositoryId: 'foreign' }, { revision: 'f'.repeat(40) }, { revision: 'HEAD' }].map(change => result([{ ...fileEvidence(f), ...change }])) ];
  for (const value of mutations) {
    output(events, value); const failed = await run(f); assert.equal(failed.status, 'failed');
    assert.ok(['INVALID_RESULT', 'INVALID_EVIDENCE'].includes(failed.error!.code));
    assert.equal(f.storage.tasks.journal.detail(f.workspaceId, f.task.id, failed.id).result, null);
    assert.deepEqual(f.storage.tasks.investigations.list(f.workspaceId, f.task.id), [first]);
    assert.equal(f.storage.tasks.get(f.workspaceId, f.task.id).status, 'ROOT_CAUSE_READY');
  }
});

test('insufficient evidence is an explicit successful conclusion; questions and evidence requirements are validated', async t => {
  const value: InvestigationResult = { investigation: { summary: 'History is insufficient.', timeline: [] },
    rootCause: { status: 'insufficient_evidence', summary: 'No concrete cause is supported.', evidenceIds: [], unresolvedQuestions: ['Which revision first failed?'] }, evidence: [] };
  assert.equal(validateInvestigation(value), true);
  assert.equal(validateInvestigation({ ...value, rootCause: { ...value.rootCause, unresolvedQuestions: [] } }), false);
  const events: AIEvent[] = [], f = await fixture(t, new FakeRuntime(events)); output(events, value);
  assert.equal((await run(f)).status, 'succeeded');
  assert.equal(f.storage.tasks.investigations.list(f.workspaceId, f.task.id)[0]!.result.rootCause.status, 'insufficient_evidence');
});

test('publication rollback and cancellation preserve the previous pair and terminal task state', async t => {
  const events: AIEvent[] = [], f = await fixture(t, new FakeRuntime(events)); output(events, result([fileEvidence(f)]));
  assert.equal((await run(f)).status, 'succeeded');
  const first = f.storage.tasks.investigations.list(f.workspaceId, f.task.id)[0]!;
  const db = new DatabaseSync(f.storage.paths.database);
  try {
    // Fail after inserting the report, proving the pair/output/success transaction rolls back.
    db.exec("CREATE TRIGGER reject_output BEFORE UPDATE OF result_json ON run_execution BEGIN SELECT RAISE(ABORT, 'injected_disk_failure'); END;");
    const failed = await run(f); assert.equal(failed.status, 'failed');
    assert.equal(f.storage.tasks.journal.detail(f.workspaceId, f.task.id, failed.id).result, null);
    assert.deepEqual(f.storage.tasks.investigations.list(f.workspaceId, f.task.id), [first]);
    db.exec('DROP TRIGGER reject_output');
  } finally { db.close(); }
  const cancelled = f.runtimeService.startInvestigation(f.workspaceId, f.task.id, {});
  f.runtimeService.cancel(f.workspaceId, f.task.id, cancelled.id);
  assert.equal((await finished(f, cancelled.id)).status, 'cancelled');
  assert.deepEqual(f.storage.tasks.investigations.list(f.workspaceId, f.task.id), [first]);
  assert.equal(f.storage.tasks.get(f.workspaceId, f.task.id).status, 'ROOT_CAUSE_READY');
});

test('artifact evidence stays within the supplied UTF-8 selection and rejects changed, excluded or foreign bytes', async t => {
  const events: AIEvent[] = [], fake = new FakeRuntime(events), f = await fixture(t, fake);
  const bytes = Buffer.from('prefix|café|suffix');
  const artifact = await f.storage.tasks.artifacts.import(f.workspaceId, f.task.id, {name:'trace.log', mimeType:'text/plain', size:bytes.length},
    new ReadableStream({start(c){ c.enqueue(bytes); c.close(); }}));
  const pdf = await f.storage.tasks.artifacts.import(f.workspaceId, f.task.id, {name:'report.pdf', mimeType:'application/pdf', size:bytes.length},
    new ReadableStream({start(c){ c.enqueue(bytes); c.close(); }}));
  f.storage.tasks.artifacts.selectContext(f.workspaceId, f.task.id, [{artifactId:artifact.id,start:7,end:12}]);
  const evidence: Evidence = { id:'log', kind:'artifact', description:'Supplied log.', repositoryId:null,revision:null,path:null,lineStart:null,lineEnd:null,
    artifactId:artifact.id,sha256:artifact.sha256,byteStart:7,byteEnd:12 };
  output(events,result([evidence])); assert.equal((await run(f)).status,'succeeded');
  const report = f.storage.tasks.investigations.list(f.workspaceId, f.task.id)[0]!;
  assert.equal((await f.runtimeService.readEvidence(f.workspaceId,f.task.id,report.id,'log')).text,'café');
  assert.match(fake.requests[0]!.instructions,/Not analyzed in v0.1/);
  for (const change of [{byteStart:0}, {byteEnd:11}, {sha256:'0'.repeat(64)}, {artifactId:pdf.id}, {artifactId:'foreign'}]) {
    output(events,result([{...evidence,...change}])); assert.equal((await run(f)).status,'failed');
  }
  // Changing the current selection does not change historical evidence access.
  f.storage.tasks.artifacts.selectContext(f.workspaceId,f.task.id,[]);
  assert.equal((await f.runtimeService.readEvidence(f.workspaceId,f.task.id,report.id,'log')).text,'café');
  const stored = path.join(f.storage.paths.tasks,f.task.id,'artifacts',artifact.id);
  chmodSync(stored, 0o600); writeFileSync(stored,Buffer.alloc(bytes.length,120));
  await assert.rejects(f.runtimeService.readEvidence(f.workspaceId,f.task.id,report.id,'log'),/hash/);
});

test('investigation API protects report ownership and evidence routes and supports existing run SSE', async t => {
  const events: AIEvent[] = [], f = await fixture(t,new FakeRuntime(events)); output(events,result([fileEvidence(f)]));
  const route=`${f.base}/investigations`;
  assert.equal((await f.request(route,'POST',{}, {cookie:''})).status,401);
  assert.equal((await f.request(route,'POST',{}, {'x-aew-csrf':''})).status,403);
  assert.equal((await f.request(route,'POST',{instructions:'injected'})).status,400);
  const response=await f.request(route,'POST',{}); assert.equal(response.status,202);
  const started=await response.json() as {id:string}; assert.equal((await finished(f,started.id)).status,'succeeded');
  const body=await (await f.request(route)).json() as {reports:{id:string}[]}; const id=body.reports[0]!.id;
  assert.equal((await f.request(`${route}/${id}`)).status,200);
  assert.equal((await f.request(`${route}/${id}/evidence/e1`)).status,200);
  assert.equal((await f.request(`${route}/${id}/evidence/unknown`)).status,404);
  assert.equal((await f.request(`${route}/${id}/evidence/e1`,'GET',undefined,{cookie:''})).status,401);
  const other=f.storage.settings.createWorkspace({name:'Other',connection:{name:'CLI'}});
  assert.equal((await f.request(`/api/workspaces/${other.workspace.id}/tasks/${f.task.id}/investigations/${id}`)).status,404);
  assert.match(await (await f.request(`${f.base}/runtime-runs/${started.id}/events`)).text(),/event: complete/);
});

test('history evidence is anchored to the pin, survives cleanup and rejects future commits, links, binary files and changed pins', async t => {
  const events: AIEvent[] = [], f = await fixture(t, new FakeRuntime(events), 1, true);
  const file = fileEvidence(f), tree = f.storage.tasks.worktrees.list(f.workspaceId, f.task.id)[0]!;
  const parent = f.git(['rev-parse', `${file.revision}^`], tree.sourcePath!);
  const ancestor: Evidence = { ...file, revision: parent };
  const commit: Evidence = { ...ancestor, id:'commit', kind:'git_commit', path:null, lineStart:null, lineEnd:null };
  output(events, result([ancestor, commit])); assert.equal((await run(f)).status, 'succeeded');
  const report = f.storage.tasks.investigations.list(f.workspaceId, f.task.id)[0]!;
  assert.match((await f.runtimeService.readEvidence(f.workspaceId, f.task.id, report.id, 'commit')).text, new RegExp(parent));
  const future = f.git(['commit-tree', `${file.revision}^{tree}`, '-p', file.revision!, '-m', 'Future revision'], tree.sourcePath!);
  for (const change of [{revision:future}, {path:'linked'}, {path:'binary'}]) {
    output(events, result([{...file,...change}])); const failed=await run(f);
    assert.equal(failed.status,'failed'); assert.equal(failed.error!.code,'INVALID_EVIDENCE');
  }
  // Reading evidence uses pinned Git objects, so worktree removal cannot redirect it.
  const cleanup = f.service.start(f.workspaceId, f.task.id, tree.repositoryId);
  assert.equal((await finished(f, cleanup.id)).status, 'succeeded');
  assert.equal((await f.runtimeService.readEvidence(f.workspaceId, f.task.id, report.id, 'e1')).text, '1: committed');
  f.git(['update-ref', tree.managedPinRef!, future], tree.sourcePath!);
  await assert.rejects(f.runtimeService.readEvidence(f.workspaceId, f.task.id, report.id, 'e1'), /pin changed/);
});
