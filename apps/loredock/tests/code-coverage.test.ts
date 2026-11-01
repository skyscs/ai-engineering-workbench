import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { CodeAnalysisFollow } from '../src/code-analysis-follow.js';
import type { AnalysisFileSummary, AnalysisPayload, AnalysisSummary } from '../src/code-analysis-types.js';
import { createApp } from '../src/app.js';
// @ts-expect-error Owned fixture generation is plain JavaScript.
import { createLoreDockFixture } from '../../../scripts/loredock-fixture.mjs';

async function setup(t: TestContext) {
  const fixture = await createLoreDockFixture() as { root: string }, directory = path.join(fixture.root, 'coverage-data');
  const store = new CatalogStore(directory), catalog = new Catalog(store), analysis = new CodeAnalysis(catalog);
  for (const source of ['portal', 'order-api', 'order-worker']) await catalog.addSource(path.join(fixture.root, 'sources', source));
  const index = async (key: string) => { const state = catalog.state(), build = catalog.start(key, state.sourceSetVersion, state.policyVersion); await catalog.idle(); return build.id; };
  const initial = await index('initial'), follow = new CodeAnalysisFollow(analysis);
  t.after(async () => { follow.stop(); await analysis.stop(); await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  return { store, catalog, analysis, follow, index, initial };
}

test('new index publication starts one automatic inventory while existing indexes and stopped attempts stay explicit', async t => {
  const s = await setup(t); s.follow.tick(); assert.equal(s.analysis.list().length, 0);
  const build = await s.index('new'); s.follow.tick(); s.follow.tick(); await s.analysis.idle();
  assert.equal(s.analysis.list().length, 1); assert.equal(s.analysis.list()[0]!.buildId, build); assert.equal(s.analysis.list()[0]!.counts.parsed, 5);
  s.follow.tick(); assert.equal(s.analysis.list().length, 1);
  const manualBuild = await s.index('manual'), manual = s.analysis.start('manual', manualBuild);
  s.analysis.control(manual.id, 'pause'); await s.analysis.idle(); s.follow.tick();
  assert.equal(s.analysis.get(manual.id).status, 'paused'); assert.equal(s.follow.state().pendingBuildId, null);
  s.analysis.control(manual.id, 'resume'); await s.analysis.stop();
  assert.equal(s.analysis.get(manual.id).status, 'interrupted');
  const afterRestart = new CodeAnalysisFollow(s.analysis); afterRestart.tick(); assert.equal(s.analysis.get(manual.id).status, 'interrupted'); afterRestart.stop();
  const ids = s.analysis.list().map(run => run.id); s.follow.stop();
  await s.index('after-stop'); s.follow.tick(); assert.deepEqual(s.analysis.list().map(run => run.id), ids);
});

test('automatic inventory waits for active work, coalesces publications and discards stale source or policy scope', async t => {
  const s = await setup(t), second = await s.index('second'), third = await s.index('third');
  s.store.run('UPDATE project SET publishedBuildId=? WHERE id=1', s.initial);
  const active = s.analysis.start('active', s.initial);
  s.store.run('UPDATE project SET publishedBuildId=? WHERE id=1', second); s.follow.tick(); assert.equal(s.follow.state().pendingBuildId, second);
  s.store.run('UPDATE project SET publishedBuildId=? WHERE id=1', third); s.follow.tick(); assert.equal(s.follow.state().pendingBuildId, third);
  s.analysis.control(active.id, 'cancel'); await s.analysis.idle(); s.follow.tick(); await s.analysis.idle();
  assert.equal(s.analysis.list()[0]!.buildId, third); assert.ok(s.analysis.list().every(run => run.buildId !== second));
  const current = s.analysis.start('occupy', third);
  s.store.run('UPDATE project SET publishedBuildId=? WHERE id=1', second); s.follow.tick(); assert.equal(s.follow.state().pendingBuildId, second);
  s.catalog.revoke(s.catalog.state().sources[0]!.id); s.follow.tick(); await s.analysis.idle();
  assert.equal(s.follow.state().pendingBuildId, null); assert.equal(s.analysis.get(current.id).status, 'fenced');
  s.catalog.updatePolicy(['src']); s.follow.tick(); assert.equal(s.follow.state().pendingBuildId, null);
});

test('automatic start errors are visible without changing the source index or retrying', async t => {
  const s = await setup(t), build = await s.index('failure'), original = s.store.build(build);
  s.store.db.exec("CREATE TRIGGER reject_auto BEFORE INSERT ON code_analyses BEGIN SELECT RAISE(ABORT,'Synthetic start failure'); END;");
  s.follow.tick(); assert.match(s.follow.state().automaticError!.message, /Synthetic start failure/);
  assert.equal(s.follow.state().automaticError!.buildId, build); assert.equal(s.analysis.list().length, 0); assert.deepEqual(s.store.build(build), original);
  s.store.db.exec('DROP TRIGGER reject_auto'); s.follow.tick(); assert.equal(s.analysis.list().length, 0);
  const manual = s.analysis.start('retry-explicitly', build); await s.analysis.idle();
  assert.equal(s.analysis.get(manual.id).published, true); assert.equal(s.follow.state().automaticError, null);
  s.store.run("UPDATE project SET publishedBuildId='unavailable-index' WHERE id=1");
  assert.doesNotThrow(() => s.follow.tick()); assert.equal(s.follow.state().automaticError!.buildId, 'unavailable-index');
  assert.deepEqual(s.store.build(build), original);
});

test('code inventory HTTP boundaries protect lifecycle, scoped pages and original facts', async t => {
  const s = await setup(t), app = createApp(s.catalog, { codeAnalysis: s.analysis, codeFollow: s.follow }), base = 'http://127.0.0.1:4244';
  const raw = (route: string, init: RequestInit = {}) => app.request(base + '/api' + route, { ...init, headers: { host: '127.0.0.1:4244', ...init.headers } });
  assert.equal((await raw('/code-analysis')).status, 401);
  assert.equal((await raw('/code-analysis', { headers: { host: 'evil.invalid' } })).status, 403);
  assert.equal((await raw('/code-analysis', { headers: { origin: 'https://evil.invalid' } })).status, 403);
  const session = await raw('/session', { method: 'POST', headers: { origin: base, 'x-loredock-client': 'web' } });
  const cookie = session.headers.get('set-cookie')!.split(';')[0]!, token = (await session.json() as { token: string }).token;
  const headers = { cookie, origin: base, 'x-loredock-csrf': token, 'content-type': 'application/json' };
  const request = (route: string, method = 'GET', input?: unknown) => raw(route, { method, headers, ...input === undefined ? {} : { body: JSON.stringify(input) } });
  for (const route of ['/code-analysis', '/code-analysis/unknown/pause', '/code-analysis/unknown/resume', '/code-analysis/unknown/cancel']) {
    assert.equal((await raw(route, { method: 'POST', headers: { cookie, origin: base } })).status, 403);
  }
  const state = s.catalog.state(), input = { requestId: 'http', buildId: s.initial, policyVersion: state.policyVersion, sourceSetVersion: state.sourceSetVersion };
  for (const bad of [null, [], {}, { ...input, model: 'unexpected' }, { ...input, buildId: null }, { ...input, policyVersion: '1' }, { ...input, requestId: 'x'.repeat(101) }]) {
    assert.equal((await request('/code-analysis', 'POST', bad)).status, 400);
  }
  assert.equal((await request('/code-analysis', 'POST', { ...input, sourceSetVersion: 0 })).status, 409);
  assert.equal((await raw('/code-analysis', { method: 'POST', headers, body: 'x'.repeat(16385) })).status, 413);
  const started = await request('/code-analysis', 'POST', input); assert.equal(started.status, 202);
  const run = await started.json() as AnalysisSummary;
  assert.equal((await request(`/code-analysis/${run.id}/pause`, 'POST')).status, 200); await s.analysis.idle();
  assert.equal(s.analysis.get(run.id).status, 'paused');
  const page = await (await request(`/code-analysis/${run.id}/files`)).json() as { files: AnalysisFileSummary[]; limit: number };
  assert.equal(page.limit, 50); assert.equal(page.files.length, 5);
  assert.equal((await request(`/code-analysis/${run.id}/files/${page.files[0]!.fileId}`)).status, 409);
  for (const offset of ['', '-1', '1', '50', '0.0', 'null', '050', '1e2']) assert.equal((await request(`/code-analysis/${run.id}/files?offset=${offset}`)).status, 400);
  for (const bad of [[], null, { force: true }]) assert.equal((await request(`/code-analysis/${run.id}/resume`, 'POST', bad)).status, 400);
  assert.equal((await request(`/code-analysis/${run.id}/unknown`, 'POST')).status, 400);
  assert.equal((await request(`/code-analysis/${run.id}/resume`, 'POST', {})).status, 200); await s.analysis.idle();
  const response = await request(`/code-analysis/${run.id}/files/${page.files[0]!.fileId}`); assert.equal(response.status, 200);
  const file = await response.json() as AnalysisPayload; assert.equal(file.buildId, s.initial); assert.ok(file.evidence.length);
  assert.equal(s.catalog.evidence(file.evidence[0]!.id).sourceId, file.sourceId);
  const replay = await (await request('/code-analysis', 'POST', input)).json() as AnalysisSummary; assert.equal(replay.id, run.id);
  const nextBuild = await s.index('foreign'), foreign = s.store.one<{ id: string }>("SELECT id FROM files WHERE buildId=? AND path LIKE '%.ts'", nextBuild)!;
  assert.equal((await request(`/code-analysis/${run.id}/files/${foreign.id}`)).status, 404);
  assert.equal((await request('/code-analysis', 'POST', { ...input, buildId: nextBuild })).status, 409);
  const cancel = await (await request('/code-analysis', 'POST', { ...input, requestId: 'cancel' })).json() as AnalysisSummary;
  assert.equal((await request(`/code-analysis/${cancel.id}/cancel`, 'POST')).status, 200); await s.analysis.idle();
  assert.equal(s.analysis.get(cancel.id).status, 'cancelled');
  assert.equal((await request(`/code-analysis/${cancel.id}/resume`, 'POST')).status, 409);
  s.catalog.revoke(file.sourceId);
  assert.equal((await request(`/code-analysis/${run.id}/files/${file.fileId}`)).status, 409);
  assert.equal((await request(`/code-analysis/${run.id}/files`)).status, 409);
  assert.equal((await request('/code-analysis', 'POST', { ...input, requestId: 'stale' })).status, 409);
  s.catalog.updatePolicy(['src']); assert.equal((await request('/code-analysis', 'POST', { ...input, requestId: 'old-policy' })).status, 409);
  assert.equal(s.store.all('SELECT id FROM answer_attempts').length, 0);
});
