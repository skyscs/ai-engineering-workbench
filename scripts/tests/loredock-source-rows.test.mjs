import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { assertSourceRowsEqual } from '../loredock-memory-runner/source-rows.mjs';

test('SQLite source columns survive JSON handoff without requiring object prototypes', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec("CREATE TABLE headers (sourceId TEXT, revision TEXT, omitted INTEGER, error TEXT); INSERT INTO headers VALUES ('one','abcd',0,NULL),('two','ef01',1,'gap')");
    const rows = db.prepare('SELECT * FROM headers ORDER BY rowid').all();
    assert.equal(Object.getPrototypeOf(rows[0]), null);
    const recorded = JSON.parse(JSON.stringify(rows));
    assert.throws(() => assert.deepEqual(rows, recorded));
    assertSourceRowsEqual(rows, recorded);
    const mutations = [
      [{ ...recorded[0], revision: 'changed' }, recorded[1]],
      [{ ...recorded[0], extra: null }, recorded[1]],
      [Object.fromEntries(Object.entries(recorded[0]).filter(([key]) => key !== 'error')), recorded[1]],
      [...recorded].reverse(), recorded.slice(1),
    ];
    for (const changed of mutations) assert.throws(() => assertSourceRowsEqual(rows, changed), /column values/);
  } finally { db.close(); }
});

test('source row comparison refuses values that JSON could omit or coerce', () => {
  for (const value of [undefined, NaN, Infinity, 1n, {}, [], () => {}])
    assert.throws(() => assertSourceRowsEqual([{ value }], [{ value }]), /JSON scalars/);
  for (const row of [new Date(), Object.create({ value: 1 }), { get value() { throw new Error('Getter executed'); } },
    { [Symbol('hidden')]: 1 }, Object.defineProperty({}, 'hidden', { value: 1 })])
    assert.throws(() => assertSourceRowsEqual([row], [row]), /prototype|data fields/);
  assert.throws(() => assertSourceRowsEqual(new Array(1), new Array(1)), /dense/);
  assert.throws(() => assertSourceRowsEqual([{ value: -0 }], [{ value: 0 }]), /column values/);
});
