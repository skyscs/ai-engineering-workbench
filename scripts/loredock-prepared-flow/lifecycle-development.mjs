// Ordinary HTTP lifecycle/fault development. Never imports a reserved family or candidate helper.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, cp, readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, launch, client, save, inventory, normalized, journal, until } from './io.mjs';
import { indexSources, prepare, generate } from './flow.mjs';

const output = process.argv[2]; assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const report = { schemaVersion: 'prepared-flow-lifecycle-development/1', cases: [], errors: [], modelCalls: 0, reservedFamilyReads: 0, qualification: false };
const log = journal(path.join(output, 'journal.jsonl')), base = path.join(output, 'base-data');
const question = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
let daemon, api, currentDirectory, data;
async function stop() {
  api?.close(); api = undefined;
  if (daemon) { const owned = daemon; daemon = undefined; const result = await owned.stop(); assert.equal(result.code, 0, JSON.stringify(result)); assert.equal(result.signal, null); return result; }
}
async function start(name, controlled = true) {
  daemon = await launch({ directory: path.join(currentDirectory, name), data, controlled, fault: controlled });
  api = await client(path.join(currentDirectory, 'http-' + name));
  if (controlled) assert.deepEqual(await daemon.command('stats'), { prepares: 0, calls: 0, closed: 0 });
}
async function terminal(id) {
  return until(async () => {
    const value = (await api.request('/answers/' + id)).value;
    return ['preparing', 'running'].includes(value.status) ? false : value;
  }, 'Expected a terminal controlled answer.', 15000, 100);
}
async function drained() { return until(async () => { const value = await daemon.command('stats'); return value.closed === 1 ? value : false; }, 'Runtime did not close.', 15000, 25); }
async function held(gate) {
  const prepared = await prepare(api, question);
  await daemon.command('hold', { gate });
  const input = { requestId: randomUUID(), preparationId: prepared.review.id, reviewedHash: prepared.review.reviewedHash };
  const answer = (await api.request('/prepared-answers', 'POST', input)).value;
  await until(async () => { const value = await daemon.command('stats'); return gate === 'prepare' ? value.prepares === 1 : value.calls === 1; }, 'Runtime gate was not reached.');
  log.append({ event: 'runtime-held', gate, answerId: answer.id });
  return { input, answer, review: prepared.review, heldAt: performance.now() };
}
async function release(gate, heldAt) {
  log.append({ event: 'runtime-release', gate, deliberatelyHeldMs: performance.now() - heldAt });
  const began = performance.now(); await daemon.command('release', { gate }); await drained(); return performance.now() - began;
}
function sql(statement, parameters = []) {
  // Explicitly isolated fault injection, never normal admission or seeding capacity rows.
  log.append({ event: 'declared-catalog-fault', data, statement, parameters });
  const database = new DatabaseSync(path.join(data, 'loredock.db'));
  try { return database.prepare(statement).run(...parameters); } finally { database.close(); }
}
async function scenario(name, run) {
  currentDirectory = path.join(output, name); await mkdir(currentDirectory);
  data = path.join(currentDirectory, 'data'); await cp(base, data, { recursive: true, errorOnExist: true, force: false });
  assert.deepEqual(await inventory(data), await inventory(base));
  const entry = { name, errors: [] }; report.cases.push(entry); log.append({ event: 'case-started', name });
  try { await start('controlled'); Object.assign(entry, await run()); }
  catch (error) { entry.errors.push(normalized(error)); process.exitCode = 1; }
  finally {
    try { await stop(); } catch (error) { entry.errors.push(normalized(error)); process.exitCode = 1; }
    await save(path.join(currentDirectory, 'stopped-data.json'), await inventory(data));
    log.append({ event: 'case-finished', name, failed: entry.errors.length > 0 });
  }
}
async function mutation(kind) {
  const project = (await api.request('/project')).value;
  if (kind === 'policy') return api.request('/policy', 'PUT', { excludedPaths: ['owned-excluded-path'] });
  if (kind === 'review') {
    const projection = (await api.request('/code-flows')).value, overlay = (await api.request('/corrections')).value;
    const link = projection.edges[0]; assert(link);
    return api.request('/corrections', 'POST', { requestId: randomUUID(), buildId: project.publishedBuildId,
      targetKind: 'code-link', targetId: link.id, projectionHash: projection.inputHash, expectedRevision: overlay.revision,
      expectedPreviousId: null, action: 'clarify', statement: 'Owned unverified lifecycle note; deployed behavior remains unknown.', environment: 'owned-development' });
  }
  const first = (await api.request('/builds', 'POST', { requestId: randomUUID(), sourceSetVersion: project.sourceSetVersion, policyVersion: project.policyVersion })).value;
  return until(async () => { const value = (await api.request('/builds/' + first.id)).value;
    if (['preparing', 'running'].includes(value.status)) return false;
    assert.equal(value.status, 'completed'); assert(value.published); assert.notEqual(value.id, project.publishedBuildId); return value;
  }, 'Replacement source build did not publish.', 15000, 100);
}
async function analyze() {
  const project = (await api.request('/project')).value;
  const first = (await api.request('/code-analysis', 'POST', { requestId: randomUUID(), buildId: project.publishedBuildId,
    sourceSetVersion: project.sourceSetVersion, policyVersion: project.policyVersion })).value;
  await until(async () => {
    const state = (await api.request('/code-analysis')).value, row = state.inventories.find(value => value.id === first.id);
    if (row?.status === 'running') return false;
    assert.equal(row?.status, 'completed'); assert(row.published); return true;
  }, 'Replacement inventory did not publish.', 15000, 100);
  return first.id;
}
try {
  log.append({ event: 'started', corpus: 'ordinary-permit-development', resourceQualified: false });
  const corpus = corpusFactory(); for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const sources = await materialize(path.join(output, 'sources'), corpus); await save(path.join(output, 'sources.json'), sources);
  currentDirectory = output; data = base; await start('base', false); await indexSources(api, sources.paths);
  await api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: output, profile: null });
  await stop(); await save(path.join(output, 'base-data.json'), await inventory(base));

  await scenario('preparation-cancel', async () => {
    const project = (await api.request('/project')).value;
    const first = (await api.request('/question-preparations', 'POST', { requestId: randomUUID(), question, buildId: project.publishedBuildId })).value;
    assert.equal(first.status, 'preparing');
    const began = performance.now(), cancelled = (await api.request('/question-preparations/' + first.id + '/cancel', 'POST', {})).value;
    const cancelHttpMs = performance.now() - began;
    assert.equal(cancelled.status, 'cancelled');
    const replacement = await prepare(api, question); assert(replacement.review.compact.item);
    assert.equal((await daemon.command('stats')).calls, 0);
    return { initialStatus: first.status, cancelHttpMs, replacementReady: true,
      limitation: 'The admission response is preparing; a separate public checkpoint does not expose the precise internal cancel instant.' };
  });
  for (const gate of ['prepare', 'provider']) await scenario('cancel-' + gate, async () => {
    const current = await held(gate);
    assert.equal((await api.request('/answers/' + current.answer.id + '/cancel', 'POST', {})).value.status, 'cancelled');
    const drainMs = await release(gate, current.heldAt), result = await terminal(current.answer.id), stats = await daemon.command('stats');
    assert.equal(result.status, 'cancelled'); assert.equal(result.answer, null); assert.equal(stats.calls, gate === 'provider' ? 1 : 0);
    if (gate === 'provider') assert.deepEqual(result.usage, { inputTokens: 80, outputTokens: 20, cachedInputTokens: 0 });
    assert.equal((await api.request('/prepared-answers', 'POST', current.input)).value.id, result.id);
    assert.deepEqual(await daemon.command('stats'), stats);
    return { stats, drainMsExcludingDeclaredHold: drainMs, status: result.status, usage: result.usage };
  });
  await scenario('shutdown-held-worker', async () => {
    const current = await held('provider'), began = performance.now();
    await stop(); const shutdownMs = performance.now() - began;
    const stats = JSON.parse(await readFile(path.join(currentDirectory, 'controlled/runtime-stats.json'), 'utf8')); assert.equal(stats.calls, 1); assert.equal(stats.closed, 1);
    await start('production-reopen', false);
    const saved = (await api.request('/answers/' + current.answer.id)).value;
    assert.equal(saved.status, 'interrupted'); assert.equal(saved.answer, null); assert.equal(saved.usage.outputTokens, 20);
    assert.equal((await api.request('/prepared-answers', 'POST', current.input)).value.id, saved.id);
    assert.equal((await api.request('/question-preparations/' + current.review.id, 'GET', undefined, { allowError: true })).value.error.code, 'QUESTION_NOT_FOUND');
    return { stats, shutdownMs, status: saved.status, usage: saved.usage, actualEntryReplay: true };
  });
  for (const gate of ['prepare', 'provider']) for (const kind of ['review', 'policy', 'build']) await scenario(kind + '-before-' + (gate === 'prepare' ? 'dispatch' : 'publication'), async () => {
    const current = await held(gate); await mutation(kind);
    const drainMs = await release(gate, current.heldAt), result = await terminal(current.answer.id), stats = await daemon.command('stats');
    assert.notEqual(result.status, 'succeeded'); assert.equal(result.answer, null); assert.equal(stats.calls, gate === 'provider' ? 1 : 0);
    if (gate === 'provider') assert.equal(result.usage.outputTokens, 20);
    return { stats, status: result.status, reason: result.reason, usage: result.usage, drainMsExcludingDeclaredHold: drainMs };
  });
  await scenario('inventory-eviction', async () => {
    const ready = await prepare(api, question), inventoryId = (await api.request('/code-analysis')).value.inventories.find(row => row.published).id;
    const replacements = [await analyze(), await analyze(), await analyze()];
    assert(!(await api.request('/code-analysis')).value.inventories.some(row => row.id === inventoryId));
    const review = (await api.request('/question-preparations/' + ready.review.id + '/review')).value; assert.deepEqual(review, ready.review);
    const published = await generate(api, review); await analyze(); await analyze();
    assert.deepEqual((await api.request('/answers/' + published.answer.id)).value, published.answer);
    await stop(); await start('production-reopen', false); assert.deepEqual((await api.request('/answers/' + published.answer.id)).value, published.answer);
    return { evictedInventory: inventoryId, replacements, exactReady: true, exactHistory: true };
  });
  for (const kind of ['missing', 'corrupt']) await scenario('original-' + kind, async () => {
    const current = await held('prepare'), original = current.review.context.spans[0].id;
    if (kind === 'missing') sql('DELETE FROM spans WHERE id=?', [original]);
    else sql("UPDATE spans SET text='Owned corrupted original.' WHERE id=?", [original]);
    const drainMs = await release('prepare', current.heldAt), result = await terminal(current.answer.id), stats = await daemon.command('stats');
    assert.equal(result.status, 'failed'); assert.equal(result.answer, null); assert.equal(stats.calls, 0);
    return { original, status: result.status, reason: result.reason, stats, drainMsExcludingDeclaredHold: drainMs };
  });
  await scenario('pending-purge-recovery', async () => {
    const ready = await prepare(api, question), published = await generate(api, ready.review);
    const source = (await api.request('/project')).value.sources.find(row => row.name === 'z-independent-notes'); assert(source);
    await stop(); sql("CREATE TRIGGER owned_purge_failure BEFORE UPDATE OF witness ON answer_witnesses BEGIN SELECT RAISE(ABORT,'Owned purge failure'); END");
    await start('production-fault', false);
    const refused = await api.request('/sources/' + source.id + '/revoke', 'POST', {}, { allowError: true }); assert.equal(refused.status, 500);
    const result = (await api.request('/answers/' + published.answer.id)).value; assert.equal(result.context, null); assert.equal(result.nativeContext, null); assert.equal(result.answer, null);
    await stop();
    await cp(data, path.join(currentDirectory, 'pending-data'), { recursive: true, errorOnExist: true, force: false });
    assert.deepEqual(await inventory(data), await inventory(path.join(currentDirectory, 'pending-data')));
    const database = new DatabaseSync(path.join(data, 'loredock.db'), { readOnly: true });
    try { assert.equal(database.prepare('SELECT purge FROM sources WHERE id=?').get(source.id).purge, 'pending');
      assert.equal(database.prepare('SELECT purged FROM answer_witnesses').get().purged, 0); } finally { database.close(); }
    sql('DROP TRIGGER owned_purge_failure'); await start('production-recovery', false);
    assert.equal((await api.request('/project')).value.sources.find(row => row.id === source.id).purge, 'completed');
    const replay = (await api.request('/prepared-answers', 'POST', published.input)).value; assert.equal(replay.id, published.answer.id); assert.equal(replay.status, 'fenced');
    assert.equal(replay.context, null); assert.equal(replay.nativeContext, null); assert.equal(replay.answer, null);
    await stop(); const recovered = new DatabaseSync(path.join(data, 'loredock.db'), { readOnly: true });
    try { const row = recovered.prepare('SELECT purged,witness,witnessBytes FROM answer_witnesses').get(); assert.deepEqual({ ...row }, { purged: 1, witness: null, witnessBytes: 0 }); }
    finally { recovered.close(); }
    return { expectedFailureHttpStatus: refused.status, pendingSnapshotRetained: true, startupPurgeCompleted: true, modelRedispatch: false };
  });
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  try { await stop(); } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  try { await save(path.join(output, 'retained-tree.json'), await inventory(output)); } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'result.json'), report); log.append({ event: 'finished', failed: Boolean(process.exitCode) }); log.close();
}
console.log(JSON.stringify(report, null, 2));
