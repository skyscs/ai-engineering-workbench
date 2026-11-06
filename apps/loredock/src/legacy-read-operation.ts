import type { Catalog } from './catalog.js';
import { LexicalReadAccount } from './lexical-read-account.js';
import type { OperationBudget } from './operation-budget.js';
import { CatalogError } from './types.js';
import type { ParserLease } from './file-parser-service.js';
import { parseLegacyFile, type LegacyFileInput } from './legacy-file-parser.js';

/** Synchronous read phases sharing one authority epoch and the caller's original budget. */
export class LegacyReadOperation {
  private initial: string | undefined;
  private lease: ParserLease | undefined;
  private readonly deadline: number;
  private transferBytes = 0;
  get parserBytes() { return this.transferBytes; }
  private readonly totals = { sqlRows: 0, originalBytes: 0, originalReads: 0, acceptedUnits: 0, rejectedUnits: 0 };
  constructor(readonly catalog: Catalog, private readonly budget?: OperationBudget, private readonly signal?: AbortSignal) {
    // The caller retains this account before the first potentially rejected charge.
    budget?.check();
    this.deadline = budget?.deadline ?? performance.now() + 5000;
  }
  async run<T>(action: () => Promise<T>): Promise<T> {
    if (this.lease) return action();
    this.catalog.assertReading(); this.budget?.check();
    const lease = this.catalog.parser.acquire('foreground', { deadline: this.deadline,
      ...(this.signal ? { signal: this.signal } : {}), charge: (bytes: number) => { this.budget?.charge('receipt', bytes); this.transferBytes += bytes; } });
    this.lease = lease;
    try { return await action(); }
    finally { try { await lease.release(); } finally { this.lease = undefined; } }
  }
  async parse(input: LegacyFileInput) {
    if (!this.lease) throw new CatalogError('PARSER_OWNERSHIP', 'Code parsing requires an admitted operation.', 409);
    try { return await parseLegacyFile(input, ({ path, content }) => this.lease!.parse(path, content)); }
    catch (error) { this.budget?.check(); throw error; }
  }
  private epoch() {
    this.catalog.assertReading();
    this.budget?.check();
    this.lease?.check();
    if (this.signal?.aborted) throw new CatalogError('CANCELLED', 'The legacy read was cancelled.', 409);
    this.budget?.check();
    if (performance.now() >= this.deadline) throw new CatalogError('LEGACY_TIME_LIMIT', 'The context operation exceeded its five-second deadline.', 409);
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
