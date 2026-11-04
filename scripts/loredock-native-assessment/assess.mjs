import assert from 'node:assert/strict';
import { readArtifact } from './artifact.mjs';
import { captureOutput, decodeProjection, decodeReceipt, historyOutput } from './codec.mjs';
import { bytes, eq, limits, parse } from './schema.mjs';
import { validateSupport, validateUsefulness } from '../loredock-qualification-assessment/content.mjs';

export const operations = Object.freeze(['first', 'repeat-1', 'repeat-2', 'repeat-3', 'selected', 'page-4', 'isolated', 'history']);
const pass = () => ({ state: 'pass' });
const blocked = reason => ({ state: 'blocked', reason });
const na = () => ({ state: 'not-applicable' });
const fail = error => ({ state: 'fail', error: { name: error.name, message: String(error.message).slice(0, 512) } });
const check = action => { try { action(); return pass(); } catch (error) { return fail(error); } };
const good = value => ['pass', 'not-applicable'].includes(value.state);

// Functional assessment only. Process/resource observations are a subsequent gate.
// Retain raw comparison inputs before decoding or source/usefulness assessment.
export async function assessSeries({ root, rows, metadata, corpus, oracle, size }) {
  const comparisons = new Map(), shapes = new Map(), assessed = [];
  const sequence = check(() => eq(rows.map(row => row.name), operations));
  for (const name of operations) {
    const matches = Array.isArray(rows) ? rows.filter(row => row?.name === name) : [], row = matches.length === 1 ? matches[0] : undefined;
    const d = { artifact: blocked('operation-unavailable'), shape: blocked('artifact-unavailable'), support: blocked('shape-unavailable'),
      usefulness: name === 'history' ? na() : blocked('support-unavailable'),
      history: name === 'history' ? blocked('history-shape-unavailable') : na(), rawRepeat: name.startsWith('repeat-') ? blocked('comparison-unavailable') : na() };
    const result = { name, dimensions: d, artifacts: {} }; assessed.push(result); if (!row) continue;
    let outputBytes, receiptBytes, output, saved;
    const capture = !['page-4', 'history'].includes(name);
    for (const [label, reference] of [['output', row.output], ...(capture ? [['receipt', row.receipt]] : [])]) {
      try {
        const raw = await readArtifact(root, reference); result.artifacts[label] = pass();
        if (label === 'receipt') { receiptBytes = raw; comparisons.set(name, raw); } else outputBytes = raw;
      } catch (error) { result.artifacts[label] = fail(error); }
    }
    d.artifact = Object.values(result.artifacts).every(good) ? pass() : { state: 'fail', reason: 'artifact-integrity' };
    const shapeChecks = [];
    if (capture && receiptBytes) shapeChecks.push(check(() => { saved = decodeReceipt(receiptBytes, metadata.catalogId); shapes.set(name, saved); }));
    if (outputBytes) shapeChecks.push(check(() => {
      if (capture) {
        output = captureOutput(outputBytes);
        if (saved) {
          eq(output.receiptId, saved.receipt.receiptHash);
          eq(output.created, name === 'first' || name === 'selected' || name === 'isolated');
          const m = output.metrics;
          eq(m.receiptBytes, receiptBytes.length); eq(m.projectionBytes, bytes(saved.receipt.projectionJson));
          eq(m.textBytes, saved.receipt.originals.reduce((sum, item) => sum + bytes(item.text), 0));
          eq(m.spans, saved.receipt.originals.length); eq(m.sources, saved.receipt.dependencies.length);
        }
      } else if (name === 'page-4') {
        // Raw JSON bytes remain comparable even if the native schema is invalid.
        parse(outputBytes, limits.projectionBytes, true); comparisons.set(name, outputBytes);
        saved = decodeProjection(outputBytes.toString('utf8'), 'roots'); shapes.set(name, saved);
      } else { saved = historyOutput(outputBytes); shapes.set(name, saved); }
    }));
    d.shape = shapeChecks.some(item => item.state === 'fail') ? shapeChecks.find(item => item.state === 'fail')
      : d.artifact.state !== 'pass' ? blocked('artifact-unavailable') : shapeChecks.length ? pass() : blocked('artifact-unavailable');
    if (saved) {
      d.support = check(() => {
        validateSupport(saved, corpus, metadata);
        for (const key of ['policyVersion', 'registryVersion', 'sourceSetVersion']) eq(saved.projection.identity[key], metadata[key]);
      });
      if (name !== 'history') d.usefulness = d.support.state === 'pass' ? check(() => validateUsefulness(saved, name, oracle, size)) : blocked('support-invalid');
      else {
        const first = shapes.get('first');
        d.history = first ? check(() => {
          eq(JSON.stringify(saved.projection), first.receipt.projectionJson); eq(saved.receipt.originals, first.receipt.originals);
          eq(saved.receipt.dependencies, first.receipt.dependencies); eq(saved.receipt.receiptHash, first.receipt.receiptHash);
          eq(saved.output.stale, false);
          for (const key of ['projectionBytes', 'receiptBytes', 'textBytes', 'spans', 'sources']) {
            const expected = key === 'projectionBytes' ? bytes(first.receipt.projectionJson) : key === 'receiptBytes' ? comparisons.get('first').length
              : key === 'textBytes' ? first.receipt.originals.reduce((sum, item) => sum + bytes(item.text), 0)
              : key === 'spans' ? first.receipt.originals.length : first.receipt.dependencies.length;
            eq(saved.output.metrics[key], expected);
          }
        }) : blocked('first-receipt-shape-unavailable');
      }
    }
    if (name.startsWith('repeat-')) d.rawRepeat = comparisons.has('first') && comparisons.has(name)
      ? check(() => assert.ok(comparisons.get('first').equals(comparisons.get(name)))) : blocked('comparison-unavailable');
  }
  const summary = {};
  for (const key of ['artifact', 'shape', 'support', 'usefulness', 'history', 'rawRepeat']) {
    const states = assessed.map(row => row.dimensions[key].state); summary[key] = { planned: 8, required: states.filter(state => state !== 'not-applicable').length,
      pass: states.filter(state => state === 'pass').length, fail: states.filter(state => state === 'fail').length, blocked: states.filter(state => state === 'blocked').length };
  }
  return { report: { schemaVersion: 'native-functional-assessment/1', failed: !good(sequence) || assessed.some(row => Object.values(row.dimensions).some(value => !good(value))),
    sequence, operations: assessed, summary, currentAuthorization: 'not-evaluated', currentApplicability: 'not-evaluated', resources: 'not-evaluated' }, comparisons };
}
export function compareSeries(left, right) {
  const parity = operations.filter(name => name !== 'history').map(name => ({ name, meaning: 'byte-equality-only',
    ...(left.comparisons.has(name) && right.comparisons.has(name) ? check(() => assert.ok(left.comparisons.get(name).equals(right.comparisons.get(name)))) : blocked('comparison-unavailable')) }));
  return { failed: left.report.failed || right.report.failed || parity.some(row => !good(row)), required: 7, parity };
}
