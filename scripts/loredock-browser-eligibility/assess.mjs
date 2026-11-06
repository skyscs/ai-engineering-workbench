import assert from 'node:assert/strict';
import { plan } from './plan.mjs';

export function assess({ samples, browser, idle, lifetime, diagnosticErrors = [] }) {
  assert(Array.isArray(samples) && samples.length > 0 && samples.length <= 2000);
  assert(lifetime && Number.isFinite(lifetime.began) && Number.isFinite(lifetime.ended) && lifetime.ended >= lifetime.began);
  const failures = [], gaps = [], complete = [];
  for (let index = 0; index < samples.length; index++) {
    const row = samples[index];
    assert(Number.isFinite(row.began) && Number.isFinite(row.at) && row.at >= row.began);
    assert(Number.isSafeInteger(row.rssBytes) && row.rssBytes >= 0 && Array.isArray(row.rows));
    if (index) { const gap = row.began - samples[index - 1].began; assert(gap >= 0); gaps.push(gap); }
    if (!row.complete || !row.rows.length || row.rows.some(process => !process.complete)) {
      failures.push({ code: 'INCOMPLETE_RSS_SAMPLE', index }); continue;
    }
    assert(row.rows.every(process => Number.isSafeInteger(process.rssBytes) && process.rssBytes >= 0));
    assert.equal(row.rssBytes, row.rows.reduce((sum, process) => sum + process.rssBytes, 0));
    complete.push(row.rssBytes);
  }
  const peak = Math.max(...samples.map(row => row.rssBytes));
  if (peak > plan.rssBytes) failures.push({ code: 'RSS_LIMIT', actual: peak, limit: plan.rssBytes });
  // The original protocol requests sampling at most every 100 ms. Preserve actual gaps.
  const maxGap = gaps.length ? Math.max(...gaps) : null;
  if (maxGap === null || maxGap > plan.rawCadenceMs) failures.push({ code: 'SAMPLING_GAP', actual: maxGap, limit: plan.rawCadenceMs });
  const startGap = samples[0].began - lifetime.began, endGap = lifetime.ended - samples.at(-1).at;
  assert(startGap >= 0 && endGap >= 0);
  if (startGap > plan.rawCadenceMs) failures.push({ code: 'STARTUP_SAMPLE_GAP', actual: startGap, limit: plan.rawCadenceMs });
  if (endGap > plan.rawCadenceMs) failures.push({ code: 'EXIT_SAMPLE_GAP', actual: endGap, limit: plan.rawCadenceMs });
  if (browser.code !== 0 || browser.sampleError || browser.errors?.length || diagnosticErrors.length
    || browser.lifetime?.reason !== 'completed' || browser.lifetime?.driverExit?.exit !== 0
    || !Array.isArray(browser.lifetime?.survivors) || browser.lifetime.survivors.length) failures.push({ code: 'LIFETIME_FAILURE' });
  if (browser.memorySamples !== samples.length || browser.incompleteMemorySamples !== samples.length - complete.length
    || browser.maxRssBytes !== peak) failures.push({ code: 'SAMPLE_RECEIPT_MISMATCH' });
  if (!idle || idle.apiRequests !== 0 || idle.pendingAtEnd?.length !== 0 || idle.elapsedMs < plan.idleMs
    || idle.elapsedMs > plan.wholeMs || lifetime.ended - lifetime.began < idle.elapsedMs) failures.push({ code: 'INVALID_BLANK_CONTROL' });
  return { eligible: failures.length === 0, failures, samples: samples.length, completeSamples: complete.length,
    maximumRecordedRssBytes: peak, maximumCompleteSampleRssBytes: complete.length ? Math.max(...complete) : null,
    maximumSampleStartGapMs: maxGap, startupSampleGapMs: startGap, exitSampleGapMs: endGap,
    nominalCadenceMs: plan.rawCadenceMs, rssLimitBytes: plan.rssBytes,
    resourceQualification: false, scope: 'One blank-browser environment control; no daemon, application page or repaired full-flow qualification.' };
}
