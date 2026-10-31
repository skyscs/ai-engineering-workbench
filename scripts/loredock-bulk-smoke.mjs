import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScaleFixture } from './loredock-scale-fixture.mjs';

// Opt-in Linux browser acceptance. Uses synthetic sources, port 4244 and no models.
const fixture = await createScaleFixture();
const output = process.env.LOREDOCK_SMOKE_OUTPUT ?? await mkdtemp(path.join(tmpdir(), 'loredock-browser-result-'));
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
let page;
try {
  const daemonDir = fileURLToPath(new URL('../apps/loredock/', import.meta.url));
  const env = { ...process.env, LOREDOCK_DATA_DIR: path.join(fixture.root, 'data'), LOREDOCK_ANSWERS: '0' };
  let daemon = start(process.execPath, ['dist/index.js'], daemonDir, env);
  const ready = record => waitFor(() => { if (record.ended) throw new Error(record.output); return record.output.includes('LoreDock listening'); }, 'LoreDock did not start.');
  await ready(daemon);
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
  const text = value => waitFor(() => evaluate(`document.body?.innerText.includes(${JSON.stringify(value)})`), `Missing UI text: ${value}`);
  const click = label => evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Button unavailable: '+${JSON.stringify(label)});b.click();})()`);
  const input = value => evaluate(`(()=>{const e=document.getElementById('repository-path');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const screenshot = async name => writeFile(path.join(output, name), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64'));
  const count = () => evaluate("document.querySelectorAll('.sources > li').length");
  const noOverflow = async () => assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await page.send('Page.navigate', { url: 'http://127.0.0.1:4244' }); await text('Add your first repository.');
  const paths = fixture.manifest.sources.map(source => path.join(fixture.root, 'sources', source.id));
  const pasted = [...paths, paths[1], '../invalid'].join('\n');
  await input(pasted); await click('Preview repositories'); await text('20 new repositories');
  assert.equal(await count(), 0); await text('Same Git repository as'); await text('Enter an absolute local repository path.');
  await noOverflow(); await evaluate("document.querySelector('.source-preview').scrollIntoView()"); await screenshot('bulk-preview-mobile.png');
  // A different tab changes the registry while a successful preview response is delayed.
  await evaluate(`(()=>{const native=window.fetch;let first=true,release;const gate=new Promise(r=>release=r);window.releasePreview=()=>{release();window.fetch=native;};window.fetch=async(...args)=>{const held=first&&String(args[0]).includes('/api/sources/preview');if(held)first=false;const response=await native(...args);if(held){window.previewHeld=true;await gate;window.previewReleased=true;}return response;};})()`);
  await click('Preview repositories'); await waitFor(() => evaluate('window.previewHeld===true'), 'Preview did not reach gate.');
  await evaluate(`(async()=>{const {token}=await(await fetch('/api/session',{method:'POST',headers:{'x-loredock-client':'web'}})).json();const response=await fetch('/api/sources',{method:'POST',headers:{'content-type':'application/json','x-loredock-csrf':token},body:JSON.stringify({path:${JSON.stringify(paths[0])}})});if(!response.ok)throw Error('Concurrent registration failed');})()`);
  await waitFor(async () => await count() === 1, 'Concurrent registration was not polled.');
  await evaluate('window.releasePreview()');
  await waitFor(() => evaluate('window.previewReleased===true'), 'Held preview did not return.');
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  assert.equal(await evaluate("document.querySelector('.source-preview')===null"), true);
  await input(pasted); await click('Preview repositories'); await text('19 new repositories'); await text('Already registered as portal.');
  await click('Add 19 repositories'); await waitFor(async () => await count() === 20, 'Bulk registration failed.');
  assert.equal(await evaluate("document.querySelector('.source-preview')===null"), true);
  await click('Index sources'); await text('79 indexed · 60 excluded · 0 failed · 0 pending'); await text('README context for 20 of 20 repositories');
  assert.equal(await evaluate("document.querySelectorAll('.orientation-card').length"), 20);
  await evaluate("document.querySelector('.project-overview').scrollIntoView()"); await noOverflow(); await screenshot('overview-mobile.png');
  await evaluate("document.querySelector('.reading-guide').open=true"); await click('Read repository context'); assert.equal(await evaluate("document.activeElement===document.querySelector('.orientation-card h3')"), true);
  await evaluate("[...document.querySelectorAll('.orientation-card')].at(-1).querySelector('.orientation-citations button').click()"); await text('Source evidence');
  assert.equal(await evaluate("document.querySelector('.evidence strong').textContent"), 'supplier-sync');
  const firstBuild = await evaluate("document.querySelector('.project-overview').dataset.buildId");
  await click('Update knowledge'); await waitFor(() => evaluate(`document.querySelector('.project-overview')?.dataset.buildId!==${JSON.stringify(firstBuild)} && document.querySelectorAll('.orientation-card').length===20`), 'Refresh overview did not publish.');
  await text('79 indexed · 60 excluded · 0 failed · 0 pending');
  await stop(daemon); daemon = start(process.execPath, ['dist/index.js'], daemonDir, env); await ready(daemon);
  await page.send('Page.reload'); await text('README context for 20 of 20 repositories');
  await evaluate("document.querySelector('.connected-sources').open=true;[...document.querySelectorAll('.sources > li')].at(-1).querySelector('button').click()"); await click('Confirm removal');
  await text('README context for 19 of 19 repositories'); assert.equal(await count(), 19); await noOverflow();
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.querySelector('.project-overview').scrollIntoView()"); await screenshot('overview-desktop.png');
  const result = { schemaVersion: 'loredock-bulk-browser/1', sources: 20, indexedFiles: 79, excludedFiles: 60, modelRequests: 0,
    previewBeforeMutation: true, duplicatesAndInvalidPaths: true, existingSources: true, delayedPreviewFenced: true, oneConfirmation: true,
    readmeContexts: 20, lastSourceOriginalCitation: true, guideNavigation: true, refresh: true, restartPersistence: true, revocation: true, mobileWidth: 390, horizontalOverflow: false };
  await writeFile(path.join(output, 'browser-result.json'), JSON.stringify(result, null, 2)+'\n'); console.log(JSON.stringify({ output, ...result }, null, 2));
} catch (error) {
  if (page) {
    await writeFile(path.join(output, 'failure.png'), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    const result = await page.send('Runtime.evaluate', { expression: 'document.body?.innerText.slice(0,16384)', returnByValue: true });
    await writeFile(path.join(output, 'failure.txt'), String(result.result.value));
  }
  throw error;
} finally {
  page?.close(); for (const record of children.reverse()) await stop(record);
  await rm(fixture.root, { recursive: true, force: true });
}
