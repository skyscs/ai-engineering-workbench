import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { LoreDockServer } from '../../apps/loredock/dist/server.js';
import { ControlledRuntime } from '../loredock-controlled-server/runtime.mjs';
import { client, until } from '../loredock-controlled-server/http.mjs';
import { createLoreDockFixture } from '../loredock-fixture.mjs';

const question = 'Which local topic is configured?';
async function setup(t) {
  const fixture = await createLoreDockFixture(), owners = [], directory = path.join(fixture.root, 'data');
  t.after(async () => { for (const server of owners) await server.stop(); await rm(fixture.root, { recursive: true, force: true }); });
  async function open() {
    const evidence = path.join(fixture.root, 'runtime-' + owners.length); await mkdir(evidence);
    const runtime = new ControlledRuntime(evidence);
    const server = new LoreDockServer({ directory, port: 0, answers: true, preparedAnswers: true, textRuntime: runtime });
    owners.push(server);
    const port = await server.start(), api = await client(port);
    assert.equal(server.catalog.parser.snapshot().owner.state, 'ready');
    assert.equal(runtime.snapshot().prepares, 0);
    return { server, runtime, api, evidence };
  }
  const current = await open();
  for (const name of ['portal', 'order-api', 'order-worker']) {
    await current.api.json('/sources', 'POST', { path: path.join(fixture.root, 'sources', name) }, 201);
  }
  const project = await current.api.json('/project');
  const build = await current.api.json('/builds', 'POST', { requestId: randomUUID(), policyVersion: project.policyVersion, sourceSetVersion: project.sourceSetVersion }, 202);
  await until(async () => {
    const value = await current.api.json('/builds/' + build.id);
    assert(!['failed', 'cancelled', 'interrupted'].includes(value.status), value.reason);
    return ['completed', 'partial'].includes(value.status);
  }, 'Synthetic index did not finish.');
  await until(async () => {
    const value = await current.api.json('/code-analysis'); assert.equal(value.automaticError, null);
    return value.inventories.some(row => row.published && row.buildId === build.id);
  }, 'Synthetic analysis did not publish.');
  await current.api.json('/answers/configuration', 'PUT', { executable: process.execPath, configHome: fixture.root, profile: null });
  return { ...current, open, buildId: build.id };
}
async function dispatch(api, buildId) {
  const prepared = await api.json('/question-preparations', 'POST', { requestId: randomUUID(), question, buildId }, 202);
  await until(async () => {
    const value = await api.json('/question-preparations/' + prepared.id);
    assert(['preparing', 'ready'].includes(value.status), value.reason); return value.status === 'ready';
  }, 'Preparation did not become ready.');
  const review = await api.json('/question-preparations/' + prepared.id + '/review');
  const request = { requestId: randomUUID(), preparationId: review.id, reviewedHash: review.reviewedHash };
  const answer = await api.json('/prepared-answers', 'POST', request, 202);
  return { request, answer };
}
async function complete(api, runtime, id) {
  const answer = await until(async () => {
    const value = await api.json('/answers/' + id);
    assert(['preparing', 'running', 'succeeded'].includes(value.status), value.reason);
    return value.status === 'succeeded' ? value : false;
  }, 'Controlled answer did not succeed.');
  await until(() => !runtime.snapshot().active, 'Runtime did not close.');
  return answer;
}

