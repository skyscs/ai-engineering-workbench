// Real expiry case for the ordered suite; caller supplies already materialized sources.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { launch, client, save, inventory, normalized, until } from './io.mjs';
import { indexSources } from './flow.mjs';
import { browser } from './browser.mjs';
import { assessExpiryBounds } from './expiry-bounds.mjs';

export async function expiryCase({ directory: output, sources, question }) {
  assert(path.isAbsolute(output ?? '') && path.resolve(output) === output);
  assert(typeof question === 'string' && question.length > 0);
  await mkdir(output);
  const report = { schemaVersion: 'prepared-flow-expiry-case/1', errors: [], modelCalls: 0, qualification: false };
  let daemon, api, page;
  try {
    daemon = await launch({ directory: path.join(output, 'production'), data: path.join(output, 'data') });
    api = await client(path.join(output, 'http')); await indexSources(api, sources.paths);
    await api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: output, profile: null });
    page = await browser({ directory: path.join(output, 'browser') });
    await page.evaluate("document.querySelector('.answer-panel').scrollIntoView({block:'start'})");
    const findStarted = performance.now(); await page.prepare(question);
    const readyObserved = performance.now();
    report.readyVisible = await page.evaluate(`(()=>{const r=document.querySelector('.question-context').getBoundingClientRect();
      return document.visibilityState==='visible'&&r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0;})()`);
    assert(report.readyVisible, 'Ready context must intersect the visible viewport.');
    await page.evaluate(`window.expiryObservation={ready:performance.now(),cleared:null,noticeVisible:null};new MutationObserver(()=>{
      const notice=[...document.querySelectorAll('.answer-panel [role="status"]')].find(element=>element.textContent.includes('This context expired.'));
      if(window.expiryObservation.cleared===null&&!document.querySelector('.question-context')&&notice){
        const r=notice.getBoundingClientRect();window.expiryObservation.cleared=performance.now();
        window.expiryObservation.noticeVisible=document.visibilityState==='visible'&&r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight;
      }}).observe(document.body,{subtree:true,childList:true,characterData:true});`);
    await page.snapshot('ready');
    await until(() => page.evaluate('window.expiryObservation.cleared!==null'), 'The real ten-minute expiry did not clear browser context.', 605000, 250);
    const clearedObserved = performance.now(), observation = await page.evaluate('window.expiryObservation');
    report.timingBounds = assessExpiryBounds({ findStarted, readyObserved, clearedObserved });
    assert(observation.noticeVisible, 'Expiry notice must be visible without another scroll.');
    assert(await page.evaluate("document.querySelector('.question-context')===null"));
    assert.equal((await api.request('/answers')).value.attempts.length, 0);
    await page.snapshot('expired');
    const events = (await readFile(path.join(output, 'browser/events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    const mutations = events.filter(row => row.value?.method === 'Network.requestWillBeSent' && row.value.params.request.method === 'POST'
      && row.value.params.request.url.endsWith('/api/question-preparations'));
    assert.equal(mutations.length, 1, 'Browser must not refresh the transient lifetime.');
    const admissions = events.filter(row => row.value?.method === 'Network.requestWillBeSent' && row.value.params.request.method === 'POST'
      && row.value.params.request.url.endsWith('/api/prepared-answers'));
    assert.equal(admissions.length, 0, 'Expiry must never admit an answer.');
    const polls = events.filter(row => row.value?.method === 'Network.requestWillBeSent' && /\/question-preparations\/[^/]+$/.test(row.value.params.request.url));
    assert(polls.length >= 590, 'Ordinary scalar polls were not preserved.');
    report.observation = { findStarted, readyObserved, clearedObserved, readyToClearMs: clearedObserved - readyObserved, browser: observation,
      scalarPolls: polls.length, preparations: mutations.length, admissions: admissions.length, answerAttempts: 0, fakeClock: false };
  } catch (error) { report.errors.push(normalized(error)); }
  finally {
    try { if (page) { report.browser = await page.stop(); assert.equal(report.browser.code, 0); assert.deepEqual(report.browser.errors, []); } } catch (error) { report.errors.push(normalized(error)); }
    api?.close();
    try { if (daemon) { report.daemon = await daemon.stop(); assert.equal(report.daemon.code, 0); } } catch (error) { report.errors.push(normalized(error)); }
    try { await save(path.join(output, 'retained-tree.json'), await inventory(output, { recordSymlinks: true })); } catch (error) { report.errors.push(normalized(error)); }
    await save(path.join(output, 'result.json'), report);
  }
  return report;
}
