import { AsyncLocalStorage } from 'node:async_hooks';
export const preparedReadLimits = Object.freeze({ statements: 64, sqlBytes: 64 * 1024 });
const expire = (scope) => { scope.active = false; scope.statements.clear(); scope.bytes = 0; };
/** One store owns this helper. It retains statements only within one explicit read scope. */
export class PreparedReadScope {
    db;
    context = new AsyncLocalStorage();
    limits;
    scope = null;
    closed = false;
    constructor(db, limits = {}) {
        this.db = db;
        for (const key of Object.keys(limits))
            if (!Object.hasOwn(preparedReadLimits, key))
                throw new Error('Unknown read statement limit.');
        this.limits = { ...preparedReadLimits, ...limits };
        for (const key of Object.keys(this.limits)) {
            const value = this.limits[key];
            if (!Number.isSafeInteger(value) || value < 0 || value > preparedReadLimits[key])
                throw new Error('Read statement limits may only decrease.');
        }
    }
    execute(method, sql, args, fallback) {
        const scope = this.context.getStore();
        // SQL is trusted application code. Eligibility is not SQL authorization.
        if (this.closed || !scope?.active || (!/^SELECT\s/i.test(sql) && sql !== 'PRAGMA data_version'))
            return fallback();
        let entry = scope.statements.get(sql);
        if (entry?.busy)
            return fallback();
        if (!entry) {
            const bytes = Buffer.byteLength(sql);
            if (scope.statements.size >= this.limits.statements || scope.bytes + bytes > this.limits.sqlBytes)
                return fallback();
            entry = { statement: this.db.prepare(sql), bytes, busy: false };
            scope.statements.set(sql, entry);
            scope.bytes += bytes;
        }
        entry.busy = true;
        try {
            return entry.statement[method](...args);
        }
        catch (error) {
            if (scope.statements.get(sql) === entry) {
                scope.statements.delete(sql);
                scope.bytes -= entry.bytes;
            }
            throw error;
        }
        finally {
            entry.busy = false;
        }
    }
    async run(action) {
        if (this.closed)
            return action();
        if (this.scope)
            return this.context.run(undefined, action);
        const scope = { active: true, statements: new Map(), bytes: 0 };
        this.scope = scope;
        return this.context.run(scope, async () => {
            try {
                return await action();
            }
            finally {
                expire(scope);
                if (this.scope === scope)
                    this.scope = null;
            }
        });
    }
    /** Release owned references before the caller closes its database; no native finalization claim. */
    close() {
        if (this.scope)
            expire(this.scope);
        this.scope = null;
        this.closed = true;
        this.context.disable();
    }
}
