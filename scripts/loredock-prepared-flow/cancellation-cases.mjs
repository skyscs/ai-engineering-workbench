// Declared diagnostic/fault cases. Shutdown produces a checkpoint; reopen is separate.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, cp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { launch, client, save, inventory, normalized, journal, until, hash } from './io.mjs';
import { prepare } from './flow.mjs';
import { stoppedHistoryCheckpoint } from './history-cases.mjs';

async function copiedCase({ directory, checkpoint, lane }, execute) {
  assert(['fault', 'accounting'].includes(lane));
  for (const target of [directory, checkpoint.data]) assert(path.isAbsolute(target) && path.resolve(target) === target);
  await mkdir(directory);
  const data = path.join(directory, 'data'), log = journal(path.join(directory, 'journal.jsonl'));
  const report = { lane, errors: [], exits: [], modelCalls: 0, resourceQualification: false, timingQualified: false };
  let daemon, api, copied = false;
  const context = { directory, data, report, log, get daemon() { return daemon; }, get api() { return api; },
    async start(name, controlled = true) {
      assert(!daemon && !api);
      assert(controlled || lane === 'fault', 'Production reopen cannot enable diagnostic budget forwarding.');
      log.append({ event: 'launch-started', name, controlled, lane });
      // Inherited fault provenance survives a production entry with no runtime double.
      daemon = await launch({ directory: path.join(directory, name), data, controlled,
        fault: lane === 'fault', accounting: lane === 'accounting' });
      api = await client(path.join(directory, 'http-' + name));
      if (controlled) assert.deepEqual(await daemon.command('stats'), { prepares: 0, calls: 0, closed: 0 });
    },
    async stop() {
      api?.close(); api = undefined;
      if (!daemon) return;
      const owned = daemon; daemon = undefined;
      const exit = await owned.stop(); report.exits.push({ directory: owned.directory, ...exit });
      assert.equal(exit.code, 0); assert.equal(exit.signal, null); return exit;
    } };
  try {
    log.append({ event: 'started', lane, checkpointFilesSha256: hash(JSON.stringify(checkpoint.files)) });
    assert.deepEqual(await inventory(checkpoint.data), checkpoint.files, 'The stopped input checkpoint changed.');
    await cp(checkpoint.data, data, { recursive: true, force: false, errorOnExist: true }); copied = true;
    assert.deepEqual(await inventory(data), checkpoint.files);
    await save(path.join(directory, 'input.json'), checkpoint);
    await execute(context);
  } catch (error) { report.errors.push(normalized(error)); }
  finally {
    try { await context.stop(); } catch (error) { report.errors.push(normalized(error)); }
    try {
      assert.deepEqual(await inventory(checkpoint.data), checkpoint.files, 'The stopped input checkpoint changed.');
      report.inputCheckpointUnchanged = true;
      if (copied) await save(path.join(directory, 'stopped-data.json'), await inventory(data));
    } catch (error) { report.errors.push(normalized(error)); }
    try {
      await save(path.join(directory, 'result.json'), report);
      log.append({ event: 'finished', failed: report.errors.length > 0 });
    } finally { log.close(); }
  }
  return report;
}

export function observePreparationCancellation(args) {
  return copiedCase({ ...args, lane: 'accounting' }, async c => {
    await c.start('diagnostic');
    const { api, daemon, report } = c, project = (await api.request('/project')).value;
    await daemon.command('accounting-start', { scope: 'cancel-preparing' });
    const admitted = (await api.request('/question-preparations', 'POST', { requestId: randomUUID(),
      question: args.question, buildId: project.publishedBuildId })).value;
    assert.equal(admitted.status, 'preparing');
    const route = '/question-preparations/' + admitted.id + '/cancel';
    assert.equal((await api.request(route, 'POST', {})).value.status, 'cancelled');
    await until(async () => (await daemon.command('accounting-status')).unclosedBudgets.length === 0, 'Cancelled preparation did not drain.');
    report.cancelled = await daemon.command('accounting-end');
    await save(path.join(c.directory, 'cancellation-observation.json'), report.cancelled);
    const response = report.cancelled.responses.find(row => row.path === '/api' + route);
    assert(response && response.status === 200); assert.equal(report.cancelled.budgets.length, 1);
    assert.deepEqual(response.openBudgets, [report.cancelled.budgets[0].id], 'The preparing admission alone is not proof of active work at cancellation.');
    assert.deepEqual(report.cancelled.unclosedBudgets, []);
    assert(Object.entries(report.cancelled.budgets[0].errors).some(([name, count]) => name.endsWith(':CANCELLED') && count > 0));
    await daemon.command('accounting-start', { scope: 'replacement-ready-control' });
    const replacement = await prepare(api, args.question); assert(replacement.review.compact.item);
    const readyRoute = '/question-preparations/' + replacement.review.id + '/cancel';
    assert.equal((await api.request(readyRoute, 'POST', {})).value.status, 'cancelled');
    report.readyControl = await daemon.command('accounting-end');
    const readyResponse = report.readyControl.responses.find(row => row.path === '/api' + readyRoute);
    assert(readyResponse && readyResponse.status === 200); assert.deepEqual(readyResponse.openBudgets, []);
    assert.deepEqual(report.readyControl.unclosedBudgets, []); assert.deepEqual(report.readyControl.budgets[0].errors, {});
    report.runtime = await daemon.command('stats'); assert.deepEqual(report.runtime, { prepares: 0, calls: 0, closed: 0 });
    await c.stop();
    report.audit = JSON.parse(await readFile(path.join(c.directory, 'diagnostic/accounting-audit.json'), 'utf8'));
    assert.equal(report.audit.activeScope, null);
    for (const key of ['lateActivities', 'unscopedBudgets', 'unclosedBudgets']) assert.deepEqual(report.audit[key], []);
  });
}

