import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { codeFlows } from '../apps/loredock/dist/code-flows.js';
import { Answers } from '../apps/loredock/dist/answers.js';
import { createApp } from '../apps/loredock/dist/app.js';
import { fileURLToPath } from 'node:url';
import { createScaleFixture, scaleGit } from './loredock-scale-fixture.mjs';

// Test-only browser harness. The production daemon has no fake-runtime selector.
const fixture = await createScaleFixture();
const output = process.env.LOREDOCK_SMOKE_OUTPUT ?? await mkdtemp(path.join(tmpdir(), 'loredock-headers-browser-'));
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
  // Independent cases added only to owned generated checkouts; frozen corpus files stay intact.
  await writeFile(path.join(fixture.root, 'sources/checkout-bff/src/receipt.ts'), `
export function literal(key) { return fetch('/<img>', {headers:{'x-receipt':key}}); }
export function dynamic(options) { return fetch('/receipt/dynamic', {headers:options}); }
`);
  await writeFile(path.join(fixture.root, 'sources/order-api/config/receipt-browser.json'), JSON.stringify({
    routes: [{method:'GET',path:'/<img>',handler:'Ledger.accept'}, {method:'GET',path:'/receipt/dynamic',handler:'Ledger.accept'}],
    headerBindings: {'Ledger.accept.key':'X-Receipt'},
  })+'\n');
  for (const source of ['checkout-bff','order-api']) {
    scaleGit(fixture.root, source, ['add','--all']); scaleGit(fixture.root, source, ['commit','-qm','Add independent browser header cases']);
  }
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
  await page.send('Page.bringToFront');
  const evaluate = async expression => {
    const value = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description ?? 'Browser evaluation failed.');
    return value.result.value;
  };
  const text = value => waitFor(() => evaluate(`document.body.innerText.includes(${JSON.stringify(value)})`), `Missing UI text: ${value}`);
  const click = label => evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Button unavailable');b.click();})()`);
  const question = value => evaluate(`(()=>{const e=document.getElementById('project-question');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const screenshot = async name => writeFile(path.join(output, name), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  const graph = codeFlows(catalog), comparisons = graph.edges.filter(edge => edge.headerCheck);
  const gap = comparisons.find(edge => edge.headerCheck.status === 'gap' && graph.nodes.find(node => node.id === edge.from).sourceName === 'checkout-bff');
  assert.ok(gap); assert.ok(!graph.flows.some(flow => flow.edgeIds.includes(gap.id)));
  const byPath = requestPath => comparisons.find(edge => graph.nodes.find(node => node.id === edge.from).properties.path === requestPath);
  assert.equal(byPath('/<img>').headerCheck.status, 'match');
  assert.equal(byPath('/receipt/dynamic').headerCheck.status, 'unknown');
  assert.ok(Buffer.byteLength(JSON.stringify(graph)) <= graph.limits.outputBytes);
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.navigate', { url: 'http://127.0.0.1:4244' }); await text('HTTP header bindings');
  await text('Mapping not shown'); await text('Names match'); await text('Not resolved');
  assert.equal(await evaluate("document.querySelectorAll('.flow-header-check').length"), comparisons.length);
  for (const [requestPath, label] of [['/<img>', 'Names match'], ['/receipt/dynamic', 'Not resolved']]) {
    assert.equal(await evaluate(`document.querySelector('.flow-header-check:has([data-target-id="${byPath(requestPath).id}"])').innerText.includes(${JSON.stringify(label)})`), true);
  }
  assert.equal(await evaluate("document.querySelector('.flow-header-checks').open"), true);
  assert.equal(await evaluate("document.querySelector('.flow-header-checks').innerText.includes('/<img>')"), true);
  assert.equal(await evaluate("document.querySelectorAll('.flow-header-checks img').length"), 0);
  const selector = `.flow-header-check:has([data-target-id="${gap.id}"])`;
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView()`);
  await screenshot('headers-desktop.png');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await screenshot('headers-mobile.png');
  // Use the keyboard to open the original caller evidence, then the route declaration.
  for (const source of ['checkout-bff', 'order-api']) {
    await evaluate(`(()=>{const row=document.querySelector(${JSON.stringify(selector)});[...row.querySelectorAll('.flow-citations button')].find(button=>button.textContent.startsWith(${JSON.stringify(source + ' /')})).focus();})()`);
    await page.send('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13, text:'\r', unmodifiedText:'\r' });
    await page.send('Input.dispatchKeyEvent', { type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
    await waitFor(() => evaluate(`document.querySelector('.evidence pre')?.textContent.includes(${JSON.stringify(source === 'checkout-bff' ? 'x-tenant-id' : 'X-Tenant')})`), 'Original header evidence did not open.');
    assert.equal(await evaluate("document.activeElement===document.querySelector('.evidence h2')"), true);
  }
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).querySelector('.link-correction button').click()`);
  await waitFor(() => evaluate(`!!document.querySelector(${JSON.stringify(selector)}).querySelector('textarea')`), 'Correction form did not open.');
  await evaluate(`(()=>{const row=document.querySelector(${JSON.stringify(selector)}),e=row.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'The literal header names differ; runtime rewriting is not established.');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await waitFor(() => evaluate(`!document.querySelector(${JSON.stringify(selector)}).querySelector('button[type=submit]').disabled`), 'Correction save did not enable.');
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).querySelector('button[type=submit]').click()`);
  await text('The literal header names differ; runtime rewriting is not established.');
  await page.send('Page.reload'); await text('HTTP header bindings'); await text('The literal header names differ; runtime rewriting is not established.');
  // Hold a late response while revoking a source: the previous comparison must not reappear.
  await evaluate(`(()=>{const nativeFetch=window.fetch;let first=true,release;const gate=new Promise(resolve=>release=resolve);
    window.releaseHeaders=release;window.fetch=async(...args)=>{const held=first&&String(args[0]).includes('/api/code-flows?');if(held)first=false;
    const response=await nativeFetch(...args);if(held){window.headersHeld=true;await gate;}return response;};})()`);
  const current = catalog.state(); catalog.start('browser-refresh', current.sourceSetVersion, current.policyVersion); await catalog.idle();
  await waitFor(() => evaluate('window.headersHeld===true'), 'Refreshed header response was not held.');
  catalog.revoke(catalog.state().sources.find(source => source.name === 'checkout-bff').id);
  await waitFor(() => evaluate("!document.querySelector('.flow-header-checks')?.innerText.includes('checkout-bff') && document.querySelector('.evidence')===null"), 'Revocation did not fence header comparisons.');
  await evaluate('window.releaseHeaders()');
  await waitFor(() => evaluate("!!document.querySelector('.flow-header-checks') && !document.querySelector('.flow-header-checks').innerText.includes('checkout-bff')"), 'Authorized comparisons did not recover.');
  assert.equal(await evaluate("document.querySelector('.flow-header-checks').innerText.includes('The literal header names differ')"), false);
  catalog.updatePolicy(['config']);
  await waitFor(() => evaluate("document.querySelector('.flow-header-checks')===null"), 'Old-policy comparisons remained visible.');
  assert.equal(calls, 0); assert.equal(store.all('SELECT id FROM answer_attempts').length, 0);
  for (const source of fixture.manifest.sources) assert.equal(scaleGit(fixture.root, source.id, ['status', '--porcelain=v1']), '');
  const result = { schemaVersion:'loredock-http-headers-browser/1', sources:20, independentAddedFiles:2,
    comparisons:comparisons.length, statuses:comparisons.map(edge => edge.headerCheck.status), gapOutsideOutlines:true,
    candidateGap:gap.headerCheck, candidateEvidence:gap.evidenceIds.map(id => { return graph.evidence[id].sourceName + ' / ' + graph.evidence[id].path; }),
    caseInsensitiveMatch:true, dynamicUnknown:true, escapedRouteLabel:true, originalCallerAndRouteCitations:true, keyboardFocus:true,
    mobileWidth:390, horizontalOverflow:false, correctionSavedAndReloaded:true, lateResponseFenced:true, sourceRevocationFenced:true,
    policyChangeFenced:true, modelRequests:0, runtimePreparations:calls, answerAttempts:0, sourceCheckoutsUnchanged:true };
  await writeFile(path.join(output,'browser-result.json'), JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify({output,...result},null,2));
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
