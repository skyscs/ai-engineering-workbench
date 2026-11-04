import assert from 'node:assert/strict';
import { assessSeries, compareSeries, operations } from '../loredock-native-assessment/assess.mjs';
import { assessComplete } from './complete.mjs';
import { resourceFailures } from '../loredock-capture-memory/validate.mjs';
import { readArtifact } from '../loredock-native-assessment/artifact.mjs';
import { parse } from '../loredock-native-assessment/schema.mjs';
export const ceilings = Object.freeze({ work: 1000000, wallMs: 5000, projectionBytes: 524288, receiptBytes: 655360, textBytes: 65536, spans: 30, sources: 20 });
export const resources = Object.freeze({ sampleIntervalMs: 5, maxSliceMs: 150, sampledRssMiB: 384, sampledHeapGrowthMiB: 64 });
const integer = n => assert.ok(Number.isSafeInteger(n) && n >= 0);
const finite = n => assert.ok(Number.isFinite(n) && n >= 0);
const check = action => { try { action(); return { state: 'pass' }; } catch (error) { return { state: 'fail', error: { name: error.name, message: error.message } }; } };
const checkAsync = async action => { try { await action(); return { state: 'pass' }; } catch (error) { return { state: 'fail', error: { name: error.name, message: error.message } }; } };
export function validateLimits(oracle) {
  for (const [key, maximum] of Object.entries(ceilings)) { integer(oracle.limits[key]); assert.ok(oracle.limits[key] <= maximum); }
  for (const [key, maximum] of Object.entries(resources)) { finite(oracle.resources[key]); assert.ok(oracle.resources[key] <= maximum); }
  assert.equal(oracle.resources.sampleIntervalMs, 5);
}
export function validateObservation(row, oracle) {
  validateLimits(oracle); assert.ok(!row.blocked && !row.error && !row.observerError);
  for (const key of ['wallMs', 'maxSliceMs', 'peakRssMiB', 'heapGrowthMiB']) finite(row[key]);
  for (const key of ['rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers']) integer(row.baselineMemory[key]);
  assert.ok(row.peakRssMiB * 1048576 >= row.baselineMemory.rss);
  for (const key of ['gitCalls', 'writeCalls', 'changedRows', 'factReads', 'snapshots', 'pathReads', 'originalReads']) {
    integer(row.before[key]); integer(row.after[key]); assert.ok(row.after[key] >= row.before[key]);
  }
  for (const key of ['gitCalls', 'writeCalls', 'changedRows']) assert.equal(row.before[key], row.after[key]);
  assert.match(row.legacyBefore, /^[a-f0-9]{64}$/); assert.equal(row.legacyBefore, row.legacyAfter);
  integer(row.sums.path); integer(row.sums.receipt);
  for (const key of ['totalWork', 'pathWork', 'receiptWork']) integer(row.metrics[key]); finite(row.metrics.wallMs); assert.ok(row.wallMs >= row.metrics.wallMs);
  assert.equal(row.metrics.accountingVersion, 'shared-capture-work/1');
  assert.equal(row.metrics.totalWork, row.sums.path + row.sums.receipt); assert.equal(row.metrics.pathWork, row.sums.path); assert.equal(row.metrics.receiptWork, row.sums.receipt);
  assert.ok(row.metrics.totalWork <= oracle.limits.work && row.metrics.wallMs < oracle.limits.wallMs);
  if (row.name !== 'page-4') {
    for (const key of ['projectionBytes', 'receiptBytes', 'textBytes', 'spans', 'sources']) { integer(row.metrics[key]); assert.ok(row.metrics[key] <= oracle.limits[key]); }
    assert.equal(row.metrics.publicationLocks, row.name === 'history' ? 0 : 1);
    assert.equal(row.metrics.work, row.metrics.totalWork); integer(row.metrics.checkpoints);
    assert.ok(row.after.originalReads - row.before.originalReads >= row.metrics.spans);
  }
  if (row.name === 'history') {
    assert.equal(row.metrics.pathWork, 0); for (const key of ['factReads', 'snapshots', 'pathReads']) assert.equal(row.before[key], row.after[key]);
    assert.equal(row.after.originalReads - row.before.originalReads, row.metrics.spans);
  } else { assert.equal(row.after.pathReads - row.before.pathReads, 1); assert.ok(row.after.factReads > row.before.factReads && row.after.snapshots > row.before.snapshots); }
  assert.deepEqual(row.instrumentation, { enabled: false, phases: [], queries: [], prepareCalls: 0 });
}
export async function assessNativeArm({ root, arm, raw, outcome, metadata, config }) {
  const rows = Array.isArray(raw?.operations) ? raw.operations : [], input = { root, rows, metadata, corpus: config.corpusFactory(), oracle: config.oracle, size: config.size };
  const content = await assessSeries(input), complete = await assessComplete({ ...input, expected: config.complete });
  const lifecycle = check(() => {
    validateLimits(config.oracle); assert.ok(outcome && outcome.exit === 0 && outcome.signal === null && !outcome.timeout && !outcome.blocked && !outcome.spawnError);
    assert.equal(outcome.arm, arm); assert.equal(raw.arm, arm); assert.equal(raw.schemaVersion, 'native-qualification-worker/1'); assert.deepEqual(raw.execArgv, []);
    integer(raw.pid); assert.ok(raw.pid > 0); assert.equal(raw.pid, outcome.pid); assert.deepEqual(raw.errors, []);
    assert.deepEqual(raw.size, config.size); assert.deepEqual(raw.runtime, metadata.runtime); assert.equal(raw.node, metadata.runtime.node); assert.deepEqual(raw.initialHashes, metadata.initialHashes); assert.equal(raw.evicted, metadata.inventory.id);
    assert.deepEqual(rows.map(row => row.name), operations); assert.ok(raw.lifecycle.some(row => row.stage === 'closure-after'));
    assert.ok(raw.lifecycle.some(row => row.stage === 'preparation-before') === (arm === 'same-process'));
  });
  const observations = await Promise.all(operations.map(async name => {
    const matching = rows.filter(row => row.name === name), row = matching[0];
    const observation = await checkAsync(async () => {
      assert.equal(matching.length, 1); validateObservation(row, config.oracle);
      if (name !== 'page-4') {
        const output = parse(await readArtifact(root, row.output), 655360, true);
        assert.deepEqual(row.metrics, output.metrics, 'Recorded observations must describe the exact saved service result.');
      }
    });
    const resource = check(() => { assert.equal(matching.length, 1); validateLimits(config.oracle); assert.deepEqual(resourceFailures(row, config.oracle), []); });
    return { name, observation, resource };
  }));
  const functionalFailed = content.report.failed || complete.failed || lifecycle.state !== 'pass' || observations.some(row => row.observation.state !== 'pass');
  return { ...content, report: { schemaVersion: 'native-arm-assessment/1', content: content.report, complete, lifecycle, observations,
    functionalFailed, failed: functionalFailed || observations.some(row => row.resource.state !== 'pass') } };
}
export function combineNativeArms(values) {
  assert.equal(values.length, 2);
  const comparison = compareSeries(values[0], values[1]);
  return { schemaVersion: 'native-qualification-assessment/1', plannedOperations: 16, requiredComparisons: 7,
    functionalFailed: values.some(value => value.report.functionalFailed) || comparison.parity.some(row => row.state !== 'pass'),
    failed: values.some(value => value.report.failed) || comparison.failed, parity: comparison.parity };
}
