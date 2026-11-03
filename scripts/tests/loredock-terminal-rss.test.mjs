import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRssObservation } from '../loredock-terminal-ownership/rss.mjs';

test('RSS exit gaps remain missing observations instead of fabricated zeros or zombie-only assertions', () => {
  const probe = createRssObservation();
  assert.deepEqual(probe.sample('State:\tR (running)\nVmRSS:\t100 kB\n', 1), { rss: 102400, overdue: false });
  assert.deepEqual(probe.sample('State:\tR (running)\nThreads:\t1\n', 10), { rss: null, overdue: false });
  probe.finish(11);
  assert.equal(probe.report.samples, 1); assert.equal(probe.report.missingSamples, 1);
  assert.equal(probe.report.peakRssBytes, 102400); assert.equal(probe.report.lastMissingState, 'R');
  assert.equal(probe.report.maximumMissingMs, 1);
});

test('prolonged unavailable RSS fails supervision while recovery resets the gap', () => {
  const probe = createRssObservation();
  assert.equal(probe.sample(null, 0).overdue, false);
  assert.equal(probe.sample('State:\tZ (zombie)\n', 99).overdue, false);
  assert.equal(probe.sample(null, 100).overdue, true);
  assert.equal(probe.sample('State:\tR (running)\nVmRSS:\t150 kB\n', 101).overdue, false);
  assert.equal(probe.sample(null, 102).overdue, false);
  assert.equal(probe.report.samples, 1); assert.equal(probe.report.missingSamples, 4);
  assert.throws(() => probe.sample('State:\tR (running)\nVmRSS:\tinvalid\n', 103));
  assert.throws(() => probe.sample('VmRSS:\t1 kB\n', 104));
  assert.throws(() => probe.sample(null, 1));
});
