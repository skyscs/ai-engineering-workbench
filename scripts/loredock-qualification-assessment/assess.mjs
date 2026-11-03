import assert from 'node:assert/strict';
import { readArtifact } from './artifact.mjs';
import { decodeJSON, decodeReceipt, decodeHistory, decodeProjection, receiptLimits } from './codec.mjs';
import { validateSupport, validateUsefulness } from './content.mjs';
import { resourceFailures, validateObservation } from '../loredock-streaming-qualification/validate.mjs';

const pass = () => ({ state: 'pass' });
const blocked = reason => ({ state: 'blocked', reason });
const na = reason => ({ state: 'not-applicable', reason });
const failure = (reason, error) => ({ state: 'fail', reason,
  error: { name: error.name, code: error.code ?? null, message: error.message } });
function check(reason, action) { try { action(); return pass(); } catch (error) { return failure(reason, error); } }
function integer(value) { assert.ok(Number.isSafeInteger(value) && value >= 0, 'Expected a nonnegative integer observation.'); }
function finite(value) { assert.ok(Number.isFinite(value) && value >= 0, 'Expected a finite nonnegative observation.'); }
function resources(row, arm, oracle) {
  for (const [key, maximum] of Object.entries(receiptLimits)) {
    integer(oracle.limits[key]); assert.ok(oracle.limits[key] <= maximum, 'Receipt limits cannot be raised.');
  }
  for (const key of ['maxSliceMs', 'sampledRssMiB', 'sampledHeapGrowthMiB']) finite(oracle.resources[key]);
  assert.deepEqual(resourceFailures(row, oracle), [], 'Recorded resources exceed limits or are unavailable.');
  for (const key of ['wallMs', 'maxSliceMs', 'peakRssMiB', 'heapGrowthMiB']) finite(row[key]);
  for (const key of ['gitCalls', 'writeCalls', 'changedRows', 'pathReads', 'factReads', 'snapshots', 'originalReads']) {
    integer(row.before[key]); integer(row.after[key]); assert.ok(row.after[key] >= row.before[key]);
  }
  assert.match(row.legacyBefore, /^[a-f0-9]{64}$/); assert.match(row.legacyAfter, /^[a-f0-9]{64}$/);
  integer(row.sums.path); integer(row.sums.receipt);
  for (const key of ['pathWork', 'receiptWork', 'totalWork']) integer(row.metrics[key]);
  finite(row.metrics.wallMs); assert.ok(row.metrics.wallMs < oracle.limits.wallMs);
  const outputs = ['projectionBytes', 'receiptBytes', 'textBytes', 'spans', 'sources'];
  if (row.name !== 'page-4') for (const key of outputs) integer(row.metrics[key]);
  for (const key of outputs) if (key in row.metrics) integer(row.metrics[key]);
  if (row.name === 'history') { assert.equal(row.metrics.pathWork, 0); assert.equal(row.metrics.publicationLocks, 0); }
  else if (row.name !== 'page-4') assert.equal(row.metrics.publicationLocks, 1);
  validateObservation(row, arm, oracle);
}
const captures = new Set(['first', 'repeat-1', 'repeat-2', 'repeat-3', 'selected', 'isolated']);
export const operations = Object.freeze(['first', 'repeat-1', 'repeat-2', 'repeat-3', 'selected', 'page-4', 'isolated', 'history']);

