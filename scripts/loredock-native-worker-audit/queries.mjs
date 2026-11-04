import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const owners = new WeakSet();
const methods = new Set(['get', 'all', 'run', 'iterate']);
const hash = text => createHash('sha256').update(text).digest('hex');

// Opt-in diagnostic only. Retains bounded SQL templates/counters, never arguments,
// result rows, statements or per-call records. Iterator counts mean invocation.
export function observeQueries(db, { identities = 128, sqlBytes = 64 * 1024, stages = 12 } = {}) {
  for (const [value, max] of [[identities, 128], [sqlBytes, 64 * 1024], [stages, 12]])
    assert.ok(Number.isSafeInteger(value) && value >= 0 && value <= max);
  assert.ok(!owners.has(db), 'Database already has this diagnostic owner.');
  const templates = new Map(), recorded = [];
  const prepare = db.prepare, exec = db.exec;
  let current, usedBytes = 0, attached = true;
  function entry(sql) {
    if (!attached || !current) return undefined;
    assert.equal(typeof sql, 'string');
    if (!templates.has(sql)) {
      const bytes = Buffer.byteLength(sql);
      assert.ok(templates.size < identities && usedBytes + bytes <= sqlBytes, 'Diagnostic SQL identity bound exceeded.');
      templates.set(sql, { sha256: hash(sql), bytes, sql }); usedBytes += bytes;
    }
    const key = templates.get(sql).sha256;
    if (!current.queries.has(key)) current.queries.set(key, { sha256: key, prepare: 0, prepareErrors: 0,
      get: 0, all: 0, run: 0, iterate: 0, executionErrors: 0, exec: 0, execErrors: 0 });
    return current.queries.get(key);
  }
  const wrappedPrepare = function(sql) {
    const row = entry(sql); if (row) row.prepare++;
    let statement;
    try { statement = prepare.call(db, sql); }
    catch (error) { if (row) row.prepareErrors++; throw error; }
    return new Proxy(statement, { get(target, key) {
      const value = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      if (!methods.has(key)) return value.bind(target);
      return (...args) => {
        const execution = entry(sql); if (execution) execution[key]++;
        try { return value.apply(target, args); }
        catch (error) { if (execution) execution.executionErrors++; throw error; }
      };
    } });
  };
  const wrappedExec = function(sql) {
    const row = entry(sql); if (row) row.exec++;
    try { return exec.call(db, sql); }
    catch (error) { if (row) row.execErrors++; throw error; }
  };
  db.prepare = wrappedPrepare; db.exec = wrappedExec; owners.add(db);
  return {
    begin(name) {
      assert.ok(attached && !current && recorded.length < stages, 'Diagnostic stage bound/ownership violated.');
      assert.ok(typeof name === 'string' && /^[a-z0-9-]{1,64}$/.test(name) && !recorded.some(row => row.name === name));
      current = { name, queries: new Map() };
    },
    end() {
      assert.ok(current, 'No active diagnostic stage.');
      const result = { name: current.name, queries: [...current.queries.values()].map(row => ({ ...row })) };
      recorded.push(result); current = undefined; return result;
    },
    report() { return structuredClone({ templates: [...templates.values()], stages: recorded }); },
    detach() {
      if (!attached) return;
      assert.ok(!current && db.prepare === wrappedPrepare && db.exec === wrappedExec, 'Finish the stage and preserve diagnostic ownership before detaching.');
      db.prepare = prepare; db.exec = exec; attached = false; owners.delete(db);
    },
  };
}
