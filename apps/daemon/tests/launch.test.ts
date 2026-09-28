import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { FakeRuntime, RuntimeError, type AIEvent } from '@aew/ai';
import { LaunchService } from '../src/launch-service.js';
import { createApp } from '../src/app.js';
import { fixture, goodEvents } from './runtime-fixture.js';
const result: AIEvent = { type: 'result', data: { investigation: { summary: 'Insufficient fixture evidence.', timeline: [] }, rootCause: { status: 'insufficient_evidence', summary: 'More evidence is needed.', evidenceIds: [], unresolvedQuestions: ['Which change caused this?'] }, evidence: [] } };

test('one launch saves full text, prepares current HEAD, preserves dirty checkout and publishes once despite duplicate requests', async t => {
  const fake = new FakeRuntime([goodEvents[0]!, result]), f = await fixture(t, fake);
  const launch = new LaunchService(f.storage, f.repositories, f.service, f.runtimeService, async () => {});
  t.after(() => launch.close());
  const source = f.repositories.get(f.workspaceId, f.task.repositoryIds[0]!).localPath;
  writeFileSync(path.join(source, 'file'), 'new committed'); f.git(['add', '.'], source); f.git(['commit', '-m', 'New committed fixture'], source);
  const head = f.git(['rev-parse', 'HEAD'], source); writeFileSync(path.join(source, 'file'), 'uncommitted text');
  let draft = f.storage.drafts.create(randomUUID());
  draft = f.storage.drafts.save(draft.id, 0, { ...draft.input, workspaceId: f.workspaceId, source, description: 'Explain this regression.' });
  draft = f.storage.drafts.putFile(draft.id, randomUUID(), 'trace.log', Buffer.from('Included café log'));
  const excluded = randomUUID(); draft = f.storage.drafts.putFile(draft.id, excluded, 'other.log', Buffer.from('Excluded diagnostic'));
  draft = f.storage.drafts.changeFile(draft.id, excluded, false);
  const id = randomUUID(); launch.start(draft.id, id, draft.revision); launch.start(draft.id, id, draft.revision);
  await launch.wait(id);
  assert.equal(f.storage.drafts.operation(id).state, 'succeeded', f.storage.drafts.operation(id).message);
  assert.equal(fake.requests.length, 1); assert.match(fake.requests[0]!.instructions, /Included café log/); assert.doesNotMatch(fake.requests[0]!.instructions, /Excluded diagnostic/);
  assert.equal(f.storage.tasks.worktrees.list(f.workspaceId, draft.id)[0]!.resolvedCommitSha, head);
  assert.equal(readFileSync(path.join(source, 'file'), 'utf8'), 'uncommitted text');
  launch.start(draft.id, id, draft.revision); assert.equal(fake.requests.length, 1);
  const retry = randomUUID(); launch.start(draft.id, retry, draft.revision); await launch.wait(retry);
  assert.equal(f.storage.drafts.operation(retry).state, 'succeeded');
  assert.equal(f.storage.tasks.artifacts.context(f.workspaceId, draft.id).entries.length, 2);
  const reports = f.storage.tasks.investigations.list(f.workspaceId, draft.id);
  assert.equal(reports.length, 2); assert.equal(reports[1]!.freshness, 'fresh');
  f.storage.tasks.artifacts.selectContext(f.workspaceId, draft.id, []);
  const afterEdit = randomUUID(); launch.start(draft.id, afterEdit, draft.revision); await launch.wait(afterEdit);
  assert.equal(f.storage.drafts.operation(afterEdit).state, 'succeeded');
  assert.doesNotMatch(fake.requests[2]!.instructions, /Included café log/);
});
test('preflight failure leaves the draft editable and setup unlocked; cancellation during checking never invokes a model', async t => {
  const fake = new FakeRuntime([goodEvents[0]!, result]), f = await fixture(t, fake);
  const w = f.storage.settings.createWorkspace({ name: 'Unchecked setup', connection: { name: 'Fixture', configHome: f.root } }).workspace.id;
  let checks = 0;
  const launch = new LaunchService(f.storage, f.repositories, f.service, f.runtimeService, async (_connection, signal) => {
    if (++checks === 1) throw new RuntimeError('PROCESS_FAILED', 'Fixture setup failed.');
    await new Promise<void>(resolve => { if (signal.aborted) resolve(); else signal.addEventListener('abort', () => resolve(), { once: true }); });
  });
  t.after(() => launch.close());
  let draft = f.storage.drafts.create(randomUUID()); draft = f.storage.drafts.save(draft.id, 0, { ...draft.input, workspaceId: w, source: f.root, description: 'Problem.' });
  const first = randomUUID(); launch.start(draft.id, first, draft.revision); await launch.wait(first);
  assert.equal(f.storage.drafts.operation(first).state, 'failed'); assert.equal(f.storage.settings.getWorkspace(w).workspace.boundaryLocked, false);
  assert.equal(f.storage.drafts.get(draft.id).taskId, null);
  const second = randomUUID(); launch.start(draft.id, second, draft.revision); await new Promise(resolve => setImmediate(resolve)); launch.cancel(second); await launch.wait(second);
  assert.equal(f.storage.drafts.operation(second).state, 'cancelled'); assert.equal(fake.requests.length, 0);
});
test('adopting an existing task keeps advanced artifact selections and APIs enforce browser protections', async t => {
  const fake = new FakeRuntime([goodEvents[0]!, result]), f = await fixture(t, fake);
  const launch = new LaunchService(f.storage, f.repositories, f.service, f.runtimeService, async () => {});
  t.after(() => launch.close());
  const body = Buffer.from('prefix|selected text|suffix');
  const file = await f.storage.tasks.artifacts.import(f.workspaceId, f.task.id, { name: 'original.log', mimeType: 'text/plain', size: body.length }, new ReadableStream({ start(c) { c.enqueue(body); c.close(); } }));
  f.storage.tasks.artifacts.selectContext(f.workspaceId, f.task.id, [{ artifactId: file.id, start: 7, end: 20 }]);
  const draft = f.storage.drafts.adopt(f.task.id, { workspaceId: f.workspaceId, source: '', repositoryIds: f.task.repositoryIds, description: f.task.description, modelProfileId: null });
  const id = randomUUID(); launch.start(draft.id, id, draft.revision); await launch.wait(id);
  assert.equal(f.storage.drafts.operation(id).state, 'succeeded', f.storage.drafts.operation(id).message); assert.match(fake.requests[0]!.instructions, /selected text/); assert.doesNotMatch(fake.requests[0]!.instructions, /prefix|suffix/);
  const app = createApp({ launches: launch }), origin = 'http://127.0.0.1:4242';
  const session = await app.request(`${origin}/api/session`, { method: 'POST', headers: { host: '127.0.0.1:4242', origin, 'x-aew-client': 'web' } });
  const cookie = session.headers.get('set-cookie')!.split(';')[0]!, csrf = (await session.json() as { csrfToken: string }).csrfToken;
  const headers = { host: '127.0.0.1:4242', origin, cookie, 'x-aew-csrf': csrf, 'content-type': 'application/json' };
  const url = `${origin}/api/drafts`;
  assert.equal((await app.request(url, { headers: { ...headers, cookie: '' } })).status, 401);
  assert.equal((await app.request(url, { method: 'POST', headers: { ...headers, 'x-aew-csrf': '' }, body: '{}' })).status, 403);
  assert.equal((await app.request(url, { method: 'POST', headers, body: '{"id":"invalid"}' })).status, 400);
  assert.equal((await app.request(url, { method: 'POST', headers, body: JSON.stringify({ id: randomUUID() }) })).status, 201);
});

