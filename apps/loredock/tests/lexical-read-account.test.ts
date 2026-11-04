import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CatalogStore } from '../src/store.js';
import { OperationBudget } from '../src/operation-budget.js';
import { LexicalReadAccount } from '../src/lexical-read-account.js';

function setup(t: TestContext) {
  const directory = mkdtempSync(path.join(tmpdir(), 'lexical-account-')), store = new CatalogStore(directory);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  const budget = new OperationBudget(); t.after(() => budget.close());
  return { store, budget, account: new LexicalReadAccount(budget) };
}
const code = (expected: string) => (error: unknown) => (error as { code?: string }).code === expected;

test('actual rows, empty results and cached reads consume exactly the shared receipt budget', async t => {
  const { store, budget, account } = setup(t), sql = 'SELECT ? value';
  let prepares = 0; const prepare = store.db.prepare.bind(store.db);
  store.db.prepare = text => { if (text === sql) prepares++; return prepare(text); };
  await store.withPreparedReads(() => store.withLexicalReads(account, () => {
    const first = store.one<{ value: number }>(sql, 1)!; assert.equal(Object.getPrototypeOf(first), null);
    first.value = 99; assert.equal(store.one<{ value: number }>(sql, 2)!.value, 2);
    assert.equal(store.one<{ value: null }>(sql, null)!.value, null);
    assert.equal(store.one('SELECT 1 WHERE 0'), undefined); assert.deepEqual(store.all('SELECT 1 WHERE 0'), []);
    assert.equal(store.all('SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3').length, 3);
  }));
  assert.equal(prepares, 1);
  assert.deepEqual(account.stats(), { sqlRows: 6, originalBytes: 0, originalReads: 0, acceptedUnits: 6, rejectedUnits: 0 });
  assert.equal(budget.stats().receiptWork, 6); budget.charge('path', 2); assert.equal(budget.stats().totalWork, 8);
  store.one(sql, 3); assert.equal(account.stats().sqlRows, 6); assert.equal(prepares, 2);
  assert.throws(() => store.withLexicalReads(account, () => 0), code('LEXICAL_SCOPE_REUSED'));
});

test('work refusal retains actual returned rows and distinguishes accepted from rejected charges', t => {
  const { store } = setup(t), budget = new OperationBudget({ limits: { work: 1 } }), account = new LexicalReadAccount(budget);
  assert.throws(() => store.withLexicalReads(account, () => {
    store.one('SELECT 1'); store.all('SELECT 1 UNION ALL SELECT 2');
  }), code('CAPTURE_WORK_LIMIT'));
  assert.deepEqual(account.stats(), { sqlRows: 3, originalBytes: 0, originalReads: 0, acceptedUnits: 1, rejectedUnits: 2 });
  budget.close(); assert.equal(store.one<{ n: number }>('SELECT 7 n')!.n, 7);
});

test('cancellation before SQL does not read; cancellation during a returned row retains rejected work', t => {
  const { store } = setup(t), controller = new AbortController();
  const budget = new OperationBudget({ signal: controller.signal }), account = new LexicalReadAccount(budget);
  let sqlCalls = 0; const prepare = store.db.prepare.bind(store.db);
  store.db.prepare = sql => { sqlCalls++; return prepare(sql); };
  assert.throws(() => store.withLexicalReads(account, () => { controller.abort(); store.one('SELECT 1'); }), code('CANCELLED'));
  assert.equal(sqlCalls, 0); assert.equal(account.stats().sqlRows, 0); budget.close();
  const second = new AbortController(), next = new OperationBudget({ signal: second.signal }), reads = new LexicalReadAccount(next);
  store.db.function('cancel_read', () => { second.abort(); return 3; });
  assert.throws(() => store.withLexicalReads(reads, () => store.one('SELECT cancel_read()')), code('CANCELLED'));
  assert.equal(reads.stats().sqlRows, 1); assert.equal(reads.stats().rejectedUnits, 1); next.close();
});

