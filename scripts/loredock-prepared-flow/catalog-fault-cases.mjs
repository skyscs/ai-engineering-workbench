// Isolated catalog faults only; production recovery retains the inherited fault lane.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { save, inventory, until } from './io.mjs';
import { prepare } from './flow.mjs';
import { withCatalog } from './validator-cases.mjs';
import { stoppedHistoryCheckpoint } from './history-cases.mjs';

function inspect(data, operation) {
  const db = new DatabaseSync(path.join(data, 'loredock.db'), { readOnly: true });
  try { return operation(db); } finally { db.close(); }
}

export function originalFault(args) {
  assert(['missing', 'corrupt'].includes(args.kind));
  assert.equal(args.checkpoint.kind, 'cold-catalog'); assert.equal(args.checkpoint.storage.rows, 0);
  return withCatalog(args, async c => {
    c.report.kind = args.kind;
    await c.start('controlled');
    await c.api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: c.directory, profile: null });
    const prepared = await prepare(c.api, args.question); assert(prepared.review.compact.item); c.report.prepared = prepared;
    await c.daemon.command('hold', { gate: 'prepare' });
    const input = { requestId: randomUUID(), preparationId: prepared.review.id, reviewedHash: prepared.review.reviewedHash };
    c.report.input = input; c.report.admitted = await c.api.request('/prepared-answers', 'POST', input);
    await until(async () => (await c.daemon.command('stats')).prepares === 1, 'Runtime preflight did not reach its declared hold.');
    const original = prepared.review.context.spans[0].id; assert(original); c.report.original = original;
    c.report.fault = args.kind === 'missing' ? c.sql('DELETE FROM spans WHERE id=?', [original])
      : c.sql("UPDATE spans SET text='Owned corrupted original.' WHERE id=?", [original]);
    assert.equal(c.report.fault.changes, 1);
    await c.daemon.command('release', { gate: 'prepare' });
    c.report.terminal = await until(async () => {
      const response = await c.api.request('/answers/' + c.report.admitted.value.id);
      return ['preparing', 'running'].includes(response.value.status) ? false : response;
    }, 'The missing/corrupt required original did not refuse dispatch.');
    await until(async () => (await c.daemon.command('stats')).closed === 1, 'Runtime preflight did not close.');
    c.report.runtime = await c.daemon.command('stats');
    assert.deepEqual(c.report.runtime, { prepares: 1, calls: 0, closed: 1 });
    assert.equal(c.report.terminal.value.status, 'failed');
    for (const field of ['answer', 'usage', 'dispatchedAt']) assert.equal(c.report.terminal.value[field], null);
    c.report.replayed = await c.api.request('/prepared-answers', 'POST', input);
    assert.equal(c.report.replayed.rawSha256, c.report.terminal.rawSha256);
    assert.deepEqual(await c.daemon.command('stats'), c.report.runtime);
    assert.equal((await c.api.request('/answers')).value.attempts.length, 1);
  });
}