test('cancellation after preparation settles prevents the final model claim', async t => {
  const fake = new FakeRuntime([goodEvents[0]!, result]), f = await fixture(t, fake);
  const launch = new LaunchService(f.storage, f.repositories, f.service, f.runtimeService, async () => {});
  t.after(() => launch.close());
  let draft = f.storage.drafts.create(randomUUID());
  draft = f.storage.drafts.save(draft.id, 0, { ...draft.input, workspaceId: f.workspaceId, repositoryIds: f.task.repositoryIds, description: 'Cancel before analysis.' });
  const id = randomUUID(), wait = f.service.wait.bind(f.service);
  f.service.wait = async runId => { await wait(runId); assert.equal(f.storage.drafts.operation(id).state, 'preparing'); launch.cancel(id); };
  launch.start(draft.id, id, draft.revision); await launch.wait(id);
  assert.equal(f.storage.drafts.operation(id).state, 'cancelled'); assert.equal(fake.requests.length, 0);
  assert.equal(f.storage.tasks.worktrees.list(f.workspaceId, draft.id)[0]!.status, 'ready');
});

test('reusing a managed URL fetches new remote commits only for a new investigation', async t => {
  const fake = new FakeRuntime([goodEvents[0]!, result]), f = await fixture(t, fake);
  const launch = new LaunchService(f.storage, f.repositories, f.service, f.runtimeService, async () => {});
  t.after(() => launch.close());
  const source = f.repositories.get(f.workspaceId, f.task.repositoryIds[0]!).localPath;
  const start = async () => {
    let draft = f.storage.drafts.create(randomUUID());
    draft = f.storage.drafts.save(draft.id, 0, { ...draft.input, workspaceId: f.workspaceId, source: new URL(`file://${source}`).href, description: 'Remote fixture.' });
    const id = randomUUID(); launch.start(draft.id, id, draft.revision); await launch.wait(id);
    assert.equal(f.storage.drafts.operation(id).state, 'succeeded', f.storage.drafts.operation(id).message);
    return f.storage.tasks.worktrees.list(f.workspaceId, draft.id)[0]!;
  };
  const first = await start(); f.git(['add', '.'], source); f.git(['commit', '-m', 'Remote update'], source);
  const next = await start(); assert.notEqual(next.resolvedCommitSha, first.resolvedCommitSha);
  assert.equal(next.resolvedCommitSha, f.git(['rev-parse', 'HEAD'], source));
});
