import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { SourceGit } from '../apps/loredock/dist/git.js';
import { CodeAnalysis } from '../apps/loredock/dist/code-analysis.js';
import { CodePathsV2 } from '../apps/loredock/dist/code-paths-v2.js';
import { NativeCaptures } from '../apps/loredock/dist/native-capture.js';
import { OperationBudget } from '../apps/loredock/dist/operation-budget.js';
import { NativeReceiptError } from '../apps/loredock/dist/native-receipt-json.js';
import { createApp } from '../apps/loredock/dist/app.js';
import { receiptFixture } from './loredock-capture-scale/fixture.mjs';
import { corpusFactory } from './loredock-native-assessment/fixture.mjs';

// Owned functional input and non-forwarding browser transport, never a resource family.
const root = fileURLToPath(new URL('../', import.meta.url)), origin = 'http://127.0.0.1:4244';
const output = process.env.LOREDOCK_DISCOVERY_BROWSER_OUTPUT;
assert.ok(output && path.isAbsolute(output) && path.resolve(output) === output); await mkdir(output);
const report = { schemaVersion: 'loredock-saved-path-discovery-browser/1', head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  node: process.version, chrome: execFileSync('google-chrome', ['--version'], { encoding: 'utf8' }).trim(),
  modelRequests: 0, resourceQualification: false, checks: [], requests: [], operations: [], errors: [], failed: true };