// The caller supplies stopped worker reports, frozen metadata and trusted expected text.
// No catalog or application service is accepted. Comparison bytes never depend on usefulness.
export async function assessArm({ root, arm, raw, process: outcome, oracle, size, corpus, metadata }) {
  const comparisons = new Map(), shapes = new Map(), rows = [], results = [];
  const lifecycle = check('lifecycle-invalid', () => {
    assert.ok(outcome && outcome.exit === 0 && outcome.signal === null && !outcome.timeout && !outcome.blocked && !outcome.spawnError);
    assert.equal(outcome.arm, arm); assert.equal(raw.arm, arm);
    assert.deepEqual(raw.size, size);
    assert.ok(['same-process', 'reopened-process'].includes(arm));
    assert.deepEqual(raw.errors, []); assert.deepEqual(raw.initialHashes, metadata.initialHashes);
    assert.equal(raw.evicted, metadata.inventory.id);
    assert.deepEqual(raw.operations.map(row => row.name), operations);
    assert.deepEqual(oracle.operations, operations);
    assert.ok(raw.lifecycle.some(row => row.stage === 'closure-after'), 'Worker closure must be recorded.');
  });
  if (Array.isArray(raw?.operations)) rows.push(...raw.operations);
  for (const name of operations) {
    const matches = rows.filter(row => row?.name === name), row = matches.length === 1 ? matches[0] : undefined;
    const dimensions = { artifact: blocked('operation-unavailable'), shape: blocked('artifact-unavailable'),
      support: blocked('shape-unavailable'), usefulness: name === 'history' ? na('history-compares-recorded-first') : blocked('support-unavailable'),
      history: name === 'history' ? blocked('history-shape-unavailable') : na('not-history'),
      rawRepeat: name.startsWith('repeat-') ? blocked('comparison-bytes-unavailable') : na('not-repeat'),
      resources: row ? check('resources-invalid', () => resources(row, arm, oracle)) : blocked('operation-unavailable') };
    const item = { name, dimensions, artifacts: {} }; results.push(item);
    if (!row) continue;
    let wrapper, saved, observation, receiptBytes;
    for (const [label, ref] of [['observation', row.artifact], ...(captures.has(name) ? [['receipt', row.receipt]] : [])]) {
      try {
        const bytes = await readArtifact(root, ref);
        item.artifacts[label] = { ...pass(), reference: ref };
        if (label === 'receipt') { receiptBytes = bytes; comparisons.set(name, bytes); }
        else observation = bytes;
      } catch (error) { item.artifacts[label] = { ...failure('artifact-unavailable', error), reference: ref ?? null }; }
    }
    dimensions.artifact = Object.values(item.artifacts).every(row => row.state === 'pass') ? pass()
      : failure('artifact-integrity-failed', new Error('One or more required artifacts are unavailable.'));
    const observationShape = observation ? check('observation-shape-invalid', () => {
      wrapper = decodeJSON(observation);
      assert.deepEqual(Object.keys(wrapper).sort(), ['error', 'observerError', 'result']);
      assert.equal(wrapper.error, null); assert.equal(wrapper.observerError, null); assert.ok(wrapper.result);
    }) : blocked('observation-artifact-unavailable');
    // Decode the receipt independently, even when its operation wrapper is invalid.
    const contentShape = captures.has(name) && !receiptBytes ? blocked('receipt-artifact-unavailable')
      : !captures.has(name) && observationShape.state !== 'pass' ? blocked('observation-shape-unavailable')
      : check('content-shape-invalid', () => {
      if (captures.has(name)) {
        saved = decodeReceipt(receiptBytes);
      } else {
        if (name === 'history') saved = decodeHistory(wrapper.result);
        else {
          assert.equal(wrapper.result.status, 'available');
          const projection = JSON.stringify(wrapper.result.projection);
          comparisons.set(name, Buffer.from(projection));
          const decoded = decodeProjection(projection, 'roots');
          saved = { projection: decoded.value, evidence: decoded.evidence };
        }
      }
    });
    item.observationShape = observationShape; item.contentShape = contentShape;
    if (contentShape.state === 'pass') shapes.set(name, saved);
    dimensions.shape = dimensions.artifact.state !== 'pass' ? blocked('artifact-unavailable')
      : observationShape.state !== 'pass' ? observationShape : contentShape.state !== 'pass' ? contentShape
        : check('operation-content-mismatch', () => {
          assert.deepEqual(wrapper.result.metrics, row.metrics);
          if (captures.has(name)) { assert.equal(wrapper.result.status, 'captured'); assert.equal(wrapper.result.receiptId, saved.receipt.receiptHash); }
        });
    if (contentShape.state === 'pass') {
      dimensions.support = check('frozen-source-support-invalid', () => validateSupport(saved, corpus, metadata));
      dimensions.usefulness = name === 'history' ? na('history-compares-recorded-first')
        : dimensions.support.state === 'pass' ? check('useful-path-mismatch', () => validateUsefulness(saved, name, oracle, size))
          : blocked('source-support-unavailable');
    } else if (name === 'history') dimensions.usefulness = na('history-compares-recorded-first');
  }
  // Resolve dependencies after every intact input has been retained.
  for (const item of results) {
    const { name, dimensions } = item;
    if (name.startsWith('repeat-')) dimensions.rawRepeat = compareBytes(comparisons.get('first'), comparisons.get(name));
    if (name === 'history') {
      const first = shapes.get('first'), history = shapes.get(name);
      dimensions.history = !first ? blocked('first-receipt-shape-unavailable') : !history ? blocked('history-shape-unavailable')
        : check('history-content-mismatch', () => {
          assert.deepEqual(history.projection, first.projection);
          for (const key of ['receiptHash', 'originals', 'dependencies']) assert.deepEqual(history.receipt[key], first.receipt[key]);
        });
    }
  }
  const report = { arm, lifecycle, process: outcome ?? null, workerErrors: raw?.errors ?? null,
    currentApplicability: 'not-evaluated', operations: results };
  report.summary = summarize(results.flatMap(row => Object.entries(row.dimensions)));
  report.failed = lifecycle.state !== 'pass' || results.some(row => Object.values(row.dimensions).some(value => !['pass', 'not-applicable'].includes(value.state)));
  return { report, comparisons };
}
function compareBytes(reference, candidate) {
  return !reference ? blocked('first-comparison-bytes-unavailable') : !candidate ? blocked('comparison-bytes-unavailable')
    : check('raw-bytes-differ', () => assert.ok(reference.equals(candidate), 'Recorded bytes differ.'));
}
export function compareArms(reference, candidate) {
  return operations.filter(name => name !== 'history').map(name => ({ name, meaning: 'byte-equality-only',
    ...compareBytes(reference.comparisons.get(name), candidate.comparisons.get(name)) }));
}
function summarize(entries) {
  const result = {};
  for (const [dimension, value] of entries) {
    const counts = result[dimension] ??= { planned: 0, pass: 0, fail: 0, blocked: 0, 'not-applicable': 0 };
    counts.planned++; counts[value.state]++;
  }
  for (const counts of Object.values(result)) counts.required = counts.planned - counts['not-applicable'];
  return result;
}
export function assessQualification(arms) {
  const parity = arms.length === 2 ? compareArms(arms[0], arms[1]) : [];
  return { schemaVersion: 'loredock-offline-assessment/1', currentApplicability: 'not-evaluated',
    arms: arms.map(value => value.report), parity,
    failed: arms.length !== 2 || arms[0].report.arm !== 'same-process' || arms[1].report.arm !== 'reopened-process'
      || arms.some(value => value.report.failed) || parity.some(value => value.state !== 'pass') };
}