export function pendingPurgeRecovery(args) {
  const { checkpoint } = args;
  assert.equal(checkpoint.rows, 64); assert.equal(checkpoint.storage.rows, 64); assert.equal(checkpoint.storage.purged, 0);
  assert.equal(checkpoint.admissions.length, 64); assert.equal(new Set(checkpoint.admissions.map(row => row.id)).size, 64);
  assert(typeof args.sourceName === 'string' && args.sourceName);
  return withCatalog(args, async c => {
    await c.start('production-inspect', false);
    assert.equal((await c.api.request('/answers')).rawSha256, checkpoint.list.rawSha256);
    const source = (await c.api.request('/project')).value.sources.find(row => row.name === args.sourceName); assert(source);
    c.report.sourceId = source.id;
    await c.stop();
    c.report.dependencies = inspect(c.data, db => {
      const rows = db.prepare('SELECT a.id,a.context FROM answer_attempts a JOIN answer_sources d ON a.id=d.answerId WHERE d.sourceId=? ORDER BY a.id').all(source.id);
      assert.equal(rows.length, 64);
      for (const row of rows) assert(!JSON.parse(row.context).spans.some(span => span.sourceName === args.sourceName), 'The revoked dependency must be uncited in every stored answer.');
      return rows.map(row => row.id);
    });
    assert.deepEqual(c.report.dependencies, checkpoint.admissions.map(row => row.id).sort());
    c.sql("CREATE TRIGGER owned_purge_failure BEFORE UPDATE OF witness ON answer_witnesses BEGIN SELECT RAISE(ABORT,'Owned purge failure'); END");
    await c.start('production-fault', false);
    c.report.refused = await c.api.request('/sources/' + source.id + '/revoke', 'POST', {}, { allowError: true });
    assert.equal(c.report.refused.status, 500);
    c.report.pendingAnswers = [];
    for (const admitted of checkpoint.admissions) {
      const response = await c.api.request('/answers/' + admitted.id);
      assert.equal(response.value.status, 'fenced');
      for (const field of ['context', 'nativeContext', 'answer']) assert.equal(response.value[field], null);
      c.report.pendingAnswers.push({ id: admitted.id, rawSha256: response.rawSha256 });
    }
    await c.stop();
    c.report.pendingState = inspect(c.data, db => {
      const sourceRow = db.prepare('SELECT status,purge FROM sources WHERE id=?').get(source.id);
      assert.equal(sourceRow.status, 'revoked'); assert.equal(sourceRow.purge, 'pending');
      const storage = db.prepare('SELECT count(*) rows,sum(purged) purged,sum(witnessBytes) bytes FROM answer_witnesses').get();
      assert.equal(storage.rows, 64); assert.equal(storage.purged, 0); assert(storage.bytes > 0);
      return { source: { ...sourceRow }, storage: { ...storage } };
    });
    const pendingData = path.join(c.directory, 'pending-checkpoint');
    const retained = await stoppedHistoryCheckpoint(c.data, pendingData);
    c.report.pendingCheckpoint = { data: pendingData, ...retained, lane: 'fault', kind: 'pending-source-purge' };
    await save(path.join(c.directory, 'pending-checkpoint.json'), c.report.pendingCheckpoint);
    c.sql('DROP TRIGGER owned_purge_failure');
    await c.start('production-recovery', false);
    const recoveredSource = (await c.api.request('/project')).value.sources.find(row => row.id === source.id);
    assert.equal(recoveredSource.status, 'revoked'); assert.equal(recoveredSource.purge, 'completed');
    c.report.recoveredAnswers = []; let first;
    for (const admitted of checkpoint.admissions) {
      const response = await c.api.request('/answers/' + admitted.id);
      assert.equal(response.value.status, 'fenced');
      for (const field of ['context', 'nativeContext', 'answer']) assert.equal(response.value[field], null);
      first ??= response; c.report.recoveredAnswers.push({ id: admitted.id, rawSha256: response.rawSha256 });
    }
    c.report.replayed = await c.api.request('/prepared-answers', 'POST', checkpoint.admissions[0].input);
    assert.equal(c.report.replayed.rawSha256, first.rawSha256);
    await c.stop();
    c.report.recoveredState = inspect(c.data, db => {
      const ids = db.prepare('SELECT id FROM answer_attempts ORDER BY id').all().map(row => row.id);
      assert.deepEqual(ids, c.report.dependencies);
      assert.equal(db.prepare('SELECT count(*) rows FROM answer_attempts WHERE context IS NOT NULL OR result IS NOT NULL').get().rows, 0);
      const storage = db.prepare('SELECT count(*) rows,sum(purged) purged,sum(witnessBytes) bytes FROM answer_witnesses').get();
      assert.deepEqual({ ...storage }, { rows: 64, purged: 64, bytes: 0 });
      assert.equal(db.prepare("SELECT count(*) rows FROM sqlite_master WHERE name='owned_purge_failure'").get().rows, 0);
      return { attempts: ids.length, storage: { ...storage } };
    });
    assert.deepEqual(await inventory(pendingData), c.report.pendingCheckpoint.files);
    c.report.pendingCheckpointUnchanged = true;
  });
}
