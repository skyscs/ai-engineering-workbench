import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareConnectedCase, connectedGit } from './loredock-connected-fixture.mjs';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { SourceGit } from '../apps/loredock/dist/git.js';
import { CodeAnalysis } from '../apps/loredock/dist/code-analysis.js';
import { CodePaths } from '../apps/loredock/dist/code-paths.js';
import { createApp } from '../apps/loredock/dist/app.js';

// A new functional browser check, not a rerun of any frozen measurement matrix.
// The owned proxy dispatches only to this process; it never forwards to a demo.
const root = fileURLToPath(new URL('../', import.meta.url)), origin = 'http://127.0.0.1:4244';
const output = process.env.LOREDOCK_SMOKE_OUTPUT ?? await mkdtemp(path.join(tmpdir(), 'loredock-path-browser-result-'));
await mkdir(output, { recursive: true });
const fixture = await prepareConnectedCase({ Catalog, CatalogStore, SourceGit, CodeAnalysis }, 'roots');
const children = [], checks = [], requests = [];
let proxy, page, paths, releaseBusy;
async function waitFor(fn,message) {
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,40));}
  throw new Error(message);
}
function start(command,args) {
  const child=spawn(command,args,{cwd:fixture.root,detached:true,stdio:['ignore','pipe','pipe']});
  const record={child,output:'',ended:false};
  record.exit=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>{record.ended=true;resolve(code);});});
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{record.output=(record.output+chunk).slice(-16384);});
  children.push(record);return record;
}
async function stop(record) {
  if(record.ended)return;
  process.kill(-record.child.pid,'SIGTERM');
  const timer=setTimeout(()=>{try{process.kill(-record.child.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}},3000);
  try{await record.exit;}finally{clearTimeout(timer);}
}
async function connect(url) {
  const socket=new WebSocket(url);let id=0;const pending=new Map();
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data),entry=pending.get(message.id);if(!entry)return;
    pending.delete(message.id);clearTimeout(entry.timer);if(message.error)entry.reject(new Error(message.error.message));else entry.resolve(message.result);});
  return {close:()=>socket.close(),send:(method,params={})=>new Promise((resolve,reject)=>{
    const requestId=++id,timer=setTimeout(()=>{pending.delete(requestId);reject(new Error(`CDP timeout: ${method}`));},10000);
    pending.set(requestId,{resolve,reject,timer});socket.send(JSON.stringify({id:requestId,method,params}));})};
}
try {
  const { catalog, analysis, store } = fixture, action = fixture.corpus.console['src/Dispatch.vue'];
  const files = {};
  for (let i = 0; i < 3; i++) files[`src/Extra${i}.vue`] = action.replace('const send =', `const extra${i} =`).replace('@click="send"', `@click="extra${i}"`);
  files['src/ZIsolated.vue'] = '<script setup lang="ts">\nimport { absent } from "./missing";\nconst isolated = () => absent();\n</script>\n<template><button @click="isolated">Inspect</button></template>\n';
  files['src/TooLong.ts'] = `export function ${'entry'.repeat(105)}() { return fetch('/unbound', { method: 'POST' }); }\n`;
  for (const [name, text] of Object.entries(files)) await writeFile(path.join(fixture.root, 'sources/console', name), text);
  connectedGit(fixture.root, 'console', ['add', '--all']); connectedGit(fixture.root, 'console', ['commit', '-qm', 'Add owned browser entry points']);
  const buildId = await fixture.index('browser');
  const revisions = () => Object.fromEntries(Object.keys(fixture.corpus).map(source => [source, connectedGit(fixture.root, source, ['rev-parse', 'HEAD'])]));
  const initialRevisions = revisions();
  let blockNext = false, busyEntered = false;
  paths = new CodePaths(analysis, { checkpoint: async () => { if (blockNext) { blockNext = false; busyEntered = true; await new Promise(resolve => { releaseBusy = resolve; }); } } });
  const app = createApp(catalog, { publicDir: path.join(root, 'apps/loredock/public'), codeAnalysis: analysis, codePaths: paths });
  const sentinel = '/__owned_probe/' + randomUUID(); let sentinelHits = 0;
  proxy = createServer(async (req, res) => {
    try {
      const url = new URL(req.url);
      if (url.origin !== origin) { res.writeHead(403); res.end('Only the owned test origin is supported.'); return; }
      if (url.pathname === sentinel) { sentinelHits++; res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<p>' + sentinel + '</p>'); return; }
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 16384) throw new Error('Test request exceeds its bound.'); chunks.push(chunk); }
      const headers = new Headers(); for (const [name, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(',') : value);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const response = await app.fetch(new Request(url, { method: req.method, headers, ...body ? { body } : {} }));
      requests.push({ method: req.method, path: url.pathname, query: url.search, status: response.status });
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) { res.writeHead(500); res.end(String(error)); }
  });
  proxy.on('connect', (_req, socket) => socket.destroy());
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const chrome = start('google-chrome', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-background-networking',
    `--proxy-server=http://127.0.0.1:${proxy.address().port}`, '--proxy-bypass-list=<-loopback>',
    '--remote-debugging-port=0', `--user-data-dir=${path.join(fixture.root, 'browser')}`, 'about:blank']);
  await waitFor(() => /DevTools listening on (ws:\/\/\S+)/.test(chrome.output), 'Chrome did not start.');
  const endpoint = new URL(chrome.output.match(/DevTools listening on (ws:\/\/\S+)/)[1]);
  const targets = await (await fetch(`http://${endpoint.host}/json/list`)).json(); page = await connect(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await page.send('Page.enable');
  const evaluate = async expression => { const result = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'Browser evaluation failed.'); return result.result.value; };
  const text = value => waitFor(() => evaluate(`document.body?.innerText.includes(${JSON.stringify(value)})`), `Missing UI text: ${value}`);
  const wait = (expression, message) => waitFor(() => evaluate(expression), message);
  const click = label => evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Button unavailable: '+${JSON.stringify(label)});b.click();})()`);
  const ready = id => wait(`document.querySelector('.connected-path-browser')?.dataset.inventoryId===${JSON.stringify(id)}`, 'Path inventory did not load.');
  const open = () => evaluate("document.querySelector('.connected-paths').open=true");
  const collapse = () => evaluate("document.querySelector('.connected-paths').open=false");
  const original = () => evaluate("document.querySelector('.connected-roots .citations button').click()");
  const select = id => evaluate(`(()=>{const s=document.querySelector('select[aria-label="Index version"]');s.value=${JSON.stringify(id)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const shown = id => wait(`document.querySelector('.project-overview')?.dataset.buildId===${JSON.stringify(id)}`, 'Selected index did not load.');
  const pathReads = () => requests.filter(request => request.path.startsWith('/api/code-paths')).length;
  const screenshot = async name => writeFile(path.join(output, name), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  // Deliberately deliver completed responses even after AbortSignal cancellation.
  const hold = pattern => evaluate(`(()=>{const native=window.fetch;let first=true,release;const gate=new Promise(r=>release=r);
    window.held=false;window.delivered=false;window.releaseHeld=release;window.restoreFetch=()=>{window.fetch=native;};
    window.fetch=async(...args)=>{const held=first&&String(args[0]).includes(${JSON.stringify(pattern)});if(held)first=false;
      const response=await native(...args);if(held){window.held=true;await gate;window.delivered=true;}return response;};})()`);
  const held = () => wait('window.held===true', 'The response was not held.');
  const release = async () => { await evaluate('window.releaseHeld()'); await wait('window.delivered===true', 'Held response was not released.');
    await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))'); await evaluate('window.restoreFetch()'); };
  await page.send('Page.navigate', { url: origin + sentinel }); await text(sentinel); assert.equal(sentinelHits, 1);
  checks.push('Owned non-forwarding transport verified by a unique sentinel before app navigation.');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.navigate', { url: origin }); await shown(buildId); await text('Browse connected paths');
  assert.equal(await evaluate("document.querySelector('.connected-paths').open"), false); assert.equal(pathReads(), 0);
  await evaluate("document.querySelector('.connected-paths > summary').focus()");
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await text('No compatible published code inventory'); assert.equal(analysis.list().length, 0);
  await evaluate("document.querySelector('.connected-path-browser a').click()");
  assert.equal(await evaluate('document.activeElement.id'), 'code-coverage-heading');
  checks.push('Collapsed by default, keyboard opening reads without starting analysis, and missing facts link focuses Code coverage.');
  await click('Analyze code'); await waitFor(() => analysis.list().some(run => run.published), 'Analysis did not publish.');
  const inventoryId = analysis.list().find(run => run.published).id; await ready(inventoryId);
  assert.equal(await evaluate("document.querySelectorAll('.connected-flow').length"), 2);
  assert.equal(await evaluate("document.querySelectorAll('.connected-roots > li').length"), 4);
  await text('Static connection candidate'); await text('9 supported entry points'); await text('5 outside this page');
  await text('Static flow outlines'); await text('HTTP header bindings');
  await evaluate("document.querySelector('.connected-paths').scrollIntoView()"); await screenshot('paths-desktop.png');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true); await screenshot('paths-mobile.png');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  checks.push('Publication loads two qualified default paths and four of nine entries; existing static/header cards remain. Desktop and 390px layouts fit.');
  await original(); await text('Immutable committed snapshot'); assert.equal(await evaluate('document.activeElement.textContent'), 'Source evidence');
  await click('Next entry points'); await wait("document.querySelector('.connected-roots')?.dataset.offset==='4'", 'Second root page missing.');
  assert.equal(await evaluate("Boolean(document.querySelector('.evidence,.connected-flow'))"), false);
  assert.equal(await evaluate('document.activeElement.id'), 'connected-path-heading');
  await evaluate("[...document.querySelectorAll('.connected-roots > li > button')].find(b=>b.querySelector('strong').textContent==='isolated').click()");
  await wait("document.querySelectorAll('.connected-flow > ol > li').length===1", 'Isolated entry did not render.');
  await text('isolated'); await click('Show default paths'); await wait("document.querySelectorAll('.connected-flow').length===2", 'Defaults did not return.');
  await click('Next entry points'); await wait("document.querySelector('.connected-roots')?.dataset.offset==='4'", 'Second root page missing.');
  await click('Next entry points'); await wait("document.querySelector('.connected-roots')?.dataset.offset==='8'", 'Last root page missing.');
  await text('Entry point unavailable'); assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Next entry points').disabled"), true);
  await click('Previous entry points'); await wait("document.querySelector('.connected-roots')?.dataset.offset==='4'", 'Previous root page missing.');
  await click('Show default paths'); await ready(inventoryId);
  checks.push('Root pagination clears paths/originals and focuses the result; a later isolated root stays inspectable and an oversized entry remains counted/unavailable.');
  await hold('/api/evidence/'); await original(); await held(); await click('Next entry points'); await wait("document.querySelector('.connected-roots')?.dataset.offset==='4'", 'Page did not load.'); await release();
  assert.equal(await evaluate("Boolean(document.querySelector('.evidence'))"), false);
  await hold('/api/code-paths/roots'); await click('Next entry points'); await held(); await collapse(); await release();
  assert.equal(await evaluate("Boolean(document.querySelector('.connected-path-browser'))"), false);
  await open(); await ready(inventoryId);
  checks.push('Delayed originals cannot return after page navigation; delayed pages cannot return after collapse even when cancellation is ignored.');
  const beforePending = pathReads();
  const pending = analysis.start('browser-paused', buildId); analysis.control(pending.id, 'pause'); await analysis.idle();
  await text('Paths use an earlier completed inventory.'); assert.equal(pathReads(), beforePending);
  await hold('/api/evidence/'); await original(); await held(); analysis.control(pending.id, 'resume'); await analysis.idle(); await ready(pending.id); await release();
  assert.equal(pathReads(), beforePending + 1); assert.equal(await evaluate("Boolean(document.querySelector('.evidence'))"), false);
  assert.equal(await evaluate("document.querySelectorAll('.connected-flow').length"), 2);
  checks.push('A newer paused attempt preserves the old view without graph reads; publication reloads defaults once and fences pending originals.');
  blockNext = true; const occupied = paths.read({ buildId }); await waitFor(() => busyEntered, 'Busy read did not enter.');
  await click('Show default paths'); await text('Another connected path read is running'); const busyCount = pathReads();
  releaseBusy(); releaseBusy = undefined; await occupied;
  const pollingCount = requests.filter(request => request.path === '/api/code-analysis').length;
  await waitFor(() => requests.filter(request => request.path === '/api/code-analysis').length > pollingCount + 1, 'Inventory polling stopped.');
  assert.equal(pathReads(), busyCount); await click('Retry path request'); await ready(pending.id);
  checks.push('A real busy response leaves no stale graph, does not auto-retry on progress polls, and supports explicit retry.');
  await hold('/api/code-paths?'); await click('Show default paths'); await held();
  const newerId = await fixture.analyze('browser-newer', buildId); await release(); await ready(newerId);
  assert.equal(await evaluate("document.querySelectorAll('.connected-flow').length"), 2);
  checks.push('A delayed graph from an older inventory cannot replace the newly published default view.');
  await hold('/api/code-paths/roots'); await click('Next entry points'); await held();
  await select(fixture.buildId); await shown(fixture.buildId); await release();
  assert.equal(await evaluate("Boolean(document.querySelector('.connected-path-browser'))"), false);
  await select(''); await shown(buildId); await open(); await ready(newerId);
  await hold('/api/evidence/'); await original(); await held();
  const nextBuild = await fixture.index('browser-next'); await shown(nextBuild); await release();
  assert.equal(await evaluate("Boolean(document.querySelector('.evidence'))"), false);
  await select(buildId); await shown(buildId); await open(); await ready(newerId); await text('Paths use an older saved index.');
  checks.push('Selected-index and newly published-index boundaries discard delayed pages/originals; retained historical paths remain explicitly labeled.');
  // Evict the historical inventory using ordinary retained-inventory lifecycle operations.
  await fixture.analyze('next-one', nextBuild); await fixture.analyze('next-two', nextBuild);
  await text('No compatible published code inventory'); assert.equal(await evaluate("Boolean(document.querySelector('.connected-flow,.connected-roots'))"), false);
  checks.push('Inventory eviction clears the historical path/root view without starting analysis or switching indexes.');
  await select(''); await shown(nextBuild); await open(); const latestId = analysis.list().find(run => run.published).id; await ready(latestId);
  await hold('/api/code-paths?'); await click('Show default paths'); await held();
  const consoleSource = catalog.state().sources.find(source => source.name === 'console');
  assert.ok(consoleSource); catalog.revoke(consoleSource.id);
  await wait("!document.querySelector('.connected-path-browser')", 'Source boundary did not close the browser.'); await release();
  assert.equal(await evaluate("Boolean(document.querySelector('.connected-path-browser'))"), false);
  checks.push('Source revocation discards a delayed graph and its original identifiers.');
  const scopedBuild = await fixture.index('remaining-sources'); await fixture.analyze('remaining-facts', scopedBuild); await shown(scopedBuild); await open();
  await ready(analysis.list().find(run => run.published).id);
  await hold('/api/evidence/'); await original(); await held(); catalog.updatePolicy(['README.md']);
  await wait("!document.querySelector('.connected-path-browser')", 'Policy boundary did not close the browser.'); await release();
  assert.equal(await evaluate("Boolean(document.querySelector('.evidence'))"), false);
  checks.push('Policy changes discard delayed originals from the connected-path browser.');
  assert.deepEqual(revisions(), initialRevisions);
  for (const source of Object.keys(fixture.corpus)) assert.equal(connectedGit(fixture.root, source, ['status', '--porcelain=v1']), '');
  assert.equal(requests.some(request => request.path.startsWith('/api/answers')), false);
  checks.push('Owned source checkouts remain unchanged throughout browser actions; no model/answer requests.');
  const result = { schemaVersion: 'loredock-connected-browser-smoke/1', createdAt: new Date().toISOString(),
    implementationCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    node: process.version, chrome: execFileSync('google-chrome', ['--version'], { encoding: 'utf8' }).trim(),
    sourceCount: 3, initialRevisions, checks, modelRequests: 0, pathReads: pathReads(),
    transport: 'Owned loopback HTTP proxy dispatches to the compiled in-process app; no upstream forwarding or listener on port 4244.', requests };
  await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify({ output, checks: checks.length, pathReads: pathReads() }));
} catch (error) {
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ message: error.stack, checks, requests }, null, 2) + '\n');
  throw error;
} finally {
  releaseBusy?.(); page?.close(); for (const child of children.reverse()) await stop(child);
  if (proxy) await new Promise(resolve => { proxy.close(resolve); proxy.closeAllConnections(); });
  await paths?.stop(); await fixture.close();
}
