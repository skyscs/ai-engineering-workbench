// Ordinary whole-worker accounting with exact same stopped base and output parity. No model or reserved family.
import assert from 'node:assert/strict';
import { mkdir, readFile, cp } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, launch, client, save, inventory, normalized, until } from './io.mjs';
import { indexSources, prepare, generate } from './flow.mjs';

const output = process.argv[2]; assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const report = { schemaVersion: 'prepared-flow-worker-accounting-development/1', errors: [], modelCalls: 0, reservedFamilyReads: 0, qualification: false };
const base = path.join(output, 'base-data'); let daemon, api;
async function stop() {
  api?.close(); api = undefined;
  if (daemon) { const owned = daemon; daemon = undefined; const exit = await owned.stop(); assert.equal(exit.code, 0); }
}
async function json(file) { return JSON.parse(await readFile(file, 'utf8')); }
function stored(data, id) {
  const database = new DatabaseSync(path.join(data, 'loredock.db'), { readOnly: true });
  try { return { ...database.prepare('SELECT a.context,w.witness,w.reviewedHash FROM answer_attempts a JOIN answer_witnesses w ON w.answerId=a.id WHERE a.id=?').get(id) }; }
  finally { database.close(); }
}
async function flow(name, accounting) {
  const data = path.join(output, name + '-data'); await cp(base, data, { recursive: true, force: false, errorOnExist: true });
  assert.deepEqual(await inventory(data), await inventory(base));
  daemon = await launch({ directory: path.join(output, name), data, controlled: true, accounting }); api = await client(path.join(output, 'http-' + name));
  assert.deepEqual(await daemon.command('stats'), { prepares: 0, calls: 0, closed: 0 });
  if (accounting) await daemon.command('accounting-start', { scope: 'complete-find-through-history' });
  const began = performance.now();
  const prepared = await prepare(api, 'How does apply reach PermitWriter.onMessage through permit.granted.v3?'); assert(prepared.review.compact.item);
  const published = await generate(api, prepared.review), elapsedMs = performance.now() - began;
  await until(async () => (await daemon.command('stats')).closed === 1, 'Controlled worker cleanup did not complete.');
  const actual = accounting ? await daemon.command('accounting-end') : null;
  if (actual) {
    assert.deepEqual(actual.unclosedBudgets, []);
    for (const budget of actual.budgets) assert.equal(Object.values(budget.charges).reduce((sum, row) => sum + row.accepted, 0), budget.final.totalWork);
    assert.equal(actual.totalWork, actual.budgets.reduce((sum, budget) => sum + budget.final.totalWork, 0));
    await save(path.join(output, 'whole-worker-accounting.json'), actual);
  }
  const runtime = await daemon.command('stats'); assert.equal(runtime.calls, 1);
  const request = await json(path.join(daemon.directory, 'request-1.json'));
  await stop();
  const saved = stored(data, published.answer.id); assert.equal(saved.context, JSON.stringify(prepared.review.context));
  assert.equal(JSON.parse(saved.witness).prompt, request.prompt); assert.equal(saved.reviewedHash, prepared.review.reviewedHash);
  if (accounting) {
    const audit = await json(path.join(output, name, 'accounting-audit.json'));
    assert.equal(audit.activeScope, null); assert.deepEqual(audit.lateActivities, []); assert.deepEqual(audit.unscopedBudgets, []); assert.deepEqual(audit.unclosedBudgets, []);
    assert.equal(audit.observedBudgets, actual.budgets.length);
  }
  return { prepared: prepared.review, published, request, saved, runtime, elapsedMs, actual };
}
try {
  const corpus = corpusFactory(); for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const sources = await materialize(path.join(output, 'sources'), corpus); await save(path.join(output, 'sources.json'), sources);
  daemon = await launch({ directory: path.join(output, 'production-base'), data: base }); api = await client(path.join(output, 'http-base'));
  await indexSources(api, sources.paths); await api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: output, profile: null }); await stop();
  const ordinary = await flow('ordinary', false), diagnostic = await flow('diagnostic', true);
  // Predeclared normalization: only transient/answer UUIDs and created/dispatched timestamps differ.
  const preview = value => { const { id, requestId, ...result } = value; return result; };
  const answer = value => { const { id, createdAt, dispatchedAt, ...result } = value; return result; };
  assert.deepEqual(preview(diagnostic.prepared), preview(ordinary.prepared));
  assert.deepEqual(answer(diagnostic.published.answer), answer(ordinary.published.answer));
  assert.deepEqual(diagnostic.request, ordinary.request); assert.deepEqual(diagnostic.saved, ordinary.saved);
  report.result = { ordinaryMs: ordinary.elapsedMs, diagnosticTimingQualified: false, actualBudgets: diagnostic.actual.budgets.length,
    actualWork: diagnostic.actual.totalWork, requestedWork: diagnostic.actual.requestedWork, usefulOutputParity: true, promptSchemaWitnessByteParity: true,
    normalizedFields: ['preparation.id', 'preparation.requestId', 'answer.id', 'answer.createdAt', 'answer.dispatchedAt'], controlledCalls: 2 };
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  try { await stop(); } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  try { await save(path.join(output, 'retained-tree.json'), await inventory(output)); } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'result.json'), report);
}
console.log(JSON.stringify(report, null, 2));
