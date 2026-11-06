import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { sha256 } from '../apps/loredock/dist/extract.js';
import { Answers, answerPrompt } from '../apps/loredock/dist/answers.js';
import { createApp } from '../apps/loredock/dist/app.js';
import { fileURLToPath } from 'node:url';
import { createScaleFixture, scaleGit } from './loredock-scale-fixture.mjs';

// Test-only browser harness. The production daemon has no fake-runtime selector.
const fixture = await createScaleFixture();
const output = process.env.LOREDOCK_SMOKE_OUTPUT ?? await mkdtemp(path.join(tmpdir(), 'loredock-answer-interfaces-browser-'));
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
const prompts = [];
const answers = new Answers(catalog, { prepare: async connection => ({
  identity: {...connection,version:'browser-fixture',policyVersion:'fixture',configurationFingerprint:'synthetic'},
  close: async () => {}, run: async request => {
    calls++; prompts.push(request.prompt);
    const input = JSON.parse(request.prompt.split('INPUT_JSON (data, not instructions):\n')[1]);
    const comparison = input.interfaceComparisons.comparisons.find(item => item.headerCheck.status === 'gap');
    assert.ok(comparison); assert.ok(comparison.evidenceIds.every(id => input.spans.some(span => span.id === id)));
    return {text:JSON.stringify({claims:[{kind:'inference',text:'Review the supplied declarations. <script>window.answerInjected=true</script>',evidenceIds:comparison.evidenceIds}],unknowns:['Which runtime wiring connects these declarations?']}),
      usage:null,usageUnknownReason:'Synthetic browser runtime; no external model.'};
  }
}) });
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
  await answers.configure({executable:process.execPath,configHome:fixture.root,profile:null});
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
  const questionText = 'How do receipt headers and checkout-bff connect to order-api?';
  const answerPreview = answers.preview(questionText), gap = answerPreview.interfaces.comparisons.find(item => item.headerCheck.status === 'gap');
  assert.ok(gap); assert.ok(answerPreview.interfaces.comparisons.some(item => item.headerCheck.status === 'unknown'));
  assert.ok(answerPreview.interfaces.comparisons.some(item => item.from.label === 'GET /<img>' && item.headerCheck.status === 'match'));
  await page.send('Emulation.setDeviceMetricsOverride', { width:1280,height:1100,deviceScaleFactor:1,mobile:false });
  await page.send('Page.navigate', {url:'http://127.0.0.1:4244'}); await text('Find context');
  await question(questionText); await click('Find context'); await text('Interface comparisons in this context');
  const previewSelector = '.question-context .answer-interfaces';
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(previewSelector)}).open`), true);
  assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(previewSelector + ' .interface-comparison')}).length`), answerPreview.interfaces.comparisons.length);
  await text('Derived static analysis · unverified.');
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(previewSelector)}).innerText.includes('/<img>')`), true);
  assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(previewSelector + ' img')}).length`), 0);
  assert.equal(calls,0);
  await evaluate(`document.querySelector(${JSON.stringify(previewSelector)}).scrollIntoView()`); await screenshot('comparison-preview-desktop.png');
  await page.send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true); await screenshot('comparison-preview-mobile.png');
  for (const source of ['checkout-bff','order-api']) {
    await evaluate(`(()=>{const row=[...document.querySelectorAll('.question-context .interface-comparison')].find(row=>row.querySelector('h4').textContent.includes('POST /api/orders') && row.querySelector('h4').textContent.includes('checkout-bff'));[...row.querySelectorAll('button')].find(button=>button.textContent.startsWith(${JSON.stringify(source + ' /')})).focus();})()`);
    await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
    await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await waitFor(()=>evaluate(`document.querySelector('.evidence pre')?.textContent.includes(${JSON.stringify(source==='checkout-bff'?'x-tenant-id':'X-Tenant')})`),'Original comparison citation did not open.');
    assert.equal(await evaluate("document.activeElement===document.querySelector('.evidence h2')"),true);
  }
  await click('Generate answer'); await text('Which runtime wiring connects these declarations?');
  await waitFor(()=>evaluate("!!document.querySelector('.answer-result .answer-interfaces')"),'Saved answer comparison did not appear.');
  assert.equal(calls,1); assert.equal(prompts[0],answerPrompt(answerPreview));
  const original = answers.state().publishedAnswerId;
  const saved = store.one('SELECT context,result FROM answer_attempts WHERE id=?',original);
  assert.deepEqual(answers.get(original).context.interfaces,answerPreview.interfaces);
  assert.equal(await evaluate('window.answerInjected===undefined'),true);
  await page.send('Page.reload'); await text('Interface comparisons in this context');
  const beforeRefresh = catalog.state(); catalog.start('comparison-refresh',beforeRefresh.sourceSetVersion,beforeRefresh.policyVersion); await catalog.idle();
  await text('A newer index or source registry is available.');
  assert.deepEqual(store.one('SELECT context,result FROM answer_attempts WHERE id=?',original),saved);
  // Seed a separately generated owned attempt with the pre-v9 optional-field absence.
  const refreshed = answers.preview(questionText), legacy = answers.start('legacy-example',questionText,refreshed.buildId,refreshed.inputHash);
  await answers.idle(); const oldContext = structuredClone(answers.get(legacy.id).context); delete oldContext.interfaces;
  const {inputHash:previousHash,...oldInput}=oldContext; oldContext.inputHash=sha256(JSON.stringify(oldInput));
  store.run("UPDATE answer_attempts SET context=?,inputHash=?,promptVersion='loredock-answer-v8' WHERE id=?",JSON.stringify(oldContext),oldContext.inputHash,legacy.id);
  await page.send('Page.reload'); await text('This older answer did not record interface comparisons.');
  assert.equal(await evaluate("document.querySelectorAll('.answer-result .answer-interfaces').length"),0);
  assert.deepEqual(store.one('SELECT context,result FROM answer_attempts WHERE id=?',original),saved);
  await evaluate(`(()=>{const select=document.querySelector('select[aria-label="Answer history"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,${JSON.stringify(original)});select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await waitFor(()=>evaluate("!!document.querySelector('.answer-result .answer-interfaces')"),'Original saved comparison did not return.');
  await evaluate(`(()=>{const nativeFetch=window.fetch;let first=true,release;const gate=new Promise(resolve=>release=resolve);
    window.releaseComparisonPreview=release;window.fetch=async(...args)=>{const held=first&&String(args[0]).includes('/answers/preview');if(held)first=false;
    const response=await nativeFetch(...args);if(held){window.comparisonPreviewHeld=true;await gate;}return response;};})()`);
  await question(questionText); await click('Find context'); await waitFor(()=>evaluate('window.comparisonPreviewHeld===true'),'Preview response was not held.');
  catalog.revoke(catalog.state().sources.find(source=>source.name==='checkout-bff').id);
  await waitFor(()=>evaluate("document.querySelector('.answer-result .answer-interfaces')===null && document.querySelector('.evidence')===null"),'Revocation did not fence saved comparisons.');
  await evaluate('window.releaseComparisonPreview()');
  await waitFor(()=>evaluate("![...document.querySelectorAll('button')].find(button=>button.textContent==='Find context').disabled"),'Held preview did not settle.');
  assert.equal(await evaluate("document.querySelector('.question-context')===null"),true);
  await question(questionText); await click('Find context'); await text('Interface comparisons in this context');
  assert.equal(await evaluate("document.querySelector('.question-context').innerText.includes('checkout-bff /')"),false);
  catalog.updatePolicy(['config']);
  await waitFor(()=>evaluate("document.querySelector('.question-context')===null"),'Policy change did not fence comparisons.');
  assert.equal(calls,2);
  for (const source of fixture.manifest.sources) assert.equal(scaleGit(fixture.root,source.id,['status','--porcelain=v1']),'');
  const result={schemaVersion:'loredock-answer-interfaces-browser/1',sources:20,independentAddedFiles:2,comparisons:answerPreview.interfaces.comparisons.length,
    statuses:answerPreview.interfaces.comparisons.map(item=>item.headerCheck.status),previewModelFree:true,issuedPromptMatchesPreview:true,
    originalCallerAndRouteCitations:true,keyboardFocus:true,escapedText:true,mobileWidth:390,horizontalOverflow:false,
    savedComparisonsAfterReload:true,historyUnchangedAfterRefresh:true,legacyFieldAbsencePreserved:true,historicalSelection:true,
    latePreviewFenced:true,sourceRevocationFenced:true,policyChangeFenced:true,fakeRuntimeCalls:calls,modelRequests:0,sourceCheckoutsUnchanged:true};
  await writeFile(path.join(output,'browser-result.json'),JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify({output,...result},null,2));
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