for (const change of ['source', 'policy']) test(`the production server fences pending and saved answers after a ${change} change`, { timeout: 45000 }, async t => {
  const s = await setup(t), first = await dispatch(s.api, s.buildId);
  const saved = await complete(s.api, s.runtime, first.answer.id);
  s.runtime.hold('run'); const pending = await dispatch(s.api, s.buildId);
  await until(() => s.runtime.snapshot().waiting === 'run', 'Runtime hold was not reached.');
  if (change === 'source') {
    const cited = saved.context.spans.find(span => span.id === saved.answer.claims[0].evidenceIds[0]).sourceId;
    const uncited = saved.context.sources.find(source => source.sourceId !== cited);
    assert(uncited, 'The fixture must include an uncited input source.');
    await s.api.json('/sources/' + uncited.sourceId + '/revoke', 'POST', {});
  } else await s.api.json('/policy', 'PUT', { excludedPaths: ['README.md'] });
  await until(() => !s.runtime.snapshot().active, 'Fenced runtime did not close.');
  for (const id of [first.answer.id, pending.answer.id]) {
    const value = await s.api.json('/answers/' + id);
    assert.equal(value.status, 'fenced'); assert.equal(value.context, null);
    assert.equal(value.nativeContext, null); assert.equal(value.answer, null);
  }
  assert.equal((await s.api.json('/answers')).publishedAnswerId, null);
  assert.equal(s.runtime.snapshot().prepares, 2); assert.equal(s.runtime.snapshot().calls, 2);
  assert.equal(s.runtime.snapshot().closed, 2); assert.equal(s.runtime.snapshot().aborted, 1);
  assert.deepEqual((await readdir(s.evidence)).sort(), ['output-1.json', 'request-1.json', 'request-2.json']);
  await s.server.stop(); assert.equal(s.server.catalog.parser.snapshot().owner.owned, false);
});

test('a new production owner preserves actual interrupted history and dispatches only an explicit new attempt', { timeout: 45000 }, async t => {
  const s = await setup(t), first = await dispatch(s.api, s.buildId);
  const saved = await complete(s.api, s.runtime, first.answer.id);
  s.runtime.hold('run'); const pending = await dispatch(s.api, s.buildId);
  await until(() => s.runtime.snapshot().waiting === 'run', 'Runtime hold was not reached.');
  const before = await s.api.json('/answers/' + pending.answer.id);
  assert.equal(before.status, 'running'); assert(before.dispatchedAt);
  await s.server.stop(); assert.equal(s.server.catalog.parser.snapshot().owner.owned, false);
  assert.equal(s.runtime.snapshot().active, false); assert.equal(s.runtime.snapshot().closed, 2);
  const reopened = await s.open();
  const firstAgain = await reopened.api.json('/answers/' + first.answer.id);
  assert.equal(firstAgain.status, 'succeeded'); assert.deepEqual(firstAgain.context, saved.context);
  assert.deepEqual(firstAgain.nativeContext, saved.nativeContext); assert.deepEqual(firstAgain.answer, saved.answer);
  const interrupted = await reopened.api.json('/answers/' + pending.answer.id);
  assert.equal(interrupted.status, 'interrupted'); assert.equal(interrupted.answer, null);
  assert.deepEqual(interrupted.context, before.context); assert.deepEqual(interrupted.nativeContext, before.nativeContext);
  assert.equal(interrupted.dispatchedAt, before.dispatchedAt); assert.match(interrupted.usageUnknownReason, /unknown/i);
  const replay = await reopened.api.json('/prepared-answers', 'POST', pending.request, 202);
  assert.equal(replay.id, pending.answer.id); assert.equal(replay.status, 'interrupted');
  assert.equal(reopened.runtime.snapshot().prepares, 0); assert.equal(reopened.runtime.snapshot().calls, 0);
  const retry = await dispatch(reopened.api, s.buildId);
  assert.notEqual(retry.answer.id, pending.answer.id);
  await complete(reopened.api, reopened.runtime, retry.answer.id);
  assert.equal(reopened.runtime.snapshot().calls, 1); assert.equal(reopened.runtime.snapshot().closed, 1);
  assert.equal((await reopened.api.json('/answers/' + pending.answer.id)).status, 'interrupted');
  assert.deepEqual((await reopened.api.json('/answers/' + first.answer.id)).answer, saved.answer);
  assert.equal((await reopened.api.json('/answers')).publishedAnswerId, retry.answer.id);
});
