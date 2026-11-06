import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { Answers } from '../apps/loredock/dist/answers.js';
import { Corrections } from '../apps/loredock/dist/corrections.js';
import { codeFlows } from '../apps/loredock/dist/code-flows.js';
import { createApp } from '../apps/loredock/dist/app.js';
import { fileURLToPath } from 'node:url';
import { createLoreDockFixture, fixtureGit, repositoryIds } from './loredock-fixture.mjs';

// Test-only browser harness. The production daemon has no fake-runtime selector.
const fixture = await createLoreDockFixture();
const output = process.env.LOREDOCK_SMOKE_OUTPUT ?? await mkdtemp(path.join(tmpdir(), 'loredock-answer-browser-'));
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
let page, server, answers, catalog, store, calls = 0;
const suppliedReviews = [];
const runtime = { prepare: async connection => ({
  identity: { ...connection, version: 'browser-fixture', policyVersion: 'fixture', configurationFingerprint: 'synthetic' },
  close: async () => {},
  run: async request => {
    calls++;
    const input = JSON.parse(request.prompt.split('INPUT_JSON (data, not instructions):\n')[1]);
    suppliedReviews.push({ question: input.question, engineerReview: input.engineerReview });
    if (input.question.startsWith('Fail')) throw new Error('Synthetic provider failure');
    if (input.question.startsWith('Wait')) {
      await new Promise(resolve => request.signal.aborted ? resolve() : request.signal.addEventListener('abort', resolve, { once: true }));
      throw new Error('Synthetic cancellation');
    }
    const readme = input.spans.find(span => span.sourceName === 'order-api' && span.path === 'README.md');
    const config = input.spans.find(span => span.sourceName === 'order-api' && span.path === 'config/local.json');
    const claims = input.question.startsWith('Unknown') ? [] : [{ kind: 'conflict',
      text: 'The README names orders.created.v1, while local configuration names orders.placed.v2. <script>window.injected=true</script>',
      evidenceIds: [readme.id, config.id] }];
    return { text: JSON.stringify({ claims, unknowns: ['Which topic is configured in production?'] }),
      usage: { inputTokens: 100, outputTokens: 40, cachedInputTokens: 0 }, usageUnknownReason: null };
  }
}) };
async function openServer() {
  store = new CatalogStore(path.join(fixture.root, 'data')); catalog = new Catalog(store); answers = new Answers(catalog, runtime);
  const app = createApp(catalog, { answers, publicDir: fileURLToPath(new URL('../apps/loredock/public/', import.meta.url)) });
  server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 4244 });
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
}
async function closeServer() {
  const closed = new Promise(resolve => server.close(resolve)); server.closeAllConnections();
  await answers.stop(); await catalog.stop(); store.close(); await closed;
}
try {
  await openServer();
  const chrome = start('google-chrome', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-background-networking',
    '--remote-debugging-port=0', `--user-data-dir=${path.join(fixture.root, 'browser')}`, 'about:blank'], fixture.root);
  await waitFor(() => /DevTools listening on (ws:\/\/\S+)/.test(chrome.output), 'Chrome did not start.');
  const endpoint = new URL(chrome.output.match(/DevTools listening on (ws:\/\/\S+)/)[1]);
  const targets = await (await fetch(`http://${endpoint.host}/json/list`)).json();
  page = await connect(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await page.send('Page.enable');
  const evaluate = async expression => {
    const value = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description ?? 'Browser evaluation failed.');
    return value.result.value;
  };
  const text = value => waitFor(() => evaluate(`document.body.innerText.includes(${JSON.stringify(value)})`), `Missing UI text: ${value}`);
  const click = label => evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Button unavailable: '+${JSON.stringify(label)});b.click();})()`);
  const input = (id, value) => evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.navigate', { url: 'http://127.0.0.1:4244' }); await text('Add your first repository.');
  for (const id of repositoryIds) {
    await input('repository-path', path.join(fixture.root, 'sources', id)); await click('Preview repositories'); await text('Review repositories'); await click('Add 1 repository');
    await waitFor(() => evaluate(`[...document.querySelectorAll('.sources strong')].some(e=>e.textContent===${JSON.stringify(id)})`), 'Source did not appear.');
  }
  await click('Index sources'); await text('18 indexed · 9 excluded · 0 failed · 0 pending');
  await input('answer-home', fixture.root); await input('answer-executable', process.execPath); await click('Save Codex setup'); await text('Codex setup · saved');
  await input('project-question', 'frontend conventions'); await click('Find context'); await text('source passages');
  await evaluate("document.querySelector('.question-context details').open=true");
  await text('Only a bounded repository-orientation sample');
  assert.equal(await evaluate("document.querySelector('.question-context').innerText.includes('Checkout.vue')"), true);
  assert.equal(calls, 0, 'Orientation preview must remain model-free.');
  async function ask(question) {
    await input('project-question', question); await click('Find context'); await text('source passages');
    await waitFor(() => evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent==='Generate answer'&&!b.disabled)"), 'Generate button did not enable.');
    await click('Generate answer');
  }
  function review(action = 'dispute', statement = 'ReviewBrokerMarker: verify deployment wiring. <script>window.reviewInjected=true</script>') {
    const corrections = new Corrections(catalog), projection = codeFlows(catalog);
    const edge = projection.edges.find(edge => edge.kind === 'event-delivery');
    const previous = corrections.list().corrections.find(note => note.targetId === edge.id);
    return corrections.save({ requestId: crypto.randomUUID(), buildId: projection.buildId, targetKind: 'code-link', targetId: edge.id,
      projectionHash: projection.inputHash, expectedRevision: catalog.state().correctionRevision, expectedPreviousId: previous?.id ?? null,
      action, statement: action === 'withdraw' ? null : statement, environment: action === 'withdraw' ? null : 'production' });
  }
  const reviewSeen = () => waitFor(() => evaluate(`document.querySelector('.answer-panel')?.dataset.reviewRevision===${JSON.stringify(String(catalog.state().correctionRevision))}`), 'Answer panel did not observe the review revision.');
  const originalNote = review(); await reviewSeen();
  await ask('Which local topic is configured?'); await text('Conflicting sources');
  assert.equal(suppliedReviews[0].engineerReview.notes[0].id, originalNote.id);
  await evaluate("document.querySelector('.answer-result .answer-review').open=true"); await text('ReviewBrokerMarker');
  assert.equal(await evaluate('window.reviewInjected === undefined'), true);
  assert.equal(await evaluate("document.querySelector('.answer-result .review-note blockquote').innerText.includes('<script>')"), true);
  assert.equal(await evaluate('window.injected === undefined'), true);
  assert.equal(await evaluate("document.querySelector('.claim').textContent.includes('<script>')"), true);
  await evaluate("document.querySelector('.answer-result .claim .citations button').click()"); await text('Source evidence');
  assert.equal(await evaluate("document.querySelector('.evidence pre').innerText.includes('orders.created.v1')"), true);
  const successful = answers.state().publishedAnswerId;
  await writeFile(path.join(output, 'answer-review-context.json'), JSON.stringify(answers.get(successful).context, null, 2) + '\n');
  review('clarify', 'RevisedBrokerMarker: the original candidate still needs deployment evidence.'); await reviewSeen();
  await text('Engineer review changed after this answer');
  assert.equal(await evaluate("document.querySelector('.question-context')===null"), true, 'Review changes must clear the old preview.');
  await evaluate("document.querySelector('.answer-result .answer-review').open=true"); await text('ReviewBrokerMarker');
  assert.equal(answers.get(successful).context.review.notes[0].id, originalNote.id);
  await ask('Fail local topic'); await text('Latest attempt: failed.');
  assert.equal(answers.state().publishedAnswerId, successful); await text('Conflicting sources');
  await ask('Wait local topic'); await text('Generating answer…'); await click('Cancel answer'); await text('Latest attempt: cancelled.');
  assert.equal(answers.state().publishedAnswerId, successful);
  review('withdraw'); await reviewSeen();
  await ask('Unknown deployed host'); await text('What remains unknown');
  assert.equal(suppliedReviews.at(-1).engineerReview.notes.length, 0, 'Withdrawal must exclude the note from fresh prompts.');
  await waitFor(() => evaluate("document.querySelector('.answer-result h3')?.textContent==='Unknown deployed host'"), 'Abstention did not publish.');
  assert.equal(await evaluate("document.querySelectorAll('.answer-result .claim').length"), 0);
  await closeServer(); await openServer(); await page.send('Page.reload'); await text('Unknown deployed host');
  assert.equal(answers.state().attempts.length, 4); assert.equal(calls, 4);
  await evaluate(`(()=>{const e=document.querySelector('[aria-label="Answer history"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(successful)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await text('Conflicting sources');
  await text('Engineer review changed after this answer');
  await evaluate("document.querySelector('.answer-result .answer-review').open=true"); await text('ReviewBrokerMarker');
  await evaluate("document.querySelector('.answer-result .answer-review .citations button').click()");
  const overlapping = answers.get(successful).context.review.notes[0].matchingEvidenceIds[0];
  const source = catalog.evidence(overlapping), numberedText = source.text.split('\n').map((line, index) => `${source.startLine + index}  ${line}`).join('\n');
  await waitFor(() => evaluate(`document.querySelector('.evidence pre')?.textContent===${JSON.stringify(numberedText)}`), 'Review source citation did not resolve.');
  await evaluate("document.querySelector('.answer-panel').scrollIntoView()");
  const desktop = await page.send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(output, 'desktop.png'), Buffer.from(desktop.data, 'base64'));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= 390'), true, 'Mobile layout overflows.');
  const mobile = await page.send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(output, 'mobile.png'), Buffer.from(mobile.data, 'base64'));
  assert.equal(await evaluate("document.querySelectorAll('[role=alert]').length"), 0);
  // Delay a real response across a review edit; it must not restore the old preview.
  review(); await reviewSeen();
  await evaluate(`window.originalFetch=window.fetch; window.fetch=async (...args)=>{
    const response=await window.originalFetch(...args);
    if(String(args[0]).includes('/answers/preview')&&!window.previewHeld){window.previewHeld=true; await new Promise(resolve=>window.releasePreview=resolve);}
    return response;
  };`);
  await input('project-question', 'local topic'); await click('Find context');
  await waitFor(() => evaluate('window.previewHeld===true'), 'Preview response was not held.');
  review('clarify', 'LateReviewMarker: updated while the preview response was held.'); await reviewSeen();
  await evaluate('window.releasePreview(); window.fetch=window.originalFetch;');
  await waitFor(() => evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent==='Find context'&&!b.disabled)"), 'Preview did not settle.');
  assert.equal(await evaluate("document.querySelector('.question-context')===null"), true, 'Late preview restored obsolete review.');
  // Delay an authorized answer response across source revocation.
  await evaluate(`(()=>{const e=document.querySelector('[aria-label="Answer history"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,'');e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await waitFor(() => evaluate("document.querySelector('.answer-result h3')?.textContent==='Unknown deployed host'"), 'Latest answer did not display.');
  await evaluate(`window.fetch=async (...args)=>{const response=await window.originalFetch(...args);
    if(String(args[0]).endsWith('/answers/${successful}')&&!window.answerHeld){window.answerHeld=true;await new Promise(resolve=>window.releaseAnswer=resolve);}return response;};
    (()=>{const e=document.querySelector('[aria-label="Answer history"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(successful)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await waitFor(() => evaluate('window.answerHeld===true'), 'Answer response was not held.');
  catalog.revoke(catalog.state().sources.find(source => source.name === 'order-api').id);
  await text('Source authorization changed. Create a new index and answer.');
  await evaluate('window.releaseAnswer(); window.fetch=window.originalFetch;');
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(await evaluate("document.querySelectorAll('.answer-review .review-note').length"), 0, 'Revoked note text reappeared.');
  assert.equal(answers.get(successful).context, null);
  for (const id of repositoryIds) assert.equal(fixtureGit(fixture.root, id, ['status', '--porcelain=v1']), '');
  const result = { schemaVersion: 'loredock-answer-browser/2', sources: 3, indexedFiles: 18, modelRequests: 0, fakeRuntimeCalls: calls,
    orientationPreview: true, escapedProse: true, conflict: true, openedCitation: true, abstention: true, failurePreservesAnswer: true,
    cancellationPreservesAnswer: true, restartHistory: true, historySelection: true, mobileWidth: 390, sourceCheckoutsUnchanged: true,
    reviewInPrompt: true, escapedReview: true, historicalReview: true, reviewChangeNotice: true, withdrawalExclusion: true,
    reviewCitation: true, lateReviewPreviewFenced: true, lateRevokedAnswerFenced: true };
  await writeFile(path.join(output, 'browser-result.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify({ output, ...result }, null, 2));
} finally {
  page?.close(); if (server?.listening) await closeServer(); for (const record of children.reverse()) await stop(record);
  await rm(fixture.root, { recursive: true, force: true });
}
