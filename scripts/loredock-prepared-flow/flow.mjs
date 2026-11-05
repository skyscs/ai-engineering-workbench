import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { until } from './io.mjs';

export async function indexSources(api, paths) {
  for (const source of paths) await api.request('/sources', 'POST', { path: source });
  const project = (await api.request('/project')).value;
  const started = performance.now();
  const build = (await api.request('/builds', 'POST', { requestId: randomUUID(), sourceSetVersion: project.sourceSetVersion, policyVersion: project.policyVersion })).value;
  const ready = await until(async () => {
    const value = (await api.request('/builds/' + build.id)).value;
    if (['preparing', 'running'].includes(value.status)) return false;
    assert.equal(value.status, 'completed', JSON.stringify(value)); assert(value.published); return value;
  }, 'Source indexing did not complete.', 300000);
  const indexMs = performance.now() - started, analysisStarted = performance.now();
  const analysis = await until(async () => {
    const state = (await api.request('/code-analysis')).value;
    assert.equal(state.automaticError, null, JSON.stringify(state.automaticError));
    const value = state.inventories.find(row => row.buildId === ready.id);
    if (!value || value.status === 'running') return false;
    assert.equal(value.status, 'completed', JSON.stringify(value)); assert(value.published && value.currentParser); return value;
  }, 'Automatic code analysis did not complete.', 300000);
  return { build: ready, analysis, indexMs, analysisMs: performance.now() - analysisStarted };
}
export async function prepare(api, question) {
  const project = (await api.request('/project')).value, started = performance.now();
  const first = (await api.request('/question-preparations', 'POST', { requestId: randomUUID(), question, buildId: project.publishedBuildId })).value;
  const state = await until(async () => {
    const current = (await api.request('/question-preparations/' + first.id)).value;
    if (current.status === 'preparing') return false;
    assert.equal(current.status, 'ready', JSON.stringify(current)); return current;
  }, 'Question preparation did not complete.', 6000);
  const review = await api.request('/question-preparations/' + state.id + '/review');
  assert.equal(review.value.reviewedHash, state.reviewedHash);
  return { review: review.value, elapsedMs: performance.now() - started, bytes: review.bytes };
}
export async function generate(api, reviewed) {
  const input = { requestId: randomUUID(), preparationId: reviewed.id, reviewedHash: reviewed.reviewedHash };
  const first = await api.request('/prepared-answers', 'POST', input);
  const answer = await until(async () => {
    const current = (await api.request('/answers/' + first.value.id)).value;
    if (['preparing', 'running'].includes(current.status)) return false;
    assert.equal(current.status, 'succeeded', `${current.status}: ${current.reason}`); return current;
  }, 'Controlled answer did not publish.', 20000);
  return { input, answer };
}
