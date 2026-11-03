import assert from 'node:assert/strict';

// SQLite returns null-prototype records. JSON preserves their columns, not prototypes.
// Copy only own enumerable data fields; never coerce, select columns or sort rows.
function scalarRows(rows) {
  assert.ok(Array.isArray(rows), 'Source rows must be an array.');
  assert.deepEqual(Object.keys(rows), Array.from({ length: rows.length }, (_, index) => String(index)), 'Source rows must be dense.');
  return rows.map(row => {
    assert.ok(row !== null && typeof row === 'object' && !Array.isArray(row), 'Invalid source row.');
    assert.ok([null, Object.prototype].includes(Object.getPrototypeOf(row)), 'Unsupported source row prototype.');
    const entries = Reflect.ownKeys(row).map(key => {
      const field = Object.getOwnPropertyDescriptor(row, key);
      assert.ok(typeof key === 'string' && field.enumerable && Object.hasOwn(field, 'value'), 'Source columns must be enumerable data fields.');
      const value = field.value;
      assert.ok(value === null || typeof value === 'string' || typeof value === 'boolean'
        || (typeof value === 'number' && Number.isFinite(value)), 'Source columns must be JSON scalars.');
      return [key, value];
    });
    return Object.fromEntries(entries);
  });
}

export function assertSourceRowsEqual(actual, recorded) {
  assert.deepEqual(scalarRows(actual), scalarRows(recorded), 'Recorded source rows differ from SQLite column values.');
}
