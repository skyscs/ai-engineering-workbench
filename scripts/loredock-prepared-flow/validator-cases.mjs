// Declared fault observations at the real prepared-answer validator boundaries.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, cp, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { launch, client, save, inventory, normalized, journal, until } from './io.mjs';
import { prepare } from './flow.mjs';
import { stoppedHistoryCheckpoint } from './history-cases.mjs';

export async function withCatalog({ directory, checkpoint }, execute) {
  for (const value of [directory, checkpoint.data]) assert(path.isAbsolute(value) && path.resolve(value) === value);
  await mkdir(directory);
  const data = path.join(directory, 'data'), log = journal(path.join(directory, 'journal.jsonl'));
  const report = { errors: [], exits: [], lane: 'fault', timingQualified: false, resourceQualification: false, modelCalls: 0 };
  let daemon, api;
  const c = { directory, data, log, report, get daemon() { return daemon; }, get api() { return api; },
    async start(name, controlled = true) {
      assert(!daemon && !api); log.append({ event: 'launch-started', name, controlled, fault: true });
      daemon = await launch({ directory: path.join(directory, name), data, controlled, fault: true });
      api = await client(path.join(directory, 'http-' + name));
      if (controlled) assert.deepEqual(await daemon.command('stats'), { prepares: 0, calls: 0, closed: 0 });
    },
    async stop() {
      api?.close(); api = undefined;
      if (!daemon) return;
      const owned = daemon; daemon = undefined;
      const exit = await owned.stop(); report.exits.push({ directory: owned.directory, ...exit });
      assert.equal(exit.code, 0); assert.equal(exit.signal, null);
    },
    sql(statement, parameters = []) {
      log.append({ event: 'declared-catalog-fault', statement, parameters });
      const db = new DatabaseSync(path.join(data, 'loredock.db'));
      try { return db.prepare(statement).run(...parameters); } finally { db.close(); }
    } };
  try {
    log.append({ event: 'started', lane: 'fault' });
    assert.deepEqual(await inventory(checkpoint.data), checkpoint.files);
    await cp(checkpoint.data, data, { recursive: true, force: false, errorOnExist: true });
    assert.deepEqual(await inventory(data), checkpoint.files); await save(path.join(directory, 'input.json'), checkpoint);
    await execute(c);
  } catch (error) { report.errors.push(normalized(error)); }
  finally {
    try { await c.stop(); } catch (error) { report.errors.push(normalized(error)); }
    try {
      assert.deepEqual(await inventory(checkpoint.data), checkpoint.files); report.inputCheckpointUnchanged = true;
      await save(path.join(directory, 'retained-tree.json'), await inventory(directory));
    } catch (error) { report.errors.push(normalized(error)); }
    try { await save(path.join(directory, 'result.json'), report); log.append({ event: 'finished', errors: report.errors }); }
    finally { log.close(); }
  }
  return report;
}

export function alternativeBuildCheckpoint(args) {
  assert.equal(args.checkpoint.kind, 'cold-catalog'); assert.equal(args.checkpoint.storage.rows, 0);
  return withCatalog(args, async c => {
    await c.start('production-setup', false);
    const project = (await c.api.request('/project')).value;
    const first = (await c.api.request('/builds/' + project.publishedBuildId)).value;
    assert.equal(first.status, 'completed'); assert(first.published);
    const started = (await c.api.request('/builds', 'POST', { requestId: randomUUID(),
      sourceSetVersion: project.sourceSetVersion, policyVersion: project.policyVersion })).value;
    const second = await until(async () => {
      const value = (await c.api.request('/builds/' + started.id)).value;
      if (['preparing', 'running'].includes(value.status)) return false;
      assert.equal(value.status, 'completed'); assert(value.published); return value;
    }, 'The actual alternative build did not publish.', 300000, 100);
    assert.notEqual(first.id, second.id);
    const analysis = await until(async () => (await c.api.request('/code-analysis')).value.inventories.find(row =>
      row.buildId === second.id && row.status === 'completed' && row.published && row.currentParser),
    'The alternative native analysis did not publish.', 300000, 100);
    const published = (await c.api.request('/project')).value; assert.equal(published.publishedBuildId, second.id);
    for (const key of ['sourceSetVersion', 'policyVersion', 'correctionRevision']) assert.equal(published[key], project[key]);
    await c.stop();
    const data = path.join(c.directory, 'checkpoint'), retained = await stoppedHistoryCheckpoint(c.data, data);
    assert.equal(retained.storage.rows, 0);
    c.report.checkpoint = { data, ...retained, kind: 'two-published-builds', lane: 'fault', first, second, project, published, analysis };
    await save(path.join(c.directory, 'checkpoint.json'), c.report.checkpoint);
  });
}

async function mutationRequest(c, kind) {
  if (kind === 'policy') return { route: '/policy', method: 'PUT', payload: { excludedPaths: ['owned-excluded-path'] } };
  assert.equal(kind, 'review');
  const projection = (await c.api.request('/code-flows')).value, overlay = (await c.api.request('/corrections')).value;
  const link = projection.edges[0]; assert(link);
  return { route: '/corrections', method: 'POST', payload: { requestId: randomUUID(), buildId: projection.buildId,
    targetKind: 'code-link', targetId: link.id, projectionHash: projection.inputHash, expectedRevision: overlay.revision,
    expectedPreviousId: overlay.corrections.find(row => row.targetId === link.id)?.id ?? null,
    action: 'clarify', statement: 'Owned validator-boundary note; deployed behavior remains unverified.', environment: 'owned-development' } };
}

