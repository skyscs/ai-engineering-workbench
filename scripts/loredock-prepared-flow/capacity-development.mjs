// Ordinary controlled capacity exercise. No reserved-family imports or model process.
import assert from 'node:assert/strict';
import { mkdir, cp } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, launch, client, save, inventory, normalized, journal } from './io.mjs';
import { indexSources, prepare, generate } from './flow.mjs';

const output = process.argv[2]; assert(path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const report = { schemaVersion: 'prepared-flow-capacity-development/1', errors: [], samples: [], modelCalls: 0, reservedFamilyReads: 0, qualification: false };
const log = journal(path.join(output, 'journal.jsonl')), data = path.join(output, 'data');
let daemon, api;
async function stop() {
  api?.close(); api = undefined;
  if (daemon) { const result = await daemon.stop(); daemon = undefined; assert.equal(result.code, 0, JSON.stringify(result)); }
}
function storage() {
  const database = new DatabaseSync(path.join(data, 'loredock.db'), { readOnly: true });
  try { return { ...database.prepare('SELECT count(*) rows, sum(purged) purged, coalesce(sum(length(CAST(witness AS BLOB))),0) bytes FROM answer_witnesses').get() }; }
  finally { database.close(); }
}
try {
  log.append({ event: 'started', corpus: 'ordinary-permit-development', attempts: 64 });
  const corpus = corpusFactory(); for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const sources = await materialize(path.join(output, 'sources'), corpus); await save(path.join(output, 'sources.json'), sources);
  daemon = await launch({ directory: path.join(output, 'controlled'), data, controlled: true });
  assert.deepEqual(await daemon.command('stats'), { prepares: 0, calls: 0, closed: 0 });
  api = await client(path.join(output, 'http-controlled')); await indexSources(api, sources.paths);
  await api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: output, profile: null });
  const question = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
  let first, finalList;
  for (let index = 1; index <= 64; index++) {
    const began = performance.now(), prepared = await prepare(api, question); assert(prepared.review.compact.item);
    const answer = await generate(api, prepared.review); first ??= answer;
    log.append({ event: 'admitted-and-published', index, answerId: answer.answer.id, elapsedMs: performance.now() - began });
    if ([1, 20, 64].includes(index)) {
      const response = await api.request('/answers'); assert.equal(response.value.attempts.length, Math.min(index, 20));
      report.samples.push({ rows: index, visibleRows: response.value.attempts.length, elapsedMs: response.elapsedMs, bytes: response.bytes });
      finalList = response.value;
    }
  }
  const current = await prepare(api, question);
  const refusal = await api.request('/prepared-answers', 'POST', { requestId: 'owned-over-capacity', preparationId: current.review.id, reviewedHash: current.review.reviewedHash }, { allowError: true });
  assert.equal(refusal.status, 409); assert.equal(refusal.value.error.code, 'ANSWER_WITNESS_LIMIT');
  assert.equal((await api.request('/question-preparations/' + current.review.id)).value.status, 'ready');
  assert.equal((await api.request('/prepared-answers', 'POST', first.input)).value.id, first.answer.id);
  report.runtime = await daemon.command('stats'); assert.equal(report.runtime.calls, 64);
  await stop(); report.beforePurge = storage(); assert.equal(report.beforePurge.rows, 64); assert.equal(report.beforePurge.purged, 0);
  await save(path.join(output, 'stopped-capacity.json'), await inventory(data));
  await cp(data, path.join(output, 'capacity-data'), { recursive: true, errorOnExist: true, force: false });
  assert.deepEqual(await inventory(path.join(output, 'capacity-data')), await inventory(data));

  daemon = await launch({ directory: path.join(output, 'accounting'), data, controlled: true, accounting: true }); api = await client(path.join(output, 'http-accounting'));
  await daemon.command('accounting-start', { scope: 'twenty-row-list-at-capacity' });
  const response = await api.request('/answers'), accounting = await daemon.command('accounting-end');
  assert.deepEqual(response.value, finalList); assert.equal(accounting.budgets.length, 20); assert.deepEqual(accounting.unclosedBudgets, []);
  assert.equal(accounting.totalWork, accounting.budgets.reduce((sum, budget) => sum + budget.final.totalWork, 0));
  await save(path.join(output, 'accounting.json'), accounting);
  report.accounting = { budgets: accounting.budgets.length, totalWork: accounting.totalWork, uninstrumentedByteParity: true, resourceQualified: false };
  await stop();

  daemon = await launch({ directory: path.join(output, 'production-reopen'), data }); api = await client(path.join(output, 'http-reopen'));
  assert.deepEqual((await api.request('/answers')).value, finalList);
  assert.equal((await api.request('/prepared-answers', 'POST', first.input)).value.id, first.answer.id);
  const project = (await api.request('/project')).value, dependency = project.sources.find(source => source.name === 'z-independent-notes'); assert(dependency);
  await api.request('/sources/' + dependency.id + '/revoke', 'POST', {});
  const fenced = (await api.request('/answers/' + first.answer.id)).value;
  assert.equal(fenced.status, 'fenced'); assert.equal(fenced.context, null); assert.equal(fenced.answer, null); assert.equal(fenced.nativeContext, null);
  await stop(); report.afterPurge = storage(); assert.deepEqual(report.afterPurge, { rows: 64, purged: 64, bytes: 0 });
  await save(path.join(output, 'stopped-purged.json'), await inventory(data));
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  try { await stop(); } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  try { await save(path.join(output, 'retained-tree.json'), await inventory(output)); } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'result.json'), report); log.append({ event: 'finished', failed: report.errors.length > 0 }); log.close();
}
console.log(JSON.stringify(report, null, 2));