test('observer failure after an accepted charge preserves that charge and error identity', t => {
  const { store } = setup(t), error = new Error('Deliberate observer failure.');
  const budget = new OperationBudget({ observe: () => { throw error; } }), account = new LexicalReadAccount(budget);
  assert.throws(() => store.withLexicalReads(account, () => store.one('SELECT 1')), thrown => thrown === error);
  assert.equal(account.stats().acceptedUnits, 1); assert.equal(account.stats().rejectedUnits, 0); budget.close();
});

test('native SQL and action failures restore scope without counting failed reads', t => {
  const { store, budget, account } = setup(t), expected = new Error('Deliberate accessor failure.');
  const prepare = store.db.prepare.bind(store.db); store.db.prepare = sql => { if (sql === 'broken') throw expected; return prepare(sql); };
  assert.throws(() => store.withLexicalReads(account, () => { store.one('SELECT 1'); store.one('broken'); }), error => error === expected);
  assert.equal(account.stats().sqlRows, 1); assert.equal(budget.stats().totalWork, 1);
  const second = new LexicalReadAccount(budget);
  assert.throws(() => store.withLexicalReads(second, () => store.one('SELECT missing FROM absent')), /absent/);
  assert.equal(second.stats().sqlRows, 0);
  assert.throws(() => store.withLexicalReads(new LexicalReadAccount(budget), () => { throw expected; }), error => error === expected);
  assert.doesNotThrow(() => store.one('SELECT 1'));
});

test('nested accounts refuse while independent stores retain separate accounting', t => {
  const first = setup(t), second = setup(t);
  first.store.withLexicalReads(first.account, () => {
    first.store.one('SELECT 1'); second.store.one('SELECT 1');
    assert.throws(() => first.store.withLexicalReads(new LexicalReadAccount(first.budget), () => 0), code('NESTED_LEXICAL_SCOPE'));
    assert.throws(() => second.store.withLexicalReads(first.account, () => 0), code('LEXICAL_SCOPE_REUSED'));
    second.store.withLexicalReads(second.account, () => { second.store.all('SELECT 1 UNION ALL SELECT 2'); first.store.one('SELECT 1'); });
  });
  assert.equal(first.account.stats().acceptedUnits, 2); assert.equal(second.account.stats().acceptedUnits, 2);
});

test('async return, late descendants and nested late scopes fail before SQLite without leaking to other work', async t => {
  const { store, account, budget } = setup(t); let late: Promise<void> | undefined, calls = 0;
  const prepare = store.db.prepare.bind(store.db); store.db.prepare = sql => { calls++; return prepare(sql); };
  assert.throws(() => store.withLexicalReads(account, () => {
    late = (async () => {
      await Promise.resolve();
      assert.throws(() => store.one('SELECT 1'), code('CLOSED_LEXICAL_SCOPE'));
      assert.throws(() => store.withLexicalReads(new LexicalReadAccount(budget), () => 0), code('NESTED_LEXICAL_SCOPE'));
    })(); return late;
  }), code('ASYNC_LEXICAL_SCOPE'));
  await late; assert.equal(calls, 0);
  let tail!: Promise<void>;
  store.withLexicalReads(new LexicalReadAccount(budget), () => {
    tail = new Promise(resolve => setImmediate(() => {
      assert.throws(() => store.all('SELECT 1'), code('CLOSED_LEXICAL_SCOPE')); resolve();
    }));
  });
  await tail; assert.equal(calls, 0); assert.doesNotThrow(() => store.one('SELECT 1')); assert.equal(calls, 1);
});

test('closed budgets, closed stores and invalid internal accounts cannot open a lexical scope', t => {
  const { store, budget, account } = setup(t); budget.close();
  assert.throws(() => store.withLexicalReads(account, () => 0), code('CLOSED_CAPTURE_BUDGET'));
  assert.throws(() => new LexicalReadAccount({} as OperationBudget), code('INVALID_CAPTURE_BUDGET'));
  const unused = setup(t), live = new OperationBudget(); unused.store.close();
  assert.throws(() => unused.store.withLexicalReads(new LexicalReadAccount(live), () => 0), code('CLOSED_LEXICAL_SCOPE'));
  store.withLexicalReads(new LexicalReadAccount(live), () => 1); store.close();
  assert.throws(() => store.withLexicalReads(new LexicalReadAccount(live), () => 0), code('CLOSED_LEXICAL_SCOPE')); live.close();
});