export function validatorBoundary(args) {
  const { kind, boundary, checkpoint } = args;
  assert(['review', 'policy', 'published-build'].includes(kind));
  assert(['first-preflight', 'before-dispatch', 'before-publication'].includes(boundary));
  assert.equal(checkpoint.storage.rows, 0);
  if (kind === 'published-build') {
    assert.equal(checkpoint.kind, 'two-published-builds'); assert.equal(checkpoint.lane, 'fault');
    for (const build of [checkpoint.first, checkpoint.second]) {
      assert(/^[a-f0-9-]{36}$/.test(build.id)); assert.equal(build.status, 'completed'); assert(build.published);
    }
    assert.notEqual(checkpoint.first.id, checkpoint.second.id);
  } else assert.equal(checkpoint.kind, 'cold-catalog');
  return withCatalog(args, async c => {
    Object.assign(c.report, { kind, boundary, observedBoundary: false });
    if (kind === 'published-build') c.sql('UPDATE project SET publishedBuildId=? WHERE id=1', [checkpoint.first.id]);
    await c.start('controlled');
    await c.api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: c.directory, profile: null });
    const prepared = await prepare(c.api, args.question); assert(prepared.review.compact.item); c.report.prepared = prepared;
    if (kind === 'published-build') assert.equal(prepared.review.context.buildId, checkpoint.first.id);
    // Resolve mutation identity before admission; no unrelated reads delay the boundary request.
    const mutation = kind === 'published-build' ? null : await mutationRequest(c, kind);
    c.report.mutationRequest = mutation;
    const gate = boundary === 'before-publication' ? 'provider' : 'prepare';
    // At the first boundary this only prevents dispatch if the public mutation loses its race.
    await c.daemon.command('hold', { gate });
    if (kind === 'published-build' && boundary === 'first-preflight') {
      const sql = `CREATE TRIGGER owned_publish_at_admission AFTER INSERT ON answer_witnesses BEGIN\nUPDATE project SET publishedBuildId='${checkpoint.second.id}' WHERE id=1;\nEND;`;
      await writeFile(path.join(c.directory, 'fault.sql'), sql + '\n', { flag: 'wx' }); c.sql(sql);
    }
    const input = { requestId: randomUUID(), preparationId: prepared.review.id, reviewedHash: prepared.review.reviewedHash };
    c.report.input = input; c.report.admitted = await c.api.request('/prepared-answers', 'POST', input);
    if (boundary !== 'first-preflight') {
      await until(async () => { const stats = await c.daemon.command('stats'); return gate === 'provider' ? stats.calls === 1 : stats.prepares === 1; },
        'The declared controlled boundary was not reached.');
      c.log.append({ event: 'controlled-boundary-observed', boundary, gate });
    }
    if (kind === 'published-build') {
      if (boundary !== 'first-preflight') c.sql('UPDATE project SET publishedBuildId=? WHERE id=1', [checkpoint.second.id]);
      c.report.projectAfterMutation = (await c.api.request('/project')).value;
      assert.equal(c.report.projectAfterMutation.publishedBuildId, checkpoint.second.id);
      for (const key of ['sourceSetVersion', 'policyVersion', 'correctionRevision'])
        assert.equal(c.report.projectAfterMutation[key], checkpoint.project[key]);
    } else c.report.mutation = await c.api.request(mutation.route, mutation.method, mutation.payload);
    c.report.runtimeAtMutation = await c.daemon.command('stats');
    c.log.append({ event: 'hold-release-requested', boundary, gate });
    await c.daemon.command('release', { gate });
    c.report.terminal = await until(async () => {
      const response = await c.api.request('/answers/' + c.report.admitted.value.id);
      return ['preparing', 'running'].includes(response.value.status) ? false : response;
    }, 'The changed input did not reach a terminal state.');
    await until(async () => { const stats = await c.daemon.command('stats'); return stats.closed === stats.prepares; }, 'Runtime preflight did not drain.');
    c.report.runtime = await c.daemon.command('stats');
    const terminal = c.report.terminal.value, stats = c.report.runtime;
    assert.notEqual(terminal.status, 'succeeded'); assert.equal(terminal.answer, null);
    assert.equal(stats.calls, boundary === 'before-publication' ? 1 : 0);
    if (boundary === 'before-publication') assert.deepEqual(terminal.usage, { inputTokens: 80, outputTokens: 20, cachedInputTokens: 0 });
    else { assert.equal(terminal.dispatchedAt, null); assert.equal(terminal.usage, null); }
    if (boundary === 'first-preflight') {
      c.report.observedBoundary = stats.prepares === 0;
      c.report.limitation = stats.prepares ? 'Public mutation missed the first preflight; this is a later fence only.' : null;
    } else { assert.equal(stats.prepares, 1); assert.equal(stats.closed, 1); c.report.observedBoundary = true; }
    c.report.replayed = await c.api.request('/prepared-answers', 'POST', input);
    assert.equal(c.report.replayed.rawSha256, c.report.terminal.rawSha256);
    assert.deepEqual(await c.daemon.command('stats'), stats);
    assert.equal((await c.api.request('/answers')).value.attempts.length, 1);
  });
}
