import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessLifetimes } from '../loredock-prepared-flow/lifetime-assess.mjs';

function input() {
  const exit = { code: 0, signal: null, spawnError: null, shutdownMs: 10000, alreadyExited: false };
  const stored = { contextSha256: 'owned-context', witnessSha256: 'owned-witness' }, request = { prompt: 'Owned prompt.' };
  return { cold: { errors: [], exit, listenMs: 10000, index: { indexMs: 300000, analysisMs: 0, indexThroughAnalysisMs: 300000 }, prepared: { elapsedMs: 5000 } },
    warm: { errors: [], exit: { ...exit }, declaredRepetitions: 3, exactWitnessPromptParity: true,
      repetitions: [1, 2, 3].map(repetition => ({ repetition, prepared: { elapsedMs: 5000 }, elapsedMs: 5000,
        drainedElapsedMs: 5000, scopeEnd: 'history-and-runtime-closed', stored, request,
        runtime: { prepares: repetition, calls: repetition, closed: repetition } })) },
    diagnostic: { errors: [], outputParity: true, storedByteParity: true, stored, observation: { request },
      diagnosticElapsedMs: 999999, accounting: { budgets: [{ closes: 1, errors: {}, final: { wallMs: 999999 } }], unclosedBudgets: [] },
      audit: { activeScope: null, lateActivities: [], unscopedBudgets: [], unclosedBudgets: [], observedBudgets: 1 } } };
}
test('inclusive enclosing lifetime bounds use no instrumented diagnostic durations', () => {
  const result = assessLifetimes(input()); assert.equal(result.status, 'passed');
  assert.equal(result.diagnosticTimingUsed, false); assert.equal(result.exactPerOperationDurations, false);
  assert.equal(result.resourceQualification, false); assert.equal(result.diagnosticBudgets, 1);
});
test('an oversized enclosing interval is incomplete for contained work, not a fabricated per-operation violation', () => {
  const example = input(); example.warm.repetitions[0].drainedElapsedMs = 5001;
  example.cold.index.indexThroughAnalysisMs = 300001;
  const result = assessLifetimes(example); assert.equal(result.status, 'incomplete');
  assert.equal(result.checks.filter(row => row.status === 'failed').length, 0);
  assert.equal(result.incomplete.length, 2);
  example.warm.repetitions[0].drainedElapsedMs = 20001;
  const failed = assessLifetimes(example); assert.equal(failed.status, 'failed');
  assert.equal(failed.checks.filter(row => row.status === 'failed').length, 1);
});
test('legacy missing close/start evidence and automatic-analysis timing cannot be replaced by partial intervals', () => {
  const example = input(); delete example.cold.index.indexThroughAnalysisMs;
  delete example.warm.repetitions[0].scopeEnd; delete example.warm.repetitions[1].drainedElapsedMs;
  example.cold.exit.alreadyExited = true;
  const result = assessLifetimes(example); assert.equal(result.status, 'incomplete');
  assert.deepEqual(result.incomplete.map(row => row.name), ['cold', 'automatic-analysis-contained-in-index-through-analysis',
    'warm-1', 'warm-2-find-through-history-and-close', 'warm-2-contained-operations']);
  assert(!result.checks.some(row => row.name === 'cold-shutdown'));
});
test('closure, source parity, ordered repetitions and contradictory boundaries are required', () => {
  for (const mutate of [
    value => { value.warm.repetitions[0].drainedElapsedMs = 4999; },
    value => { value.warm.repetitions[0].runtime.closed = 0; },
    value => { value.warm.repetitions.reverse(); },
    value => { value.diagnostic.audit.lateActivities.push({ budget: 1 }); },
    value => { value.diagnostic.accounting.budgets[0].closes = 0; },
    value => { value.diagnostic.stored = { contextSha256: 'changed' }; },
    value => { value.cold.index.indexThroughAnalysisMs = 299999; },
  ]) { const example = input(); mutate(example); assert.throws(() => assessLifetimes(example)); }
});
