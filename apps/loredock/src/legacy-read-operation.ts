import type { Catalog } from './catalog.js';
import { LexicalReadAccount } from './lexical-read-account.js';
import type { OperationBudget } from './operation-budget.js';
import { CatalogError } from './types.js';

/** Synchronous read phases sharing one authority epoch and the caller's original budget. */
export class LegacyReadOperation {
  private initial: string | undefined;
  private readonly totals = { sqlRows: 0, originalBytes: 0, originalReads: 0, acceptedUnits: 0, rejectedUnits: 0 };
  constructor(readonly catalog: Catalog, private readonly budget?: OperationBudget, private readonly signal?: AbortSignal) {
    // The caller retains this account before the first potentially rejected charge.
    budget?.check();
  }
  private epoch() {
    this.catalog.assertReading();
    if (this.signal?.aborted) throw new CatalogError('CANCELLED', 'The legacy read was cancelled.', 409);
    this.budget?.check();
    return JSON.stringify([this.catalog.store.one<{ n: number }>('SELECT total_changes() n')!.n,
      this.catalog.store.one<{ data_version: number }>('PRAGMA data_version')!.data_version]);
  }
  private account<T>(action: () => T): T {
    if (!this.budget) return action();
    const account = new LexicalReadAccount(this.budget);
    try { return this.catalog.store.withLexicalReads(account, action); }
    finally { const stats = account.stats(); for (const key of Object.keys(this.totals) as (keyof typeof stats)[]) this.totals[key] += stats[key]; }
  }
  read<T>(action: () => T): T {
    return this.account(() => {
      const check = () => {
        const current = this.epoch();
        if (this.initial === undefined) this.initial = current;
        else if (current !== this.initial) throw new CatalogError('INPUT_CHANGED', 'Catalog inputs changed during legacy analysis. Review the current input.', 409);
      };
      check(); const result = action(); check(); return result;
    });
  }
  check() { this.read(() => undefined); }
  stats() { return { ...this.totals }; }
}
