import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CaptureBudget } from '../loredock-capture-scale/budget.mjs';
test('shared charges keep exact phase sums and reject invalid, increased or reused budgets', () => {
  const observed = { path: 0, receipt: 0 }, budget = new CaptureBudget({ limits: { work: 10 }, observe({ phase, units }) { observed[phase] += units; } });
  budget.charge('path', 6); budget.charge('receipt', 4);
  assert.equal(budget.stats().totalWork, 10); assert.deepEqual(observed, { path: 6, receipt: 4 });
  assert.throws(() => budget.charge('receipt', 1), { code: 'CAPTURE_WORK_LIMIT' }); assert.equal(budget.stats().totalWork, 10);
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => budget.charge('path', value), { code: 'INVALID_CAPTURE_CHARGE' });
  assert.throws(() => budget.charge('unknown', 0), { code: 'INVALID_CAPTURE_CHARGE' });
  budget.close(); const frozen = budget.stats(); assert.throws(() => budget.charge('path', 0), { code: 'CLOSED_CAPTURE_BUDGET' }); assert.deepEqual(budget.stats(), frozen);
  for (const limits of [{ work: 1000001 }, { wallMs: 5001 }, { unknown: 1 }, { work: -1 }, { work: 1.5 }]) assert.throws(() => new CaptureBudget({ limits }), { code: 'INVALID_CAPTURE_LIMIT' });
  const asyncObserver = new CaptureBudget({ observe: async () => {} });
  assert.throws(() => asyncObserver.charge('receipt', 1), { code: 'INVALID_CAPTURE_OBSERVER' }); asyncObserver.close();
});
