import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import type { CodeFacts } from '../src/code-facts.js';
import type { FactRanges } from '../src/code-analysis-types.js';
import { createCanonicalFactPair, canonicalFactPairLimit, type CanonicalFactPair } from '../src/canonical-fact-pair.js';
import { OperationBudget, operationAccounting } from '../src/operation-budget.js';
// @ts-expect-error Frozen value helper; independent tiny inputs only.
import { createCanonicalPair } from '../../../scripts/loredock-canonical-facts/pair.mjs';
// @ts-expect-error Frozen operation helper; no qualification family or service imports.
import { CaptureBudget } from '../../../scripts/loredock-capture-scale/budget.mjs';

const input = (gaps = ['unsupported independent marker']): { facts: CodeFacts; ranges: FactRanges } => ({
  facts: { symbols: [], operations: [], calls: [], records: {}, gaps },
  ranges: { offsetEncoding: 'UTF-16 code units', symbols: [], operations: [] },
});
const pairFactories: (() => (facts: CodeFacts, ranges: FactRanges) => CanonicalFactPair)[] = [createCanonicalPair, createCanonicalFactPair];
const budgets: (typeof OperationBudget)[] = [CaptureBudget, OperationBudget];

test('typed canonical values retain exact sharing, input independence and readonly boundaries', () => {
  const observations = pairFactories.map(factory => {
    const pair = factory(), value = input(), copy = structuredClone(value), first = pair(value.facts, value.ranges);
    assert.equal(pair(copy.facts, copy.ranges), first); assert.notEqual(first.facts, value.facts);
    for (const object of [first, first.facts, first.ranges, first.facts.gaps, first.facts.records,
      first.facts.symbols, first.facts.calls, first.facts.operations, first.ranges.symbols, first.ranges.operations]) assert.ok(Object.isFrozen(object));
    assert.throws(() => Object.defineProperty(first.facts.gaps, '0', { value: 'changed' }), TypeError);
    value.facts.gaps.push('input remains mutable'); assert.deepEqual(first, copy);
    assert.equal(pair(value.facts, value.ranges).facts, value.facts);
    assert.notEqual(factory()(copy.facts, copy.ranges), first);
    const readonlyContract = (result: CanonicalFactPair) => {
      // @ts-expect-error The retained output exposes no mutable gap array.
      result.facts.gaps.push('invalid');
      // @ts-expect-error The retained pair cannot replace its facts.
      result.facts = copy.facts;
    };
    void readonlyContract;
    return first;
  });
  assert.deepEqual(observations[1], observations[0]);
});

test('typed canonical fallback preserves unsupported facts, extra fields and ordered gaps', () => {
  for (const factory of pairFactories) {
    const pair = factory(), seed = input(['first', 'second']), canonical = pair(seed.facts, seed.ranges);
    const symbol = { key: 'method', name: 'method', qualifiedName: 'method', role: 'function' as const, exported: true, start: 0, end: 1 };
    const variants = [input(['second', 'first']), input([]), input(['first', 'second', 'second']),
      { ...input(), facts: { ...input().facts, symbols: [symbol] } },
      { ...input(), facts: { ...input().facts, records: { Event: 'String key' } } },
      { ...input(), facts: { ...input().facts, extra: [] } },
      { ...input(), ranges: { ...input().ranges, extra: true } }];
    for (const value of variants) {
      const result = pair(value.facts, value.ranges);
      assert.equal(result.facts, value.facts); assert.equal(result.ranges, value.ranges);
    }
    assert.equal(pair(seed.facts, seed.ranges), canonical);
  }
});

test('typed canonical byte boundary matches the frozen helper without occupying an oversized slot', () => {
  const overhead = Buffer.byteLength(JSON.stringify(input(['']))), exact = input(['x'.repeat(canonicalFactPairLimit - overhead)]);
  assert.equal(Buffer.byteLength(JSON.stringify(exact)), 4096);
  for (const factory of pairFactories) {
    const pair = factory();
    for (const value of [input(['x'.repeat(4097 - overhead)]), input(['😀'.repeat(1100)])])
      assert.equal(pair(value.facts, value.ranges).facts, value.facts);
    const first = pair(exact.facts, exact.ranges); assert.notEqual(first.facts, exact.facts);
    assert.equal(pair(exact.facts, exact.ranges), first);
  }
});

