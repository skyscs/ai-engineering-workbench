// Independent ordinary lifetime bounds. Instrumented diagnostic durations never enter resource checks.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { thresholds } = JSON.parse(await readFile(new URL('../../fixtures/loredock-prepared-flow/protocol.json', import.meta.url)));
export function assessLifetimes({ cold, warm, diagnostic }) {
  const report = { checks: [], incomplete: [], resourceQualification: false, exactPerOperationDurations: false };
  const measure = (name, value, limitName, upperBound = false) => {
    if (!Number.isFinite(value) || value < 0) { report.incomplete.push({ name, reason: 'missing-or-invalid-duration' }); return; }
    const limit = thresholds[limitName], passed = value <= limit;
    report.checks.push({ name, value, limit, upperBound, status: passed ? 'passed' : upperBound ? 'incomplete' : 'failed' });
    if (!passed && upperBound) report.incomplete.push({ name, reason: 'enclosing-bound-does-not-establish-contained-duration' });
  };
  for (const [name, value] of [['cold', cold], ['warm', warm]]) {
    assert.deepEqual(value.errors, []);
    assert.equal(value.exit.code, 0); assert.equal(value.exit.signal, null); assert.equal(value.exit.spawnError, null);
    if (value.exit.alreadyExited !== false) report.incomplete.push({ name, reason: 'shutdown-did-not-observe-a-live-daemon' });
    else measure(name + '-shutdown', value.exit.shutdownMs, 'shutdownMsExcludingDeclaredHold');
  }
  measure('cold-listen', cold.listenMs, 'coldListenMs');
  measure('index', cold.index.indexMs, 'indexMs');
  if (Number.isFinite(cold.index.indexThroughAnalysisMs)) assert(cold.index.indexThroughAnalysisMs >= cold.index.indexMs);
  // Automatic analysis can start before the driver's index-ready poll returns.
  measure('automatic-analysis-contained-in-index-through-analysis', cold.index.indexThroughAnalysisMs, 'analysisMs', true);
  measure('cold-prepared-review', cold.prepared.elapsedMs, 'preparedReviewHttpMs');
  // Preparation closes its budget synchronously before a Ready response can be served.
  measure('cold-preparation-operation-contained-in-review', cold.prepared.elapsedMs, 'perActualOperationMs', true);
  assert.equal(warm.declaredRepetitions, 3); assert.equal(warm.repetitions.length, 3);
  assert.equal(warm.exactWitnessPromptParity, true);
  for (const [index, row] of warm.repetitions.entries()) {
    const repetition = index + 1;
    assert.equal(row.repetition, repetition);
    assert.deepEqual(row.runtime, { prepares: repetition, calls: repetition, closed: repetition });
    measure('warm-' + repetition + '-prepared-review', row.prepared.elapsedMs, 'preparedReviewHttpMs');
    if (row.scopeEnd !== 'history-and-runtime-closed') {
      report.incomplete.push({ name: 'warm-' + repetition, reason: 'missing-runtime-close-boundary' }); continue;
    }
    if (Number.isFinite(row.drainedElapsedMs)) assert(row.drainedElapsedMs >= row.elapsedMs && row.drainedElapsedMs >= row.prepared.elapsedMs);
    measure('warm-' + repetition + '-find-through-history-and-close', row.drainedElapsedMs, 'controlledFindThroughHistoryMs');
    measure('warm-' + repetition + '-contained-operations', row.drainedElapsedMs, 'perActualOperationMs', true);
  }
  // The diagnostic replay validates budget closure and parity, not resource timing.
  assert.deepEqual(diagnostic.errors, []); assert.equal(diagnostic.outputParity, true); assert.equal(diagnostic.storedByteParity, true);
  assert.deepEqual(diagnostic.stored, warm.repetitions[0].stored);
  assert.deepEqual(diagnostic.observation.request, warm.repetitions[0].request);
  assert.equal(diagnostic.audit.activeScope, null);
  for (const key of ['lateActivities', 'unscopedBudgets', 'unclosedBudgets']) assert.deepEqual(diagnostic.audit[key], []);
  assert(diagnostic.accounting.budgets.length > 0);
  assert.equal(diagnostic.audit.observedBudgets, diagnostic.accounting.budgets.length);
  assert.deepEqual(diagnostic.accounting.unclosedBudgets, []);
  for (const budget of diagnostic.accounting.budgets) { assert.equal(budget.closes, 1); assert.deepEqual(budget.errors, {}); }
  report.diagnosticBudgets = diagnostic.accounting.budgets.length;
  report.diagnosticTimingUsed = false;
  report.status = report.checks.some(row => row.status === 'failed') ? 'failed' : report.incomplete.length ? 'incomplete' : 'passed';
  return report;
}
