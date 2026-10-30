import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLoreDockFixture, fixtureGit, repositoryIds } from './loredock-fixture.mjs';

// Opt-in Linux browser acceptance. Uses synthetic sources, port 4244 and no models.
const fixture = await createLoreDockFixture();
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
  const packagePath = path.join(fixture.root, 'sources/portal/package.json');
  const packageData = JSON.parse(await readFile(packagePath, 'utf8'));
  packageData.name = '<img src=x onerror="window.mapInjected=true">';
  await writeFile(packagePath, JSON.stringify(packageData, null, 2) + '\n');
  fixtureGit(fixture.root, 'portal', ['add', 'package.json']);
  fixtureGit(fixture.root, 'portal', ['commit', '-qm', 'Add adversarial package-label browser input']);
  const env = { ...process.env, LOREDOCK_DATA_DIR: path.join(fixture.root, 'data') };
  const daemon = start(process.execPath, ['dist/index.js'], daemonDir, env);
  const ready = record => waitFor(() => {
    if (record.ended) throw new Error(record.output); return record.output.includes('LoreDock listening');
  }, 'LoreDock did not start.');
  await ready(daemon);
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
  const click = label => evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Button unavailable');b.click();})()`);
  const input = (id, value) => evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.navigate', { url: 'http://127.0.0.1:4244' }); await text('Add your first repository.');
  for (const id of repositoryIds) {
    await input('repository-path', path.join(fixture.root, 'sources', id));
    await waitFor(() => evaluate("!document.querySelector('form button').disabled"), 'Add button did not enable.');
    await click('Add repository');
    await waitFor(() => evaluate(`[...document.querySelectorAll('.sources strong')].some(e=>e.textContent===${JSON.stringify(id)})`), 'Source did not appear.');
  }
  await click('Index sources'); await text('18 indexed · 9 excluded · 0 failed · 0 pending');
  await text('3 repositories · 16 declarations · 2 cross-repository clues');
  await text('2 static flow outlines · 4 candidate code links');
  assert.equal(await evaluate("document.querySelectorAll('.flow-card').length"), 2);
  assert.equal(await evaluate("document.querySelector('.flow-card').innerText.includes('Candidate hop')"), true);
  await evaluate("[...document.querySelectorAll('.flow-steps li')].find(e=>e.querySelector(':scope > strong')?.textContent==='MongoCollection.replaceOne').querySelector('.flow-citations button').click()");
  await text('Source evidence');
  assert.equal(await evaluate("document.querySelector('.evidence pre').innerText.includes('collection.replaceOne')"), true);
  assert.equal(await evaluate("document.activeElement.textContent"), 'Source evidence');
  await evaluate("document.querySelector('.flow-gaps').open=true");
  await text('Runtime topic parameters are not bound');
  await text('KafkaSubscriber has no implementation');
  await evaluate("document.querySelector('.flow-gaps').open=false");
  assert.equal(await evaluate("document.querySelectorAll('.map-clue.candidate').length"), 2);
  await evaluate("[...document.querySelectorAll('.map-repository')].find(e=>e.querySelector('summary').textContent==='portal').open=true");
  assert.equal(await evaluate("document.querySelector('.system-map').innerText.includes('<img src=x')"), true);
  assert.equal(await evaluate("document.querySelectorAll('.system-map img').length"), 0);
  assert.equal(await evaluate('window.mapInjected === undefined'), true);
  await evaluate("[...document.querySelectorAll('.map-repository')].find(e=>e.querySelector('summary').textContent==='portal').open=false");
  await evaluate("[...document.querySelectorAll('.map-repository')].find(e=>e.querySelector('summary').textContent==='order-api').open=true");
  await evaluate("[...document.querySelectorAll('.map-declarations li')].find(e=>e.querySelector('strong').textContent==='POST /api/orders').querySelector('.citations button').click()");
  await text('Source evidence');
  assert.equal(await evaluate("document.querySelector('.evidence pre').innerText.includes('Orders.accept')"), true);
  await evaluate(`(()=>{
    const nativeFetch=window.fetch;
    let first=true, release;
    const gate=new Promise(resolve=>{release=resolve;});
    window.releaseFlowEvidence=release;
    window.restoreFlowFetch=()=>{window.fetch=nativeFetch;};
    window.fetch=async(...args)=>{
      const delayed=first&&String(args[0]).includes('/api/evidence/');
      if(delayed)first=false;
      const response=await nativeFetch(...args);
      if(delayed){await gate;window.delayedFlowEvidenceFinished=true;}
      return response;
    };
    document.querySelector('.flow-citations button').click();
    [...document.querySelectorAll('.map-clue')].find(e=>e.querySelector('strong').textContent.includes('event contract')).querySelector('.citations button').click();
  })()`);
  await waitFor(() => evaluate("document.querySelector('.evidence pre')?.innerText.includes('OrderPlaced')"), 'Contract citation did not open.');
  await evaluate('window.releaseFlowEvidence()');
  await waitFor(() => evaluate('window.delayedFlowEvidenceFinished===true'), 'The delayed older citation did not settle.');
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  assert.equal(await evaluate("document.querySelector('.evidence pre').innerText.includes('OrderPlaced')"), true, 'An older response replaced the latest citation.');
  await evaluate('window.restoreFlowFetch()');
  const firstIndex = await evaluate("fetch('/api/project').then(r=>r.json()).then(p=>p.publishedBuildId)");
  await click('Index sources');
  await waitFor(() => evaluate(`fetch('/api/project').then(r=>r.json()).then(p=>p.publishedBuildId!==${JSON.stringify(firstIndex)})`), 'Second index did not publish.');
  await waitFor(() => evaluate("document.querySelector('[aria-label=\"Index version\"]').options.length===3"), 'Index history did not refresh.');
  await evaluate(`(()=>{const e=document.querySelector('[aria-label="Index version"]');e.value=${JSON.stringify(firstIndex)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await text('This map uses an older index');
  await text('These flows use an older index');
  await evaluate("(()=>{const e=document.querySelector('[aria-label=\"Index version\"]');e.value='';e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await waitFor(() => evaluate("!document.querySelector('.system-map').innerText.includes('This map uses an older index')"), 'Map did not select the current index.');
  await waitFor(() => evaluate("document.querySelector('.code-flows')?.innerText.includes('2 static flow outlines') && !document.querySelector('.code-flows').innerText.includes('These flows use an older index')"), 'Flows did not select the current index.');
  await input('source-query', 'orders.placed.v2'); await click('Search'); await text('3 matching passages');
  await evaluate("[...document.querySelectorAll('button.result')].find(b=>b.querySelector('.result-meta').textContent.startsWith('order-api')).click()");
  await text('Source evidence');
  assert.equal(await evaluate("document.querySelector('.evidence pre').innerText.includes('orders.placed.v2')"), true);
  assert.equal(await evaluate("document.activeElement.textContent"), 'Source evidence');
  await evaluate("document.querySelector('.code-flows').scrollIntoView()");
  const desktop = await page.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(output, 'desktop.png'), Buffer.from(desktop.data, 'base64'));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= 390'), true, 'Mobile layout overflows.');
  const mobile = await page.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(output, 'mobile.png'), Buffer.from(mobile.data, 'base64'));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false });
  await evaluate("[...document.querySelectorAll('.sources li')].find(li=>li.querySelector('strong').textContent==='order-api').querySelector('button').click()");
  await click('Confirm removal'); await text('2 / 3');
  await waitFor(() => evaluate("!document.querySelector('.evidence')"), 'Revoked evidence remained visible.');
  await waitFor(() => evaluate("document.querySelectorAll('.map-clue').length===0 && ![...document.querySelectorAll('.map-repository summary')].some(e=>e.textContent==='order-api')"), 'Revoked source remained in the map.');
  await waitFor(() => evaluate("document.querySelector('.code-flows')?.innerText.includes('0 candidate code links') && !document.querySelector('.code-flows').innerText.includes('order-api /') && !document.querySelector('.code-flows').innerText.includes('MongoCollection.replaceOne')"), 'Revoked source or dependent flow steps remained visible.');
  await input('source-query', 'publisher.publish'); await click('Search'); await text('No indexed matches.');
  await evaluate("document.querySelector('details.advanced').open=true");
  await input('exclusions', 'legacy'); await click('Save policy'); await text('Index your sources to start exploring.');
  await click('Index sources'); await text('10 indexed · 7 excluded · 0 failed · 0 pending');
  await stop(daemon);
  const restarted = start(process.execPath, ['dist/index.js'], daemonDir, env); await ready(restarted);
  await page.send('Page.reload'); await text('10 indexed · 7 excluded · 0 failed · 0 pending');
  await waitFor(() => evaluate("document.querySelectorAll('.flow-card').length===1"), 'Supported flow did not survive policy reindex and restart.');
  await input('source-query', 'OrderConsumer'); await click('Search'); await text('matching passages');
  assert.equal(await evaluate("document.querySelectorAll('[role=alert]').length"), 0);
  for (const id of repositoryIds) assert.equal(fixtureGit(fixture.root, id, ['status', '--porcelain=v1']), '');
  const result = { schemaVersion: 'loredock-browser/3', sources: 3, initialIndexedFiles: 18, initialExcludedFiles: 9,
    systemMap: { repositories: 3, declarations: 16, crossRepositoryClues: 2, routeCitation: true, contractCitation: true, escapedLabels: true, historicalSelection: true, revocation: true },
    codeFlows: { outlines: 2, candidateCodeLinks: 4, writeCitation: true, latestCitationWins: true, unresolvedWiringVisible: true, historicalSelection: true, revocation: true, restart: true },
    fixtureVariation: 'Owned temporary package name contains adversarial HTML; frozen corpus files are unchanged.',
    topicMatches: 3, evidenceOpened: true, keyboardFocus: true, mobileWidth: 390, sourceRevocation: true,
    policyFencing: true, reindex: true, restartPersistence: true, sourceCheckoutsUnchanged: true, modelRequests: 0 };
  await writeFile(path.join(output, 'browser-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ output, ...result }, null, 2));
} finally {
  page?.close(); for (const record of children.reverse()) await stop(record);
  await rm(fixture.root, { recursive: true, force: true });
}
