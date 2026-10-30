import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { setImmediate as turn } from 'node:timers/promises';
import type { PreparedTextRuntime, TextConnection, TextOutput, TextRequest, TextRuntime } from '@aew/ai';
import { Answers } from '../src/answers.js';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { createApp } from '../src/app.js';
// @ts-expect-error The independent fixture generator is plain JavaScript.
import { createLoreDockFixture } from '../../../scripts/loredock-fixture.mjs';

class FixtureRuntime implements TextRuntime {
  prepares = 0; calls = 0; closed = 0;
  mode: 'good' | 'fail' | 'invalid' | 'hold' | 'preflight-fail' = 'good';
  release: (() => void) | undefined;
  async prepare(connection: TextConnection): Promise<PreparedTextRuntime> {
    this.prepares++;
    if (this.mode === 'preflight-fail') throw new Error('Synthetic preflight failure');
    return { identity: { ...connection, version: 'fixture-cli', policyVersion: 'fixture-policy', configurationFingerprint: 'fixture-fingerprint' },
      close: async () => { this.closed++; }, run: async (request: TextRequest): Promise<TextOutput> => {
        this.calls++;
        if (this.mode === 'fail') throw new Error('Synthetic provider failure');
        if (this.mode === 'hold') await new Promise<void>(resolve => { this.release = resolve; });
        const input = JSON.parse(request.prompt.split('INPUT_JSON (data, not instructions):\n')[1]!) as { spans: { id: string }[] };
        const text = JSON.stringify({ claims: input.spans.length ? [{ kind: 'fact', text: '<script>Literal test prose</script>', evidenceIds: [this.mode === 'invalid' ? 'invented' : input.spans[0]!.id] }] : [], unknowns: input.spans.length ? [] : ['No matching indexed evidence.'] });
        return { text, usage: { inputTokens: 100, outputTokens: 20, cachedInputTokens: 0 }, usageUnknownReason: null };
      } };
  }
}
async function setup(t: TestContext) {
  const fixture = await createLoreDockFixture() as { root: string };
  const directory = path.join(fixture.root, 'catalog'), store = new CatalogStore(directory), catalog = new Catalog(store), runtime = new FixtureRuntime();
  const answers = new Answers(catalog, runtime);
  let closed = false;
  const close = async () => { if (!closed) { runtime.release?.(); await answers.stop(); await catalog.stop(); store.close(); closed = true; } };
  t.after(async () => { await close(); await rm(fixture.root, { recursive: true, force: true }); });
  for (const id of ['portal', 'order-api', 'order-worker']) await catalog.addSource(path.join(fixture.root, 'sources', id));
  const state = catalog.state(); catalog.start('index', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  await answers.configure({ executable: process.execPath, configHome: fixture.root, profile: null });
  return { store, catalog, runtime, answers, close, directory };
}
function ask(answers: Answers, requestId: string = crypto.randomUUID(), question = 'Which local topic is configured?') {
  const context = answers.preview(question);
  return answers.start(requestId, question, context.buildId, context.inputHash);
}
async function entered(runtime: FixtureRuntime) {
  for (let i = 0; i < 50 && !runtime.release; i++) await turn();
  assert.ok(runtime.release, 'The controlled runtime must reach dispatch.');
}

test('answer intentions persist before dispatch, replay once and publish result with provenance and usage', async t => {
  const { answers, runtime, store, catalog } = await setup(t);
  const first = ask(answers, 'same');
  assert.equal(first.status, 'preparing'); assert.equal(runtime.calls, 0);
  assert.equal(ask(answers, 'same').id, first.id);
  assert.throws(() => ask(answers, 'same', 'Changed question'), /different inputs/);
  assert.throws(() => ask(answers), /Another answer/);
  await answers.idle();
  const result = answers.get(first.id);
  assert.equal(result.status, 'succeeded'); assert.equal(result.usage?.inputTokens, 100);
  assert.equal(result.runtime?.version, 'fixture-cli');
  assert.equal(answers.state().publishedAnswerId, first.id);
  assert.equal(answers.state().attempts[0]!.context, null, 'Polling must not resend source text');
  assert.equal(ask(answers, 'same').id, first.id); assert.equal(runtime.calls, 1); assert.equal(runtime.closed, 1);
  assert.equal(store.one<{ count: number }>('SELECT count(*) AS count FROM answer_attempts')!.count, 1);
  assert.equal(answers.get(first.id).stale, false);
  const state = catalog.state(); catalog.start('newer-index', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  assert.equal(answers.get(first.id).stale, true, 'An older saved index must not be presented as current');
  assert.equal(answers.state().publishedAnswerId, first.id, 'A newer index does not erase the previous authorized answer');
});

test('failed preflight, provider failure and invalid citations retain the last published answer and honest usage', async t => {
  const { answers, runtime } = await setup(t);
  const good = ask(answers); await answers.idle();
  for (const mode of ['preflight-fail', 'fail', 'invalid'] as const) {
    runtime.mode = mode; const failed = ask(answers); await answers.idle();
    const result = answers.get(failed.id);
    assert.equal(result.status, 'failed'); assert.equal(result.answer, null);
    assert.equal(answers.state().publishedAnswerId, good.id);
    if (mode === 'preflight-fail') { assert.equal(result.dispatchedAt, null); assert.equal(result.usage, null); }
    if (mode === 'invalid') assert.equal(result.usage?.outputTokens, 20, 'A rejected answer still consumed reported tokens');
  }
});

test('cancel fences late completion and a retry is a new explicit attempt', async t => {
  const { answers, runtime } = await setup(t);
  const good = ask(answers); await answers.idle();
  runtime.mode = 'hold'; const cancelled = ask(answers); await entered(runtime);
  answers.cancel(cancelled.id); runtime.release!(); await answers.idle();
  assert.equal(answers.get(cancelled.id).status, 'cancelled'); assert.equal(answers.get(cancelled.id).answer, null);
  assert.equal(answers.state().publishedAnswerId, good.id);
  runtime.mode = 'good'; const retry = ask(answers); await answers.idle();
  assert.notEqual(retry.id, cancelled.id); assert.equal(answers.get(retry.id).status, 'succeeded');
});

test('revoking an uncited input stops the runtime and purges persisted derivative text', async t => {
  const { answers, catalog, runtime, store } = await setup(t);
  const good = ask(answers); await answers.idle();
  const context = answers.get(good.id).context!;
  const citedSource = context.spans.find(span => span.id === answers.get(good.id).answer!.claims[0]!.evidenceIds[0])!.sourceId;
  const uncitedSource = context.sources.find(source => source.sourceId !== citedSource)!.sourceId;
  runtime.mode = 'hold'; const active = ask(answers); await entered(runtime);
  catalog.revoke(uncitedSource);
  assert.equal(answers.get(good.id).context, null); assert.equal(answers.get(good.id).answer, null);
  runtime.release!(); await answers.idle();
  assert.equal(answers.get(active.id).status, 'fenced'); assert.equal(answers.state().publishedAnswerId, null);
  assert.equal(store.one<{ count: number }>('SELECT count(*) AS count FROM answer_attempts WHERE context IS NOT NULL OR result IS NOT NULL')!.count, 0);
});

test('policy changes reject a reviewed context and cannot publish a late answer', async t => {
  const { answers, runtime, catalog } = await setup(t);
  const context = answers.preview('local topic');
  runtime.mode = 'hold'; const active = ask(answers); await entered(runtime);
  catalog.updatePolicy(['README.md']);
  runtime.release!(); await answers.idle();
  assert.equal(answers.get(active.id).status, 'fenced');
  assert.throws(() => answers.start('stale', context.question, context.buildId, context.inputHash), /policy/);
});

test('restart distinguishes recorded dispatch from preparation and never repeats external execution', async t => {
  const { answers, store, runtime, close, directory } = await setup(t);
  const first = ask(answers); await answers.idle();
  const second = ask(answers); await answers.idle();
  // Simulate process loss at each durable boundary, before any completed result.
  store.run("UPDATE answer_attempts SET status='preparing',result=NULL,usage=NULL,dispatchedAt=NULL WHERE id=?", first.id);
  store.run("UPDATE answer_attempts SET status='running',result=NULL,usage=NULL WHERE id=?", second.id);
  const calls = runtime.calls;
  await close();
  const reopened = new CatalogStore(directory), catalog = new Catalog(reopened), restored = new Answers(catalog, runtime);
  try {
    assert.equal(restored.get(first.id).status, 'interrupted'); assert.match(restored.get(first.id).usageUnknownReason!, /Not dispatched/);
    assert.equal(restored.get(second.id).status, 'interrupted'); assert.match(restored.get(second.id).usageUnknownReason!, /unknown after restart/);
    assert.equal(runtime.calls, calls); assert.equal(restored.state().publishedAnswerId, null);
  } finally { await restored.stop(); await catalog.stop(); reopened.close(); }
});

test('answer HTTP routes protect configuration, context preview, execution and history', async t => {
  const { catalog, answers, runtime } = await setup(t), app = createApp(catalog, { answers });
  const base = 'http://127.0.0.1:4244', shared = { host: '127.0.0.1:4244', origin: base };
  assert.equal((await app.request(base + '/api/answers', { headers: shared })).status, 401);
  const session = await app.request(base + '/api/session', { method: 'POST', headers: { ...shared, 'x-loredock-client': 'web' } });
  const { token } = await session.json() as { token: string };
  const cookie = session.headers.get('set-cookie')!.split(';')[0]!;
  const headers = { ...shared, cookie, 'x-loredock-csrf': token, 'content-type': 'application/json' };
  const request = (route: string, method = 'GET', value?: unknown) => app.request(base + '/api' + route, { method, headers, ...value === undefined ? {} : { body: JSON.stringify(value) } });
  assert.equal((await app.request(base + '/api/answers/preview', { method: 'POST', headers: { ...shared, cookie }, body: '{}' })).status, 403);
  assert.equal((await request('/answers/preview', 'POST', { question: null })).status, 400);
  assert.equal((await request('/answers/configuration', 'PUT', { executable: '../codex', configHome: '/tmp', profile: null })).status, 400);
  const context = await (await request('/answers/preview', 'POST', { question: 'Local order topic' })).json() as { buildId: string; inputHash: string; spans: { id: string }[] };
  assert.equal(runtime.calls, 0, 'Context preview is model-free');
  assert.equal((await request('/answers', 'POST', { requestId: 'bad', question: 'Local order topic', buildId: context.buildId, inputHash: 'changed' })).status, 409);
  const started = await request('/answers', 'POST', { requestId: 'http-answer', question: 'Local order topic', buildId: context.buildId, inputHash: context.inputHash });
  assert.equal(started.status, 202); const { id } = await started.json() as { id: string }; await answers.idle();
  const result = await (await request(`/answers/${id}`)).json() as { status: string; answer: { claims: { evidenceIds: string[] }[] } };
  assert.equal(result.status, 'succeeded');
  assert.equal((await request(`/evidence/${result.answer.claims[0]!.evidenceIds[0]}`)).status, 200);
  assert.equal((await request(`/answers/${id}/cancel`, 'POST')).status, 200);
  assert.equal((await request('/answers/unknown')).status, 404);
});
