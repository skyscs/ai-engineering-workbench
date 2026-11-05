// Ordinary real ten-minute expiry. No clock changes, TTL refresh, provider execution or reserved inputs.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, launch, client, save, inventory, normalized, until } from './io.mjs';
import { indexSources } from './flow.mjs';
import { browser } from './browser.mjs';

const output = process.argv[2]; assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const report = { schemaVersion: 'prepared-flow-expiry-development/1', errors: [], modelCalls: 0, reservedFamilyReads: 0, qualification: false };
let daemon, api, page;
try {
  const corpus = corpusFactory(); for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const sources = await materialize(path.join(output, 'sources'), corpus); await save(path.join(output, 'sources.json'), sources);
  daemon = await launch({ directory: path.join(output, 'production'), data: path.join(output, 'data') });
  api = await client(path.join(output, 'http')); await indexSources(api, sources.paths);
  await api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: output, profile: null });
  page = await browser({ directory: path.join(output, 'browser') });
  const findStarted = performance.now(); await page.prepare('How does apply reach PermitWriter.onMessage through permit.granted.v3?');
  const readyObserved = performance.now();
  await page.evaluate(`window.expiryObservation={ready:performance.now(),cleared:null};new MutationObserver(()=>{
    if(window.expiryObservation.cleared===null&&!document.querySelector('.question-context')&&document.body.innerText.includes('This context expired.'))
      window.expiryObservation.cleared=performance.now();}).observe(document.body,{subtree:true,childList:true,characterData:true});`);
  await page.snapshot('ready');
  await until(() => page.evaluate('window.expiryObservation.cleared!==null'), 'The real ten-minute expiry did not clear browser context.', 605000, 250);
  const clearedObserved = performance.now(), observation = await page.evaluate('window.expiryObservation');
  assert(clearedObserved >= findStarted + 600000, 'Context cleared before the real ten-minute lifetime.');
  assert(clearedObserved <= readyObserved + 602000, 'Context remained beyond two poll intervals after the latest possible expiry.');
  assert(await page.evaluate("document.querySelector('.question-context')===null"));
  assert.equal((await api.request('/answers')).value.attempts.length, 0);
  await page.snapshot('expired');
  const events = (await readFile(path.join(output, 'browser/events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  const mutations = events.filter(row => row.value?.method === 'Network.requestWillBeSent' && row.value.params.request.method === 'POST'
    && row.value.params.request.url.endsWith('/api/question-preparations'));
  assert.equal(mutations.length, 1, 'Browser must not refresh the transient lifetime.');
  const polls = events.filter(row => row.value?.method === 'Network.requestWillBeSent' && /\/question-preparations\/[^/]+$/.test(row.value.params.request.url));
  assert(polls.length >= 590, 'Ordinary scalar polls were not preserved.');
  report.observation = { findStarted, readyObserved, clearedObserved, readyToClearMs: clearedObserved - readyObserved, browser: observation,
    scalarPolls: polls.length, preparations: mutations.length, answerAttempts: 0, fakeClock: false };
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  try { if (page) { report.browser = await page.stop(); assert.equal(report.browser.code, 0); assert.deepEqual(report.browser.errors, []); } } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  api?.close();
  try { if (daemon) { report.daemon = await daemon.stop(); assert.equal(report.daemon.code, 0); } } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  try { await save(path.join(output, 'retained-tree.json'), await inventory(output, { recordSymlinks: true })); } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'result.json'), report);
}
console.log(JSON.stringify(report, null, 2));
