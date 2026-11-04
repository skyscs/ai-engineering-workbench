import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
// @ts-expect-error Opt-in independent experiment; no frozen corpus or runner.
import { createPreparedReads } from '../../../scripts/loredock-prepared-reads/reuse.mjs';

class Store {
  db = new DatabaseSync(':memory:');
  constructor() { assert.equal(this.one<{ n: number }>('SELECT 1 n')!.n, 1); }
  one<T>(sql: string, ...args: SQLInputValue[]) { return this.db.prepare(sql).get(...args) as T | undefined; }
  all<T>(sql: string, ...args: SQLInputValue[]) { return this.db.prepare(sql).all(...args) as T[]; }
  run(sql: string, ...args: SQLInputValue[]) { return this.db.prepare(sql).run(...args); }
  close() { this.db.close(); }
}
interface ScopedStore extends Store { withPreparedReads<T>(fn: () => T | Promise<T>): Promise<T> }
function setup(limits?: { statements?: number; sqlBytes?: number }) {
  const { CatalogStore } = createPreparedReads({ CatalogStore: Store, CodePaths: class {} }, limits);
  const store = new CatalogStore() as ScopedStore, counts = new Map<string, number>(), prepare = store.db.prepare.bind(store.db);
  store.db.prepare = sql => { counts.set(sql, (counts.get(sql) ?? 0) + 1); return prepare(sql); };
  return { store, count: (sql: string) => counts.get(sql) ?? 0 };
}

test('read scope reexecutes with fresh positional bindings, rows, mutations and native shapes', async t => {
  const { store, count } = setup(); t.after(() => store.close());
  store.db.exec("CREATE TABLE sample(id INTEGER PRIMARY KEY,value TEXT); INSERT INTO sample VALUES (1,'first'),(2,'second')");
  const sql = 'SELECT value FROM sample WHERE id=?';
  await store.withPreparedReads(async () => {
    const first = store.one<{ value: string }>(sql, 1)!; assert.equal(Object.getPrototypeOf(first), null);
    first.value = 'caller mutation';
    assert.equal(store.one<{ value: string }>(sql, 2)!.value, 'second');
    assert.equal(store.one<{ value: string }>(sql, 1)!.value, 'first');
    assert.equal(store.one(sql, 99), undefined); assert.deepEqual(store.all(sql, 99), []);
    store.run('UPDATE sample SET value=? WHERE id=?', 'changed', 1);
    assert.equal(store.all<{ value: string }>(sql, 1)[0]!.value, 'changed');
    await Promise.resolve(); assert.equal(store.one<{ value: string }>(sql, 1)!.value, 'changed');
  });
  assert.equal(count(sql), 1);
  await store.withPreparedReads(() => store.one(sql, 2)); assert.equal(count(sql), 2);
  store.one(sql, 1); store.one(sql, 1); assert.equal(count(sql), 4);
});

test('count/text caps and non-read statements fall back without changing execution', async t => {
  for (const limits of [{ statements: 1 }, { sqlBytes: Buffer.byteLength('SELECT ? value') }, { statements: 0 }, { sqlBytes: 0 }]) {
    const { store, count } = setup(limits); t.after(() => store.close());
    store.db.exec('CREATE TABLE sample(value INTEGER)');
    const first = 'SELECT ? value', next = 'SELECT ? longer_value';
    await store.withPreparedReads(() => {
      for (let i = 0; i < 3; i++) {
        assert.equal(store.one<{ value: number }>(first, i)!.value, i);
        assert.equal(store.one<{ longer_value: number }>(next, i)!.longer_value, i);
        store.all('INSERT INTO sample VALUES (?) RETURNING value', i);
        store.run('INSERT INTO sample VALUES (?)', i);
      }
    });
    assert.equal(count(first), 'statements' in limits && limits.statements === 0 || 'sqlBytes' in limits && limits.sqlBytes === 0 ? 3 : 1);
    assert.equal(count(next), 3); assert.equal(count('INSERT INTO sample VALUES (?) RETURNING value'), 3);
    assert.equal(count('INSERT INTO sample VALUES (?)'), 3);
    assert.equal(store.one<{ n: number }>('SELECT count(*) n FROM sample')!.n, 6);
  }
});

test('execution and callback failures release statements and preserve original errors', async t => {
  const { store, count } = setup(); t.after(() => store.close()); const sql = 'SELECT ? value';
  await store.withPreparedReads(() => {
    store.one(sql, 1);
    assert.throws(() => store.one(sql, 1, 2), /bind|range|column/i);
    assert.equal(store.one<{ value: number }>(sql, 3)!.value, 3);
    assert.equal(count(sql), 2);
    assert.throws(() => store.one('SELECT missing FROM absent'), /absent/);
  });
  const expected = new Error('Independent deliberate callback failure.');
  await assert.rejects(store.withPreparedReads(async () => { store.one(sql, 4); await Promise.resolve(); throw expected; }), error => error === expected);
  await store.withPreparedReads(() => store.one(sql, 5)); assert.equal(count(sql), 4);
});

