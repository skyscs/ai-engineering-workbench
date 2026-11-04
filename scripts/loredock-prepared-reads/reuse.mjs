import { AsyncLocalStorage } from 'node:async_hooks';

export const readStatementLimits = Object.freeze({ statements: 64, sqlBytes: 64 * 1024 });

// Offline only. Every call executes SQL again; this never retains query results.
export function createPreparedReads({ CatalogStore, CodePaths }, limits = readStatementLimits) {
  for (const key of Object.keys(limits)) if (!Object.hasOwn(readStatementLimits, key)) throw new Error('Unknown read statement limit.');
  limits = { ...readStatementLimits, ...limits };
  for (const [key, value] of Object.entries(limits)) if (!Number.isSafeInteger(value) || value < 0 || value > readStatementLimits[key])
    throw new Error('Read statement limits may only decrease.');
  const states = new WeakMap();
  const expire = scope => { scope.active = false; scope.statements.clear(); scope.bytes = 0; };
  function execute(store, method, sql, args, fallback) {
    const scope = states.get(store)?.context.getStore();
    // SQL comes from trusted source code. This filter does not authorize SQL inputs.
    if (!scope?.active || typeof sql !== 'string' || (!/^SELECT\s/i.test(sql) && sql !== 'PRAGMA data_version')) return fallback();
    let entry = scope.statements.get(sql);
    if (entry?.busy) return fallback();
    if (!entry) {
      const bytes = Buffer.byteLength(sql);
      if (scope.statements.size >= limits.statements || scope.bytes + bytes > limits.sqlBytes) return fallback();
      entry = { statement: store.db.prepare(sql), bytes, busy: false };
      scope.statements.set(sql, entry); scope.bytes += bytes;
    }
    entry.busy = true;
    try { return entry.statement[method](...args); }
    catch (error) {
      // A failed execution cannot leave a possibly disturbed statement for reuse.
      if (scope.statements.get(sql) === entry) { scope.statements.delete(sql); scope.bytes -= entry.bytes; }
      throw error;
    } finally { entry.busy = false; }
  }
  class PreparedCatalogStore extends CatalogStore {
    constructor(...args) { super(...args); states.set(this, { context: new AsyncLocalStorage(), scope: null }); }
    one(sql, ...args) { return execute(this, 'get', sql, args, () => super.one(sql, ...args)); }
    all(sql, ...args) { return execute(this, 'all', sql, args, () => super.all(sql, ...args)); }
    async withPreparedReads(fn) {
      const state = states.get(this);
      if (!state) return fn();
      // Preserve the underlying owner's busy/refusal behavior. Never share scopes.
      if (state.scope) return state.context.run(undefined, fn);
      const scope = { active: true, statements: new Map(), bytes: 0 }; state.scope = scope;
      return state.context.run(scope, async () => {
        try { return await fn(); }
        finally { expire(scope); if (state.scope === scope) state.scope = null; }
      });
    }
    close() {
      const state = states.get(this);
      if (state) { if (state.scope) expire(state.scope); state.context.disable(); states.delete(this); }
      return super.close();
    }
  }
  class PreparedCodePaths extends CodePaths {
    read(...args) { return this.analysis.catalog.store.withPreparedReads(() => super.read(...args)); }
  }
  return { CatalogStore: PreparedCatalogStore, CodePaths: PreparedCodePaths };
}
