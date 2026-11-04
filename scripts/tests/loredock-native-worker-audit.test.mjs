import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { observeQueries } from '../loredock-native-worker-audit/queries.mjs';

test('diagnostic separates preparation from later execution without recording bindings or rows', () => {
  const db = new DatabaseSync(':memory:'), original = db.prepare, audit = observeQueries(db);
  try {
    audit.begin('prepare');
    db.exec('CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT)');
    const insert = db.prepare('INSERT INTO sample VALUES (?,?)');
    const read = db.prepare('SELECT value FROM sample WHERE id=?');
    audit.end(); audit.begin('execute');
    assert.equal(insert.run(1, 'private-binding-sentinel').changes, 1);
    assert.equal(insert.run(2, 'different-binding').lastInsertRowid, 2);
    assert.equal(read.get(1).value, 'private-binding-sentinel');
    assert.deepEqual(read.all(2).map(row => row.value), ['different-binding']);
    assert.deepEqual([...read.iterate(1)].map(row => row.value), ['private-binding-sentinel']);
    assert.throws(() => insert.run(1, 'duplicate'), { code: 'ERR_SQLITE_ERROR' });
    const stage = audit.end();
    assert.equal(stage.queries.reduce((sum, row) => sum + row.prepare, 0), 0);
    assert.equal(stage.queries.reduce((sum, row) => sum + row.run, 0), 3);
    assert.equal(stage.queries.reduce((sum, row) => sum + row.executionErrors, 0), 1);
    const json = JSON.stringify(audit.report());
    assert.ok(!json.includes('private-binding-sentinel') && !json.includes('different-binding'));
    audit.detach(); audit.detach(); assert.equal(db.prepare, original);
    assert.equal(read.get(2).value, 'different-binding');
    assert.equal(JSON.stringify(audit.report()), json);
  } finally { audit.detach(); db.close(); }
});

test('diagnostic retains failed prepare/exec and transaction rollback without replacing errors', () => {
  const db = new DatabaseSync(':memory:'), audit = observeQueries(db);
  try {
    db.exec('CREATE TABLE sample (value INTEGER)'); audit.begin('failures');
    assert.throws(() => db.prepare('SELECT * FROM absent'), { code: 'ERR_SQLITE_ERROR' });
    assert.throws(() => db.exec('INVALID SQL'), { code: 'ERR_SQLITE_ERROR' });
    db.exec('BEGIN'); db.prepare('INSERT INTO sample VALUES (?)').run(7); db.exec('ROLLBACK');
    assert.equal(db.prepare('SELECT count(*) n FROM sample').get().n, 0);
    const row = audit.end();
    assert.equal(row.queries.reduce((sum, item) => sum + item.prepareErrors, 0), 1);
    assert.equal(row.queries.reduce((sum, item) => sum + item.execErrors, 0), 1);
  } finally { audit.detach(); db.close(); }
});

test('diagnostic caps SQL identities and stages, isolates stores and restores the owner', () => {
  const db = new DatabaseSync(':memory:'), second = new DatabaseSync(':memory:');
  const audit = observeQueries(db, { identities: 1, stages: 1 });
  const other = observeQueries(second);
  try {
    assert.throws(() => observeQueries(db), /already/);
    audit.begin('one'); other.begin('independent');
    assert.equal(db.prepare('SELECT ? n').get(3).n, 3);
    assert.equal(second.prepare('SELECT 9 n').get().n, 9);
    assert.throws(() => db.prepare('SELECT 4'), /bound/);
    assert.throws(() => audit.detach(), /Finish/);
    audit.end(); other.end();
    assert.equal(audit.report().templates.length, 1);
    assert.throws(() => audit.begin('two'), /bound/);
    const copy = audit.report(); copy.templates.length = 0;
    assert.equal(audit.report().templates.length, 1);
  } finally { audit.detach(); other.detach(); db.close(); second.close(); }
  const tiny = new DatabaseSync(':memory:'), bounded = observeQueries(tiny, { sqlBytes: 3 });
  try { bounded.begin('bytes'); assert.throws(() => tiny.prepare('SELECT 1'), /bound/); bounded.end(); }
  finally { bounded.detach(); tiny.close(); }
});
