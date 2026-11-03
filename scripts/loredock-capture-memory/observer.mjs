import { createHash } from 'node:crypto';

export class DiagnosticError extends Error {
  constructor(message) { super(message); this.code = 'DIAGNOSTIC_LIMIT'; }
}
export const memoryPoint = () => ({ atMs: performance.now(), ...process.memoryUsage() });

// Bounded trusted observer; never logs query parameters or retains application objects.
export class MemoryObserver {
  constructor(enabled, { phaseRecords = 64, queryIdentities = 128 } = {}) {
    this.enabled = enabled; this.phaseLimit = phaseRecords; this.queryLimit = queryIdentities;
    this.templates = new Map(); this.active = false; this.records = []; this.total = 0;
    this.phase = (stage, owners = {}) => {
      if (!this.enabled || !this.active) return;
      if (this.records.length >= this.phaseLimit) throw new DiagnosticError('Phase record bound exceeded.');
      if (Object.keys(owners).length > 16 || Object.values(owners).some(value => value !== null && (!Number.isSafeInteger(value) || value < 0)))
        throw new DiagnosticError('Owner observations must be bounded counts or unavailable.');
      this.records.push({ stage, ...memoryPoint(), owners: { ...owners }, prepareCalls: this.total });
    };
  }
  attach(db) {
    if (!this.enabled) return () => {};
    const original = db.prepare, observer = this;
    db.prepare = function(sql, ...args) {
      if (observer.active) {
        let entry = observer.templates.get(sql);
        if (!entry) {
          if (observer.templates.size >= observer.queryLimit) throw new DiagnosticError('SQL template bound exceeded.');
          entry = { sha256: createHash('sha256').update(sql).digest('hex'), calls: 0 };
          observer.templates.set(sql, entry);
        }
        entry.calls++; observer.total++;
      }
      return original.call(this, sql, ...args);
    };
    return () => { db.prepare = original; };
  }
  begin() {
    if (this.active) throw new DiagnosticError('An observation is already active.');
    this.records = []; this.total = 0;
    for (const entry of this.templates.values()) entry.calls = 0;
    this.active = true; this.phase('operation-start');
  }
  end() {
    try { this.phase('operation-end'); }
    finally { this.active = false; }
    return this.result();
  }
  result() {
    return { enabled: this.enabled, phases: this.records, prepareCalls: this.total,
      queries: this.enabled ? [...this.templates.values()].filter(row => row.calls).map(row => ({ ...row })) : [],
      manifestHeaderOwnership: 'unavailable: snapshot internals are not instrumented' };
  }
}