async function heldProvider(c, question) {
  await c.start('controlled');
  await c.api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: c.directory, profile: null });
  const prepared = await prepare(c.api, question); assert(prepared.review.compact.item);
  await c.daemon.command('hold', { gate: 'provider' });
  const input = { requestId: randomUUID(), preparationId: prepared.review.id, reviewedHash: prepared.review.reviewedHash };
  const answer = (await c.api.request('/prepared-answers', 'POST', input)).value;
  await until(async () => (await c.daemon.command('stats')).calls === 1, 'The controlled provider was not called.');
  const observedAt = performance.now();
  c.log.append({ event: 'controlled-call-observed-under-declared-hold', answerId: answer.id, observedAt });
  return { input, answer, review: prepared.review, observedAt };
}
const knownUsage = { inputTokens: 80, outputTokens: 20, cachedInputTokens: 0 };

export function cancelHeldProvider(args) {
  return copiedCase({ ...args, lane: 'fault' }, async c => {
    const current = await heldProvider(c, args.question);
    c.report.attempt = current;
    const cancellationStarted = performance.now();
    assert.equal((await c.api.request('/answers/' + current.answer.id + '/cancel', 'POST', {})).value.status, 'cancelled');
    const releaseStarted = performance.now();
    c.log.append({ event: 'provider-release-requested', observedHoldMs: releaseStarted - current.observedAt });
    await c.daemon.command('release', { gate: 'provider' });
    await until(async () => (await c.daemon.command('stats')).closed === 1, 'The cancelled provider did not close.');
    c.report.drainMsAfterReleaseRequest = performance.now() - releaseStarted;
    c.report.cancelThroughDrainMs = performance.now() - cancellationStarted;
    const saved = await c.api.request('/answers/' + current.answer.id);
    assert.equal(saved.value.status, 'cancelled'); assert.equal(saved.value.answer, null); assert.deepEqual(saved.value.usage, knownUsage);
    c.report.runtime = await c.daemon.command('stats');
    assert.deepEqual(c.report.runtime, { prepares: 1, calls: 1, closed: 1 });
    const replay = await c.api.request('/prepared-answers', 'POST', current.input);
    assert.equal(replay.rawSha256, saved.rawSha256); assert.deepEqual(await c.daemon.command('stats'), c.report.runtime);
    c.report.saved = saved; c.report.replay = replay;
  });
}

export function shutdownHeldProvider(args) {
  return copiedCase({ ...args, lane: 'fault' }, async c => {
    const attempt = await heldProvider(c, args.question), began = performance.now();
    c.log.append({ event: 'shutdown-requested', observedHoldMs: began - attempt.observedAt });
    await c.stop(); c.report.shutdownMs = performance.now() - began;
    const runtime = JSON.parse(await readFile(path.join(c.directory, 'controlled/runtime-stats.json'), 'utf8'));
    assert.deepEqual(runtime, { prepares: 1, calls: 1, closed: 1 });
    const data = path.join(c.directory, 'interrupted-checkpoint');
    const retained = await stoppedHistoryCheckpoint(c.data, data);
    assert.equal(retained.storage.rows, 1); assert.equal(retained.storage.purged, 0); assert(retained.storage.bytes > 0);
    c.report.checkpoint = { data, ...retained, kind: 'held-provider-shutdown', lane: 'fault', attempt, runtime };
    await save(path.join(c.directory, 'interrupted-checkpoint.json'), c.report.checkpoint);
    c.log.append({ event: 'stopped-checkpoint-retained', productionReopen: false });
  });
}

// Called later in R09. The source checkpoint remains closed and unchanged.
export async function reopenInterrupted(args) {
  const checkpoint = args.checkpoint;
  assert.equal(checkpoint.kind, 'held-provider-shutdown'); assert.equal(checkpoint.lane, 'fault');
  assert.deepEqual(checkpoint.runtime, { prepares: 1, calls: 1, closed: 1 });
  assert.equal(checkpoint.storage.rows, 1); assert.equal(checkpoint.storage.purged, 0);
  assert.equal(checkpoint.attempt.input.preparationId, checkpoint.attempt.review.id);
  assert.equal(checkpoint.attempt.input.reviewedHash, checkpoint.attempt.review.reviewedHash);
  return copiedCase({ ...args, lane: 'fault' }, async c => {
    await c.start('production-reopen', false);
    const attempt = checkpoint.attempt, saved = await c.api.request('/answers/' + attempt.answer.id);
    assert.equal(saved.value.status, 'interrupted'); assert.equal(saved.value.answer, null);
    assert.equal(saved.value.inputKind, 'prepared-question/1'); assert.deepEqual(saved.value.usage, knownUsage);
    assert.deepEqual(saved.value.context, attempt.review.context); assert.deepEqual(saved.value.nativeContext, attempt.review.compact);
    const replay = await c.api.request('/prepared-answers', 'POST', attempt.input);
    assert.equal(replay.rawSha256, saved.rawSha256);
    const missing = await c.api.request('/question-preparations/' + attempt.review.id, 'GET', undefined, { allowError: true });
    assert.equal(missing.status, 409); assert.equal(missing.value.error.code, 'QUESTION_NOT_FOUND');
    const later = await c.api.request('/answers/' + attempt.answer.id);
    assert.equal(later.rawSha256, saved.rawSha256);
    c.report.saved = saved; c.report.replay = replay; c.report.transientLost = true;
    c.report.productionEntry = true;
  });
}
