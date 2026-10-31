import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { Answers } from '../apps/loredock/dist/answers.js';
import { createApp } from '../apps/loredock/dist/app.js';
import { fileURLToPath } from 'node:url';
import { createScaleFixture, scaleGit } from './loredock-scale-fixture.mjs';

// Test-only browser harness. The production daemon has no fake-runtime selector.
const fixture = await createScaleFixture();
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
let page, server, calls = 0;
const store = new CatalogStore(path.join(fixture.root, 'data')), catalog = new Catalog(store);
const answers = new Answers(catalog, { prepare: async () => { calls++; throw new Error('Context preview must not invoke a model runtime.'); } });
try {
  const paths = fixture.manifest.sources.map(source => path.join(fixture.root, 'sources', source.id));
  const preview = await catalog.previewSources(paths); await catalog.registerSources({ paths, previewHash: preview.previewHash, requestId: 'browser' });
  const state = catalog.state(); catalog.start('browser', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  const app = createApp(catalog, { answers, publicDir: fileURLToPath(new URL('../apps/loredock/public/', import.meta.url)) });
  server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 4244 });
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const chrome = start('google-chrome', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${path.join(fixture.root, 'browser')}`, 'about:blank'], fixture.root);
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
  const click = label => evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Button unavailable');b.click();})()`);
  const question = value => evaluate(`(()=>{const e=document.getElementById('project-question');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const screenshot = async name => writeFile(path.join(output, name), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await page.send('Page.navigate', { url: 'http://127.0.0.1:4244' }); await text('Find context');
  await question('unmatchedvocabulary026'); await click('Find context'); await text('Passages from 20 of 20 authorized indexed repositories.');
  await text('30 source passages'); assert.equal(calls, 0);
  assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Generate answer').disabled"), true);
  await evaluate("document.querySelector('.question-context').scrollIntoView()");
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true); await screenshot('orientation-preview-mobile.png');
  await question('Does inventory-api represent one application?'); await click('Find context');
  await waitFor(() => evaluate("document.querySelector('.question-context')?.textContent.includes('inventory-api / config/routes.json')"), 'Named repository route evidence is missing.');
  await evaluate("document.querySelector('.question-context details').open=true;[...document.querySelectorAll('.question-context button')].find(b=>b.textContent.includes('inventory-api / config/routes.json')).click()");
  await text('Source evidence'); assert.equal(await evaluate("document.querySelector('.evidence pre').textContent.includes('/stock/reservations')"), true);
  assert.equal(await evaluate("document.activeElement===document.querySelector('.evidence h2')"), true);
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.querySelector('.question-context details').open=false;document.querySelector('.question-context').scrollIntoView()"); await screenshot('named-source-preview-desktop.png');
  catalog.revoke(catalog.state().sources.find(source => source.name === 'inventory-api').id);
  await waitFor(() => evaluate("document.querySelector('.question-context')===null && document.querySelector('.evidence')===null"), 'Revocation did not clear context and evidence.');
  await question('unmatchedvocabulary026'); await click('Find context'); await text('Passages from 19 of 19 authorized indexed repositories.');
  await page.send('Page.reload'); await text('Find context'); await question('unmatchedvocabulary026'); await click('Find context'); await text('Passages from 19 of 19 authorized indexed repositories.');
  assert.equal(calls, 0); assert.equal(store.all('SELECT id FROM answer_attempts').length, 0);
  for (const source of fixture.manifest.sources) assert.equal(scaleGit(fixture.root, source.id, ['status', '--porcelain=v1']), '');
  const result = { schemaVersion: 'loredock-scale-retrieval-browser/1', sources: 20, initialRepresentedSources: 20, namedSourceRouteEvidence: true,
    originalCitation: true, keyboardFocus: true, mobileWidth: 390, horizontalOverflow: false, revocationClearsContext: true,
    representedAfterRevocation: 19, reloadPreservesScope: true, modelRequests: 0, runtimePreparations: calls, answerAttempts: 0, sourceCheckoutsUnchanged: true };
  await writeFile(path.join(output, 'browser-result.json'), JSON.stringify(result, null, 2)+'\n'); console.log(JSON.stringify({ output, ...result }, null, 2));
} catch (error) {
  if (page) await writeFile(path.join(output, 'failure.png'), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  throw error;
} finally {
  page?.close();
  if (server?.listening) { const closed = new Promise(resolve => server.close(resolve)); server.closeAllConnections(); await closed; }
  await answers.stop(); await catalog.stop(); store.close();
  for (const record of children.reverse()) await stop(record);
  await rm(fixture.root, { recursive: true, force: true });
}
