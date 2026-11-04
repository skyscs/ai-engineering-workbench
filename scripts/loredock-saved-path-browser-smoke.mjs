import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
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
import { NativeReceiptError } from '../apps/loredock/dist/native-receipt-json.js';
import { createApp } from '../apps/loredock/dist/app.js';
import { receiptFixture } from './loredock-capture-scale/fixture.mjs';
import { corpusFactory } from './loredock-native-assessment/fixture.mjs';

// Owned functional input and non-forwarding browser transport, never a resource family.
const root = fileURLToPath(new URL('../', import.meta.url)), origin = 'http://127.0.0.1:4244';
const output = process.env.LOREDOCK_SAVED_BROWSER_OUTPUT;
assert.ok(output && path.isAbsolute(output) && path.resolve(output) === output); await mkdir(output);
const report = { schemaVersion: 'loredock-saved-path-browser/1', head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  node: process.version, chrome: execFileSync('google-chrome', ['--version'], { encoding: 'utf8' }).trim(),
  modelRequests: 0, resourceQualification: false, checks: [], requests: [], operations: [], errors: [], failed: true };
let fixture, captures, proxy, browser, page, releaseBusy, blockNext = false, blocked = false, failNext = false, originalReads = 0;
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
  class Store extends CatalogStore { constructor(directory) { super(directory, { limits: { records: 2 } }); } }
  fixture = await receiptFixture(output, corpusFactory(), { Catalog, CatalogStore: Store, SourceGit, CodeAnalysis, CodePaths: CodePathsV2 });
  await fixture.analyze(); report.revisions = fixture.revisions;
  const { catalog, analysis, paths, store, buildId } = fixture;
  const evidence = catalog.evidence.bind(catalog); catalog.evidence = id => { originalReads++; return evidence(id); };
  captures = new NativeCaptures(analysis, { paths, async checkpoint() {
    if (failNext) { failNext = false; throw new NativeReceiptError('DISABLED_RECEIPT_STORAGE', '/private/internal-detail'); }
    if (blockNext) { blockNext = false; blocked = true; await new Promise(resolve => { releaseBusy = resolve; }); }
  } });
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
      const before = fixture.counters(), originalsBefore = originalReads;
      const response = await app.fetch(new Request(url, { method: req.method, headers, signal: controller.signal, ...body ? { body } : {} }));
      const bytes = Buffer.from(await response.arrayBuffer());
      report.requests.push({ method: req.method, path: url.pathname, query: url.search, status: response.status });
      if (url.pathname.startsWith('/api/path-captures')) {
        const name = 'response-' + String(++responseNumber).padStart(3, '0') + '.json'; await raw(name, bytes);
        const after = fixture.counters(), originalDelta = originalReads - originalsBefore;
        report.operations.push({ file: name, method: req.method, path: url.pathname, query: url.search, status: response.status,
          ...response.ok ? {} : { code: JSON.parse(bytes).error?.code }, before, after, originalDelta });
        if (req.method === 'GET' && response.status === 200) {
          const value = JSON.parse(bytes); assert.deepEqual(after, before); assert.equal(originalDelta, value.originals.length);
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
  browser.closed = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', code => { browser.ended = true; browser.exit = code; resolve(); }); });
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
  const open = async () => { await text('Browse connected paths'); await evaluate("document.querySelector('.connected-paths').open=true"); await text('Save paths'); };
  const saved = async () => { await wait("Boolean(document.querySelector('.saved-path-confirmation a'))", 'Missing saved link.'); return evaluate("document.querySelector('.saved-path-confirmation a').href"); };
  const historyReady = () => wait("Boolean(document.querySelector('.saved-path-view[data-receipt-id] .connected-flow'))", 'Saved history did not render.');
  const historyCount = () => report.requests.filter(row => row.method === 'GET' && row.path.startsWith('/api/path-captures/')).length;
  const saveCount = () => report.requests.filter(row => row.method === 'POST' && row.path === '/api/path-captures').length;
  const screenshot = async name => raw(name, Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  const hold = pattern => evaluate(`(()=>{const native=window.fetch;let first=true,release;const gate=new Promise(resolve=>release=resolve);
    window.held=false;window.delivered=false;window.releaseHeld=release;window.restoreFetch=()=>{window.fetch=native;};
    window.fetch=async(...args)=>{const hold=first&&String(args[0]).includes(${JSON.stringify(pattern)});if(hold)first=false;
      const response=await native(...args);if(!hold)return response;const bytes=await response.arrayBuffer();window.held=true;await gate;window.delivered=true;
      return new Response(bytes,{status:response.status,headers:response.headers});};})()`);
  const held = () => wait('window.held===true', 'Response was not held.');
  const release = async () => { await evaluate('window.releaseHeld()'); await wait('window.delivered===true', 'Held response was not released.');
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))'); await evaluate('window.restoreFetch()'); };
  await page.send('Page.navigate', { url: origin + sentinel }); await text(sentinel); assert.equal(sentinelHits, 1);
  report.checks.push('A unique sentinel verifies the owned non-forwarding browser transport.');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.navigate', { url: origin }); await open(); await click('Save paths'); const defaultLink = await saved(); await text('Paths saved.');
  const id = new URL(defaultLink).searchParams.get('savedPath'); assert.match(id, /^[a-f0-9]{64}$/);
  const firstSave = report.requests.find(row => row.path === '/api/path-captures' && row.method === 'POST');
  const pins = new URLSearchParams(firstSave.query); assert.equal(pins.get('buildId'), buildId); assert.ok(pins.has('inventoryId') && pins.has('generationId')); assert.ok(!pins.has('rootId'));
  const receiptFolder = path.join(store.directory, 'path-receipts', store.receipts.catalogId), bytes = await readFile(path.join(receiptFolder, id + '.json'));
  await raw('default-stored-receipt.json', bytes); const record = JSON.parse(bytes), projection = JSON.parse(record.projectionJson);
  await click('Save paths'); await text('These paths were already saved.'); assert.equal(await saved(), defaultLink); assert.equal((await readdir(receiptFolder)).length, 1);
  report.checks.push('Default save pins the displayed generation; duplicate confirmation reuses the exact record and local bookmark link.');
  await evaluate("document.querySelector('.connected-roots > li > button').click()"); await wait("document.querySelectorAll('.connected-flow').length===1", 'Selected path did not load.');
  await click('Save paths'); const selectedLink = await saved(); assert.notEqual(selectedLink, defaultLink); assert.equal((await readdir(receiptFolder)).length, 2);
  assert.equal(new URLSearchParams(report.requests.filter(row => row.path === '/api/path-captures' && row.method === 'POST').at(-1).query).get('rootId'), projection.roots.items[0].id);
  await evaluate("document.querySelector('.save-paths').scrollIntoView()"); await screenshot('save-desktop.png');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true); await screenshot('save-mobile.png');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  report.checks.push('Selected save pins the displayed root; confirmation fits desktop and 390px layouts.');
  await evaluate("document.querySelectorAll('.connected-roots > li > button')[1].click()"); await wait("!document.querySelector('.saved-path-confirmation')&&Boolean(document.querySelector('.save-paths'))", 'Selection did not clear confirmation.');
  await click('Save paths'); await text('Saved-path storage is full. Existing records are retained.'); assert.equal((await readdir(receiptFolder)).length, 2);
  const fullCount = saveCount(), pollsBefore = report.requests.filter(row => row.path === '/api/project').length;
  await waitFor(() => report.requests.filter(row => row.path === '/api/project').length > pollsBefore + 1, 'Project polling stopped.'); assert.equal(saveCount(), fullCount);
  await click('Show default paths'); await text('Save paths'); await click('Save paths'); await text('These paths were already saved.');
  report.checks.push('Capacity refuses a distinct selection, retains accepted files and still permits an exact duplicate without automatic retry.');
  await hold('/api/path-captures?'); await click('Save paths'); await held(); await click('Next entry points'); await release();
  assert.equal(await evaluate("Boolean(document.querySelector('.save-paths,.saved-path-confirmation'))"), false);
  await click('Show default paths'); await text('Save paths');
  report.checks.push('A completed save response delivered after path navigation cannot restore the old confirmation.');
  blockNext = true; blocked = false; const occupied = captures.capture({ buildId }); await waitFor(() => blocked, 'Capture did not enter.');
  await click('Save paths'); await text('A saved-path operation is active.'); const busyCount = saveCount();
  releaseBusy(); releaseBusy = undefined; await occupied; assert.equal(saveCount(), busyCount);
  await click('Save paths'); await text('These paths were already saved.');
  const beforeCancel = report.operations.length;
  blockNext = true; blocked = false; await click('Save paths'); await waitFor(() => blocked, 'UI capture did not enter.');
  await click('Cancel save'); await text('Save confirmation was cancelled.'); releaseBusy(); releaseBusy = undefined;
  await waitFor(() => report.operations.slice(beforeCancel).some(row => row.status === 409 && row.code === 'CANCELLED'), 'Cancelled request did not settle.');
  failNext = true; await click('Save paths'); await text('The local operation failed.'); assert.equal(await evaluate("document.body.innerText.includes('/private/internal-detail')"), false);
  await click('Save paths'); await text('These paths were already saved.');
  report.checks.push('Real busy/cancelled operations release ownership; explicit retry works and private faults stay generic without erasing an earlier confirmation.');
  await page.send('Page.navigate', { url: defaultLink }); await historyReady(); await text('Applicability to current code has not been checked.');
  assert.equal(await evaluate('document.activeElement.id'), 'saved-path-heading'); assert.equal(await evaluate("document.querySelectorAll('.connected-flow').length"), 2);
  assert.equal(await evaluate("Boolean(document.querySelector('.connected-roots,.save-paths,.code-inventory'))"), false);
  // Previous-page inventory polls may finish during navigation; measure the settled page
  // separately from the per-history request counters already recorded by the transport.
  const beforeHistoryRequests = report.requests.length, beforeHistory = fixture.counters();
  const historyPolls = report.requests.filter(row => row.path === '/api/project').length;
  await waitFor(() => report.requests.filter(row => row.path === '/api/project').length > historyPolls + 1, 'Saved-page project polling stopped.');
  assert.deepEqual(fixture.counters(), beforeHistory);
  assert.ok(!report.requests.slice(beforeHistoryRequests).some(row => /^\/api\/(code-paths|code-analysis|evidence)/.test(row.path)));
  await evaluate("document.querySelector('.saved-source-scope').open=true"); await text('z-independent-notes');
  await evaluate("document.querySelector('.connected-flow .citations button').click()"); await text('Saved original');
  assert.equal(await evaluate('document.activeElement.textContent'), 'Saved original');
  const originalText = await evaluate("document.querySelector('.saved-evidence pre').textContent");
  assert.ok(record.originals.some(row => row.text.split('\n').map((line, i) => `${row.startLine + i}  ${line}`).join('\n') === originalText));
  await evaluate("document.querySelector('.saved-path-view').scrollIntoView()"); await screenshot('history-desktop.png');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true); await screenshot('history-mobile.png');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  report.checks.push('Direct links render exact recorded paths, all source dependencies and saved originals with focus, no rederivation/API original reads and responsive layouts.');
  await page.send('Page.navigate', { url: selectedLink }); await historyReady(); assert.equal(await evaluate("document.querySelectorAll('.connected-flow').length"), 1);
  await page.send('Page.navigate', { url: defaultLink }); await historyReady();
  report.checks.push('The selected-root bookmark reopens only its recorded path, while the default bookmark retains both paths.');
  await fixture.analyze('replacement-one'); await fixture.analyze('replacement-two'); assert.ok(!analysis.list().some(row => row.id === pins.get('inventoryId')));
  await page.send('Page.reload'); await historyReady(); assert.deepEqual(await readFile(path.join(receiptFolder, id + '.json')), bytes);
  report.checks.push('A bookmarked link reopens after reload and actual inventory eviction without replacing saved content.');
  await hold('/api/path-captures/'); await click('Reopen saved paths'); await held(); await fixture.addSource('new-context');
  await text('Project access or the published index changed.'); await release();
  assert.equal(await evaluate("Boolean(document.querySelector('.connected-flow,.saved-evidence'))"), false);
  await click('Reopen saved paths'); await historyReady(); await text('The published index or source set has changed since this record.');
  report.checks.push('Registry changes fence even completed delayed history; explicit reopening keeps the old source vector with a separate stale-scope notice.');
  await evaluate(`(()=>{const native=window.fetch;window.restoreProjectFetch=()=>{window.fetch=native;};window.fetch=(...args)=>String(args[0])==='/api/project'?Promise.resolve(new Response(JSON.stringify({error:{message:'Injected project refresh failure.'}}),{status:503})):native(...args);})()`);
  await text('Saved content is hidden until access can be checked again.'); assert.equal(await evaluate("Boolean(document.querySelector('.connected-flow,.saved-evidence'))"), false);
  await evaluate('window.restoreProjectFetch()'); await wait("!document.body.innerText.includes('Injected project refresh failure.')", 'Project state did not recover.');
  const stoppedReads = historyCount(); await click('Reopen saved paths'); await historyReady(); assert.equal(historyCount(), stoppedReads + 1);
  report.checks.push('Failed project refresh hides saved content; recovery requires explicit authorization reopening.');
  await evaluate(`(()=>{const native=window.fetch;let first=true;window.restoreVersionFetch=()=>{window.fetch=native;};window.fetch=async(...args)=>{const response=await native(...args);if(first&&String(args[0]).startsWith('/api/path-captures/')){first=false;const value=await response.json();value.projection.schemaVersion='loredock-code-paths/1';return new Response(JSON.stringify(value),{status:200,headers:response.headers});}return response;};})()`);
  await click('Reopen saved paths'); await text('The saved-path response is out of date.'); assert.equal(await evaluate("Boolean(document.querySelector('.connected-flow'))"), false);
  await evaluate('window.restoreVersionFetch()'); await click('Reopen saved paths'); await historyReady();
  report.checks.push('Unexpected history projection versions clear the view and never fall back to current paths.');
  await hold('/api/path-captures/'); await click('Reopen saved paths'); await held(); catalog.updatePolicy(['ui']);
  await text('Project access or the published index changed.'); await release(); assert.equal(await evaluate("Boolean(document.querySelector('.connected-flow,.saved-evidence'))"), false);
  await click('Reopen saved paths'); await text('This index uses an old policy.'); assert.deepEqual(await readFile(path.join(receiptFolder, id + '.json')), bytes);
  const hidden = record.dependencies.find(dep => !record.originals.some(row => row.sourceId === dep.sourceId)); assert.ok(hidden); catalog.revoke(hidden.sourceId);
  await text('Project access or the published index changed.'); await click('Reopen saved paths'); await text('The saved path is unavailable.'); assert.equal((await readdir(receiptFolder)).length, 0);
  report.checks.push('Policy fences retained bytes and revocation of the undisplayed source purges both records; no delayed response restores original text.');
  const beforeInvalid = historyCount(); await page.send('Page.navigate', { url: defaultLink + '&savedPath=' + id }); await text('This saved-path link is invalid.'); assert.equal(historyCount(), beforeInvalid);
  await page.send('Page.navigate', { url: origin + '/?savedPath=%2Ftmp%2Fprivate' }); await text('This saved-path link is invalid.'); assert.equal(historyCount(), beforeInvalid);
  await page.send('Page.navigate', { url: defaultLink }); await text('The saved path is unavailable.');
  await evaluate("document.querySelector('.saved-path-view a').click()"); await text('Start with the sources.');
  report.checks.push('Invalid or duplicated links issue no history request; revoked bookmarks remain unavailable and return navigation needs no technical input.');
  for (const [name, revision] of Object.entries(fixture.revisions)) { assert.equal(fixture.git(name, ['rev-parse', 'HEAD']), revision); assert.equal(fixture.git(name, ['status', '--porcelain']), ''); }
  assert.equal(report.requests.some(row => row.path.startsWith('/api/answers')), false); assert.equal(report.errors.length, 0);
  report.checks.push('All owned source Git revisions and working trees remain unchanged; no model/answer requests.'); report.failed = false;
} catch (error) {
  report.errors.push({ phase: 'scenario', message: error.stack });
  if (page) try { const state = await page.send('Runtime.evaluate', { expression: '({text:document.body.innerText,active:document.activeElement.outerHTML,url:location.href})', returnByValue: true });
    await raw('browser-failure.json', JSON.stringify(state.result.value, null, 2)); } catch (failure) { report.errors.push({ phase: 'failure-view', message: failure.stack }); }
} finally {
  releaseBusy?.(); page?.close();
  const closeBrowser = async () => { if (!browser) return; if (!browser.ended) process.kill(-browser.child.pid, 'SIGTERM');
    const timer = setTimeout(() => { if (!browser.ended) { try { process.kill(-browser.child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') report.errors.push({ phase: 'browser-kill', message: error.message }); } } }, 3000);
    try { await browser.closed; await raw('chrome.log', browser.output); report.browserExit = browser.exit; } finally { clearTimeout(timer); } };
  for (const [phase, close] of [['browser', closeBrowser], ['proxy', () => proxy && new Promise(resolve => { proxy.close(resolve); proxy.closeAllConnections(); })],
    ['captures', () => captures?.stop()], ['fixture', () => fixture?.close()]]) {
    try { await close(); } catch (error) { report.errors.push({ phase, message: error.stack }); }
  }
  if (report.errors.length) report.failed = true;
  await raw('result.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ output, failed: report.failed, checks: report.checks.length, errors: report.errors }));
process.exitCode = report.failed ? 1 : 0;
