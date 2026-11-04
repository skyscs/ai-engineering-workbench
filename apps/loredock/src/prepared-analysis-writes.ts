import { AsyncLocalStorage } from 'node:async_hooks';
import type { DatabaseSync, SQLInputValue, StatementSync } from 'node:sqlite';

// Keep caller SQL in the fingerprinted analysis module. A changed literal falls back
// to fresh preparation until this independent eligibility list is reviewed.
export const analysisWriteSql = Object.freeze({
  pending: 'INSERT INTO code_analysis_files (runId,fileId,ordinal,inputHash) VALUES (?,?,?,?)',
  checkpoint: "UPDATE code_analysis_files SET status=?,reason=?,inputBytes=?,payloadBytes=?,gapCount=?,payload=?,payloadHash=?,checkpointHash=? WHERE runId=? AND fileId=? AND status='pending'",
  counters: 'UPDATE code_analyses SET elapsedMs=?,textBytes=textBytes+?,payloadBytes=payloadBytes+? WHERE id=?',
});
export interface AnalysisWriteLimits { statements: number; sqlBytes: number; bindingBytes: number }
export const analysisWriteLimits: Readonly<AnalysisWriteLimits> = Object.freeze({ statements: 3, sqlBytes: 4 * 1024, bindingBytes: 144 * 1024 });
type Limits = AnalysisWriteLimits;
interface Entry { statement: StatementSync; bytes: number; busy: boolean }
interface Scope { active: boolean; entries: Map<string, Entry>; bytes: number }
const allowed = new Set<string>(Object.values(analysisWriteSql));
const expire = (scope: Scope) => { scope.active = false; scope.entries.clear(); scope.bytes = 0; };

function eligibleBindings(args: SQLInputValue[], maximum: number) {
  let bytes = 0;
  for (const value of args) {
    if (value === null) continue;
    if (typeof value === 'string') bytes += Buffer.byteLength(value);
    else if (typeof value === 'number' || typeof value === 'bigint') bytes += 8;
    else if (ArrayBuffer.isView(value)) bytes += value.byteLength;
    else return false;
    if (bytes > maximum) return false;
  }
  return true;
}

/** Per-store transient reuse for three trusted analysis writes; never a result cache. */
export class PreparedAnalysisWrites {
  private readonly context = new AsyncLocalStorage<Scope | undefined>();
  private readonly limits: Limits;
  private scope: Scope | undefined;
  private closed = false;
  constructor(private readonly db: Pick<DatabaseSync, 'prepare'>, limits: Partial<Limits> = {}) {
    for (const key of Object.keys(limits)) if (!Object.hasOwn(analysisWriteLimits, key)) throw new Error('Unknown analysis write limit.');
    this.limits = { ...analysisWriteLimits, ...limits };
    for (const key of Object.keys(this.limits) as (keyof Limits)[]) {
      const value = this.limits[key];
      if (!Number.isSafeInteger(value) || value < 0 || value > analysisWriteLimits[key]) throw new Error('Analysis write limits may only decrease.');
    }
  }
  execute(sql: string, args: SQLInputValue[], fresh: () => ReturnType<StatementSync['run']>) {
    const scope = this.context.getStore();
    // Eligibility is an optimization boundary, not authorization to execute SQL.
    if (this.closed || !scope?.active || !allowed.has(sql)) return fresh();
    let entry = scope.entries.get(sql);
    if (entry?.busy) return fresh();
    const remove = () => {
      if (entry && scope.entries.get(sql) === entry) { scope.entries.delete(sql); scope.bytes -= entry.bytes; }
    };
    if (!eligibleBindings(args, this.limits.bindingBytes)) { remove(); return fresh(); }
    if (!entry) {
      const bytes = Buffer.byteLength(sql);
      if (scope.entries.size >= this.limits.statements || scope.bytes + bytes > this.limits.sqlBytes) return fresh();
      entry = { statement: this.db.prepare(sql), bytes, busy: false };
      scope.entries.set(sql, entry); scope.bytes += bytes;
    }
    entry.busy = true;
    try { return entry.statement.run(...args); }
    catch (error) { remove(); throw error; }
    finally { entry.busy = false; }
  }
  runSync<T>(action: () => T): T {
    if (this.closed) return action();
    if (this.scope) return this.context.run(undefined, action);
    const scope: Scope = { active: true, entries: new Map(), bytes: 0 }; this.scope = scope;
    return this.context.run(scope, () => {
      try { return action(); }
      finally { expire(scope); if (this.scope === scope) this.scope = undefined; }
    });
  }
  async run<T>(action: () => T | Promise<T>): Promise<T> {
    if (this.closed) return action();
    if (this.scope) return this.context.run(undefined, action);
    const scope: Scope = { active: true, entries: new Map(), bytes: 0 }; this.scope = scope;
    return this.context.run(scope, async () => {
      try { return await action(); }
      finally { expire(scope); if (this.scope === scope) this.scope = undefined; }
    });
  }
  /** Drop owned references; SQLite may retain its last bindings until native finalization. */
  close() {
    if (this.scope) expire(this.scope);
    this.scope = undefined; this.closed = true; this.context.disable();
  }
}
