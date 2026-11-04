import { AsyncLocalStorage } from 'node:async_hooks';
import { OperationBudget } from './operation-budget.js';
import { CatalogError } from './types.js';

interface StoreScope { context: AsyncLocalStorage<LexicalReadAccount>; closed: boolean }
const scopes = new WeakMap<object, StoreScope>();
const fail = (code: string, message: string): never => { throw new CatalogError(code, message, 409); };

/** One synchronous lexical phase of an already-started, shared operation budget. */
export class LexicalReadAccount {
  #state: 'new' | 'active' | 'closed' = 'new';
  #rows = 0; #bytes = 0; #originals = 0; #accepted = 0; #rejected = 0;
  constructor(private readonly budget: OperationBudget) {
    if (!(budget instanceof OperationBudget)) fail('INVALID_CAPTURE_BUDGET', 'Use the internal operation budget.');
    budget.check();
  }
  check() {
    if (this.#state !== 'active') fail('CLOSED_LEXICAL_SCOPE', 'Lexical reads require an active synchronous scope.');
    this.budget.check();
  }
  enter() {
    if (this.#state !== 'new') fail('LEXICAL_SCOPE_REUSED', 'Each lexical account owns exactly one synchronous scope.');
    this.budget.check(); this.#state = 'active';
  }
  close() { this.#state = 'closed'; }
  record(kind: 'rows' | 'original', units: number) {
    if (this.#state !== 'active') fail('CLOSED_LEXICAL_SCOPE', 'Lexical reads require an active synchronous scope.');
    if (kind === 'rows') this.#rows += units;
    else { this.#bytes += units; this.#originals++; }
    const before = this.budget.stats().receiptWork;
    try { this.budget.charge('receipt', units); }
    finally {
      const accepted = this.budget.stats().receiptWork - before;
      this.#accepted += accepted; this.#rejected += units - accepted;
    }
  }
  stats() { return { sqlRows: this.#rows, originalBytes: this.#bytes, originalReads: this.#originals,
    acceptedUnits: this.#accepted, rejectedUnits: this.#rejected }; }
}

export function runLexicalReads<T>(store: object, account: LexicalReadAccount, action: () => T): T {
  let scope = scopes.get(store);
  if (!scope) { scope = { context: new AsyncLocalStorage<LexicalReadAccount>(), closed: false }; scopes.set(store, scope); }
  if (scope.closed) fail('CLOSED_LEXICAL_SCOPE', 'This catalog store is closed.');
  if (scope.context.getStore()) fail('NESTED_LEXICAL_SCOPE', 'Nested or inherited lexical scopes are unsupported.');
  if (!(account instanceof LexicalReadAccount) || typeof action !== 'function')
    fail('INVALID_LEXICAL_SCOPE', 'Use an internal account and synchronous action.');
  account.enter();
  return scope.context.run(account, () => {
    try {
      const result = action();
      if (result !== null && (typeof result === 'object' || typeof result === 'function') && 'then' in result) {
        // The action is invalid. Observe native promise rejection while inherited
        // reads still fail against the closed account, before reaching SQLite.
        if (result instanceof Promise) void result.catch(() => undefined);
        fail('ASYNC_LEXICAL_SCOPE', 'Lexical accounting only supports synchronous actions.');
      }
      account.check(); return result;
    } finally { account.close(); }
  });
}
export function checkLexicalRead(store: object) { scopes.get(store)?.context.getStore()?.check(); }
export function recordLexicalRows(store: object, rows: number) { scopes.get(store)?.context.getStore()?.record('rows', rows); }
export function recordLexicalOriginal(store: object, bytes: number) { scopes.get(store)?.context.getStore()?.record('original', bytes); }
export function closeLexicalReads(store: object) {
  const scope = scopes.get(store);
  if (scope) { scope.closed = true; scope.context.getStore()?.close(); }
  else scopes.set(store, { context: new AsyncLocalStorage<LexicalReadAccount>(), closed: true });
  // Do not disable AsyncLocalStorage: late descendants must retain the closed fence.
}
