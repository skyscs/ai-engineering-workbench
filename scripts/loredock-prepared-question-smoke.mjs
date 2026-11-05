import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { preparedQuestionFixture, preparedQuestion, deferred } from './loredock-prepared-question-fixture.mjs';
import { AnswerWitnessStore } from '../apps/loredock/dist/answer-witness-store.js';

// Test-only browser harness with ordinary owned sources and a controlled runtime.
const output = process.env.LOREDOCK_SMOKE_OUTPUT ?? await mkdtemp(path.join(tmpdir(), 'prepared-question-browser-'));
await mkdir(output, { recursive: true });
const children = [];
function start(command, args, cwd, env = process.env) {
  const child = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const record = { child, output: '', ended: false };
  record.exit = new Promise((resolve, reject) => {
    child.on('error', reject); child.on('close', code => { record.ended = true; resolve(code); });
  });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { record.output = (record.output + chunk).slice(-16384); });
  children.push(record); return record;
}
async function waitFor(fn, message) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 40)); }
  throw new Error(message);
}
async function stop(record) {
  if (record.ended) return;
  process.kill(-record.child.pid, 'SIGTERM');
  const timer = setTimeout(() => { try { process.kill(-record.child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }, 3000);
  try { await record.exit; } finally { clearTimeout(timer); }
}
async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0; const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data), entry = pending.get(message.id);
    if (!entry) return; pending.delete(message.id); clearTimeout(entry.timer);
    if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
  });
  return { close: () => socket.close(), send: (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id, timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(requestId, { resolve, reject, timer }); socket.send(JSON.stringify({ id: requestId, method, params }));
  }) };
}
const { serve } = createRequire(new URL('../apps/loredock/package.json', import.meta.url))('@hono/node-server');
let holdPreparation = false, preparationGate = deferred();
const fixture = await preparedQuestionFixture({ checkpoint: async ({ stage }) => {
  if (holdPreparation && stage === 'lexical') await preparationGate.promise;
} });
let page, server;
const errors = [];
async function openServer(enabled = true) {
  const app = fixture.app(enabled, { publicDir: fileURLToPath(new URL('../apps/loredock/public/', import.meta.url)) });
  server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 4244 });
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
}
async function closeServer() {
  if (!server?.listening) return;
  const closed = new Promise(resolve => server.close(resolve)); server.closeAllConnections(); await closed;
}
try {
  await openServer();
  const chrome = start('google-chrome', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-background-networking',
    '--remote-debugging-port=0', `--user-data-dir=${path.join(fixture.parent, 'browser')}`, 'about:blank'], fixture.parent);
  await waitFor(() => /DevTools listening on (ws:\/\/\S+)/.test(chrome.output), 'Chrome did not start.');
  const endpoint = new URL(chrome.output.match(/DevTools listening on (ws:\/\/\S+)/)[1]);
  const targets = await (await fetch(`http://${endpoint.host}/json/list`)).json();
  page = await connect(targets.find(target => target.type === 'page').webSocketDebuggerUrl); await page.send('Page.enable');
  const evaluate = async expression => {
    const value = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (value.exceptionDetails) { errors.push(value.exceptionDetails); throw new Error(value.exceptionDetails.exception?.description ?? 'Browser evaluation failed.'); }
    return value.result.value;
  };
  const text = value => waitFor(() => evaluate(`document.body.innerText.includes(${JSON.stringify(value)})`), 'Missing UI text: ' + value);
  const click = label => evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Button unavailable: '+${JSON.stringify(label)});b.click();})()`);
  const input = value => evaluate(`(()=>{const e=document.getElementById('project-question');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const enabled = label => waitFor(() => evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled)`), 'Button did not enable: ' + label);
  const find = async value => { await input(value); await enabled('Find context'); await click('Find context'); await text('source passages'); await enabled('Generate answer'); };
  const published = () => fixture.answers.state().publishedAnswerId;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.navigate', { url: 'http://127.0.0.1:4244' }); await text('Experimental prepared context');
  await find(preparedQuestion); await text('Related code context'); assert.equal(fixture.runtime.calls, 0);
  await evaluate("document.querySelector('.question-context .native-question-context').open=true"); await text('Deployment coherence is unknown');
  await evaluate("document.querySelector('.question-context .native-question-context .citations button').click()"); await text('Source evidence');
  assert.equal(await evaluate("document.querySelector('.evidence pre').textContent.length>0"), true);
  // Lose a real admission response after the server commits; retry must use the same ID.
  await evaluate(`window.originalFetch=window.fetch; window.submitted=[]; window.fetch=async(...args)=>{
    if(String(args[0]).endsWith('/prepared-answers')){window.submitted.push(JSON.parse(args[1].body));const response=await window.originalFetch(...args);
      if(!window.lostAdmission){window.lostAdmission=true;throw new TypeError('Owned lost admission response.');}return response;}return window.originalFetch(...args);};`);
  await click('Generate answer'); await text('Owned lost admission response.'); await fixture.answers.idle(); await enabled('Retry request');
  const first = published(); assert(first); await click('Retry request'); await text('Saved prepared context');
  assert.equal(fixture.runtime.calls, 1); assert.equal(published(), first);
  const submitted = await evaluate('window.submitted'); assert.equal(submitted.length, 2); assert.deepEqual(submitted[0], submitted[1]);
  await evaluate('window.fetch=window.originalFetch');
  const saved = new AnswerWitnessStore(fixture.fixture.catalog).read(first), witness = JSON.parse(saved.witnessJson);
  assert.equal(fixture.runtime.requests[0].prompt, witness.prompt);
  assert.equal(await evaluate('window.answerInjected===undefined'), true);
  assert.equal(await evaluate("document.querySelector('.claim').textContent.includes('<script>')"), true);
  await evaluate("document.querySelector('.answer-result .native-question-context').open=true; document.querySelector('.answer-panel').scrollIntoView()");
  const desktop = await page.send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(output, 'desktop.png'), Buffer.from(desktop.data, 'base64'));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth<=390'), true, 'Prepared context overflows at 390px.');
  const mobile = await page.send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(output, 'mobile.png'), Buffer.from(mobile.data, 'base64'));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false });

  holdPreparation = true; preparationGate = deferred();
  await input(preparedQuestion + ' Please explain.'); await click('Find context'); await text('Finding context…'); await click('Cancel context');
  preparationGate.resolve(); holdPreparation = false; await fixture.preparations.idle(); await text('Context preparation was cancelled.');
  assert.equal(await evaluate("document.querySelector('.question-context')===null"), true); assert.equal(fixture.runtime.calls, 1);

  // Cancel while the server's successful start response is still in flight.
  await evaluate(`window.fetch=async(...args)=>{const response=await window.originalFetch(...args);
    if(String(args[0]).endsWith('/question-preparations')&&!window.startHeld){window.startHeld=true;await new Promise(resolve=>window.releaseStart=resolve);}return response;};`);
  await input(preparedQuestion); await click('Find context'); await waitFor(() => evaluate('window.startHeld===true'), 'Start response was not held.');
  await click('Cancel context'); await evaluate('window.releaseStart(); window.fetch=window.originalFetch;'); await fixture.preparations.idle();
  await waitFor(() => evaluate("document.querySelector('.question-context')===null&&document.body.innerText.includes('Context preparation was cancelled.')"), 'Late start restored cancelled context.');
  // Wait for cancellation of the late-discovered ID before starting the next operation.
  await new Promise(resolve => setTimeout(resolve, 300));

  // A review edit while a real review payload is held cannot restore that old preview.
  await evaluate(`window.fetch=async(...args)=>{const response=await window.originalFetch(...args);
    if(String(args[0]).includes('/question-preparations/')&&String(args[0]).endsWith('/review')&&!window.reviewHeld){window.reviewHeld=true;await new Promise(resolve=>window.releaseReview=resolve);}return response;};`);
  await input(preparedQuestion + ' Explain the handler.'); await click('Find context');
  await waitFor(() => evaluate('window.reviewHeld===true'), 'Review response was not held.');
  fixture.fixture.store.run('UPDATE project SET correctionRevision=correctionRevision+1');
  const revision = fixture.fixture.store.project().correctionRevision;
  await waitFor(() => evaluate(`document.querySelector('.answer-panel').dataset.reviewRevision===${JSON.stringify(String(revision))}`), 'Browser did not observe engineer review change.');
  await evaluate('window.releaseReview(); window.fetch=window.originalFetch;'); await enabled('Find context');
  assert.equal(await evaluate("document.querySelector('.question-context')===null"), true, 'Late review restored obsolete context.');

  await evaluate(`window.fetch=async(...args)=>{const response=await window.originalFetch(...args);
    if(String(args[0]).includes('/question-preparations/')&&String(args[0]).endsWith('/review')&&!window.editHeld){window.editHeld=true;await new Promise(resolve=>window.releaseEdit=resolve);}return response;};`);
  await input(preparedQuestion); await click('Find context'); await waitFor(() => evaluate('window.editHeld===true'), 'Editable question response was not held.');
  await input('A different question while context is arriving'); await evaluate('window.releaseEdit(); window.fetch=window.originalFetch;');
  await enabled('Find context'); assert.equal(await evaluate("document.querySelector('.question-context')===null"), true, 'Late response restored the previous question.');

  await find('Where are the repository README documents?'); await text('No additional code path');
  await click('Generate answer'); await waitFor(() => published() && published() !== first, 'Source-only answer did not publish.'); await fixture.answers.idle();
  const sourceOnly = published(); assert.equal(fixture.answers.get(sourceOnly).nativeContext.item, null); assert.equal(fixture.runtime.calls, 2);
  await text('No additional code path');

  await find(preparedQuestion); fixture.runtime.block = true; fixture.runtime.hold = deferred(); fixture.runtime.entered = deferred();
  await click('Generate answer'); await fixture.runtime.entered.promise; await text('Generating answer…'); await click('Cancel answer');
  assert(fixture.runtime.requests.at(-1).signal.aborted); fixture.runtime.hold.resolve(); fixture.runtime.block = false; await fixture.answers.idle();
  await text('Latest attempt: cancelled.'); assert.equal(published(), sourceOnly); assert.equal(fixture.answers.state().attempts[0].usage.outputTokens, 20);

  await closeServer(); await fixture.restart(); await openServer(); await page.send('Page.reload'); await text('Experimental prepared context');
  await text('Saved prepared context'); assert.equal(fixture.runtime.calls, 3); assert.equal(published(), sourceOnly);
  // Hold an authorized historical response across revocation; no old text may return.
  await evaluate(`window.originalFetch=window.fetch;window.fetch=async(...args)=>{const response=await window.originalFetch(...args);
    if(String(args[0]).endsWith('/answers/${first}')&&!window.historyHeld){window.historyHeld=true;await new Promise(resolve=>window.releaseHistory=resolve);}return response;};
    (()=>{const e=document.querySelector('[aria-label="Answer history"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(first)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await waitFor(() => evaluate('window.historyHeld===true'), 'Historical response was not held.');
  const dependency = fixture.fixture.store.sources().find(row => row.name === 'z-independent-notes'); fixture.fixture.catalog.revoke(dependency.id);
  await text('Source authorization changed. Create a new index and answer.');
  await evaluate('window.releaseHistory(); window.fetch=window.originalFetch;'); await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(await evaluate("document.querySelectorAll('.answer-result .native-question-context,.answer-result .claim').length"), 0);
  assert.equal(fixture.answers.get(first).context, null);

  // Disable the experiment on the same catalog: legacy preview remains an explicit path.
  await closeServer(); await openServer(false); await page.send('Page.reload'); await text('Ask about your system');
  await text('Codex setup · saved');
  assert.equal(await evaluate("document.body.innerText.includes('Experimental prepared context')"), false);
  await fixture.fixture.index('after-revocation'); await input('Where are the repository README documents?'); await enabled('Find context');
  await click('Find context'); await text('source passages');
  assert.equal(await evaluate("document.querySelector('.question-context .native-question-context')===null"), true);
  const result = { schemaVersion: 'prepared-question-browser/1', modelCalls: 0, controlledRuntimeCalls: fixture.runtime.calls,
    exactPrompt: true, lostAdmissionReplay: true, originalCitation: true, escapedProse: true, cancelledPreparation: true,
    lateStartCancelled: true, lateReviewFenced: true, lateQuestionEditFenced: true, sourceOnly: true, lateCancelledUsage: true,
    restartHistory: true, lateRevokedHistoryFenced: true, disabledLegacyPreview: true, mobileWidth: 390, errors };
  await writeFile(path.join(output, 'browser-result.json'), JSON.stringify(result, null, 2) + '\n');
  await writeFile(path.join(output, 'issued-context.json'), saved.contextJson + '\n');
  console.log(JSON.stringify({ output, ...result }, null, 2));
} catch (error) {
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack, errors }, null, 2) + '\n');
  if (page) { try { const capture = await page.send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(output, 'failure.png'), Buffer.from(capture.data, 'base64')); } catch {} }
  throw error;
} finally {
  preparationGate.resolve(); fixture.runtime.hold.resolve(); page?.close(); await closeServer();
  for (const record of children.reverse()) await stop(record); await fixture.close();
}
