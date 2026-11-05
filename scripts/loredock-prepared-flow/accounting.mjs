// Diagnostic lane only. Forward actual budget methods; never substitute limits or validators.
import assert from 'node:assert/strict';
import { channel } from 'node:diagnostics_channel';
import { OperationBudget } from '../../apps/loredock/dist/operation-budget.js';

const original = Object.fromEntries(['check', 'charge', 'close'].map(name => [name, OperationBudget.prototype[name]]));
const known = new WeakMap(), names = new Set(), finishedScopes = new Set(); const records = [], lateActivities = []; let scope = null, nextId = 0;
const responses = [];
// Node emits this after the actual server response finishes. Observe existing budgets
// synchronously; do not hold HTTP, change application methods or infer a worker phase
// from a previously returned public status.
channel('http.server.response.finish').subscribe(({ request, response }) => {
  if (scope === null) return;
  responses.push({ scope, atNs: process.hrtime.bigint().toString(), method: request.method, path: request.url,
    status: response.statusCode, openBudgets: records.filter(row => row.scope === scope && row.closes === 0).map(row => row.id) });
});
function record(budget) {
  let row = known.get(budget);
  if (!row) {
    row = { id: ++nextId, scope, began: budget.began, limits: budget.limits, checks: 0, closes: 0, charges: {}, errors: {}, final: null };
    known.set(budget, row); records.push(row);
  }
  return row;
}
for (const name of ['check', 'charge', 'close']) OperationBudget.prototype[name] = function (...args) {
  const row = record(this), before = name === 'charge' ? this.stats().totalWork : 0;
  if (finishedScopes.has(row.scope)) lateActivities.push({ budget: row.id, scope: row.scope, currentScope: scope, method: name });
  if (name === 'check') row.checks++; if (name === 'close') row.closes++;
  try { return original[name].apply(this, args); }
  catch (error) { const key = name + ':' + (error.code ?? error.name); row.errors[key] = (row.errors[key] ?? 0) + 1; throw error; }
  finally {
    if (name === 'charge') {
      const value = row.charges[args[0]] ??= { calls: 0, requested: 0, accepted: 0 };
      value.calls++; value.requested += args[1] ?? 1; value.accepted += this.stats().totalWork - before;
    }
    row.final = this.stats();
  }
};
export function beginScope(name) {
  assert.equal(scope, null, 'Finish the current diagnostic scope first.');
  assert.equal(typeof name, 'string'); assert(name.length > 0 && name.length < 200);
  assert(!names.has(name), 'Diagnostic scope names cannot be reused.'); names.add(name); scope = name;
}
export function inspectScope() {
  assert(scope); const selected = records.filter(row => row.scope === scope);
  return { scope, budgets: selected, responses: responses.filter(row => row.scope === scope), totalWork: selected.reduce((sum, row) => sum + row.final.totalWork, 0),
    requestedWork: selected.reduce((sum, row) => sum + Object.values(row.charges).reduce((units, charge) => units + charge.requested, 0), 0),
    unclosedBudgets: selected.filter(row => row.closes === 0).map(row => row.id), timingQualified: false, memoryQualified: false };
}
export function endScope() {
  const result = inspectScope(); finishedScopes.add(scope); scope = null; return result;
}
export function audit() { return { activeScope: scope, lateActivities, unscopedBudgets: records.filter(row => row.scope === null),
  observedBudgets: records.length, unclosedBudgets: records.filter(row => row.closes === 0).map(row => row.id) }; }
