import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { PreparedAnalysisWrites, analysisWriteSql as sql, analysisWriteLimits, type AnalysisWriteLimits } from '../src/prepared-analysis-writes.js';

function setup(t: TestContext, limits: Partial<AnalysisWriteLimits> = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE code_analysis_files (runId TEXT,fileId TEXT,ordinal INTEGER,inputHash,
    status TEXT DEFAULT 'pending',reason TEXT,inputBytes INTEGER,payloadBytes INTEGER,gapCount INTEGER,payload,payloadHash TEXT,checkpointHash TEXT,
    PRIMARY KEY(runId,fileId));
    CREATE TABLE code_analyses (id TEXT PRIMARY KEY,elapsedMs REAL,textBytes INTEGER,payloadBytes INTEGER);
    INSERT INTO code_analyses VALUES ('run',0,0,0);`);
  const prepares = new Map<string, number>(), prepare = db.prepare.bind(db);
  db.prepare = text => { prepares.set(text, (prepares.get(text) ?? 0) + 1); return prepare(text); };
  const owner = new PreparedAnalysisWrites(db, limits);
  const fresh = (text: string, args: SQLInputValue[]) => db.prepare(text).run(...args);
  const execute = (text: string, ...args: SQLInputValue[]) => owner.execute(text, args, () => fresh(text, args));
  t.after(() => { owner.close(); if (db.isOpen) db.close(); });
  return { db, owner, execute, fresh, count: (text: string) => prepares.get(text) ?? 0,
    rows: () => db.prepare('SELECT * FROM code_analysis_files ORDER BY ordinal').all() };
}

test('analysis writes reuse only exact trusted statements with fresh changing/null/blob bindings and results', t => {
  const s = setup(t), values: SQLInputValue[] = ['first', null, Buffer.from([7, 0, 255]), '雪😀'];
  s.owner.runSync(() => {
    for (const [i, value] of values.entries()) {
      const result = s.execute(sql.pending, 'run', 'file-' + i, i, value);
      assert.equal(result.changes, 1); assert.equal(result.lastInsertRowid, i + 1);
    }
    // Omitted bindings must clear earlier values, just like a fresh statement.
    s.execute(sql.pending, 'run', 'file-4', 4);
    s.execute(sql.counters, 3, 7, 9, 'run'); s.execute(sql.counters, 5, 2, 1, 'run');
  });
  assert.equal(s.count(sql.pending), 1); assert.equal(s.count(sql.counters), 1);
  const rows = s.rows();
  assert.equal(rows[0]!.inputHash, 'first'); assert.equal(rows[1]!.inputHash, null);
  assert.deepEqual(rows[2]!.inputHash, new Uint8Array([7, 0, 255])); assert.equal(rows[3]!.inputHash, '雪😀'); assert.equal(rows[4]!.inputHash, null);
  assert.deepEqual({ ...s.db.prepare('SELECT * FROM code_analyses').get() }, { id: 'run', elapsedMs: 5, textBytes: 9, payloadBytes: 10 });
  s.owner.runSync(() => { s.execute(sql.pending + ' ', 'run', 'file-5', 5, 'a'); s.execute(sql.pending + ' ', 'run', 'file-6', 6, 'b'); });
  assert.equal(s.count(sql.pending + ' '), 2);
  s.execute(sql.pending, 'run', 'file-7', 7, 'outside'); assert.equal(s.count(sql.pending), 2);
});

test('checkpoint errors evict the statement, preserve the exact error, and rollback both unit and counters', t => {
  const s = setup(t); const injected = new Error('checkpoint counter failure');
  s.execute(sql.pending, 'run', 'file', 0, 'input');
  s.owner.runSync(() => {
    const checkpoint = () => s.execute(sql.checkpoint, 'parsed', null, 5, 7, 0, 'payload', 'hash', 'checkpoint', 'run', 'file');
    s.db.exec('BEGIN');
    assert.equal(checkpoint().changes, 1);
    assert.throws(() => { throw injected; }, error => error === injected); s.db.exec('ROLLBACK');
    assert.equal(s.rows()[0]!.status, 'pending');
    assert.equal(checkpoint().changes, 1); assert.equal(checkpoint().changes, 0);
    const errorOf = (action: () => unknown) => { try { action(); assert.fail('Expected failure'); } catch (error) {
      const e = error as Error & { code: string; errcode: number; errstr: string }; return [e.code, e.errcode, e.errstr, e.message];
    } };
    const expected = errorOf(() => s.fresh(sql.pending, ['run', 'file', 0, 'duplicate']));
    assert.deepEqual(errorOf(() => s.execute(sql.pending, 'run', 'file', 0, 'duplicate')), expected);
    const before = s.count(sql.pending); s.execute(sql.pending, 'run', 'next', 1, 'ok'); assert.equal(s.count(sql.pending), before + 1);
  });
  assert.equal(s.count(sql.checkpoint), 1);
  assert.equal(s.db.prepare('SELECT textBytes FROM code_analyses').get()!.textBytes, 0);
  const db = { prepare() { return { run() { throw injected; } }; } } as unknown as Pick<DatabaseSync, 'prepare'>;
  const owner = new PreparedAnalysisWrites(db);
  try { owner.runSync(() => assert.throws(() => owner.execute(sql.counters, [], () => assert.fail()), error => error === injected)); }
  finally { owner.close(); }
});

test('retention caps fall back fresh and oversized bindings discard the previous cached entry', t => {
  const s = setup(t, { statements: 1, bindingBytes: 32 });
  s.owner.runSync(() => {
    s.execute(sql.pending, 'run', 'one', 0, 'a'); s.execute(sql.pending, 'run', 'two', 1, 'x'.repeat(33));
    s.execute(sql.pending, 'run', 'three', 2, 'b'); s.execute(sql.pending, 'run', 'four', 3, 'c');
    s.execute(sql.counters, 1, 1, 1, 'run'); s.execute(sql.counters, 2, 1, 1, 'run');
  });
  assert.equal(s.count(sql.pending), 3); assert.equal(s.count(sql.counters), 2);
  for (const limits of [{ statements: 0 }, { sqlBytes: 0 }]) {
    const tiny = setup(t, limits); tiny.owner.runSync(() => { tiny.execute(sql.pending, 'run', 'a', 0, 'x'); tiny.execute(sql.pending, 'run', 'b', 1, 'y'); });
    assert.equal(tiny.count(sql.pending), 2);
  }
  for (const limits of [{ statements: 4 }, { sqlBytes: 4097 }, { bindingBytes: analysisWriteLimits.bindingBytes + 1 },
    { statements: -1 }, { statements: 0.5 }, { bindingBytes: NaN }, { unexpected: 1 }])
    assert.throws(() => new PreparedAnalysisWrites(s.db, limits as Partial<AnalysisWriteLimits>));
});

test('async scopes isolate overlap, nested scopes, other stores and detached work after expiry', async t => {
  const s = setup(t), other = setup(t); let release!: () => void, later!: () => void, detached!: Promise<void>;
  const gate = new Promise<void>(resolve => { release = resolve; }), late = new Promise<void>(resolve => { later = resolve; });
  const first = s.owner.run(async () => {
    s.execute(sql.pending, 'run', 'one', 0, 'a');
    await s.owner.run(() => { s.execute(sql.pending, 'run', 'nested', 1, 'b'); });
    detached = late.then(() => { s.execute(sql.pending, 'run', 'late', 6, 'g'); });
    await gate; s.execute(sql.pending, 'run', 'two', 4, 'e');
  });
  await s.owner.run(() => { s.execute(sql.pending, 'run', 'overlap', 2, 'c'); });
  s.execute(sql.pending, 'run', 'outside', 3, 'd');
  other.owner.runSync(() => { other.execute(sql.pending, 'run', 'one', 0, 'independent'); other.execute(sql.pending, 'run', 'two', 1, 'independent'); });
  release(); await first; later(); await detached;
  assert.equal(s.count(sql.pending), 5); assert.equal(other.count(sql.pending), 1);
  await s.owner.run(() => { s.execute(sql.pending, 'run', 'new', 7, 'h'); }); assert.equal(s.count(sql.pending), 6);
});

test('throw, rejection, sync-returned promises and close cannot extend statement ownership', async t => {
  const s = setup(t), failure = new Error('scope failure');
  assert.throws(() => s.owner.runSync(() => { s.execute(sql.pending, 'run', 'sync', 0, 'a'); throw failure; }), error => error === failure);
  await assert.rejects(s.owner.run(async () => { s.execute(sql.pending, 'run', 'async', 1, 'b'); throw failure; }), error => error === failure);
  await s.owner.runSync(async () => { s.execute(sql.pending, 'run', 'initial', 2, 'c'); await Promise.resolve(); s.execute(sql.pending, 'run', 'expired', 3, 'd'); });
  await s.owner.run(async () => {
    s.execute(sql.pending, 'run', 'before-close', 4, 'e'); s.owner.close(); await Promise.resolve(); s.execute(sql.pending, 'run', 'after-close', 5, 'f');
  });
  assert.equal(s.count(sql.pending), 6); s.owner.close();
  s.db.close(); assert.throws(() => s.execute(sql.pending, 'run', 'closed-db', 6, 'g'), { code: 'ERR_INVALID_STATE' });
});

test('busy write reentrancy uses a fresh statement and preserves all actual writes', t => {
  const s = setup(t), original = s.db.prepare.bind(s.db); let inside = false;
  s.db.prepare = text => {
    const statement = original(text); if (text !== sql.pending) return statement;
    const run = statement.run.bind(statement);
    statement.run = (...args) => {
      if (!inside) { inside = true; try { s.execute(sql.pending, 'run', 'nested', 1, 'nested-value'); } finally { inside = false; } }
      return Reflect.apply(run, undefined, args) as ReturnType<typeof run>;
    }; return statement;
  };
  s.owner.runSync(() => s.execute(sql.pending, 'run', 'outer', 0, 'outer-value'));
  assert.equal(s.count(sql.pending), 2); assert.deepEqual(s.rows().map(row => row.inputHash), ['outer-value', 'nested-value']);
});
