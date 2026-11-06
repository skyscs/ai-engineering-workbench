import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { digestFile, verifyTree } from '../loredock-browser-eligibility/verify.mjs';
import { assess } from '../loredock-browser-eligibility/assess.mjs';

function observation() {
  return { samples: Array.from({ length: 301 }, (_, index) => index * 100).map(began => ({ began, at: began + 1, complete: true, rssBytes: 100,
    rows: [{ pid: 1, complete: true, rssBytes: 100 }] })),
  browser: { code: 0, sampleError: null, errors: [], memorySamples: 301, incompleteMemorySamples: 0, maxRssBytes: 100,
    lifetime: { reason: 'completed', driverExit: { exit: 0 }, survivors: [] } },
  idle: { apiRequests: 0, pendingAtEnd: [], elapsedMs: 30000 }, lifetime: { began: 0, ended: 30001 } };
}
test('complete narrow browser control never grants application resource qualification', () => {
  const result = assess(observation()); assert.equal(result.eligible, true); assert.equal(result.resourceQualification, false);
});
test('incomplete low-RSS observation cannot become an eligible zero-filled sample', () => {
  const input = observation(); input.samples[0].complete = false; input.samples[0].rows[0].complete = false;
  input.browser.incompleteMemorySamples = 1;
  const result = assess(input); assert.equal(result.eligible, false); assert(result.failures.some(row => row.code === 'INCOMPLETE_RSS_SAMPLE'));
});
test('actual sample gap and RSS failures remain independent of nominal timer configuration', () => {
  const input = observation(); input.samples[1].began = 101; input.samples[1].at = 102;
  input.samples[1].rssBytes = input.samples[1].rows[0].rssBytes = input.browser.maxRssBytes = 1073741825;
  assert.deepEqual(assess(input).failures.map(row => row.code), ['RSS_LIMIT', 'SAMPLING_GAP']);
});
test('survivors, failed exit, journal disagreement and application requests prevent eligibility', () => {
  const input = observation(); input.browser.lifetime.survivors.push({ pid: 2 }); input.browser.code = 1;
  input.browser.memorySamples = 3; input.idle.apiRequests = 1;
  assert.deepEqual(assess(input).failures.map(row => row.code), ['LIFETIME_FAILURE', 'SAMPLE_RECEIPT_MISMATCH', 'INVALID_BLANK_CONTROL']);
});
test('inconsistent complete RSS rows and non-monotonic clocks are rejected', () => {
  const input = observation(); input.samples[1].rssBytes = 101; assert.throws(() => assess(input));
  input.samples[1].rssBytes = 100; input.samples[1].began = -1; assert.throws(() => assess(input));
});
test('a short sample series cannot hide unobserved startup or shutdown', () => {
  const input = observation(); input.lifetime = { began: -101, ended: 30102 };
  assert.deepEqual(assess(input).failures.map(row => row.code), ['STARTUP_SAMPLE_GAP', 'EXIT_SAMPLE_GAP']);
});
test('installed input validation rejects changed bytes and unexpected files before launch', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'loredock-browser-input-'));
  try {
    const file = path.join(root, 'binary'); await writeFile(file, 'original');
    const expected = [{ path: 'binary', bytes: 8, sha256: await digestFile(file) }]; await verifyTree(root, expected);
    await writeFile(file, 'modified'); await assert.rejects(verifyTree(root, expected), /Input bytes changed/);
    await writeFile(file, 'original'); await writeFile(path.join(root, 'unexpected'), 'x');
    await assert.rejects(verifyTree(root, expected), /file set changed/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('installed input validation refuses path escape, duplicate names and symlinks', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'loredock-browser-input-'));
  try {
    const file = path.join(root, 'binary'); await writeFile(file, 'original');
    const row = { path: 'binary', bytes: 8, sha256: await digestFile(file) };
    await assert.rejects(verifyTree(root, [{ ...row, path: '../binary' }]));
    await assert.rejects(verifyTree(root, [row, row])); await rm(file); await symlink('/dev/null', file);
    await assert.rejects(verifyTree(root, [row]), /symlinks/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
