import assert from 'node:assert/strict';
import { test } from 'node:test';
import { url } from 'node:inspector';
import { sampleAllocation } from '../loredock-allocation-profile/sample.mjs';
import { summarizeProfile } from '../loredock-allocation-profile/summary.mjs';

const parameters = { samplingInterval: 32768, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true };
const limits = { samples: 262144, treeNodes: 32768, depth: 128, validationBytes: 33554432, summaryFrames: 100, summaryBytes: 262144, allowUnmappedSamples: true };
test('the pinned inspector samples real independent allocations without opening a debugger endpoint', async () => {
  const endpoint = url(); let held;
  const result = await sampleAllocation(async () => {
    held = Array.from({ length: 20000 }, (_, index) => ({ label: 'independent-' + index, values: [index, index + 1] }));
    return held.length;
  }, parameters);
  assert.equal(result.result, 20000); assert.equal(result.actionError, null); assert.deepEqual(result.profilerErrors, []);
  assert.equal(url(), endpoint); assert.equal(result.resourceAcceptance, 'not-evaluated-profiled');
  const summary = summarizeProfile(result.profile, limits, process.cwd());
  assert.ok(summary.totalSelfBytes > 0 && summary.samples > 0); held = undefined;
});

test('sampling preserves action/stop/disconnect errors and never runs an action after start refusal', async () => {
  for (const failAt of ['start', 'stop', 'disconnect']) {
    const calls = []; let actions = 0;
    const result = await sampleAllocation(() => { actions++; throw failAt === 'stop' ? 0 : new Error('action failed'); }, parameters, () => ({
      connect() { calls.push('connect'); },
      async post(method) { calls.push(method); if ((failAt === 'start' && method === 'HeapProfiler.startSampling')
        || (failAt === 'stop' && method === 'HeapProfiler.stopSampling')) throw new Error(failAt + ' failed'); return {}; },
      disconnect() { calls.push('disconnect'); if (failAt === 'disconnect') throw new Error('disconnect failed'); },
    }));
    assert.equal(actions, failAt === 'start' ? 0 : 1); assert.equal(calls.at(-1), 'disconnect');
    assert.equal(result.actionError?.message ?? null, failAt === 'start' ? null : failAt === 'stop' ? '0' : 'action failed');
    assert.deepEqual(result.profilerErrors.map(error => error.phase), [failAt]);
    assert.equal(calls.includes('HeapProfiler.stopSampling'), failAt !== 'start');
  }
});

const frame = (name, file = '') => ({ functionName: name, url: file, scriptId: '1', lineNumber: 0, columnNumber: 0 });
const fixture = () => ({ head: { id: 1, callFrame: frame('root'), selfSize: 7, children: [
  { id: 2, callFrame: frame('read', '/owned/apps/loredock/read.js'), selfSize: 11, children: [
    { id: 3, callFrame: frame('native'), selfSize: 13, children: [] },
  ] },
] }, samples: [{ nodeId: 2, size: 11, ordinal: 1 }, { nodeId: 3, size: 13, ordinal: 2 }] });
test('profile summaries keep disjoint weights and internal callers without ancestor double counting', () => {
  const summary = summarizeProfile(fixture(), limits, '/owned');
  assert.equal(summary.totalSelfBytes, 31); assert.equal(summary.sampleBytes, 24); assert.equal(summary.unattributedSelfBytes, 7);
  assert.equal(summary.nearestApplicationCallers.top[0].selfBytes, 24);
  const bounded = summarizeProfile(fixture(), { ...limits, summaryFrames: 1 }, '/owned');
  assert.equal(bounded.frames.top[0].selfBytes + bounded.frames.otherSelfBytes, 31);
  for (const change of [p => { p.head.children[0].id = 1; }, p => { p.samples[0].nodeId = -1; },
    p => { p.samples[1].ordinal = 1; }, p => { p.head.selfSize = -1; }]) {
    const value = fixture(); change(value); assert.throws(() => summarizeProfile(value, limits, '/owned'));
  }
  assert.throws(() => summarizeProfile(fixture(), { ...limits, treeNodes: 2 }, '/owned'), /bound/);
  assert.throws(() => summarizeProfile(fixture(), { ...limits, validationBytes: 1 }, '/owned'), /byte bound/);
});

test('unmapped runtime-export samples retain their weights without invented owners or complete-reference claims', () => {
  const profile = fixture(); profile.samples.push({ nodeId: 99, size: 17, ordinal: 3 });
  const summary = summarizeProfile(profile, limits, '/owned');
  assert.equal(summary.sampleReferenceStatus, 'partial-unmapped-samples');
  assert.equal(summary.unmappedSamples, 1); assert.equal(summary.unmappedSampleBytes, 17);
  assert.equal(summary.sampleBytes, 41); assert.equal(summary.mappedSampleBytes, 24);
  assert.equal(summary.totalSelfBytes, 31); assert.equal(summary.nearestApplicationCallers.top[0].selfBytes, 24);
  assert.throws(() => summarizeProfile(profile, { ...limits, allowUnmappedSamples: false }, '/owned'), /Unmapped/);
});
