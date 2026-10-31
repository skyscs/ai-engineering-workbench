import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScaleFixture } from './loredock-scale-fixture.mjs';
import { routingCases } from '../fixtures/loredock-routing/cases.mjs';

// Opt-in Linux browser acceptance. Uses synthetic sources, port 4244 and no models.
const fixture = await createScaleFixture();
const hostileLabel = '<img src=x onerror=alert(1)>';
const linkedLabel = '<svg onload=alert(2)>';
await rename(path.join(fixture.root, 'sources/ui-components'), path.join(fixture.root, 'sources', hostileLabel));
await rename(path.join(fixture.root, 'sources/contract-library'), path.join(fixture.root, 'sources', linkedLabel));
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

  const question = value => evaluate(`(()=>{const e=document.getElementById('candidate-question');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const find = () => click('Find candidate repositories');
  const settle = () => evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const hold = route => evaluate(`(()=>{const native=window.fetch;let first=true,release;const gate=new Promise(r=>release=r);window.heldReady=false;window.heldReleased=false;
    window.releaseHeld=()=>{release();window.fetch=native;};window.fetch=async(...args)=>{const held=first&&String(args[0]).includes(${JSON.stringify(route)});if(held)first=false;
    const response=await native(...args);if(held){window.heldReady=true;await gate;window.heldReleased=true;}return response;};})()`);
  const held = () => waitFor(()=>evaluate('window.heldReady===true'),'The response did not reach its gate.');
  const release = async () => {await evaluate('window.releaseHeld()');await waitFor(()=>evaluate('window.heldReleased===true'),'The held response did not return.');await settle();};
  const apiCall = (route,method='GET',body) => evaluate(`(async()=>{const {token}=await(await fetch('/api/session',{method:'POST',headers:{'x-loredock-client':'web'}})).json();
    const response=await fetch('/api'+${JSON.stringify(route)},{method:${JSON.stringify(method)},headers:{'content-type':'application/json','x-loredock-csrf':token},
    ${body===undefined?'':`body:JSON.stringify(${JSON.stringify(body)}),`}});const result=await response.json();if(!response.ok)throw Error(JSON.stringify(result));return result;})()`);
  const noOverflow = async () => assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await page.send('Emulation.setDeviceMetricsOverride', { width:390,height:844,deviceScaleFactor:1,mobile:true });
  await page.send('Page.navigate', { url:'http://127.0.0.1:4244' });await text('Where should I look?');
  assert.equal((await apiCall('/health')).modelExecution,false);
  const paths=fixture.manifest.sources.map(source=>path.join(fixture.root,'sources',source.id==='ui-components'?hostileLabel:source.id==='contract-library'?linkedLabel:source.id));
  await input(paths.join('\n'));await click('Preview repositories');await text('20 new repositories');await click('Add 20 repositories');
  await waitFor(()=>evaluate("document.querySelectorAll('.sources > li').length===20 && [...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Index sources' && !button.disabled)"),'Bulk registration did not finish.');
  await click('Index sources');await text('79 indexed · 60 excluded · 0 failed · 0 pending');await text('README context for 20 of 20 repositories');
  await question('OrderBadge');await find();await text('1 source suggestion to review');
  assert.equal(await evaluate("document.querySelector('.candidate-suggestions h4').textContent"),hostileLabel);
  assert.equal(await evaluate("document.querySelectorAll('.candidate-panel img').length"),0);
  await noOverflow();await evaluate("document.querySelector('.candidate-panel').scrollIntoView()");await screenshot('candidates-mobile.png');
  await evaluate("document.querySelector('.candidate-suggestions button').focus()");
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await text('Source evidence');assert.equal(await evaluate("document.activeElement===document.querySelector('.evidence h2')"),true);
  assert.equal(await evaluate("document.querySelector('.evidence strong').textContent"),hostileLabel);
  await question('zzcandidatebrowserunknown');assert.equal(await evaluate("document.querySelector('.evidence')===null"),true);
  await find();await text('No distinctive source match');
  await question('OrderBadge');await hold('/api/candidates/preview');await find();await held();
  await question('zzcandidatebrowserunknown');await release();assert.equal(await evaluate("document.querySelector('.candidate-preview')===null"),true);
  await question('OrderBadge');await find();await text('1 source suggestion to review');
  await hold('/api/evidence/');await evaluate("document.querySelector('.candidate-suggestions button').click()");await held();
  await question('zzcandidatebrowserunknown');await release();assert.equal(await evaluate("document.querySelector('.evidence')===null"),true);
  await question('OrderBadge');await find();await text('1 source suggestion to review');
  await question(routingCases[0].description);await find();await waitFor(()=>evaluate("document.querySelector('.candidate-other')!==null"),'Other candidates were not available.');
  await evaluate("document.querySelector('.candidate-other').open=true");
  assert.equal(await evaluate(`[...document.querySelectorAll('.candidate-other h4')].some(node=>node.textContent===${JSON.stringify(linkedLabel)})`),true);
  assert.equal(await evaluate("document.querySelector('.candidate-links').open"),false);
  await evaluate("document.querySelector('.candidate-links').open=true");
  assert.equal(await evaluate(`[...document.querySelectorAll('.related-source-name')].some(node=>node.textContent===${JSON.stringify(linkedLabel)})`),true);
  assert.equal(await evaluate("document.querySelectorAll('.related-source').length===4 && document.querySelectorAll('.related-source[open]').length===0"),true);
  assert.equal(await evaluate("[...document.querySelectorAll('.related-source > summary')].every(node=>node.innerText.includes('unverified') && node.querySelector('.related-source-subject'))"),true);
  await evaluate("document.querySelector('.candidate-links').scrollIntoView()");await noOverflow();await screenshot('related-summaries-mobile.png');
  assert.equal(await evaluate("document.querySelectorAll('.candidate-links svg').length"),0);
  const linkedCard=`[...document.querySelectorAll('.related-source')].find(node=>node.querySelector('.related-source-name').textContent===${JSON.stringify(linkedLabel)})`;
  await evaluate(`${linkedCard}.querySelector('summary').focus()`);
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.equal(await evaluate(`${linkedCard}.open`),true);
  const linkedButton=`[...document.querySelectorAll('.candidate-links .candidate-support')].find(node=>node.querySelector('p').textContent.includes(${JSON.stringify(linkedLabel)})).querySelector('button')`;
  await evaluate(`${linkedButton}.focus()`);
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await text('Source evidence');assert.equal(await evaluate("document.querySelector('.evidence strong').textContent"),linkedLabel);
  assert.equal(await evaluate("document.activeElement===document.querySelector('.evidence h2')"),true);
  await evaluate("document.querySelector('.candidate-links').scrollIntoView()");await noOverflow();await screenshot('candidate-links-mobile.png');
  await hold('/api/evidence/');await evaluate(`${linkedButton}.click()`);await held();
  await question('zzcandidatebrowserunknown');await release();assert.equal(await evaluate("document.querySelector('.evidence')===null"),true);
  await question(routingCases[0].description);await find();await waitFor(()=>evaluate("document.querySelector('.candidate-links')!==null"),'Related repositories did not load.');
  await page.send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate("document.querySelector('.candidate-panel').scrollIntoView()");await screenshot('other-candidates-desktop.png');
  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await noOverflow();
  await question(routingCases[5].description);await find();await waitFor(()=>evaluate("document.querySelector('.candidate-links')!==null"),'Dojo candidate links did not load.');
  await evaluate("document.querySelector('.candidate-links').open=true");
  assert.equal(await evaluate("[...document.querySelectorAll('.related-source-name')].some(node=>node.textContent==='inventory-api')"),true);
  assert.equal(await evaluate("document.querySelectorAll('.related-source[open]').length"),0);
  const inventoryCard="[...document.querySelectorAll('.related-source')].find(node=>node.querySelector('.related-source-name').textContent==='inventory-api')";
  assert.equal(await evaluate(`${inventoryCard}.querySelector('summary').innerText.includes('/stock/reservations')`),true);
  await evaluate("document.querySelector('.candidate-links').scrollIntoView()");await noOverflow();await screenshot('dojo-source-summaries-mobile.png');
  await evaluate(`${inventoryCard}.querySelector('summary').click()`);
  const dojoButton="[...document.querySelectorAll('.candidate-links .candidate-support')].find(node=>node.querySelector('p').textContent.includes('legacy-admin')).querySelector('button')";
  await evaluate(`${dojoButton}.click()`);await text('Source evidence');
  assert.equal(await evaluate("document.querySelector('.evidence strong').textContent"),'legacy-admin');
  assert.equal(await evaluate("document.querySelector('.evidence').textContent.includes('src/stock.js')"),true);
  const inventoryButton="[...document.querySelectorAll('.candidate-links .candidate-support')].find(node=>node.querySelector('p').textContent.includes('inventory-api')).querySelector('button')";
  await evaluate(`${inventoryButton}.click()`);await waitFor(()=>evaluate("document.querySelector('.evidence strong')?.textContent==='inventory-api'"),'Inventory route evidence did not open.');
  const dojoGraph=await apiCall('/code-flows');assert.equal(dojoGraph.adapterVersion,'pilot-code-v3');
  assert.ok(dojoGraph.omissions['adapter:unsupported-amd-shape']>0);assert.equal(dojoGraph.nodes.some(node=>node.path==='src/plugin.js'),false);
  assert.equal(await evaluate(`${inventoryCard}.innerText.includes('deployment binding are unresolved')`),true);
  await evaluate("document.querySelector('.candidate-links').scrollIntoView()");await noOverflow();await screenshot('dojo-object-route-mobile.png');
  await question('OrderBadge');await find();await text('1 source suggestion to review');
  const firstBuild=await evaluate("document.querySelector('.candidate-panel').dataset.buildId");
  await click('Update knowledge');await waitFor(()=>evaluate(`document.querySelector('.project-overview')?.dataset.buildId!==${JSON.stringify(firstBuild)} && document.querySelectorAll('.orientation-card').length===20`),'Refresh did not publish.');
  assert.equal(await evaluate("document.querySelector('.candidate-preview')===null"),true);
  await find();await text('1 source suggestion to review');
  await evaluate(`(()=>{const e=document.querySelector('[aria-label="Index version"]');e.value=${JSON.stringify(firstBuild)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await find();await text('These suggestions use an older index or source registry.');
  assert.equal(await evaluate("document.querySelector('.candidate-panel').dataset.buildId"),firstBuild);
  await evaluate("(()=>{const e=document.querySelector('[aria-label=\"Index version\"]');e.value='';e.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await question('POST /api/orders');await hold('/api/candidates/preview');await find();await held();
  const flow=await apiCall('/code-flows'),overlay=await apiCall('/corrections'),edge=flow.edges.find(edge=>edge.kind==='http-target');assert.ok(edge);
  await apiCall('/corrections','POST',{requestId:'candidate-browser-review',buildId:flow.buildId,targetKind:'code-link',targetId:edge.id,
    projectionHash:flow.inputHash,expectedRevision:overlay.revision,expectedPreviousId:null,action:'dispute',statement:'The candidate relationship requires runtime review.',environment:null});
  await text('The candidate relationship requires runtime review.');await release();assert.equal(await evaluate("document.querySelector('.candidate-preview')===null"),true);
  await find();await waitFor(()=>evaluate("document.querySelector('.candidate-preview')!==null"),'Reviewed candidate preview did not load.');
  await evaluate("document.querySelector('.candidate-panel .answer-review').open=true");await text('Human statements · unverified.');
  await question('OrderBadge');await hold('/api/candidates/preview');await find();await held();
  const project=await apiCall('/project'),source=project.sources.find(source=>source.name===hostileLabel);assert.ok(source);
  await apiCall(`/sources/${source.id}/revoke`,'POST');
  await waitFor(()=>evaluate("document.querySelectorAll('.sources > li').length===19"),'Source revocation was not polled.');
  await release();assert.equal(await evaluate("document.querySelector('.candidate-preview')===null"),true);
  await find();await waitFor(()=>evaluate("document.querySelector('.candidate-preview')!==null"),'Revoked-source preview did not finish.');
  assert.equal(await evaluate(`document.querySelector('.candidate-preview').textContent.includes(${JSON.stringify(hostileLabel)})`),false);
  await question(routingCases[0].description);await hold('/api/candidates/preview');await find();await held();
  const linkedSource=project.sources.find(source=>source.name===linkedLabel);assert.ok(linkedSource);
  await apiCall(`/sources/${linkedSource.id}/revoke`,'POST');
  await waitFor(()=>evaluate("document.querySelectorAll('.sources > li').length===18"),'Linked source revocation was not polled.');
  await release();assert.equal(await evaluate("document.querySelector('.candidate-preview')===null"),true);
  await find();await waitFor(()=>evaluate("document.querySelector('.candidate-preview')!==null"),'Linked revocation preview did not finish.');
  assert.equal(await evaluate(`document.querySelector('.candidate-preview').textContent.includes(${JSON.stringify(linkedLabel)})`),false);
  await question('StockReserved');await hold('/api/candidates/preview');await find();await held();
  await apiCall('/policy','PUT',{excludedPaths:['notes']});
  await waitFor(()=>evaluate("document.getElementById('exclusions').value==='notes'"),'Policy change was not polled.');
  await release();assert.equal(await evaluate("document.querySelector('.candidate-preview')===null"),true);assert.equal(await evaluate("document.querySelector('.evidence')===null"),true);
  await noOverflow();
  await page.send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate("document.querySelector('.candidate-panel').scrollIntoView()");await screenshot('candidate-policy-fence.png');
  const result={schemaVersion:'loredock-candidate-browser/3',sources:20,modelRequests:0,answerModeDisabled:true,
    sourceSuggestions:true,otherCandidatesInspectable:true,escapedSourceLabel:true,keyboardOriginalEvidence:true,noMatchUnresolved:true,
    lateQuestionPreviewFenced:true,lateQuestionEvidenceFenced:true,refreshFenced:true,historicalScope:true,
    lateReviewPreviewFenced:true,reviewNotesUnverified:true,lateRevocationPreviewFenced:true,latePolicyPreviewFenced:true,
    relatedSourcesCollapsed:true,relatedSourceLabelEscaped:true,relatedOriginalEvidenceKeyboard:true,
    lateLinkedEvidenceFenced:true,lateLinkedRevocationFenced:true,
    dojoObjectCallerAndRouteEvidence:true,dojoDynamicPluginUnresolved:true,codeAdapter:'pilot-code-v3',
    relatedSourceCardsCollapsed:true,relationshipSubjectsVisible:true,keyboardSourceDisclosure:true,
    mobileWidth:390,horizontalOverflow:false};
  await writeFile(path.join(output,'browser-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({output,...result},null,2));
} catch(error) {
  if(page){await writeFile(path.join(output,'failure.png'),Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    const result=await page.send('Runtime.evaluate',{expression:'document.body?.innerText.slice(0,16384)',returnByValue:true});await writeFile(path.join(output,'failure.txt'),String(result.result.value));}
  throw error;
} finally {
  page?.close();for(const record of children.reverse())await stop(record);await rm(fixture.root,{recursive:true,force:true});
}
