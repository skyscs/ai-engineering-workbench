// Independent real-browser fault cases for replay and obsolete question responses.
import assert from 'node:assert/strict';
import { mkdir, cp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { launch, client, save, inventory, normalized, until, journal } from './io.mjs';
import { browser } from './browser.mjs';
import { holdResponse } from './response-fault.mjs';
import { stoppedHistoryCheckpoint } from './history-cases.mjs';

export async function networkCase({ directory, checkpoint, question }, execute, { history = false } = {}) {
  for (const value of [directory, checkpoint.data]) assert(path.isAbsolute(value) && path.resolve(value) === value);
  assert(typeof question === 'string' && question.trim());
  if (history) {
    assert.equal(checkpoint.kind, 'browser-replay-history'); assert.equal(checkpoint.lane, 'fault');
    assert.equal(checkpoint.saved.value.status, 'succeeded'); assert.equal(checkpoint.storage.rows, 1);
    assert.equal(checkpoint.storage.purged, 0);
  }
  await mkdir(directory);
  const data = path.join(directory, 'data'), log = journal(path.join(directory, 'journal.jsonl'));
  const report = { errors: [], lane: 'fault', modelCalls: 0, resourceQualification: false, timingQualified: false };
  let daemon, api, page, held, retainHistory = false;
  const context = { directory, data, report, log, get daemon() { return daemon; }, get api() { return api; }, get page() { return page; },
    async hold(pattern, name) {
      assert(!held);
      held = await holdResponse(page, { pattern: 'http://127.0.0.1:4244/api/' + pattern, directory, name }); return held;
    },
    async clearHold() { if (held) { const current = held; held = undefined; await current.close(); } },
    retainHistory() { retainHistory = true; },
    input(value) { return page.evaluate(`(()=>{const e=document.getElementById('project-question');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`); },
    enabled(label) { return until(() => page.evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled)`), 'Button did not enable: ' + label); },
    async click(label) { await context.enabled(label); await page.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`); },
    text(value) { return until(() => page.evaluate(`document.body.innerText.includes(${JSON.stringify(value)})`), 'Expected browser text: ' + value); } };
  try {
    log.append({ event: 'started', lane: 'fault' });
    assert.deepEqual(await inventory(checkpoint.data), checkpoint.files, 'The stopped input checkpoint changed.');
    await cp(checkpoint.data, data, { recursive: true, force: false, errorOnExist: true });
    assert.deepEqual(await inventory(data), checkpoint.files);
    await save(path.join(directory, 'input.json'), checkpoint);
    log.append({ event: 'launch-started', lane: 'fault', intervention: 'external-cdp-response' });
    daemon = await launch({ directory: path.join(directory, 'controlled'), data, controlled: true, fault: true });
    api = await client(path.join(directory, 'http'));
    assert.deepEqual(await daemon.command('stats'), { prepares: 0, calls: 0, closed: 0 });
    const state = (await api.request('/answers')).value;
    assert.equal(state.attempts.length, history ? 1 : 0);
    if (history) {
      assert.equal(state.attempts[0].id, checkpoint.saved.value.id);
      assert.equal((await api.request('/answers/' + checkpoint.saved.value.id)).rawSha256, checkpoint.saved.rawSha256);
    }
    await api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: directory, profile: null });
    page = await browser({ directory: path.join(directory, 'browser') });
    await page.evaluate("document.querySelector('.answer-panel').scrollIntoView()");
    await execute(context);
  } catch (error) { report.errors.push(normalized(error)); }
  finally {
    try { await context.clearHold(); } catch (error) { report.errors.push(normalized(error)); }
    try {
      if (page) { report.browser = await page.stop(); assert.equal(report.browser.code, 0);
        assert.equal(report.browser.sampleError, null); assert.deepEqual(report.browser.errors, []); }
    } catch (error) { report.errors.push(normalized(error)); }
    api?.close();
    try { if (daemon) { report.exit = await daemon.stop(); assert.equal(report.exit.code, 0); assert.equal(report.exit.signal, null); } }
    catch (error) { report.errors.push(normalized(error)); }
    try {
      if (retainHistory && report.errors.length === 0) {
        const retained = await stoppedHistoryCheckpoint(data, path.join(directory, 'history-checkpoint'));
        assert.equal(retained.storage.rows, 1); assert.equal(retained.storage.purged, 0);
        report.checkpoint = { data: path.join(directory, 'history-checkpoint'), ...retained,
          kind: 'browser-replay-history', lane: 'fault', saved: report.saved, admission: report.admission };
        await save(path.join(directory, 'history-checkpoint.json'), report.checkpoint);
      }
      assert.deepEqual(await inventory(checkpoint.data), checkpoint.files);
      report.inputCheckpointUnchanged = true;
      await save(path.join(directory, 'retained-tree.json'), await inventory(directory, { recordSymlinks: true }));
    } catch (error) { report.errors.push(normalized(error)); }
    try { await save(path.join(directory, 'result.json'), report); log.append({ event: 'finished', errors: report.errors }); }
    finally { log.close(); }
  }
  return report;
}

