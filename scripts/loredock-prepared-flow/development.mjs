// Ordinary permit regression only. Never imports the reserved corpus or oracle.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, launch, client, save, inventory, normalized, journal } from './io.mjs';
import { indexSources, prepare, generate } from './flow.mjs';
import { assessPreview } from './assess.mjs';

const output = process.argv[2], failAfterIndex = process.argv[3] === '--fail-after-index';
assert(process.argv.length === (failAfterIndex ? 4 : 3), 'Use an output directory and optional --fail-after-index.');
assert(path.isAbsolute(output ?? '') && path.resolve(output) === output, 'Choose a fresh absolute owned output directory.');
await mkdir(output);
const log = journal(path.join(output, 'journal.jsonl'));
const report = { schemaVersion: 'prepared-flow-driver-development/1', reservedFamilyReads: 0, modelCalls: 0, phases: [], errors: [] };
const data = path.join(output, 'data');
let daemon, api;
const stop = async () => {
  api?.close(); api = undefined;
  if (daemon) { const result = await daemon.stop(); daemon = undefined; assert.equal(result.code, 0, JSON.stringify(result)); assert.equal(result.signal, null); }
};
try {
  log.append({ event: 'started', corpus: 'ordinary-permit-development' });
  const corpus = corpusFactory();
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const sources = await materialize(path.join(output, 'sources'), corpus); await save(path.join(output, 'sources.json'), sources);
  const question = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
  daemon = await launch({ directory: path.join(output, 'production-first'), data }); api = await client(path.join(output, 'http-first'));
  const indexed = await indexSources(api, sources.paths), first = await prepare(api, question);
  assert(first.review.compact.item); assert.equal(first.review.context.sources.length, 4);
  const assessed = assessPreview(first.review, { corpus, sources, expected: { prepared: 'native-required',
    native: { sources: ['a-permit-ui', 'b-permit-api', 'c-permit-store'], requiredEdgeKinds: ['http-target', 'event-delivery', 'dispatch-candidate'], topic: 'permit.granted.v3' } } });
  await save(path.join(output, 'source-assessment.json'), assessed);
  report.phases.push({ name: 'actual-entry-index-analysis-review', readyMs: daemon.readyMs, indexed, prepared: first });
  if (failAfterIndex) throw new Error('Owned development failure after index/review.');
  await stop(); await save(path.join(output, 'stopped-before-answer.json'), await inventory(data));

  daemon = await launch({ directory: path.join(output, 'controlled'), data, controlled: true }); api = await client(path.join(output, 'http-controlled'));
  assert.deepEqual(await daemon.command('stats'), { prepares: 0, calls: 0, closed: 0 });
  await api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: output, profile: null });
  const second = await prepare(api, question), published = await generate(api, second.review);
  const replay = (await api.request('/prepared-answers', 'POST', published.input)).value;
  assert.equal(replay.id, published.answer.id); assert.equal((await daemon.command('stats')).calls, 1);
  const supplied = JSON.parse(await readFile(path.join(daemon.directory, 'request-1.json'), 'utf8'));
  assert.equal(supplied.model, 'gpt-5.6-terra'); assert.equal(supplied.effort, 'medium');
  assert(supplied.prompt.includes(second.review.context.question));
  const issued = second.review.context.spans.map(span => span.id);
  assert.deepEqual(supplied.schema.properties.claims.items.properties.evidenceIds.items.enum, issued);
  report.phases.push({ name: 'controlled-real-http-answer-and-replay', answerId: replay.id, stats: await daemon.command('stats') });
  await stop(); await save(path.join(output, 'stopped-with-answer.json'), await inventory(data));
  const database = new DatabaseSync(path.join(data, 'loredock.db'), { readOnly: true });
  try {
    const stored = database.prepare('SELECT a.context,w.witness,w.reviewedHash FROM answer_attempts a JOIN answer_witnesses w ON w.answerId=a.id WHERE a.id=?').get(replay.id);
    assert.deepEqual(JSON.parse(stored.context), second.review.context);
    assert.equal(stored.reviewedHash, second.review.reviewedHash);
    assert.equal(JSON.parse(stored.witness).prompt, supplied.prompt);
  } finally { database.close(); }

  daemon = await launch({ directory: path.join(output, 'production-reopen'), data }); api = await client(path.join(output, 'http-reopen'));
  const saved = (await api.request('/answers/' + published.answer.id)).value;
  assert.deepEqual(saved, published.answer);
  assert.equal((await api.request('/prepared-answers', 'POST', published.input)).value.id, saved.id);
  const expired = await api.request('/question-preparations/' + second.review.id, 'GET', undefined, { allowError: true });
  assert.equal(expired.status, 409); assert.equal(expired.value.error.code, 'QUESTION_NOT_FOUND');
  const beforeAccounting = (await api.request('/answers')).value;
  report.phases.push({ name: 'actual-entry-history-and-request-replay', answerId: saved.id, transientMissing: true });
  await stop();
  daemon = await launch({ directory: path.join(output, 'accounting'), data, controlled: true, accounting: true }); api = await client(path.join(output, 'http-accounting'));
  await daemon.command('accounting-start', { scope: 'one-row-list' });
  const afterAccounting = (await api.request('/answers')).value, accounting = await daemon.command('accounting-end');
  assert.deepEqual(afterAccounting, beforeAccounting); assert(accounting.totalWork > 0); assert.deepEqual(accounting.unclosedBudgets, []);
  for (const budget of accounting.budgets) assert.equal(Object.values(budget.charges).reduce((sum, row) => sum + row.accepted, 0), budget.final.totalWork);
  await save(path.join(output, 'accounting.json'), accounting);
  report.phases.push({ name: 'actual-list-budget-accounting-and-parity', totalWork: accounting.totalWork, budgets: accounting.budgets.length });
  await stop();
  const retained = await inventory(data), retainedSources = await inventory(path.join(output, 'sources'));
  assert(retained['loredock.db']); assert(Object.keys(retainedSources).some(file => file.endsWith('/.git/HEAD')));
  await save(path.join(output, 'stopped-final.json'), retained);
  report.phases.push({ name: 'retained-output', catalogFiles: Object.keys(retained).length, sourceFiles: Object.keys(retainedSources).length });
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  try { await stop(); } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'retained-tree.json'), await inventory(output));
  await save(path.join(output, 'result.json'), report); log.append({ event: 'finished', failed: report.errors.length > 0 }); log.close();
}
console.log(JSON.stringify(report, null, 2));
