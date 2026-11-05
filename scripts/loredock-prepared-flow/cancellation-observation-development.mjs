// Ordinary diagnostic observation of cancellation through the actual HTTP route.
// No model, reserved source, application hook or synthetic worker completion.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, launch, client, save, inventory, normalized, until } from './io.mjs';
import { indexSources, prepare } from './flow.mjs';

const output = process.argv[2];
assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const report = { schemaVersion: 'prepared-flow-cancellation-observation/1', errors: [], modelCalls: 0, reservedFamilyReads: 0,
  resourceQualification: false, observation: null };
let daemon, api;
try {
  const corpus = corpusFactory();
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const sources = await materialize(path.join(output, 'sources'), corpus);
  await save(path.join(output, 'sources.json'), sources);
  daemon = await launch({ directory: path.join(output, 'daemon'), data: path.join(output, 'data'), controlled: true, accounting: true });
  api = await client(path.join(output, 'http'));
  await indexSources(api, sources.paths);
  const project = (await api.request('/project')).value;
  const question = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
  await daemon.command('accounting-start', { scope: 'cancel-preparing' });
  const admitted = (await api.request('/question-preparations', 'POST', { requestId: randomUUID(), question, buildId: project.publishedBuildId })).value;
  assert.equal(admitted.status, 'preparing');
  const route = '/question-preparations/' + admitted.id + '/cancel';
  const cancelled = (await api.request(route, 'POST', {})).value;
  assert.equal(cancelled.status, 'cancelled');
  await until(async () => (await daemon.command('accounting-status')).unclosedBudgets.length === 0, 'The cancelled preparation budget did not close.');
  report.observation = await daemon.command('accounting-end');
  await save(path.join(output, 'cancellation-observation.json'), report.observation);
  const response = report.observation.responses.find(row => row.path === '/api' + route);
  assert(response && response.status === 200);
  assert.equal(report.observation.budgets.length, 1);
  assert.deepEqual(response.openBudgets, [report.observation.budgets[0].id],
    'A preparing admission alone is inconclusive; require its actual budget still open after the cancellation response.');
  assert.deepEqual(report.observation.unclosedBudgets, []);
  await daemon.command('accounting-start', { scope: 'replacement-preparation' });
  const replacement = await prepare(api, question);
  assert(replacement.review.compact.item);
  const readyCancelRoute = '/question-preparations/' + replacement.review.id + '/cancel';
  const readyCancelled = (await api.request(readyCancelRoute, 'POST', {})).value;
  assert.equal(readyCancelled.status, 'cancelled');
  report.replacement = await daemon.command('accounting-end');
  assert.deepEqual(report.replacement.unclosedBudgets, []);
  const readyResponse = report.replacement.responses.find(row => row.path === '/api' + readyCancelRoute);
  assert(readyResponse && readyResponse.status === 200);
  assert.deepEqual(readyResponse.openBudgets, [], 'Cancelling Ready must not count as cancelling active preparation.');
  assert.deepEqual(report.replacement.budgets[0].errors, {});
  report.runtime = await daemon.command('stats');
  assert.deepEqual(report.runtime, { prepares: 0, calls: 0, closed: 0 });
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  api?.close();
  try { if (daemon) { report.daemon = await daemon.stop(); assert.equal(report.daemon.code, 0); } }
  catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  try { await save(path.join(output, 'retained-tree.json'), await inventory(output)); }
  catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'result.json'), report);
}
console.log(JSON.stringify(report, null, 2));
