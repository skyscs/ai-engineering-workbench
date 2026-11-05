import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { preparedQuestionFixture, preparedQuestion, questionClient, deferred } from '../loredock-prepared-question-fixture.mjs';
import { AnswerWitnessStore } from '../../apps/loredock/dist/answer-witness-store.js';
import { questionPreparationLimits } from '../../apps/loredock/dist/question-preparation-types.js';
import { serializedQuestionReview } from '../../apps/loredock/dist/prepared-question-api.js';
import { createApp } from '../../apps/loredock/dist/app.js';
import { beforeQuestionApi } from '../../apps/loredock/tests/fixtures/prepared-question-api-reference/verify.mjs';

async function setup(t, options) { const s = await preparedQuestionFixture(options); t.after(() => s.close()); return { ...s, client: await questionClient(s.app()) }; }
const input = s => ({ requestId: randomUUID(), question: preparedQuestion, buildId: s.fixture.store.project().publishedBuildId });
async function ready(s) {
  const response = await s.client.request('/question-preparations', 'POST', input(s)); assert.equal(response.status, 202);
  const state = await response.json(); await s.preparations.idle();
  const reviewed = await s.client.request(`/question-preparations/${state.id}/review`); assert.equal(reviewed.status, 200);
  return reviewed.json();
}
const admission = preview => ({ requestId: randomUUID(), preparationId: preview.id, reviewedHash: preview.reviewedHash });

test('prepared routes stay disabled by default and enabled injection requires the actual catalog services', async t => {
  const s = await setup(t), app = s.app(false), client = await questionClient(app);
  assert.deepEqual(await (await client.request('/answers')).json(), s.answers.state());
  for (const [url, method, body] of [['/question-preparations', 'POST', input(s)], ['/question-preparations/' + randomUUID(), 'GET'],
    ['/prepared-answers', 'POST', { requestId: 'disabled', preparationId: randomUUID(), reviewedHash: '0'.repeat(64) }]])
    assert.equal((await client.request(url, method, body)).status, 404);
  assert.throws(() => createApp(s.fixture.catalog, { preparations: s.preparations }), error => error.code === 'INVALID_PREPARATION_OWNER');
  const other = await setup(t, { native: false });
  assert.throws(() => createApp(s.fixture.catalog, { answers: s.answers, preparations: other.preparations }), error => error.code === 'INVALID_PREPARATION_OWNER');
  assert.equal((await (await s.client.request('/answers')).json()).preparedQuestions, true); assert.equal(s.runtime.prepares, 0);
});

test('sessions, CSRF, origin, body limits and exact scalar keys protect all prepared operations', async t => {
  const s = await setup(t, { native: false }), id = randomUUID();
  const anonymous = await s.app().request('http://127.0.0.1:4244/api/question-preparations/' + id, { headers: { host: '127.0.0.1:4244' } });
  assert.equal(anonymous.status, 401);
  for (const headers of [{ 'x-loredock-csrf': 'wrong' }, { origin: 'https://foreign.invalid' }])
    assert.equal((await s.client.request('/question-preparations', 'POST', input(s), headers)).status, 403);
  assert.equal((await s.client.request('/question-preparations', 'POST', { ...input(s), question: 'x'.repeat(17000) })).status, 413);
  for (const extra of ['context', 'prompt', 'receipt', 'rootId', 'limits', 'model', 'connection'])
    assert.equal((await s.client.request('/question-preparations', 'POST', { ...input(s), [extra]: {} })).status, 400);
  for (const invalid of [{ ...input(s), buildId: randomUUID() }, { ...input(s), question: '雪'.repeat(667) }, { ...input(s), requestId: '../escape' }])
    assert([400, 409].includes((await s.client.request('/question-preparations', 'POST', invalid)).status));
  assert.equal((await s.client.request('/question-preparations/invalid/review')).status, 400);
  const preview = await ready(s), request = admission(preview);
  for (const extra of ['context', 'prompt', 'receipt', 'model', 'budget', 'question'])
    assert.equal((await s.client.request('/prepared-answers', 'POST', { ...request, [extra]: 'untrusted' })).status, 400);
  assert.equal((await s.client.request(`/question-preparations/${preview.id}/cancel`, 'POST', { context: {} })).status, 400);
  assert.equal(s.runtime.prepares, 0); assert.equal(s.fixture.store.one('SELECT count(*) n FROM answer_attempts').n, 0);
});

