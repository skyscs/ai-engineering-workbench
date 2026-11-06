import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HeapLedger } from '../loredock-parser-coverage/ledger.mjs';
import { plan, sourceFiles } from '../loredock-parser-coverage/plan.mjs';
import { createHash } from 'node:crypto';

const settled = () => new Promise(resolve => setImmediate(resolve));
function control(options = {}) {
  let clock = 0; const events = [];
  const ledger = new HeapLedger({ now: () => clock, emit: row => events.push(row), ...options });
  return { ledger, events, at: value => { clock = value; } };
}
test('missing early worker statistics remain rejected and never become zero', async () => {
  const { ledger, at } = control(); let online = false;
  ledger.add(1, 1, 2, () => { if (!online) throw Object.assign(new Error(), { code: 'ERR_WORKER_NOT_RUNNING' }); return { used_heap_size: 123 }; });
  at(2); ledger.tick(); await settled(); online = true; at(30); ledger.tick(); await settled();
  const report = ledger.close();
  assert.equal(report.requests[0].status, 'rejected'); assert.equal(report.requests[0].heap, null);
  assert.deepEqual(report.workers[0].firstSuccessfulWindow, [30, 30]);
  assert.equal(report.completeStartup, false); assert.equal(report.simultaneousHeapPeakBytes, null);
});
test('slow sample has one outstanding request and unknown sample instant', async () => {
  const { ledger, at } = control(); let resolve;
  ledger.add(1, 0, 1, () => new Promise(done => { resolve = done; }));
  at(5); ledger.tick(); at(15); ledger.tick(); at(25); ledger.tick(); at(90);
  resolve({ used_heap_size: 64 }); await settled();
  const report = ledger.close(); assert.equal(report.requests.length, 1); assert.equal(report.workers[0].skipped, 2);
  assert.deepEqual(report.workers[0].firstSuccessfulWindow, [5, 90]); assert.equal(report.requests[0].measurementAt, null);
});
test('never-settling request does not block observer close or become success after close', async () => {
  const { ledger, at } = control(); let resolve;
  ledger.add(1, 0, 1, () => new Promise(done => { resolve = done; })); ledger.tick(); at(100);
  const first = ledger.close(); assert.equal(first.workers[0].pendingAtClose, 1);
  assert.equal(first.workers[0].sampledHeapMaximumBytes, null); assert.equal(first.requests[0].status, 'pending');
  resolve({ used_heap_size: 999 }); await settled(); ledger.tick(); assert.deepEqual(ledger.report(), first);
});
test('exit preserves pending rejection and prevents new requests', async () => {
  const { ledger, at } = control(); let reject;
  ledger.add(1, 0, 1, () => new Promise((_, fail) => { reject = fail; })); ledger.tick();
  at(10); ledger.exit(1); ledger.tick(); at(20); reject(Object.assign(new Error(), { code: 'ERR_WORKER_NOT_RUNNING' })); await settled();
  const report = ledger.close(); assert.equal(report.requests.length, 1); assert.equal(report.requests[0].status, 'rejected');
  assert.equal(report.workers[0].exitedAt, 10); assert.equal(report.workers[0].lastSuccessfulWindow, null);
});
test('successful reply delivered after exit retains an uncertain interval across exit', async () => {
  const { ledger, at, events } = control(); let resolve;
  ledger.add(1, 0, 1, () => new Promise(done => { resolve = done; })); at(2); ledger.tick(); at(5); ledger.exit(1);
  at(8); resolve({ used_heap_size: 100 }); await settled();
  assert.deepEqual(ledger.close().workers[0].lastSuccessfulWindow, [2, 8]); assert.equal(events.at(-1).afterExit, true);
});
test('independent isolate maxima are never combined into a simultaneous peak', async () => {
  const { ledger, at } = control(); ledger.add(1, 0, 1, () => ({ used_heap_size: 10 })); ledger.add(2, 0, 1, () => ({ used_heap_size: 20 }));
  at(10); ledger.tick(); await settled(); const report = ledger.close();
  assert.deepEqual(report.workers.map(row => row.sampledHeapMaximumBytes), [10, 20]);
  assert.equal(report.simultaneousHeapPeakBytes, null); assert.equal(report.completeIsolateSet, false);
});
test('malformed statistics and observation capacity failure remain explicit', async () => {
  const { ledger } = control({ requestLimit: 1 }); ledger.add(1, 0, 1, () => ({ used_heap_size: -1 }));
  ledger.tick(); await settled(); assert.equal(ledger.report().requests[0].status, 'invalid');
  assert.throws(() => ledger.tick(), /bound exceeded/);
  assert.throws(() => ledger.add(1, 0, 1, () => ({})), /registration/);
});
test('prospective files, modes and unchanged ceilings remain explicit', () => {
  assert.deepEqual(plan.modes, ['source', 'emitted']); assert.equal(plan.resourceQualification, false);
  assert.equal(plan.limits.wholeHeapBytes, 67108864); assert.equal(plan.limits.startupOrIntervalMs, 100);
  for (const file of plan.files) assert.equal(createHash('sha256').update(sourceFiles[file.path]).digest('hex'), file.sha256);
});