test('typed operation accounting preserves aggregate-only refusal, ownership and terminal metrics', () => {
  const observations = budgets.map(Budget => {
    const charges: { phase: 'path' | 'receipt'; units: number }[] = [];
    const budget = new Budget({ limits: { work: 9 }, observe: charge => charges.push(charge) });
    assert.equal(budget.deadline - budget.began, operationAccounting.wallMs);
    assert.ok(Object.isFrozen(budget.limits)); budget.claimPath();
    assert.throws(() => budget.claimPath(), { code: 'CAPTURE_BUDGET_OWNERSHIP' });
    budget.charge('path', 5); budget.charge('receipt', 4);
    assert.throws(() => budget.charge('receipt', 1), { code: 'CAPTURE_WORK_LIMIT' });
    const { wallMs, ...stable } = budget.stats(); assert.ok(Number.isFinite(wallMs) && wallMs >= 0);
    assert.equal(stable.totalWork, 9); assert.deepEqual(charges, [{ phase: 'path', units: 5 }, { phase: 'receipt', units: 4 }]);
    budget.close(); const closed = budget.stats(); budget.close(); assert.deepEqual(budget.stats(), closed);
    assert.throws(() => budget.check(), { code: 'CLOSED_CAPTURE_BUDGET' });
    assert.throws(() => budget.charge('path', 0), { code: 'CLOSED_CAPTURE_BUDGET' });
    return stable;
  });
  assert.deepEqual(observations[1], observations[0]);
});

test('typed budgets preserve reduced deadlines, cancellation and original observer errors', async () => {
  for (const Budget of budgets) {
    const controller = new AbortController(), budget = new Budget({ signal: controller.signal });
    controller.abort(); assert.throws(() => budget.check(), { code: 'CANCELLED' }); budget.close();
    assert.throws(() => new Budget({ signal: controller.signal }), { code: 'CANCELLED' });
    const timed = new Budget({ limits: { wallMs: 2000 }, wallCeiling: 1000 });
    assert.equal(timed.limits.wallMs, 1000); await delay(Math.max(0, timed.deadline - performance.now()) + 10);
    assert.throws(() => timed.charge('receipt'), { code: 'CAPTURE_TIME_LIMIT' }); timed.close();
    const failure = new Error('Owned observer failure.'), failing = new Budget({ observe() { throw failure; } });
    assert.throws(() => failing.charge('path'), e => e === failure); assert.equal(failing.stats().totalWork, 1); failing.close();
    const asynchronous = new Budget({ observe: () => Promise.resolve() });
    assert.throws(() => asynchronous.charge('path'), { code: 'INVALID_CAPTURE_OBSERVER' }); asynchronous.close();
  }
});

test('typed budgets reject invalid configuration and charges with matching explicit codes', () => {
  type Options = NonNullable<ConstructorParameters<typeof OperationBudget>[0]>;
  for (const Budget of budgets) {
    for (const limits of [{ work: -1 }, { wallMs: 5001 }, { work: 1000001 }, { work: NaN }, { wallMs: 1.5 }, { other: 1 }, null, []])
      assert.throws(() => new Budget({ limits } as unknown as Options), { code: 'INVALID_CAPTURE_LIMIT' });
    assert.throws(() => new Budget({ limits: { wallMs: 0 } }), { code: 'CAPTURE_TIME_LIMIT' });
    assert.throws(() => new Budget({ wallCeiling: -1 }), { code: 'INVALID_CAPTURE_LIMIT' });
    assert.throws(() => new Budget({ signal: {} } as unknown as Options), { code: 'INVALID_CAPTURE_BUDGET' });
    assert.throws(() => new Budget({ observe: 1 } as unknown as Options), { code: 'INVALID_CAPTURE_BUDGET' });
    const budget = new Budget();
    for (const units of [-1, 0.5, NaN, Infinity]) assert.throws(() => budget.charge('path', units), { code: 'INVALID_CAPTURE_CHARGE' });
    assert.throws(() => budget.charge('unknown' as 'path'), { code: 'INVALID_CAPTURE_CHARGE' });
    assert.equal(budget.stats().totalWork, 0); budget.close();
  }
});
