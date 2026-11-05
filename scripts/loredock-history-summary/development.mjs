// First ordinary history observation. Existing controls remain frozen and unreplayed.
import assert from 'node:assert/strict';
import { mkdir, cp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { plan, ordinaryInput } from './plan.mjs';
import { materialize, save, inventory, normalized, journal, launch, client } from '../loredock-prepared-flow/io.mjs';
import { createHistory, reopenHistory, revokeHistory, witnessStorage } from '../loredock-prepared-flow/history-cases.mjs';

async function account(checkpoint, directory) {
  await mkdir(directory);
  const data = path.join(directory, 'data'), result = { errors: [], rows: checkpoint.rows, timingQualified: false };
  let daemon, api;
  try {
    assert.deepEqual(await inventory(checkpoint.data), checkpoint.files);
    await cp(checkpoint.data, data, { recursive: true, force: false, errorOnExist: true });
    assert.deepEqual(await inventory(data), checkpoint.files);
    daemon = await launch({ directory: path.join(directory, 'daemon'), data, controlled: true, accounting: true });
    api = await client(path.join(directory, 'http'));
    await daemon.command('accounting-start', { scope: 'summary-' + checkpoint.rows });
    result.list = await api.request('/answers'); result.accounting = await daemon.command('accounting-end');
    assert.equal(result.list.rawSha256, checkpoint.list.rawSha256);
    const accounting = result.accounting;
    assert.equal(accounting.budgets.length, 1); assert.deepEqual(accounting.unclosedBudgets, []);
    const [budget] = accounting.budgets;
    assert.equal(Object.values(budget.charges).reduce((sum, row) => sum + row.accepted, 0), budget.final.totalWork);
    assert.equal(accounting.totalWork, budget.final.totalWork); assert(accounting.totalWork > 0 && accounting.totalWork <= plan.aggregateWork);
    assert.deepEqual(budget.errors, {}); assert.equal(budget.closes, 1);
    result.runtime = await daemon.command('stats'); assert.deepEqual(result.runtime, { prepares: 0, calls: 0, closed: 0 });
  } catch (error) { result.errors.push(normalized(error)); }
  finally {
    api?.close();
    try {
      if (daemon) {
        result.exit = await daemon.stop(); assert.equal(result.exit.code, 0);
        result.audit = JSON.parse(await readFile(path.join(daemon.directory, 'accounting-audit.json'), 'utf8'));
        assert.equal(result.audit.activeScope, null);
        for (const key of ['lateActivities', 'unscopedBudgets', 'unclosedBudgets']) assert.deepEqual(result.audit[key], []);
      }
      result.storage = witnessStorage(data); assert.deepEqual(await inventory(checkpoint.data), checkpoint.files);
    } catch (error) { result.errors.push(normalized(error)); }
    await save(path.join(directory, 'result.json'), result);
  }
  assert.deepEqual(result.errors, []); return result;
}

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output); await save(path.join(output, 'plan.json'), plan);
const log = journal(path.join(output, 'sequence.jsonl'));
const result = { errors: [], cases: [], qualification: false, reservedFamilyReads: 0, modelCalls: 0 };
async function run(name, operation) {
  log.append({ event: 'started', name });
  const value = await operation(); result.cases.push({ name, value }); log.append({ event: 'finished', name }); return value;
}
try {
  const { corpus, question } = ordinaryInput();
  const sources = await materialize(path.join(output, 'sources'), corpus);
  await save(path.join(output, 'sources.json'), sources);
  const capacity = await run('capacity', () => createHistory({ directory: path.join(output, 'capacity'), sources,
    question }));
  for (const checkpoint of capacity.checkpoints) {
    assert.equal(checkpoint.list.value.attempts.length, plan.returnedRows);
    assert(checkpoint.list.value.attempts.every(row => row.status === 'succeeded' && row.inputValidation === 'metadata-only'
      && row.context === null && row.nativeContext === null && row.answer === null));
    const observed = await run('restart-' + checkpoint.rows, () => reopenHistory({ checkpoint, directory: path.join(output, 'restart-' + checkpoint.rows) }));
    assert(observed.observation.list.elapsedMs <= plan.listWallMs);
  }
  await run('revocation-64', () => revokeHistory({ checkpoint: capacity.checkpoints[1], directory: path.join(output, 'revocation-64'), sourceName: 'z-independent-notes' }));
  for (const checkpoint of capacity.checkpoints) await run('accounting-' + checkpoint.rows, () => account(checkpoint, path.join(output, 'accounting-' + checkpoint.rows)));
} catch (error) { result.errors.push(normalized(error)); process.exitCode = 1; }
finally { await save(path.join(output, 'result.json'), result); log.close(); }
console.log(JSON.stringify({ errors: result.errors, completedCases: result.cases.map(row => row.name), qualification: false }, null, 2));
