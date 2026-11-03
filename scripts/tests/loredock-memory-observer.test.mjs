import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { MemoryObserver } from '../loredock-capture-memory/observer.mjs';
import { resourceFailures, validateObservation } from '../loredock-capture-memory/validate.mjs';

test('memory observation counts prepared templates without changing queries or retaining parameters', () => {
  const db = new DatabaseSync(':memory:'), original = db.prepare;
  const observer = new MemoryObserver(true, { phaseRecords: 3, queryIdentities: 1 }), detach = observer.attach(db);
  try {
    observer.begin(); assert.equal(db.prepare('SELECT ? n').get('owned-value').n, 'owned-value');
    assert.equal(db.prepare('SELECT ? n').get(9).n, 9); observer.phase('read', { rows: 1 });
    const result = observer.end(); assert.equal(result.prepareCalls, 2); assert.equal(result.queries.length, 1); assert.equal(result.queries[0].calls, 2);
    assert.ok(!JSON.stringify(result).includes('owned-value')); assert.ok(!JSON.stringify(result).includes('SELECT'));
    observer.begin(); assert.throws(() => db.prepare('SELECT 2'), { code: 'DIAGNOSTIC_LIMIT' }); observer.end();
    detach(); assert.equal(db.prepare, original); assert.equal(db.prepare('SELECT 2 n').get().n, 2);
  } finally { detach(); db.close(); }
});
test('phase overflow releases observation ownership and disabled instrumentation stays empty', () => {
  const observer = new MemoryObserver(true, { phaseRecords: 2 }); observer.begin(); observer.phase('one');
  assert.throws(() => observer.end(), { code: 'DIAGNOSTIC_LIMIT' }); observer.begin(); assert.equal(observer.end().phases.length, 2);
  const disabled = new MemoryObserver(false); disabled.begin(); disabled.phase('ignored', { rows: 100 });
  assert.deepEqual(disabled.end().phases, []); assert.deepEqual(disabled.result().queries, []);
});
test('a resource failure does not prevent independent integrity validation', () => {
  const row = { name: 'history', wallMs: 4, maxSliceMs: 4, peakRssMiB: 410, heapGrowthMiB: 70,
    before: { gitCalls: 0, writeCalls: 0, changedRows: 0, factReads: 0, pathReads: 0, snapshots: 0 },
    after: { gitCalls: 0, writeCalls: 0, changedRows: 0, factReads: 0, pathReads: 0, snapshots: 0 },
    legacyBefore: 'same', legacyAfter: 'same', sums: { path: 0, receipt: 5 },
    metrics: { pathWork: 0, receiptWork: 5, totalWork: 5, accountingVersion: 'shared-capture-work/1' },
    instrumentation: { enabled: false, phases: [], queries: [] } };
  const oracle = { limits: { wallMs: 5000, work: 1000000 }, resources: { maxSliceMs: 150, sampledRssMiB: 384, sampledHeapGrowthMiB: 64 } };
  assert.equal(resourceFailures(row, oracle).length, 2); assert.doesNotThrow(() => validateObservation(row, 'instrumentation-control', oracle));
  row.after.factReads = 1; assert.throws(() => validateObservation(row, 'instrumentation-control', oracle));
});
