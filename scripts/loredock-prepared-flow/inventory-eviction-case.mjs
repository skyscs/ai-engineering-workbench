// Actual inventory replacement without faults, followed by an ordinary production reopen.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, cp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { launch, client, save, inventory, normalized, journal, until } from './io.mjs';
import { prepare, generate } from './flow.mjs';
import { assessPreview } from './assess.mjs';
import { assessDaemonSamples } from './cold-warm-cases.mjs';
import { assessRecordedHttp } from './http-assess.mjs';
import { stoppedHistoryCheckpoint } from './history-cases.mjs';

export async function inventoryEviction({ directory, checkpoint, question, assessment }) {
  for (const value of [directory, checkpoint.data]) assert(path.isAbsolute(value) && path.resolve(value) === value);
  // Produced by the owned cold case, which starts a fresh catalog and uses public APIs only.
  assert.equal(checkpoint.kind, 'cold-catalog'); assert.equal(checkpoint.lane, 'resource');
  assert.equal(checkpoint.storage.rows, 0);
  await mkdir(directory);
  const data = path.join(directory, 'data'), log = journal(path.join(directory, 'journal.jsonl'));
  const report = { errors: [], segments: [], replacements: [], modelCalls: 0, lane: 'resource', resourceQualification: false };
  let daemon, api, current;
  async function start(name, controlled) {
    assert(!daemon && !api); current = name;
    log.append({ event: 'launch-started', name, controlled, fault: false });
    daemon = await launch({ directory: path.join(directory, name), data, controlled });
    api = await client(path.join(directory, 'http-' + name));
    if (controlled) assert.deepEqual(await daemon.command('stats'), { prepares: 0, calls: 0, closed: 0 });
  }
  async function stop() {
    api?.close(); api = undefined;
    if (!daemon) return;
    const owned = daemon; daemon = undefined;
    const exit = await owned.stop(); assert.equal(exit.code, 0); assert.equal(exit.signal, null);
    const samples = (await readFile(path.join(owned.directory, 'memory-timer.jsonl'), 'utf8')).trimEnd().split('\n').map(JSON.parse);
    const metrics = assessDaemonSamples(samples);
    const http = await assessRecordedHttp({ directory: path.join(directory, 'http-' + current), processDirectory: owned.directory, lane: 'resource' });
    report.segments.push({ name: current, exit, metrics, http });
  }
  async function analyze(buildId) {
    const project = (await api.request('/project')).value; assert.equal(project.publishedBuildId, buildId);
    const first = (await api.request('/code-analysis', 'POST', { requestId: randomUUID(), buildId,
      sourceSetVersion: project.sourceSetVersion, policyVersion: project.policyVersion })).value;
    const result = await until(async () => {
      const state = (await api.request('/code-analysis')).value;
      const value = state.inventories.find(row => row.id === first.id);
      if (value?.status === 'running') return false;
      assert.equal(value?.status, 'completed'); assert(value.published && value.currentParser); assert.equal(value.buildId, buildId); return value;
    }, 'Replacement inventory did not publish.', 300000, 100);
    assert(!report.replacements.some(row => row.id === result.id)); report.replacements.push(result);
    log.append({ event: 'replacement-published', id: result.id, buildId });
    return result;
  }
  try {
    log.append({ event: 'started', lane: 'resource', prerequisite: 'fresh-owned-cold-checkpoint' });
    assert.deepEqual(await inventory(checkpoint.data), checkpoint.files);
    await cp(checkpoint.data, data, { recursive: true, force: false, errorOnExist: true });
    assert.deepEqual(await inventory(data), checkpoint.files); await save(path.join(directory, 'input.json'), checkpoint);
    await start('controlled', true);
    await api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: directory, profile: null });
    const project = (await api.request('/project')).value, buildId = project.publishedBuildId;
    report.buildId = buildId;
    const prepared = await prepare(api, question); report.prepared = prepared;
    report.sourceAssessment = assessPreview(prepared.review, assessment);
    report.initialInventory = (await api.request('/code-analysis')).value.inventories.find(row => row.published).id;
    for (let count = 0; count < 3; count++) await analyze(buildId);
    const afterEviction = (await api.request('/code-analysis')).value;
    assert(!afterEviction.inventories.some(row => row.id === report.initialInventory));
    const exact = await api.request('/question-preparations/' + prepared.review.id + '/review');
    assert.deepEqual(exact.value, prepared.review); report.reviewAfterEviction = exact;
    report.published = await generate(api, exact.value);
    await until(async () => (await daemon.command('stats')).closed === 1, 'The controlled answer did not drain.');
    report.runtime = await daemon.command('stats'); assert.deepEqual(report.runtime, { prepares: 1, calls: 1, closed: 1 });
    report.saved = await api.request('/answers/' + report.published.answer.id);
    assert.deepEqual(report.saved.value.context, prepared.review.context); assert.deepEqual(report.saved.value.nativeContext, prepared.review.compact);
    for (let count = 0; count < 2; count++) await analyze(buildId);
    assert.equal((await api.request('/answers/' + report.published.answer.id)).rawSha256, report.saved.rawSha256);
    assert.equal((await api.request('/project')).value.publishedBuildId, buildId);
    assert.deepEqual(await daemon.command('stats'), report.runtime);
    await stop();
    const retained = await stoppedHistoryCheckpoint(data, path.join(directory, 'before-reopen'));
    assert.equal(retained.storage.rows, 1); assert.equal(retained.storage.purged, 0);
    report.beforeReopen = { data: path.join(directory, 'before-reopen'), ...retained, lane: 'resource' };
    await save(path.join(directory, 'before-reopen.json'), report.beforeReopen);
    await start('production-reopen', false);
    report.reopened = await api.request('/answers/' + report.published.answer.id);
    assert.equal(report.reopened.rawSha256, report.saved.rawSha256);
    report.replayed = await api.request('/prepared-answers', 'POST', report.published.input);
    assert.equal(report.replayed.rawSha256, report.saved.rawSha256);
    assert.equal((await api.request('/answers')).value.attempts.length, 1);
    const latest = (await api.request('/code-analysis')).value.inventories.find(row => row.published);
    assert.equal(latest.id, report.replacements.at(-1).id); assert.equal(latest.buildId, buildId);
    assert.equal((await api.request('/project')).value.publishedBuildId, buildId);
    await stop(); assert.deepEqual(await inventory(report.beforeReopen.data), report.beforeReopen.files);
  } catch (error) { report.errors.push(normalized(error)); }
  finally {
    try { await stop(); } catch (error) { report.errors.push(normalized(error)); }
    try {
      assert.deepEqual(await inventory(checkpoint.data), checkpoint.files); report.inputCheckpointUnchanged = true;
      await save(path.join(directory, 'retained-tree.json'), await inventory(directory));
    } catch (error) { report.errors.push(normalized(error)); }
    report.resourceSubsetPassed = report.errors.length === 0 && report.segments.length === 2 &&
      report.segments.every(row => row.metrics.passed && row.http.status === 'passed');
    try { await save(path.join(directory, 'result.json'), report); log.append({ event: 'finished', errors: report.errors, resourceSubsetPassed: report.resourceSubsetPassed }); }
    finally { log.close(); }
  }
  return report;
}
