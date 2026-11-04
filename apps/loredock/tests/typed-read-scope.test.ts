import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { PreparedReadScope, type PreparedReadLimits } from '../src/prepared-read-scope.js';
// @ts-expect-error Frozen helper comparison on independent tiny SQLite inputs.
import { createPreparedReads } from '../../../scripts/loredock-prepared-reads/reuse.mjs';

class Store {
  readonly db: DatabaseSync;
  constructor(file = ':memory:') { this.db = new DatabaseSync(file); }
  one<T>(sql: string, ...args: SQLInputValue[]) { return this.db.prepare(sql).get(...args) as T | undefined; }
  all<T>(sql: string, ...args: SQLInputValue[]) { return this.db.prepare(sql).all(...args) as T[]; }
  run(sql: string, ...args: SQLInputValue[]) { return this.db.prepare(sql).run(...args); }
  close() { this.db.close(); }
}
interface Scoped extends Store { withPreparedReads<T>(action: () => T | Promise<T>): Promise<T> }
function setup(typed: boolean, limits: Partial<PreparedReadLimits> = {}, file = ':memory:') {
  class TypedStore extends Store {
    readonly reads = new PreparedReadScope(this.db, limits);
    override one<T>(sql: string, ...args: SQLInputValue[]) { return this.reads.execute('get', sql, args, () => super.one<T>(sql, ...args)); }
    override all<T>(sql: string, ...args: SQLInputValue[]) { return this.reads.execute('all', sql, args, () => super.all<T>(sql, ...args)); }
    withPreparedReads<T>(action: () => T | Promise<T>) { return this.reads.run(action); }
    override close() { this.reads.close(); super.close(); }
  }
  const Constructor = typed ? TypedStore : createPreparedReads({ CatalogStore: Store, CodePaths: class {} }, limits).CatalogStore;
  const store = new Constructor(file) as Scoped, counts = new Map<string, number>(), prepare = store.db.prepare.bind(store.db);
  store.db.prepare = sql => { counts.set(sql, (counts.get(sql) ?? 0) + 1); return prepare(sql); };
  return { store, counts, count: (sql: string) => counts.get(sql) ?? 0 };
}

test('typed scope preserves native values, current bindings, writes and preparation counts', async () => {
  const traces = [];
  for (const typed of [false, true]) {
    const { store, counts } = setup(typed), rows: unknown[] = [];
    try {
      store.db.exec('CREATE TABLE readings(id INTEGER PRIMARY KEY,value TEXT)');
      const sql = 'SELECT ? first, ? second';
      await store.withPreparedReads(async () => {
        for (const args of [[1, 'fresh'], [null, Buffer.from('owned')], [], [2], [3, null], []] as SQLInputValue[][]) {
          const expected = store.db.prepare(sql).get(...args), actual = store.one(sql, ...args);
          assert.deepEqual(actual, expected); assert.equal(Object.getPrototypeOf(actual), null);
          assert.deepEqual(store.all(sql, ...args), [expected]); rows.push(actual);
        }
        store.run('INSERT INTO readings VALUES (?,?)', 1, 'before');
        const query = 'SELECT value FROM readings WHERE id=?', first = store.one<{ value: string }>(query, 1)!;
        first.value = 'caller mutation'; assert.equal(store.one<{ value: string }>(query, 1)!.value, 'before');
        assert.equal(store.one(query, 2), undefined); assert.deepEqual(store.all(query, 2), []);
        store.run('UPDATE readings SET value=? WHERE id=?', 'after', 1); await Promise.resolve();
        assert.equal(store.one<{ value: string }>(query, 1)!.value, 'after');
      });
      traces.push({ rows, counts });
    } finally { store.close(); }
  }
  assert.deepEqual(traces[1], traces[0]);
});

test('typed scope retains count/byte fallback and never reuses writes or noneligible queries', async () => {
  for (const limits of [{ statements: 1 }, { sqlBytes: 14 }, { statements: 0 }, { sqlBytes: 0 }]) {
    const traces = [];
    for (const typed of [false, true]) {
      const { store, counts } = setup(typed, limits);
      try {
        store.db.exec('CREATE TABLE totals(value INTEGER)');
        await store.withPreparedReads(() => {
          for (let i = 0; i < 3; i++) {
            assert.equal(store.one<{ value: number }>('SELECT ? value', i)!.value, i);
            assert.equal(store.one<{ longer: number }>('SELECT ? longer', i)!.longer, i);
            store.all('INSERT INTO totals VALUES (?) RETURNING value', i);
            store.one('PRAGMA user_version');
          }
        });
        assert.equal(store.one<{ n: number }>('SELECT count(*) n FROM totals')!.n, 3); traces.push(counts);
      } finally { store.close(); }
    }
    assert.deepEqual(traces[1], traces[0]);
  }
});

