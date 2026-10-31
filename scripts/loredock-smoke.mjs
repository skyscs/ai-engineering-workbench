import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
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
  const portalReadme = path.join(fixture.root, 'sources/portal/README.md');
  await writeFile(portalReadme, await readFile(portalReadme, 'utf8') + '<img src=x onerror="window.orientationInjected=true"> Documented text is not an instruction to execute.\n');
  fixtureGit(fixture.root, 'portal', ['add', 'package.json', 'README.md']);
  fixtureGit(fixture.root, 'portal', ['commit', '-qm', 'Add adversarial browser source text']);
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
  const text = value => waitFor(() => evaluate(`document.body?.innerText.includes(${JSON.stringify(value)})`), `Missing UI text: ${value}`);
  const click = label => evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Button unavailable');b.click();})()`);
  const input = (id, value) => evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false });
  await page.send('Page.navigate', { url: 'http://127.0.0.1:4244' }); await text('Add your first repository.');
  for (const id of repositoryIds) {
    await input('repository-path', path.join(fixture.root, 'sources', id));
    await waitFor(() => evaluate("!document.querySelector('form button').disabled"), 'Add button did not enable.');
    await click('Preview repositories'); await text('Review repositories'); await click('Add 1 repository');
    await waitFor(() => evaluate(`[...document.querySelectorAll('.sources strong')].some(e=>e.textContent===${JSON.stringify(id)})`), 'Source did not appear.');
  }
  await evaluate(`(()=>{
    const nativeFetch=window.fetch;let first=true,release;const gate=new Promise(resolve=>{release=resolve;});
    window.releaseOrientationFlow=release;window.restoreOrientationFetch=()=>{window.fetch=nativeFetch;};
    window.fetch=async(...args)=>{const held=first&&String(args[0]).includes('/api/code-flows?');if(held)first=false;
      const response=await nativeFetch(...args);if(held){window.orientationFlowHeld=true;await gate;}return response;};
  })()`);
  await click('Index sources'); await text('18 indexed · 9 excluded · 0 failed · 0 pending');
  await text('README context for 3 of 3 repositories');
  assert.equal(await evaluate("document.querySelectorAll('.orientation-card').length"), 3);
  assert.equal(await evaluate("document.querySelector('.project-overview').innerText.includes('orders.created.v1')"), true);
  assert.equal(await evaluate("document.querySelector('.project-overview').innerText.includes('<img src=x')"), true);
  assert.equal(await evaluate("document.querySelectorAll('.project-overview img').length"), 0);
  assert.equal(await evaluate('window.orientationInjected===undefined'), true);
  await evaluate("[...document.querySelectorAll('.orientation-card')].find(e=>e.querySelector('h3').textContent==='order-api').querySelector('.orientation-citations button').click()");
  await waitFor(() => evaluate("document.querySelector('.evidence pre')?.innerText.includes('orders.created.v1')"), 'README evidence did not open.');
  assert.equal(await evaluate('document.activeElement.textContent'), 'Source evidence');
  await evaluate("document.querySelector('.reading-guide').open=true");
  await waitFor(() => evaluate('window.orientationFlowHeld===true'), 'The initial flow response was not held.');
  await click('Follow first flow'); await text('No flow outline is available yet.');
  await evaluate('window.releaseOrientationFlow()');
  await text('3 repositories · 16 declarations · 2 cross-repository clues');
  await text('2 static flow outlines · 4 candidate code links');
  await evaluate('window.restoreOrientationFetch()');
  await click('Read repository context'); assert.equal(await evaluate('document.activeElement.textContent'), 'portal');
  await click('Explore system map'); assert.equal(await evaluate('document.activeElement.textContent'), 'System map');
  await click('Follow first flow'); assert.equal(await evaluate("document.activeElement===document.querySelector('.flow-card > summary')"), true);
  await click('Review sources and gaps'); assert.equal(await evaluate('document.activeElement.textContent'), 'Overview coverage and gaps');
  await evaluate("document.querySelector('.orientation-coverage').open=false;document.querySelector('.reading-guide').scrollIntoView()");
  await writeFile(path.join(output, 'guide-desktop.png'), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await evaluate("document.querySelector('.orientation-coverage').open=false;document.querySelector('.reading-guide').open=false;document.querySelector('.project-overview').scrollIntoView()");
  await writeFile(path.join(output, 'overview-desktop.png'), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth<=390'), true);
  await writeFile(path.join(output, 'overview-mobile.png'), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false });
  const initialOrientation = await evaluate("fetch('/api/orientation').then(r=>r.json())");
  await writeFile(path.join(output, 'orientation-initial.json'), JSON.stringify(initialOrientation, null, 2) + '\n');
  assert.equal(await evaluate("document.querySelectorAll('.flow-card').length"), 2);
  assert.equal(await evaluate("document.querySelector('.flow-card').innerText.includes('Candidate hop')"), true);
  await evaluate("[...document.querySelectorAll('.flow-steps li')].find(e=>e.querySelector(':scope > strong')?.textContent==='MongoCollection.replaceOne').querySelector('.flow-citations button').click()");
  await waitFor(() => evaluate("document.querySelector('.evidence pre')?.innerText.includes('collection.replaceOne')"), 'Write evidence did not replace the README citation.');
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
  await waitFor(() => evaluate("document.querySelector('.evidence pre')?.innerText.includes('Orders.accept')"), 'Route evidence did not replace the prior citation.');
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
  const deliveryTarget = await evaluate("[...document.querySelector('.flow-card').querySelectorAll('.flow-steps li')].find(e=>e.querySelector('.flow-candidate')?.textContent.includes('Equal supported Java record shapes')).querySelector('.link-correction').dataset.targetId");
  const correctionSelector = `.link-correction[data-target-id="${deliveryTarget}"]`;
  const correctionClick = label => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(correctionSelector)});const b=[...e.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Correction button unavailable');b.click();})()`);
  await waitFor(() => evaluate(`!!document.querySelector(${JSON.stringify(correctionSelector)})?.querySelector('button')`), 'Correction controls did not load.');
  await correctionClick('Correct this link');
  const correctionTextId = await evaluate(`document.querySelector(${JSON.stringify(correctionSelector)}).querySelector('textarea').id`);
  await input(correctionTextId, '<img src=x onerror="window.correctionInjected=true"> The subscriber broker has not been verified.');
  await evaluate(`document.querySelector(${JSON.stringify(correctionSelector)}).querySelector('.correction-scope').open=true`);
  await input(await evaluate(`document.querySelector(${JSON.stringify(correctionSelector)}).querySelector('input').id`), 'local');
  await correctionClick('Save correction');
  await waitFor(() => evaluate("document.querySelectorAll('.flow-card.needs-review').length===2"), 'The shared correction did not invalidate both outlines.');
  await text('Engineer scope: local');
  assert.equal(await evaluate("document.querySelectorAll('.human-correction img').length"), 0);
  assert.equal(await evaluate('window.correctionInjected===undefined'), true);
  assert.equal(await evaluate("document.querySelector('.human-correction').innerText.includes('<img src=x')"), true);
  await evaluate(`document.querySelector(${JSON.stringify(correctionSelector)}).scrollIntoView()`);
  await writeFile(path.join(output, 'correction-desktop.png'), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await writeFile(path.join(output, 'correction-mobile.png'), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  const correctionOverflow = await evaluate("[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>391).slice(0,8).map(e=>({tag:e.tagName,className:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right}))");
  assert.equal(await evaluate('document.documentElement.scrollWidth<=390'), true, JSON.stringify(correctionOverflow));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false });
  await correctionClick('Edit correction');
  const preservedDraft = 'This link is limited to the local fixture; production broker binding is unknown.';
  await input(await evaluate(`document.querySelector(${JSON.stringify(correctionSelector)}).querySelector('textarea').id`), preservedDraft);
  await evaluate(`(async()=>{
    const token=await fetch('/api/session',{method:'POST',headers:{'x-loredock-client':'web'}}).then(r=>r.json()).then(r=>r.token);
    const project=await fetch('/api/project').then(r=>r.json());
    const code=await fetch('/api/code-flows').then(r=>r.json());
    const overlay=await fetch('/api/corrections').then(r=>r.json());
    const previous=overlay.corrections.find(c=>c.targetId===${JSON.stringify(deliveryTarget)});
    const response=await fetch('/api/corrections',{method:'POST',headers:{'Content-Type':'application/json','x-loredock-csrf':token},body:JSON.stringify({
      requestId:crypto.randomUUID(),buildId:project.publishedBuildId,targetKind:'code-link',targetId:previous.targetId,
      projectionHash:code.inputHash,expectedRevision:overlay.revision,expectedPreviousId:previous.id,
      action:'clarify',statement:'Concurrent review: deployment binding remains unresolved.',environment:'local'})});
    if(!response.ok)throw Error('The concurrent review did not publish.');
  })()`);
  await text('This link has a newer correction.');
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(correctionSelector)}).querySelector('textarea').value`), preservedDraft);
  assert.equal(await evaluate(`([...document.querySelector(${JSON.stringify(correctionSelector)}).querySelectorAll('button')].find(b=>b.textContent==='Save correction')).disabled`), true);
  await correctionClick('Use latest review');
  await evaluate(`(()=>{const s=document.querySelector(${JSON.stringify(correctionSelector)}).querySelector('select');s.value='clarify';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await correctionClick('Save correction');
  await waitFor(() => evaluate(`document.querySelector(${JSON.stringify(correctionSelector)}).innerText.includes('Correction history (3)')`), 'Correction revision did not publish.');
  await correctionClick('Correction history (3)'); await text('Version 3 · Clarification'); await text('Version 1 · Disputed link');
  await correctionClick('Withdraw correction');
  await waitFor(() => evaluate("document.querySelectorAll('.flow-card.needs-review').length===0 && document.querySelectorAll('.human-correction').length===0"), 'Withdrawal did not clear review invalidation.');
  await correctionClick('Correct this link');
  await input(await evaluate(`document.querySelector(${JSON.stringify(correctionSelector)}).querySelector('textarea').id`), 'Historical correction: local delivery is still an engineer-supplied claim.');
  await correctionClick('Save correction');
  await waitFor(() => evaluate(`document.querySelector(${JSON.stringify(correctionSelector)}).innerText.includes('Correction history (5)')`), 'Replacement correction did not publish.');
  const correctionId = await evaluate("fetch('/api/corrections').then(r=>r.json()).then(r=>r.corrections[0].id)");
  await stop(daemon);
  const reviewedDaemon = start(process.execPath, ['dist/index.js'], daemonDir, env); await ready(reviewedDaemon);
  await page.send('Page.reload'); await text('Historical correction: local delivery');
  await text('README context for 3 of 3 repositories');
  assert.equal(await evaluate("document.querySelectorAll('.flow-card.needs-review').length"), 2);
  await click('Update knowledge');
  await waitFor(() => evaluate(`fetch('/api/project').then(r=>r.json()).then(p=>p.publishedBuildId!==${JSON.stringify(firstIndex)})`), 'Second index did not publish.');
  await waitFor(() => evaluate("document.querySelector('[aria-label=\"Index version\"]').options.length===3"), 'Index history did not refresh.');
  await text('No committed file changes since the previous index.');
  await evaluate("document.querySelector('.change-details').open=true");
  await text('18 text files reused · 3 Git file read attempts · 0 cache validation failures');
  await waitFor(() => evaluate("document.querySelectorAll('.human-correction').length===0 && document.querySelectorAll('.flow-card.needs-review').length===0"), 'A new index inherited an old correction.');
  await evaluate(`(()=>{const e=document.querySelector('[aria-label="Index version"]');e.value=${JSON.stringify(firstIndex)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await text('This map uses an older index');
  await text('These flows use an older index');
  await text('Historical correction: local delivery');
  assert.equal(await evaluate("document.querySelectorAll('.flow-card.needs-review').length"), 2);
  await evaluate("(()=>{const e=document.querySelector('[aria-label=\"Index version\"]');e.value='';e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await waitFor(() => evaluate("!document.querySelector('.system-map').innerText.includes('This map uses an older index')"), 'Map did not select the current index.');
  await waitFor(() => evaluate("document.querySelector('.code-flows')?.innerText.includes('2 static flow outlines') && !document.querySelector('.code-flows').innerText.includes('These flows use an older index')"), 'Flows did not select the current index.');
  await waitFor(() => evaluate("document.querySelectorAll('.human-correction').length===0"), 'Historical corrections remained on the current index.');
  const secondIndex = await evaluate("fetch('/api/project').then(r=>r.json()).then(p=>p.publishedBuildId)");
  await text('Supporting evidence unchanged');
  const beforeApply = await evaluate("fetch('/api/correction-reconciliation').then(r=>r.json())");
  assert.equal(beforeApply.entries[0].status, 'support-unchanged'); assert.equal(beforeApply.entries[0].source.id, correctionId);
  assert.equal(await evaluate("document.querySelectorAll('.flow-card.needs-review').length"), 0, 'A proposal changed the active review state.');
  await writeFile(path.join(output, 'reconciliation-before-apply.json'), JSON.stringify(beforeApply, null, 2) + '\n');
  await evaluate("document.querySelector('.earlier-correction').open=true");
  await evaluate("document.querySelector('.earlier-correction .review-comparison > div:first-child button').click()"); await text('Source evidence');
  await evaluate("document.querySelector('.earlier-correction .review-comparison > div:nth-child(2) button').click()"); await text('Source evidence');
  await evaluate("document.querySelector('.earlier-corrections').scrollIntoView()");
  await writeFile(path.join(output, 'reconciliation-desktop.png'), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth<=390'), true);
  await writeFile(path.join(output, 'reconciliation-mobile.png'), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false });
  await click('Apply to this index'); await text('Reapplied from index');
  await waitFor(() => evaluate("document.querySelectorAll('.flow-card.needs-review').length===2"), 'Explicit reapplication did not mark both flows.');
  await text('Already reviewed in this index');
  assert.equal(await evaluate("document.querySelector('.earlier-correction').open"), false, 'The refreshed proposal should require a new review.');
  await evaluate("document.querySelector('.earlier-correction').open=true");
  assert.equal(await evaluate("[...document.querySelectorAll('.earlier-corrections button')].some(b=>b.textContent==='Apply to this index')"), false);
  await evaluate("[...document.querySelectorAll('.correction-origin button')].find(b=>b.textContent==='Read earlier correction').click()");
  await text('Earlier correction and original evidence');
  await evaluate("document.querySelector('.correction-origin details button').click()"); await text('Source evidence');
  const reapplied = await evaluate("fetch('/api/corrections').then(r=>r.json()).then(r=>r.corrections[0])");
  assert.equal(reapplied.reappliedFrom.id, correctionId); assert.equal(reapplied.buildId, secondIndex);
  await writeFile(path.join(output, 'reapplied-correction.json'), JSON.stringify(reapplied, null, 2) + '\n');
  await stop(reviewedDaemon);
  const reconciliationDaemon = start(process.execPath, ['dist/index.js'], daemonDir, env); await ready(reconciliationDaemon);
  await page.send('Page.reload'); await text('Reapplied from index');
  assert.equal(await evaluate("document.querySelectorAll('.flow-card.needs-review').length"), 2);
  const apiReadme = path.join(fixture.root, 'sources/order-api/README.md');
  await writeFile(apiReadme, (await readFile(apiReadme, 'utf8')).replace('POST /api/orders accepts', 'RefreshBrowserMarker: committed refresh demonstration.\nPOST /api/orders accepts'));
  fixtureGit(fixture.root, 'order-api', ['add', 'README.md']); fixtureGit(fixture.root, 'order-api', ['commit', '-qm', 'Change the owned refresh README']);
  await rename(path.join(fixture.root, 'sources/order-worker/README.md'), path.join(fixture.root, 'sources/order-worker/REFRESH.md'));
  fixtureGit(fixture.root, 'order-worker', ['add', '--all']); fixtureGit(fixture.root, 'order-worker', ['commit', '-qm', 'Move an owned document to test added and removed paths']);
  await click('Update knowledge');
  await waitFor(() => evaluate(`fetch('/api/project').then(r=>r.json()).then(p=>p.publishedBuildId!==${JSON.stringify(secondIndex)})`), 'Changed refresh did not publish.');
  await text('Supporting evidence unchanged');
  assert.equal(await evaluate("document.querySelectorAll('.human-correction').length"), 0, 'Reapplication was automatically repeated on the next refresh.');
  await text('1 added · 1 changed · 1 removed · 0 coverage changes · 0 not comparable');
  await text('README context for 2 of 3 repositories'); await text('README context unavailable');
  assert.equal(await evaluate("document.querySelector('.project-overview').innerText.includes('RefreshBrowserMarker')"), true);
  const updatedOrientation = await evaluate("fetch('/api/orientation').then(r=>r.json())");
  await writeFile(path.join(output, 'orientation-updated.json'), JSON.stringify(updatedOrientation, null, 2) + '\n');
  await evaluate(`(()=>{const s=document.querySelector('[aria-label="Index version"]');s.value=${JSON.stringify(secondIndex)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await waitFor(() => evaluate(`document.querySelector('.project-overview')?.dataset.buildId===${JSON.stringify(secondIndex)}`), 'Historical overview did not load.');
  await text('README context for 3 of 3 repositories');
  assert.equal(await evaluate("document.querySelector('.project-overview').innerText.includes('RefreshBrowserMarker')"), false);
  await text('This overview uses an older index');
  await evaluate("(()=>{const s=document.querySelector('[aria-label=\"Index version\"]');s.value='';s.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await text('README context for 2 of 3 repositories');
  await evaluate("document.querySelector('.change-details').open=true");
  await text('16 text files reused · 5 Git file read attempts · 0 cache validation failures');
  await evaluate("[...document.querySelectorAll('.changed-files li')].find(e=>e.innerText.includes('order-api / README.md')).querySelectorAll('button')[1].click()");
  await waitFor(() => evaluate("document.querySelector('.evidence pre')?.innerText.includes('RefreshBrowserMarker')"), 'Selected-index change citation did not open.');
  await evaluate("[...document.querySelectorAll('.changed-files li')].find(e=>e.innerText.includes('order-api / README.md')).querySelectorAll('button')[0].click()");
  await waitFor(() => evaluate("document.querySelector('.evidence pre') && !document.querySelector('.evidence pre').innerText.includes('RefreshBrowserMarker')"), 'Previous change citation did not stay pinned.');
  await evaluate("document.querySelector('.index-changes').scrollIntoView()");
  await writeFile(path.join(output, 'refresh-desktop.png'), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth<=390'), true);
  await writeFile(path.join(output, 'refresh-mobile.png'), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1200, deviceScaleFactor: 1, mobile: false });
  await input('source-query', 'orders.placed.v2'); await click('Search'); await text('3 matching passages');
  await evaluate("[...document.querySelectorAll('button.result')].find(b=>b.querySelector('.result-meta').textContent.startsWith('order-api')).click()");
  await waitFor(() => evaluate("document.querySelector('.evidence pre')?.innerText.includes('orders.placed.v2')"), 'Search evidence did not replace the previous citation.');
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
  const thirdIndex = await evaluate("fetch('/api/project').then(r=>r.json()).then(p=>p.publishedBuildId)");
  const workerFile = path.join(fixture.root, 'sources/order-worker/src/main/java/OrderConsumer.java');
  await writeFile(workerFile, await readFile(workerFile, 'utf8') + '\n// Additional broker review context.\n');
  fixtureGit(fixture.root, 'order-worker', ['add', '--all']); fixtureGit(fixture.root, 'order-worker', ['commit', '-qm', 'Change owned supporting source context']);
  await click('Update knowledge');
  await waitFor(() => evaluate(`fetch('/api/project').then(r=>r.json()).then(p=>p.publishedBuildId!==${JSON.stringify(thirdIndex)})`), 'Support-change refresh did not publish.');
  const fourthIndex = await evaluate("fetch('/api/project').then(r=>r.json()).then(p=>p.publishedBuildId)");
  await waitFor(() => evaluate(`document.querySelector('.earlier-corrections')?.dataset.buildId===${JSON.stringify(fourthIndex)}`), 'The review comparison did not select the support-change index.');
  await text('Choose an older review index');
  await evaluate(`(()=>{const s=document.querySelector('.earlier-index-selection select');s.value=${JSON.stringify(secondIndex)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await text('Supporting evidence changed');
  const changedSupport = await evaluate(`fetch('/api/correction-reconciliation?fromBuildId=${secondIndex}').then(r=>r.json())`);
  assert.equal(changedSupport.entries[0].status, 'support-changed');
  await writeFile(path.join(output, 'reconciliation-changed-support.json'), JSON.stringify(changedSupport, null, 2) + '\n');
  await evaluate("document.querySelector('.earlier-correction').open=true");
  assert.equal(await evaluate("[...document.querySelectorAll('.earlier-corrections button')].some(b=>b.textContent==='Apply to this index')"), false);
  await click('Open current link');
  await evaluate("document.querySelector('.earlier-corrections').scrollIntoView()");
  await writeFile(path.join(output, 'reconciliation-changed-support.png'), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await evaluate(`(()=>{
    const nativeFetch=window.fetch;
    let first=true, reviewFirst=true, orientationFirst=true, release;
    const gate=new Promise(resolve=>{release=resolve;});
    window.releaseCorrectionResponse=release;
    window.restoreCorrectionFetch=()=>{window.fetch=nativeFetch;};
    window.fetch=async(...args)=>{
      const delayed=first&&String(args[0]).includes('/api/corrections?buildId=');
      const reviewDelayed=reviewFirst&&String(args[0]).includes('/api/correction-reconciliation?');
      const orientationDelayed=orientationFirst&&String(args[0]).includes('/api/orientation?');
      if(delayed)first=false;
      if(reviewDelayed)reviewFirst=false;
      if(orientationDelayed)orientationFirst=false;
      const response=await nativeFetch(...args);
      if(delayed){window.delayedCorrectionPayload=await response.clone().json();await gate;window.delayedCorrectionFinished=true;}
      if(reviewDelayed){window.delayedReviewPayload=await response.clone().json();await gate;window.delayedReviewFinished=true;}
      if(orientationDelayed){window.delayedOrientationPayload=await response.clone().json();await gate;window.delayedOrientationFinished=true;}
      return response;
    };
    const e=document.querySelector('[aria-label="Index version"]');e.value=${JSON.stringify(secondIndex)};e.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  await waitFor(() => evaluate("window.delayedCorrectionPayload?.corrections[0]?.statement.includes('Historical correction')"), 'The delayed response did not contain the original correction.');
  await waitFor(() => evaluate("window.delayedReviewPayload?.entries[0]?.source.statement.includes('Historical correction')"), 'The delayed review response did not contain the original correction.');
  await waitFor(() => evaluate("window.delayedOrientationPayload?.sources.some(s=>s.context?.text.includes('orders.created.v1'))"), 'The delayed overview did not contain original README context.');
  await evaluate("[...document.querySelectorAll('.sources li')].find(li=>li.querySelector('strong').textContent==='order-api').querySelector('button').click()");
  await click('Confirm removal'); await text('2 / 20');
  await waitFor(() => evaluate("!document.querySelector('.evidence')"), 'Revoked evidence remained visible.');
  await waitFor(() => evaluate("document.querySelectorAll('.map-clue').length===0 && ![...document.querySelectorAll('.map-repository summary')].some(e=>e.textContent==='order-api')"), 'Revoked source remained in the map.');
  await waitFor(() => evaluate("document.querySelector('.code-flows')?.innerText.includes('0 candidate code links') && !document.querySelector('.code-flows').innerText.includes('order-api /') && !document.querySelector('.code-flows').innerText.includes('MongoCollection.replaceOne')"), 'Revoked source or dependent flow steps remained visible.');
  await evaluate('window.releaseCorrectionResponse()');
  await waitFor(() => evaluate('window.delayedCorrectionFinished===true'), 'The older correction response did not settle.');
  await waitFor(() => evaluate('window.delayedReviewFinished===true'), 'The older reconciliation response did not settle.');
  await waitFor(() => evaluate('window.delayedOrientationFinished===true'), 'The older orientation response did not settle.');
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  assert.equal(await evaluate("document.querySelectorAll('.human-correction').length"), 0, 'A late response restored revoked correction content.');
  assert.equal(await evaluate("document.querySelectorAll('.earlier-correction').length"), 0, 'A late response restored revoked review proposals.');
  await waitFor(() => evaluate("document.querySelectorAll('.orientation-card').length===2"), 'Revoked repository context remained visible.');
  assert.equal(await evaluate("document.querySelector('.project-overview').innerText.includes('orders.created.v1')"), false, 'A late response restored revoked README context.');
  assert.equal(await evaluate(`fetch('/api/correction-reconciliation?buildId=${secondIndex}').then(r=>r.json()).then(p=>p.scope.current.every(s=>s.name!=='order-api'))`), true, 'A revoked source remained in the review revision scope.');
  assert.equal(await evaluate(`fetch('/api/corrections/${correctionId}/history').then(r=>r.status)`), 404);
  await evaluate('window.restoreCorrectionFetch()');
  await input('source-query', 'publisher.publish'); await click('Search'); await text('No indexed matches.');
  await evaluate("document.querySelector('details.advanced').open=true");
  await input('exclusions', 'legacy'); await click('Save policy'); await text('Index your sources to start exploring.');
  await click('Index sources'); await text('10 indexed · 7 excluded · 0 failed · 0 pending');
  await stop(reconciliationDaemon);
  const restarted = start(process.execPath, ['dist/index.js'], daemonDir, env); await ready(restarted);
  await page.send('Page.reload'); await text('10 indexed · 7 excluded · 0 failed · 0 pending');
  await waitFor(() => evaluate("document.querySelectorAll('.flow-card').length===1"), 'Supported flow did not survive policy reindex and restart.');
  await input('source-query', 'OrderConsumer'); await click('Search'); await text('matching passages');
  assert.equal(await evaluate("document.querySelectorAll('[role=alert]').length"), 0);
  for (const id of repositoryIds) assert.equal(fixtureGit(fixture.root, id, ['status', '--porcelain=v1']), '');
  const result = { schemaVersion: 'loredock-browser/7', sources: 3, initialIndexedFiles: 18, initialExcludedFiles: 9,
    projectOrientation: { initialContexts: 3, outdatedREADMEPreserved: true, originalCitation: true, escapedText: true, guideNavigationAndFocus: true,
      unavailableStepExplained: true, historicalIsolation: true, updatedREADME: true, missingREADMEGap: true, restart: true,
      lateResponseRevocationFence: true, mobileWidth: 390 },
    systemMap: { repositories: 3, declarations: 16, crossRepositoryClues: 2, routeCitation: true, contractCitation: true, escapedLabels: true, historicalSelection: true, revocation: true },
    codeFlows: { outlines: 2, candidateCodeLinks: 4, writeCitation: true, latestCitationWins: true, unresolvedWiringVisible: true, historicalSelection: true, revocation: true, restart: true },
    engineerCorrections: { dispute: true, scopedClarification: true, originalClaimPreserved: true, twoFlowsInvalidated: true, concurrentDraftPreserved: true, history: true, withdrawal: true,
      escapedText: true, restart: true, newIndexIsolation: true, historicalSelection: true, lateResponseFencing: true, revokedHistoryUnavailable: true },
    knowledgeRefresh: { unchangedReusedFiles: 18, unchangedGitReadAttempts: 3, changedReusedFiles: 16, changedGitReadAttempts: 5,
      added: 1, changed: 1, removed: 1, previousCitation: true, selectedCitation: true, mobileWidth: 390 },
    correctionReconciliation: { noAutomaticTransfer: true, explicitApply: true, originalAndCurrentEvidence: true, exactOrigin: true,
      bothFlowsInvalidated: true, currentDecisionProtected: true, restart: true, changedSupportBlocked: true, olderAncestorSelection: true,
      historicalIsolation: true, lateResponseFencing: true, revokedRevisionScopeExcluded: true, mobileWidth: 390 },
    fixtureVariation: 'Owned temporary package name and portal README contain adversarial HTML; an API README introduction changes, a worker README moves and a supporting Java file gains a comment during refresh. Frozen templates are unchanged.',
    topicMatches: 3, evidenceOpened: true, keyboardFocus: true, mobileWidth: 390, sourceRevocation: true,
    policyFencing: true, reindex: true, restartPersistence: true, sourceCheckoutsUnchanged: true, modelRequests: 0 };
  await writeFile(path.join(output, 'browser-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ output, ...result }, null, 2));
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