test('review is model-free without configuration and public responses exclude durable witness and prompt text', async t => {
  const s = await setup(t); s.fixture.store.run('DELETE FROM answer_settings'); const preview = await ready(s);
  assert(preview.compact.item); assert.equal(preview.context.question, preparedQuestion);
  for (const key of ['witness', 'witnessJson', 'receipt', 'prompt', 'contextJson']) assert.equal(Object.hasOwn(preview, key), false);
  const status = await s.client.request(`/question-preparations/${preview.id}`);
  assert.equal(status.headers.get('cache-control'), 'no-store'); assert.equal(status.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(Object.hasOwn(await status.json(), 'context'), false);
  const response = await s.client.request('/prepared-answers', 'POST', admission(preview));
  assert.equal(response.status, 400); assert.equal((await response.json()).error.code, 'CONFIGURATION_REQUIRED');
  assert.equal(s.preparations.get(preview.id).status, 'ready'); assert.equal(s.runtime.prepares, 0);
  assert.throws(() => serializedQuestionReview({ ...preview, extra: 'x'.repeat(1024 * 1024) }), error => error.code === 'QUESTION_RESPONSE_LIMIT');
});

test('protected admission dispatches the exact reviewed context once and history uses only original citations', async t => {
  const s = await setup(t), preview = await ready(s), request = admission(preview);
  const originalContext = JSON.stringify(preview.context), originalCompact = JSON.stringify(preview.compact); preview.context.question = 'Caller mutation.';
  const response = await s.client.request('/prepared-answers', 'POST', request); assert.equal(response.status, 202); const first = await response.json();
  await s.answers.idle(); const result = await (await s.client.request('/answers/' + first.id)).json();
  assert.equal(result.status, 'succeeded', result.reason); assert.equal(result.inputKind, 'prepared-question/1');
  assert.equal(JSON.stringify(result.context), originalContext); assert.equal(JSON.stringify(result.nativeContext), originalCompact);
  const snapshot = new AnswerWitnessStore(s.fixture.catalog).read(first.id), witness = JSON.parse(snapshot.witnessJson);
  assert.equal(s.runtime.requests[0].prompt, witness.prompt); assert.equal(s.runtime.calls, 1);
  const retry = await s.client.request('/prepared-answers', 'POST', request); assert.equal((await retry.json()).id, first.id); assert.equal(s.runtime.calls, 1);
  await s.answers.configure({ ...s.answers.configuration(), profile: 'changed' }); await ready(s);
  assert.equal((await (await s.client.request('/prepared-answers', 'POST', request)).json()).id, first.id);
  assert.equal((await s.client.request('/prepared-answers', 'POST', { ...request, reviewedHash: '0'.repeat(64) })).status, 409);
  const secondPreview = await ready(s); s.runtime.citation = secondPreview.compact.item.receiptHash;
  const bad = await (await s.client.request('/prepared-answers', 'POST', admission(secondPreview))).json(); await s.answers.idle();
  const rejected = await (await s.client.request('/answers/' + bad.id)).json(); assert.equal(rejected.status, 'failed'); assert.equal(rejected.answer, null);
  assert.equal(rejected.usage.outputTokens, 20);
});

test('active cancellation and ready expiry are explicit and never dispatch a model', async t => {
  const entered = deferred(), hold = deferred();
  const s = await setup(t, { checkpoint: async ({ stage }) => { if (stage === 'lexical') { entered.resolve(); await hold.promise; } } });
  const state = await (await s.client.request('/question-preparations', 'POST', input(s))).json(); await entered.promise;
  try {
    assert.equal((await s.client.request(`/question-preparations/${state.id}/review`)).status, 409);
    assert.equal((await (await s.client.request(`/question-preparations/${state.id}/cancel`, 'POST', {})).json()).status, 'cancelled');
  } finally { hold.resolve(); }
  await s.preparations.idle(); const preview = await ready(s), now = performance.now.bind(performance);
  t.mock.method(performance, 'now', () => now() + questionPreparationLimits.readyMs + 1);
  assert.equal((await (await s.client.request(`/question-preparations/${preview.id}`)).json()).status, 'expired'); t.mock.restoreAll();
  assert.equal((await s.client.request('/prepared-answers', 'POST', admission(preview))).status, 409); assert.equal(s.runtime.prepares, 0);
});

test('review/source changes invalidate prepared routes and revocation hides saved compact content', async t => {
  const s = await setup(t), preview = await ready(s); s.fixture.store.run('UPDATE project SET correctionRevision=correctionRevision+1');
  assert.equal((await (await s.client.request(`/question-preparations/${preview.id}`)).json()).status, 'fenced');
  assert.equal((await s.client.request(`/question-preparations/${preview.id}/review`)).status, 409);
  assert.equal((await s.client.request('/prepared-answers', 'POST', admission(preview))).status, 409);
  const current = await ready(s), first = await (await s.client.request('/prepared-answers', 'POST', admission(current))).json(); await s.answers.idle();
  const dependency = s.fixture.store.one('SELECT sourceId FROM answer_sources WHERE answerId=?', first.id); s.fixture.catalog.revoke(dependency.sourceId);
  const fenced = await (await s.client.request('/answers/' + first.id)).json();
  assert.equal(fenced.status, 'fenced'); assert.equal(fenced.context, null); assert.equal(fenced.nativeContext, null); assert.equal(fenced.answer, null);
});

test('capacity refusal at the public admission boundary leaves reviewed context ready', async t => {
  const s = await setup(t, { native: false }), preview = await ready(s); let snapshot;
  assert.throws(() => s.preparations.promote(preview.id, preview.reviewedHash, value => { snapshot = value; throw new Error('Keep Ready.'); }), /Keep Ready/);
  const storage = new AnswerWitnessStore(s.fixture.catalog);
  for (let i = 0; i < 64; i++) { const id = randomUUID(); storage.create({ id, requestId: id, preparationId: preview.id,
    connection: s.answers.configuration(), model: 'gpt-5.6-terra', effort: 'medium' }, snapshot); s.fixture.store.run("UPDATE answer_attempts SET status='failed' WHERE id=?", id); }
  const response = await s.client.request('/prepared-answers', 'POST', admission(preview)); assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'ANSWER_WITNESS_LIMIT');
  assert.equal((await (await s.client.request(`/question-preparations/${preview.id}`)).json()).status, 'ready'); assert.equal(s.runtime.prepares, 0);
});

