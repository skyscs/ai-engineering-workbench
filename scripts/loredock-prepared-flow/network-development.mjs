// Ordinary real-browser network races; declared CDP response faults, no application method wrappers or models.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { materialize, launch, client, save, inventory, normalized, until } from './io.mjs';
import { indexSources } from './flow.mjs';
import { browser } from './browser.mjs';
import { holdResponse } from './response-fault.mjs';

const output = process.argv[2]; assert(process.argv.length === 3 && path.isAbsolute(output ?? '') && path.resolve(output) === output);
await mkdir(output);
const report = { schemaVersion: 'prepared-flow-network-development/1', errors: [], cases: [], modelCalls: 0, reservedFamilyReads: 0, qualification: false };
let daemon, api, page, held;
const question = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
const text = value => until(() => page.evaluate(`document.body.innerText.includes(${JSON.stringify(value)})`), 'Expected browser text: ' + value);
const input = value => page.evaluate(`(()=>{const e=document.getElementById('project-question');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const enabled = label => until(() => page.evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled)`), 'Button did not enable: ' + label);
async function click(label) { await enabled(label); await page.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`); }
async function clearHold() { if (held) { const current = held; held = undefined; await current.close(); } }
async function hold(pattern, name) { held = await holdResponse(page, { pattern: 'http://127.0.0.1:4244/api/' + pattern, directory: output, name }); return held; }
async function reviewChange() {
  const projection = (await api.request('/code-flows')).value, overlay = (await api.request('/corrections')).value;
  return (await api.request('/corrections', 'POST', { requestId: randomUUID(), buildId: projection.buildId,
    targetKind: 'code-link', targetId: projection.edges[0].id, projectionHash: projection.inputHash,
    expectedRevision: overlay.revision, expectedPreviousId: overlay.corrections.find(row => row.targetId === projection.edges[0].id)?.id ?? null,
    action: 'clarify', statement: 'Owned browser race note; deployment remains unverified.', environment: 'owned-development' })).value;
}
try {
  const corpus = corpusFactory(); for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const sources = await materialize(path.join(output, 'sources'), corpus); await save(path.join(output, 'sources.json'), sources);
  daemon = await launch({ directory: path.join(output, 'controlled'), data: path.join(output, 'data'), controlled: true, fault: true });
  assert.deepEqual(await daemon.command('stats'), { prepares: 0, calls: 0, closed: 0 });
  api = await client(path.join(output, 'http')); await indexSources(api, sources.paths);
  await api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: output, profile: null });
  page = await browser({ directory: path.join(output, 'browser') }); await page.prepare(question);

  await hold('prepared-answers', 'lost-admission'); await click('Generate answer'); const first = await held.wait();
  assert.equal(first.status, 202); await held.release(true); await clearHold(); await enabled('Retry request');
  await until(async () => (await daemon.command('stats')).closed === 1, 'First real worker did not finish.');
  await click('Retry request'); await text('Saved prepared context');
  assert.equal((await daemon.command('stats')).calls, 1);
  const state = (await api.request('/answers')).value; assert.equal(state.attempts.length, 1); assert.equal(state.attempts[0].id, first.value.id);
  const events = (await readFile(path.join(output, 'browser/events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  const requests = events.filter(row => row.value?.method === 'Network.requestWillBeSent' && row.value.params.request.url.endsWith('/api/prepared-answers'));
  assert.equal(requests.length, 2); assert.deepEqual(JSON.parse(requests[0].value.params.request.postData), JSON.parse(requests[1].value.params.request.postData));
  report.cases.push({ name: 'lost-admission-response', identicalRequestReplay: true, attempts: 1, calls: 1 });

  // Request a historical answer and hold its already-authorized bytes across a real review edit.
  await hold('answers/' + first.value.id, 'late-history-review');
  await page.protocol.send('Page.reload'); const oldHistory = await held.wait(); assert.equal(oldHistory.value.reviewState, 'current'); const note = await reviewChange();
  await until(() => page.evaluate(`document.querySelector('.answer-panel')?.dataset.reviewRevision===${JSON.stringify(String(note.revision))}`), 'Browser did not see the saved-answer review change.');
  await held.release(); await clearHold();
  await text("Engineer review changed after this answer's context was prepared.");
  assert(await page.evaluate("document.querySelector('.answer-result .review-changed')!==null"));
  report.cases.push({ name: 'late-saved-history-after-review', staleResponseCannotClaimCurrentReview: true, authorizedHistoryLabelledHistorical: true });

  for (const mutation of ['question', 'review']) {
    await input(question + ' Explain ' + mutation + '.'); await hold('question-preparations/*/review', 'late-' + mutation);
    await click('Find context'); await held.wait();
    if (mutation === 'question') await input('A different question while the previous response is held');
    else {
      const note = await reviewChange();
      await until(() => page.evaluate(`document.querySelector('.answer-panel').dataset.reviewRevision===${JSON.stringify(String(note.revision))}`), 'Browser did not observe the real review revision.');
    }
    await held.release(); await clearHold(); await enabled('Find context');
    assert(await page.evaluate("document.querySelector('.question-context')===null"));
    report.cases.push({ name: 'late-review-after-' + mutation, oldContextHidden: true });
  }

  // A separate historical fetch crosses an actual source-scope revocation, including the uncited dependency.
  await hold('answers/' + first.value.id, 'late-history-revoke'); await page.protocol.send('Page.reload'); await held.wait();
  const dependency = (await api.request('/project')).value.sources.find(source => source.name === 'z-independent-notes'); assert(dependency);
  await api.request('/sources/' + dependency.id + '/revoke', 'POST', {}); await text('Latest attempt: fenced.');
  await held.release(); await clearHold();
  assert(await page.evaluate("document.querySelectorAll('.answer-result .claim,.answer-result .native-question-context').length===0"));
  const fenced = (await api.request('/answers/' + first.value.id)).value;
  assert.equal(fenced.context, null); assert.equal(fenced.nativeContext, null); assert.equal(fenced.answer, null);
  report.cases.push({ name: 'late-saved-history-after-revocation', oldAnswerHidden: true, originalTextPurged: true });
  report.runtime = await daemon.command('stats'); assert.equal(report.runtime.calls, 1);
  await page.snapshot('network-final');
} catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
finally {
  try { await clearHold(); } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  try { if (page) { report.browser = await page.stop(); assert.equal(report.browser.code, 0); assert.deepEqual(report.browser.errors, []); } } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  api?.close();
  try { if (daemon) { report.daemon = await daemon.stop(); assert.equal(report.daemon.code, 0); } } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  try { await save(path.join(output, 'retained-tree.json'), await inventory(output, { recordSymlinks: true })); } catch (error) { report.errors.push(normalized(error)); process.exitCode = 1; }
  await save(path.join(output, 'result.json'), report);
}
console.log(JSON.stringify(report, null, 2));