export function lostAdmissionResponse(args) {
  return networkCase(args, async c => {
    await c.page.prepare(args.question);
    const held = await c.hold('prepared-answers', 'lost-admission');
    await c.click('Generate answer'); const first = await held.wait();
    assert.equal(first.status, 202);
    await held.release(true); await c.clearHold(); await c.enabled('Retry request');
    await until(async () => (await c.daemon.command('stats')).closed === 1, 'The first real worker did not close.');
    await c.click('Retry request'); await c.text('Saved prepared context');
    c.report.runtime = await c.daemon.command('stats');
    assert.deepEqual(c.report.runtime, { prepares: 1, calls: 1, closed: 1 });
    const state = (await c.api.request('/answers')).value;
    assert.equal(state.attempts.length, 1); assert.equal(state.attempts[0].id, first.value.id);
    const saved = await c.api.request('/answers/' + first.value.id);
    assert.equal(saved.value.status, 'succeeded'); assert(saved.value.nativeContext.item);
    const events = (await readFile(path.join(c.directory, 'browser/events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    const requests = events.filter(row => row.value?.method === 'Network.requestWillBeSent' && row.value.params.request.url.endsWith('/api/prepared-answers'));
    assert.equal(requests.length, 2);
    const [original, replay] = requests.map(row => JSON.parse(row.value.params.request.postData));
    assert.deepEqual(original, replay); assert.deepEqual(original, first.request);
    c.report.admission = original; c.report.saved = saved;
    c.report.identicalRequestReplay = true;
    await c.page.snapshot('replayed-answer'); c.retainHistory();
  });
}

export function lateReviewAfterQuestionEdit(args) {
  assert(typeof args.changedQuestion === 'string' && args.changedQuestion.trim() && args.changedQuestion !== args.question);
  return networkCase(args, async c => {
    await c.input(args.question);
    const held = await c.hold('question-preparations/*/review', 'late-question');
    await c.click('Find context'); const old = await held.wait();
    assert.equal(old.status, 200); assert(old.value.compact.item);
    const captured = JSON.parse(await readFile(path.join(c.directory, 'late-question-request.json'), 'utf8'));
    assert(typeof captured.networkId === 'string');
    let completed = false;
    const remove = c.page.listen(event => {
      if (event.method === 'Network.loadingFinished' && event.params.requestId === captured.networkId) completed = true;
    });
    try {
      await c.input(args.changedQuestion); await c.enabled('Find context');
      await c.page.evaluate(`(()=>{window.lateQuestionObservation={contextInsertions:0};
        new MutationObserver(()=>{if(document.querySelector('.question-context'))window.lateQuestionObservation.contextInsertions++;})
          .observe(document.querySelector('.answer-panel'),{childList:true,subtree:true});})()`);
      await held.release(); await c.clearHold();
      await until(() => completed, 'The held review response did not reach the browser.');
      await c.page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      c.report.dom = await c.page.evaluate(`({question:document.getElementById('project-question').value,
        contextPresent:document.querySelector('.question-context')!==null,
        generatePresent:[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Generate answer'),
        contextInsertions:window.lateQuestionObservation.contextInsertions})`);
      assert.deepEqual(c.report.dom, { question: args.changedQuestion, contextPresent: false, generatePresent: false, contextInsertions: 0 });
      c.report.lateResponseCompleted = completed;
    } finally { remove(); }
    c.report.runtime = await c.daemon.command('stats');
    assert.deepEqual(c.report.runtime, { prepares: 0, calls: 0, closed: 0 });
    assert.equal((await c.api.request('/answers')).value.attempts.length, 0);
    const state = await c.api.request('/question-preparations/' + old.value.id);
    assert.equal(state.value.status, 'cancelled');
    c.report.cancelledPreparation = state;
    await c.page.snapshot('obsolete-context-hidden');
  });
}
