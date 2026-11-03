import assert from 'node:assert/strict';

// /proc status can omit the memory section during exit even with a sampled R state.
// Missing samples remain explicit; a living child cannot go unobserved indefinitely.
export function createRssObservation() {
  const report = { samples: 0, peakRssBytes: 0, missingSamples: 0, maximumMissingMs: 0, lastMissingState: null, unavailableLimitMs: 100 };
  let since, previous = 0;
  function elapsed(now) {
    assert.ok(Number.isFinite(now) && now >= previous); previous = now;
    if (since !== undefined) report.maximumMissingMs = Math.max(report.maximumMissingMs, now - since);
  }
  return { report,
    sample(status, now) {
      elapsed(now); let rss, state = 'unavailable';
      if (status !== null) {
        assert.equal(typeof status, 'string');
        const found = /^State:\s+([A-Za-z])\b/m.exec(status); assert.ok(found, 'Missing process state.'); state = found[1];
        const match = /^VmRSS:\s+(\d+) kB[ \t]*$/m.exec(status);
        assert.ok(match || !/^VmRSS:/m.test(status), 'Malformed RSS observation.');
        if (match) { rss = Number(match[1]) * 1024; assert.ok(Number.isSafeInteger(rss) && rss >= 0); }
      }
      if (rss === undefined) {
        since ??= now; report.missingSamples++; report.lastMissingState = state;
        return { rss: null, overdue: now - since >= report.unavailableLimitMs };
      }
      since = undefined; report.samples++; report.peakRssBytes = Math.max(report.peakRssBytes, rss);
      return { rss, overdue: false };
    },
    finish(now) { elapsed(now); },
  };
}
