import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessDaemonSamples } from '../loredock-prepared-flow/cold-warm-cases.mjs';

const sample = (event, now, fields = {}) => ({ event, now, gapMs: 10, rss: 100, heapUsed: 50, processHighWaterRssBytes: 100, ...fields });
test('daemon assessment preserves a final OS peak and the full raw timer gap', () => {
  const result = assessDaemonSamples([sample('start', 0), sample('sample', 101, { gapMs: 101 }),
    sample('exit-0', 111, { processHighWaterRssBytes: 402653185 })]);
  assert.equal(result.passed, false);
  assert.deepEqual(result.checks.filter(row => !row.passed).map(row => row.metric), ['osHighWaterRssBytes', 'rawIntervalGapMs']);
  assert.equal(result.measured.rawIntervalGapMs, 101); assert.equal(result.resourceQualification, false);
});
test('missing, failed, malformed and reordered process lifetimes are not passing samples', () => {
  for (const rows of [[], [sample('start', 0)], [sample('start', 0), sample('exit-1', 10)],
    [sample('start', 0), sample('exit-0', 10, { rss: NaN })], [sample('start', 10), sample('exit-0', 0)],
    [sample('start', 0), sample('start', 10), sample('exit-0', 20)]]) assert.throws(() => assessDaemonSamples(rows));
});
test('each daemon ceiling is inclusive and never grants whole-flow qualification', () => {
  const result = assessDaemonSamples([sample('start', 0), sample('exit-0', 100, {
    gapMs: 100, rss: 402653184, processHighWaterRssBytes: 402653184, heapUsed: 67108864 })]);
  assert(result.passed); assert.equal(result.resourceQualification, false);
});