let fixture, captures, proxy, browser, page, releaseBusy, blockNext = false, blocked = false, failNext = false, originalReads = 0, listLimit;
const nativeReads = new AsyncLocalStorage();
const raw = (name, value) => writeFile(path.join(output, name), value, { flag: 'wx' });
async function waitFor(fn, message) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 40)); }
  throw new Error(message);
}
async function connect(url) {
  const socket = new WebSocket(url); let id = 0; const pending = new Map();
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => { const message = JSON.parse(event.data), entry = pending.get(message.id); if (!entry) return;
    pending.delete(message.id); clearTimeout(entry.timer); if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result); });
  return { close: () => socket.close(), send: (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id, timer = setTimeout(() => { pending.delete(requestId); reject(new Error('CDP timeout: ' + method)); }, 10000);
    pending.set(requestId, { resolve, reject, timer }); socket.send(JSON.stringify({ id: requestId, method, params }));
  }) };
}
try {
  fixture = await receiptFixture(output, corpusFactory(), { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths: CodePathsV2 });
  await fixture.analyze(); report.revisions = fixture.revisions;
  const { catalog, analysis, paths, store, buildId } = fixture;
  const evidence = catalog.evidence.bind(catalog); catalog.evidence = id => {
    originalReads++; const operation = nativeReads.getStore(); if (operation) operation.originals++; return evidence(id);
  };
  captures = new NativeCaptures(analysis, { paths, async checkpoint() {
    if (failNext) { failNext = false; throw new NativeReceiptError('DISABLED_RECEIPT_STORAGE', '/private/internal-detail'); }
    if (blockNext) { blockNext = false; blocked = true; await new Promise(resolve => { releaseBusy = resolve; }); }
  } });
  const nativeList = captures.list.bind(captures);
  captures.list = (selection, signal) => {
    if (listLimit === undefined) return nativeList(selection, signal);
    const budget = new OperationBudget({ limits: { work: listLimit } });
    return nativeList(selection, signal, budget).finally(() => budget.close());
  };
  const app = createApp(catalog, { publicDir: path.join(root, 'apps/loredock/public'), codeAnalysis: analysis, codePaths: paths, nativeCaptures: captures });
  const sentinel = '/__owned_saved_probe/' + randomUUID(); let sentinelHits = 0, responseNumber = 0;
  proxy = createServer(async (req, res) => {
    const controller = new AbortController(); res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    try {
      const url = new URL(req.url); if (url.origin !== origin) { res.writeHead(403); res.end('Only the owned origin is supported.'); return; }
      if (url.pathname === sentinel) { sentinelHits++; res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<p>' + sentinel + '</p>'); return; }
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; assert.ok(size <= 16384); chunks.push(chunk); }
      const headers = new Headers(); for (const [name, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(',') : value);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const before = fixture.counters(), originalsBefore = originalReads, operation = { originals: 0 };
      const response = await nativeReads.run(operation, () => app.fetch(new Request(url, { method: req.method, headers, signal: controller.signal, ...body ? { body } : {} })));
      const bytes = Buffer.from(await response.arrayBuffer());
      const after = fixture.counters(), originalDelta = originalReads - originalsBefore;
      report.requests.push({ method: req.method, path: url.pathname, query: url.search, status: response.status });
      if (url.pathname.startsWith('/api/path-captures')) {
        const name = 'response-' + String(++responseNumber).padStart(3, '0') + '.json'; await raw(name, bytes);
        report.operations.push({ file: name, method: req.method, path: url.pathname, query: url.search, status: response.status,
          ...response.ok ? {} : { code: JSON.parse(bytes).error?.code }, before, after, originalDelta, operationOriginals: operation.originals });
        if (req.method === 'GET' && response.status === 200) {
          const value = JSON.parse(bytes); assert.equal(after.writeCalls, before.writeCalls); assert.equal(after.changedRows, before.changedRows);
          assert.equal(operation.originals, url.pathname === '/api/path-captures' ? value.items.reduce((sum, row) => sum + row.originalCount, 0) : value.originals.length);
          assert.equal(value.metrics.pathWork, 0); assert.equal(value.metrics.publicationLocks, 0);
        }
      }
      if (!res.destroyed) { res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(bytes); }
    } catch (error) { report.errors.push({ phase: 'transport', message: error.stack }); if (!res.destroyed) { res.writeHead(500); res.end('Owned test transport failed.'); } }
  });
  proxy.on('connect', (_req, socket) => socket.destroy()); await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const child = spawn('google-chrome', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-background-networking',
    '--proxy-server=http://127.0.0.1:' + proxy.address().port, '--proxy-bypass-list=<-loopback>', '--remote-debugging-port=0',
    '--user-data-dir=' + path.join(output, 'browser'), 'about:blank'], { cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  browser = { child, ended: false, output: '' };
  browser.closed = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', (code, signal) => { browser.ended = true; browser.exit = code; browser.signal = signal; resolve(); }); });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { browser.output = (browser.output + chunk).slice(-16384); });
  await waitFor(() => /DevTools listening on (ws:\/\/\S+)/.test(browser.output), 'Chrome did not start.');
  const endpoint = new URL(browser.output.match(/DevTools listening on (ws:\/\/\S+)/)[1]);
  const targets = await (await fetch('http://' + endpoint.host + '/json/list')).json(); page = await connect(targets.find(row => row.type === 'page').webSocketDebuggerUrl);
  await page.send('Page.enable');
  const evaluate = async expression => { const value = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description ?? 'Browser evaluation failed.'); return value.result.value; };
  const wait = (expression, message) => waitFor(() => evaluate(expression), message);
  const text = value => wait('document.body?.innerText.includes(' + JSON.stringify(value) + ')', 'Missing UI text: ' + value);
  const click = label => evaluate(`(()=>{const node=[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===${JSON.stringify(label)});if(!node||node.disabled)throw Error('Unavailable button: '+${JSON.stringify(label)});node.click();})()`);
  const historyReady = () => wait("Boolean(document.querySelector('.saved-path-view[data-receipt-id] .connected-flow'))", 'Saved history did not render.');
  const listCount = () => report.requests.filter(row => row.method === 'GET' && row.path === '/api/path-captures').length;
  const screenshot = async name => raw(name, Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  const hold = (pattern, signalled = false) => evaluate(`(()=>{const native=window.fetch;let first=true,release;const gate=new Promise(resolve=>release=resolve);
    window.held=false;window.delivered=false;window.releaseHeld=release;window.restoreFetch=()=>{window.fetch=native;};
    window.fetch=async(...args)=>{const hold=first&&String(args[0]).includes(${JSON.stringify(pattern)})&&(!${signalled}||Boolean(args[1]?.signal));if(hold)first=false;
      const response=await native(...args);if(!hold)return response;const bytes=await response.arrayBuffer();window.held=true;await gate;window.delivered=true;
      return new Response(bytes,{status:response.status,headers:response.headers});};})()`);
  const held = () => wait('window.held===true', 'Response was not held.');
  const release = async () => { await evaluate('window.releaseHeld()'); await wait('window.delivered===true', 'Held response was not released.');
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))'); await evaluate('window.restoreFetch()'); };
  const ready = (offset = 0, size = 4) => wait(`document.querySelector('.saved-path-page')?.dataset.offset==='${offset}'&&document.querySelector('.saved-path-page')?.dataset.pageSize==='${size}'`, 'Saved list page did not load.');
  const expand = async () => { await text('Browse saved paths'); await evaluate("document.querySelector('.saved-path-list').open=true"); await ready(); };
  const seed = async (pairs, label, selectedBuild = buildId) => {
    for (let index = 0; index < pairs; index++) {
      await fixture.analyze(label + index, selectedBuild); const saved = await captures.capture({ buildId: selectedBuild });
      const file = await readFile(path.join(store.directory, 'path-receipts', store.receipts.catalogId, saved.receiptId + '.json'));
      await raw(label + index + '-receipt.json', file); const projection = JSON.parse(JSON.parse(file).projectionJson);
      await captures.capture({ buildId: selectedBuild, inventoryId: projection.identity.inventoryId, generationId: projection.generationId, rootId: projection.roots.items[0].id });
    }
  };
  await page.send('Page.navigate', { url: origin + sentinel }); await text(sentinel); assert.equal(sentinelHits, 1);
  report.checks.push('A unique sentinel verifies the owned non-forwarding browser transport.');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.navigate', { url: origin }); await text('Browse saved paths'); assert.equal(listCount(), 0);
  await expand(); await text('No saved paths yet.'); assert.equal(await evaluate("document.activeElement.textContent"), 'Saved paths in this catalog');
  report.checks.push('Discovery is collapsed and issues no list request until opened; empty history needs no bookmark or technical input.');
  await seed(3, 'initial-'); assert.equal(listCount(), 1); await text('No saved paths yet.');
  await click('Refresh saved paths'); await ready(); await text('of 6 in this list.');
  assert.equal(await evaluate("document.querySelectorAll('.saved-path-items > li').length"), 4);
  const firstIds = await evaluate("[...document.querySelectorAll('.saved-path-items > li')].map(row=>row.dataset.receiptId)");
  await evaluate("document.querySelector('.saved-path-items details').open=true;document.querySelector('.saved-path-list').scrollIntoView()");
  await text('z-independent-notes'); await screenshot('list-desktop.png');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true); await screenshot('list-mobile.png');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await click('Next saved paths'); await ready(4); assert.equal(await evaluate("document.querySelectorAll('.saved-path-items > li').length"), 2);
  assert.equal(await evaluate("document.activeElement.textContent"), 'Saved paths in this catalog');
  const nextIds = await evaluate("[...document.querySelectorAll('.saved-path-items > li')].map(row=>row.dataset.receiptId)");
  assert.equal(new Set([...firstIds, ...nextIds]).size, 6); await click('Previous saved paths'); await ready();
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.saved-path-items > li')].map(row=>row.dataset.receiptId)"), firstIds);
  report.checks.push('Explicit refresh discovers six saved records, four/two pages retain stable order, all source names are available and layouts fit 390px and desktop.');
  const savedLink = await evaluate("document.querySelector('.saved-path-items a').href"), beforeLink = listCount();
  await evaluate("document.querySelector('.saved-path-items a').click()"); await historyReady(); assert.equal(listCount(), beforeLink);
  await page.send('Page.navigate', { url: origin }); await expand();
  report.checks.push('Each listed link reauthorizes the existing recorded view; direct history pages make no discovery request.');
  await evaluate("document.querySelector('.saved-path-list > summary').focus()");
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await wait("!document.querySelector('.saved-path-page')", 'Keyboard collapse retained summaries.'); await expand();
  await hold('/api/path-captures'); await click('Refresh saved paths'); await held();
  await evaluate("document.querySelector('.saved-path-list').open=false"); await wait("!document.querySelector('.saved-path-page')", 'Collapse did not unmount.');
  await release(); assert.equal(await evaluate("Boolean(document.querySelector('.saved-path-items'))"), false); await expand();
  report.checks.push('Keyboard collapse and a completed delayed response both clear the page; reopening explicitly reauthorizes it.');
  await seed(1, 'added-'); await click('Next saved paths'); await text('Saved paths changed. Refresh the list to continue.');
  assert.equal(await evaluate("Boolean(document.querySelector('.saved-path-items'))"), false);
  await click('Refresh saved paths'); await ready(); await text('of 8 in this list.');
  report.checks.push('A newly saved record invalidates the pinned next page instead of mixing generations; explicit refresh starts a new list.');
  const single = await captures.list({ pageSize: 1 }); listLimit = single.metrics.work + 500;
  await click('Refresh saved paths'); await text('Show one saved path');
  const beforeFallback = listCount(), polls = report.requests.filter(row => row.path === '/api/project').length;
  await waitFor(() => report.requests.filter(row => row.path === '/api/project').length > polls + 1, 'Project polling stopped.'); assert.equal(listCount(), beforeFallback);
  assert.equal(await evaluate("Boolean(document.querySelector('.saved-path-items'))"), false);
  await screenshot('fallback-desktop.png'); await click('Show one saved path'); await ready(0, 1);
  await click('Next saved paths'); await ready(1, 1); assert.equal(await evaluate("document.querySelectorAll('.saved-path-items > li').length"), 1);
  listLimit = undefined; await click('Refresh saved paths'); await ready(0, 4);
  report.checks.push('A real reduced shared budget fails the complete page, does not retry automatically, and explicit one-record recovery keeps one-record navigation until refresh.');
  blockNext = true; blocked = false; const occupied = captures.list(); await waitFor(() => blocked, 'List did not enter.');
  await click('Refresh saved paths'); await text('A saved-path operation is active.'); releaseBusy(); releaseBusy = undefined; await occupied;
  await click('Refresh saved paths'); await ready();
  failNext = true; await click('Refresh saved paths'); await text('The local operation failed.');
  assert.equal(await evaluate("document.body.innerText.includes('/private/internal-detail')"), false); await click('Refresh saved paths'); await ready();
  blockNext = true; blocked = false; const beforeCancel = report.operations.length;
  await click('Refresh saved paths'); await waitFor(() => blocked, 'Browser list did not enter.');
  await evaluate("document.querySelector('.saved-path-list').open=false"); await wait("!document.querySelector('.saved-path-page')", 'Pending list remained visible.');
  releaseBusy(); releaseBusy = undefined;
  await waitFor(() => report.operations.slice(beforeCancel).some(row => row.code === 'CANCELLED'), 'Disconnected list did not abort.'); await expand();
  report.checks.push('Actual ownership conflicts, private faults and disconnected list cancellation clear output and permit explicit retry.');
  await hold('/api/path-captures'); await click('Refresh saved paths'); await held(); await fixture.addSource('new-context');
  await text('Project access or the published index changed.'); await release(); assert.equal(await evaluate("Boolean(document.querySelector('.saved-path-items'))"), false);
  await click('Refresh saved paths'); await ready(); await text('The published index or source set has changed since this record.');
  report.checks.push('A source epoch change fences a completed delayed list; explicit refresh returns authorized old summaries with a separate stale notice.');
  await evaluate(`(()=>{const native=window.fetch;window.restoreProjectFetch=()=>{window.fetch=native;};window.fetch=(...args)=>String(args[0])==='/api/project'?Promise.resolve(new Response(JSON.stringify({error:{message:'Injected project refresh failure.'}}),{status:503})):native(...args);})()`);
  await text('Saved summaries are hidden until access can be checked again.'); assert.equal(await evaluate("Boolean(document.querySelector('.saved-path-items'))"), false);
  await evaluate('window.restoreProjectFetch()'); await wait("!document.body.innerText.includes('Injected project refresh failure.')", 'Project state did not recover.');
  assert.equal(await evaluate("Boolean(document.querySelector('.saved-path-items'))"), false); await click('Refresh saved paths'); await ready();
  report.checks.push('Project refresh failure hides summaries; recovery cannot restore cached content without an explicit new read.');
  await evaluate(`(()=>{const native=window.fetch;let first=true;window.restoreVersionFetch=()=>{window.fetch=native;};window.fetch=async(...args)=>{const response=await native(...args);if(first&&String(args[0])==='/api/path-captures'){first=false;const value=await response.json();value.schemaVersion='unexpected';return new Response(JSON.stringify(value),{status:200,headers:response.headers});}return response;};})()`);
  await click('Refresh saved paths'); await text('The saved-path list response is out of date.'); assert.equal(await evaluate("Boolean(document.querySelector('.saved-path-items'))"), false);
  await evaluate('window.restoreVersionFetch()'); await click('Refresh saved paths'); await ready();
  report.checks.push('Unexpected response versions fail visibly without falling back to current derivation.');
  catalog.updatePolicy(['private']); await text('Project access or the published index changed.'); await click('Refresh saved paths'); await ready();
  await text('4 retained records are unavailable under the current policy.'); assert.equal(await evaluate("document.querySelectorAll('.saved-path-items > li').length"), 0);
  await click('Next saved paths'); await ready(4); await text('4 retained records are unavailable under the current policy.');
  await screenshot('unavailable-desktop.png');
  const mixedBuild = await fixture.index('mixed-policy'); await seed(1, 'mixed-', mixedBuild);
  await text('Project access or the published index changed.'); await click('Refresh saved paths'); await ready();
  let allowed = 0, unavailable = 0;
  for (let offset = 0; offset < 10; offset += 4) {
    await ready(offset); const value = JSON.parse(await readFile(path.join(output, report.operations.filter(row => row.method === 'GET' && row.path === '/api/path-captures' && row.status === 200).at(-1).file), 'utf8'));
    allowed += value.items.length; unavailable += value.unavailableCount;
    if (value.nextOffset !== null) await click('Next saved paths');
  }
  assert.equal(allowed, 2); assert.equal(unavailable, 8);
  report.checks.push('Unavailable-only pages retain next-page navigation and hide old IDs/names; mixed authority yields exactly two authorized and eight unavailable records.');
  const hidden = store.project().sources.find(source => source.name === 'z-independent-notes'); assert.ok(hidden); catalog.revoke(hidden.id);
  await text('Project access or the published index changed.'); await click('Refresh saved paths'); await ready(); await text('No saved paths yet.');
  const beforeRevoked = listCount(); await page.send('Page.navigate', { url: savedLink }); await text('The saved path is unavailable.'); assert.equal(listCount(), beforeRevoked);
  report.checks.push('Revoking an undisplayed source purges every dependent record; the empty list and an old unavailable bookmark agree.');
  for (const [name, revision] of Object.entries(fixture.revisions)) { assert.equal(fixture.git(name, ['rev-parse', 'HEAD']), revision); assert.equal(fixture.git(name, ['status', '--porcelain']), ''); }
  assert.equal(report.requests.some(row => row.path.startsWith('/api/answers')), false); assert.equal(report.errors.length, 0);
  report.checks.push('Owned source working trees and revisions remain unchanged; no model requests.'); report.failed = false;
} catch (error) {
  report.errors.push({ phase: 'scenario', message: error.stack });
  if (page) try { const state = await page.send('Runtime.evaluate', { expression: '({text:document.body.innerText,active:document.activeElement.outerHTML,url:location.href})', returnByValue: true });
    await raw('browser-failure.json', JSON.stringify(state.result.value, null, 2)); } catch (failure) { report.errors.push({ phase: 'failure-view', message: failure.stack }); }
} finally {
  releaseBusy?.(); page?.close();
  const closeBrowser = async () => { if (!browser) return; if (!browser.ended) process.kill(-browser.child.pid, 'SIGTERM');
    const timer = setTimeout(() => { if (!browser.ended) { report.browserForcedKill = true;
      try { process.kill(-browser.child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') report.errors.push({ phase: 'browser-kill', message: error.message }); } } }, 3000);
    try { await browser.closed; await raw('chrome.log', browser.output); report.browserExit = browser.exit; report.browserSignal = browser.signal;
      assert.equal(browser.exit, 0); assert.equal(browser.signal, null); assert.ok(!report.browserForcedKill);
    } finally { clearTimeout(timer); } };
  for (const [phase, close] of [['browser', closeBrowser], ['proxy', () => proxy && new Promise(resolve => { proxy.close(resolve); proxy.closeAllConnections(); })],
    ['captures', () => captures?.stop()], ['fixture', () => fixture?.close()]]) {
    try { await close(); } catch (error) { report.errors.push({ phase, message: error.stack }); }
  }
  if (report.errors.length) report.failed = true;
  await raw('result.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ output, failed: report.failed, checks: report.checks.length, errors: report.errors }));
process.exitCode = report.failed ? 1 : 0;