test('omitted/null/binary bindings match freshly prepared SQLite reads', async t => {
  const { store } = setup(); t.after(() => store.close()); const sql = 'SELECT ? first, ? second';
  await store.withPreparedReads(() => {
    for (const args of [[1, 'value'], [], [2], [null, Buffer.from('binary')], [3, null], []] as SQLInputValue[][]) {
      const expected = store.db.prepare(sql).get(...args);
      assert.deepEqual(store.one(sql, ...args), expected);
      assert.deepEqual(store.all(sql, ...args), expected ? [expected] : []);
    }
  });
});

test('reused statements observe external commits, data_version and schema changes', async t => {
  const root = mkdtempSync(path.join(tmpdir(), 'prepared-sqlite-')), file = path.join(root, 'data.db');
  class FileStore extends Store { constructor() { super(); this.db.close(); this.db = new DatabaseSync(file); } }
  const { CatalogStore } = createPreparedReads({ CatalogStore: FileStore, CodePaths: class {} });
  const store = new CatalogStore() as ScopedStore, writer = new DatabaseSync(file);
  t.after(() => { writer.close(); store.close(); rmSync(root, { recursive: true }); });
  writer.exec("CREATE TABLE sample(value TEXT); INSERT INTO sample VALUES ('before')");
  await store.withPreparedReads(() => {
    const version = store.one<{ data_version: number }>('PRAGMA data_version')!.data_version;
    assert.equal(store.one<{ value: string }>('SELECT * FROM sample')!.value, 'before');
    writer.exec("UPDATE sample SET value='after'; ALTER TABLE sample ADD COLUMN extra INTEGER DEFAULT 7");
    assert.notEqual(store.one<{ data_version: number }>('PRAGMA data_version')!.data_version, version);
    const row = store.one<{ value: string; extra: number }>('SELECT * FROM sample')!;
    assert.equal(row.value, 'after'); assert.equal(row.extra, 7);
  });
});

test('overlapping, nested and expired async work never inherits an active statement cache', async t => {
  const { store, count } = setup(); t.after(() => store.close()); const sql = 'SELECT ? value';
  let release!: () => void, started!: () => void, late!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), entered = new Promise<void>(resolve => { started = resolve; });
  const lateGate = new Promise<void>(resolve => { late = resolve; }); let descendant!: Promise<void>;
  const running = store.withPreparedReads(async () => {
    store.one(sql, 1); started();
    descendant = lateGate.then(() => { store.one(sql, 9); store.one(sql, 10); });
    await gate; store.one(sql, 2);
    await store.withPreparedReads(() => { store.one(sql, 3); store.one(sql, 4); });
    store.one(sql, 5);
  });
  await entered; store.one(sql, 6); store.one(sql, 7);
  await store.withPreparedReads(() => store.one(sql, 8));
  release(); await running; assert.equal(count(sql), 6);
  late(); await descendant; assert.equal(count(sql), 8);
  await store.withPreparedReads(() => { store.one(sql, 11); store.one(sql, 12); }); assert.equal(count(sql), 9);
});

test('recursive SQL execution uses a fresh statement and close invalidates live scopes', async () => {
  const { store, count } = setup(); const sql = 'SELECT recursive_value(?) value'; let inside = false;
  store.db.function('recursive_value', (value: unknown) => {
    if (inside) return value as number;
    inside = true; try { return store.one<{ value: number }>(sql, value as number)!.value; } finally { inside = false; }
  });
  await store.withPreparedReads(() => {
    assert.equal(store.one<{ value: number }>(sql, 1)!.value, 1);
    assert.equal(store.one<{ value: number }>(sql, 2)!.value, 2);
  });
  assert.equal(count(sql), 3);
  await store.withPreparedReads(async () => {
    store.one('SELECT 1'); store.close(); await Promise.resolve();
    assert.throws(() => store.one('SELECT 1'), /not open|closed/i);
  });
});

test('read statement configuration rejects unknown and increased limits', () => {
  for (const limits of [{ statements: 65 }, { sqlBytes: 65537 }, { statements: -1 }, { sqlBytes: NaN }, { statements: 0.5 }, { extra: 1 }])
    assert.throws(() => createPreparedReads({ CatalogStore: Store, CodePaths: class {} }, limits));
});