test('typed scope observes external committed data/schema and preserves failure cleanup', async () => {
  for (const typed of [false, true]) {
    const root = mkdtempSync(path.join(tmpdir(), 'typed-read-')), file = path.join(root, 'owned.db');
    const { store, count } = setup(typed, {}, file), writer = new DatabaseSync(file), sql = 'SELECT * FROM readings';
    try {
      writer.exec("CREATE TABLE readings(value TEXT); INSERT INTO readings VALUES ('before')");
      await store.withPreparedReads(() => {
        const version = store.one<{ data_version: number }>('PRAGMA data_version')!.data_version;
        assert.equal(store.one<{ value: string }>(sql)!.value, 'before');
        writer.exec("UPDATE readings SET value='after'; ALTER TABLE readings ADD COLUMN count INTEGER DEFAULT 9");
        assert.notEqual(store.one<{ data_version: number }>('PRAGMA data_version')!.data_version, version);
        assert.deepEqual({ ...store.one<Record<string, unknown>>(sql) }, { value: 'after', count: 9 });
        assert.throws(() => store.one('SELECT ? value', 1, 2));
        assert.equal(store.one<{ value: number }>('SELECT ? value', 3)!.value, 3);
        assert.equal(count('SELECT ? value'), 2); assert.equal(count(sql), 1);
      });
      const failure = new Error('Owned callback failure.');
      await assert.rejects(store.withPreparedReads(async () => { store.one(sql); await Promise.resolve(); throw failure; }), e => e === failure);
      await store.withPreparedReads(() => store.one(sql)); assert.equal(count(sql), 3);
    } finally { writer.close(); store.close(); rmSync(root, { recursive: true }); }
  }
});

test('typed scope keeps nested, overlapping and expired asynchronous owners isolated', async () => {
  for (const typed of [false, true]) {
    const { store, count } = setup(typed), sql = 'SELECT ? value';
    let release!: () => void, late!: () => void, descendant!: Promise<void>;
    const gate = new Promise<void>(resolve => { release = resolve; }), later = new Promise<void>(resolve => { late = resolve; });
    try {
      const running = store.withPreparedReads(async () => {
        store.one(sql, 1); descendant = later.then(() => { store.one(sql, 8); store.one(sql, 9); });
        await gate; store.one(sql, 2);
        await store.withPreparedReads(() => { store.one(sql, 3); store.one(sql, 4); });
        store.one(sql, 5);
      });
      store.one(sql, 6); await store.withPreparedReads(() => store.one(sql, 7));
      release(); await running; assert.equal(count(sql), 5);
      late(); await descendant; assert.equal(count(sql), 7);
      await store.withPreparedReads(() => { store.one(sql, 10); store.one(sql, 11); }); assert.equal(count(sql), 8);
    } finally { release(); late(); store.close(); }
  }
});

test('typed scope handles recursive execution and releases references before database close', async () => {
  for (const typed of [false, true]) {
    const { store, count } = setup(typed), sql = 'SELECT nested(?) value'; let inside = false;
    store.db.function('nested', (value: unknown) => {
      if (inside) return value as number;
      inside = true; try { return store.one<{ value: number }>(sql, value as number)!.value; } finally { inside = false; }
    });
    await store.withPreparedReads(() => {
      assert.equal(store.one<{ value: number }>(sql, 1)!.value, 1); assert.equal(store.one<{ value: number }>(sql, 2)!.value, 2);
    });
    assert.equal(count(sql), 3);
    await store.withPreparedReads(async () => { store.one('SELECT 1'); store.close(); await Promise.resolve(); assert.throws(() => store.one('SELECT 1')); });
  }
});

test('typed read configuration refuses unknown, invalid and increased limits', () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const limits of [{ statements: 65 }, { sqlBytes: 65537 }, { statements: -1 }, { sqlBytes: NaN }, { statements: 0.5 }, { extra: 1 }])
      assert.throws(() => new PreparedReadScope(db, limits as Partial<PreparedReadLimits>));
    const owner = new PreparedReadScope(db); owner.close(); owner.close();
    // Reference release is distinct from closing a database owned by the caller.
    assert.equal(db.prepare('SELECT 1 n').get()!.n, 1);
  } finally { db.close(); }
});