test('restart replays a committed public request and startup refuses standalone experimental enablement', async t => {
  const s = await preparedQuestionFixture({ native: false }); t.after(() => s.close());
  const client = await questionClient(s.app()), preview = await ready({ ...s, client }), request = admission(preview);
  const first = await (await client.request('/prepared-answers', 'POST', request)).json(); await s.answers.idle();
  await s.restart(); const reopened = await questionClient(s.app()); s.fixture.store.run('DELETE FROM answer_settings');
  assert.equal((await (await reopened.request('/prepared-answers', 'POST', request)).json()).id, first.id); assert.equal(s.runtime.calls, 1);
  const target = path.join(s.parent, 'must-not-create'), child = spawnSync(process.execPath, ['apps/loredock/dist/index.js'], {
    cwd: new URL('../../', import.meta.url), encoding: 'utf8', timeout: 10000,
    env: { ...process.env, LOREDOCK_PREPARED_ANSWERS: '1', LOREDOCK_ANSWERS: '0', LOREDOCK_DATA_DIR: target } });
  assert.equal(child.status, 1); assert.match(child.stderr, /requires LOREDOCK_ANSWERS=1/); await assert.rejects(access(target));
});

test('accepted application/browser sources and emitted controls change only through declared deltas', async () => {
  const root = new URL('../../', import.meta.url), manifest = JSON.parse(await readFile(new URL('apps/loredock/tests/fixtures/prepared-question-api-reference/manifest.json', root), 'utf8'));
  for (const [file, expected] of Object.entries(manifest.existingFiles)) {
    const raw = await beforeQuestionApi(file, await readFile(new URL(file, root)));
    assert.equal(raw.length, expected.bytes, file); assert.equal(createHash('sha256').update(raw).digest('hex'), expected.sha256, file);
  }
  assert.equal(createHash('sha256').update(await readFile(new URL('docs/loredock/PREPARED_QUESTION_API.md', root))).digest('hex'), manifest.publicContractSha256);
});
