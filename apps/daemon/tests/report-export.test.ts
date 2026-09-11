import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { renameSync } from 'node:fs';
import { test } from 'node:test';
import { FakeRuntime, type AIEvent } from '@aew/ai';
import { fixture, finished, goodEvents } from './runtime-fixture.js';

test('chosen report exports escaped prose, snapshot provenance, locators and honest source availability through the protected API', async t => {
  const events: AIEvent[] = [], fake = new FakeRuntime(events), f = await fixture(t, fake);
  const tree = f.storage.tasks.worktrees.list(f.workspaceId, f.task.id)[0]!;
  events.push(goodEvents[0]!, { type: 'result', data: {
    investigation: { summary: `Original <script>alert(1)</script> ![image](https://user:password@example.invalid)\n${f.root}/data\nC:\\Users\\alice\\secret.txt\npassword=secretvalue ghp_testfixture`, timeline: [] },
    rootCause: { status: 'identified', summary: 'Original conclusion.', evidenceIds: ['e1'], unresolvedQuestions: ['Which deployment?'] },
    evidence: [{ id:'e1',kind:'repository_file',description:'Pinned source.',repositoryId:tree.repositoryId,revision:tree.resolvedCommitSha,path:'file',lineStart:1,lineEnd:1,artifactId:null,sha256:null,byteStart:null,byteEnd:null }]
  }});
  const guard = () => ({ requestId: randomUUID(), expectedContextRevision: f.storage.tasks.get(f.workspaceId,f.task.id).contextRevision });
  f.runtimeService.intervene(f.workspaceId,f.task.id,{type:'constraint',text:'Preserve history.',...guard()});
  assert.equal((await finished(f,f.runtimeService.startInvestigation(f.workspaceId,f.task.id,{}).id)).status,'succeeded');
  const first = f.storage.tasks.investigations.list(f.workspaceId,f.task.id)[0]!;
  const revised = f.runtimeService.intervene(f.workspaceId,f.task.id,{type:'challenge',text:'Reconsider the deployment.',targetReportId:first.id,...guard()});
  assert.equal((await finished(f,revised.run!.id)).status,'succeeded');
  const second = f.storage.tasks.investigations.list(f.workspaceId,f.task.id)[0]!;
  const route = `${f.base}/investigations/${first.id}/export`;
  const response = await f.request(route); assert.equal(response.status,200);
  assert.match(response.headers.get('content-type')!,/text\/markdown/); assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('x-content-type-options'),'nosniff'); assert.match(response.headers.get('content-security-policy')!,/sandbox/);
  assert.equal(response.headers.get('content-disposition'),`attachment; filename="investigation-${first.id}-v1.md"`);
  const markdown = await response.text();
  assert.match(markdown, /version 1/); assert.match(markdown,/superseded/); assert.match(markdown,/Original conclusion/);
  assert.ok(markdown.includes(tree.resolvedCommitSha!)); assert.match(markdown,/Available; locator rechecked/);
  assert.match(markdown,/&lt;script&gt;/); assert.doesNotMatch(markdown,/<script>|https:|secretvalue|ghp_testfixture|C:\\Users/);
  assert.ok(!markdown.includes(f.root)); assert.doesNotMatch(markdown,/configurationFingerprint|fake-v1.*\/fixture/);
  assert.match(markdown,/Preserve history/); assert.match(markdown,/fake\\-v1/);
  const revision = await (await f.request(`${f.base}/investigations/${second.id}/export`)).text();
  assert.match(revision,/Triggering challenge/); assert.match(revision,/Reconsider the deployment/);
  assert.ok(revision.includes(first.id.replaceAll('-', '\\-'))); assert.ok(revision.includes(revised.intervention.id.replaceAll('-', '\\-')));
  assert.equal((await f.request(route,'GET',undefined,{cookie:''})).status,401);
  assert.equal((await f.request(route,'GET',undefined,{origin:'https://evil.example'})).status,403);
  const foreign = f.storage.settings.createWorkspace({name:'Other',connection:{name:'Other'}}).workspace.id;
  assert.equal((await f.request(route.replace(f.workspaceId,foreign))).status,404);
  assert.equal((await f.request(`${f.base}/investigations/${randomUUID()}/export`)).status,404);
  renameSync(tree.sourcePath!,`${tree.sourcePath!}-unavailable`);
  try {
    const unavailable = await (await f.request(route)).text();
    assert.match(unavailable,/Unavailable or busy/); assert.doesNotMatch(unavailable,/Available; locator rechecked/);
    assert.deepEqual(f.storage.tasks.investigations.get(f.workspaceId,f.task.id,first.id).result,first.result);
  } finally { renameSync(`${tree.sourcePath!}-unavailable`,tree.sourcePath!); }
  assert.equal(fake.requests.length,2);
});
