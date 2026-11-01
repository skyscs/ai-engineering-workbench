import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCapacityFixture } from './loredock-capacity-fixture.mjs';

// Opt-in browser check over a small owned shape, not the full volume benchmark.
const fixture = await createCapacityFixture(5);
const hostileLabel = '<img src=x onerror=alert(1)>';
await rename(path.join(fixture.root, 'sources/portal'), path.join(fixture.root, 'sources', hostileLabel));
const output = process.env.LOREDOCK_SMOKE_OUTPUT ?? await mkdtemp(path.join(tmpdir(), 'loredock-code-browser-'));
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

  const settle = () => evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const hold = routes => evaluate(`(()=>{const native=window.fetch,routes=${JSON.stringify(Array.isArray(routes)?routes:[routes])},seen=new Set();let ready=0,returned=0,release;const gate=new Promise(r=>release=r);window.heldReady=false;window.heldReleased=false;
    window.releaseHeld=()=>{release();window.fetch=native;};window.fetch=async(...args)=>{const route=routes.find(route=>!seen.has(route)&&String(args[0]).includes(route));if(route)seen.add(route);
    const response=await native(...args);if(route){window.heldReady=++ready===routes.length;await gate;window.heldReleased=++returned===routes.length;}return response;};})()`);
  const held = () => waitFor(()=>evaluate('window.heldReady===true'),'The response did not reach its gate.');
  const release = async () => {await evaluate('window.releaseHeld()');await waitFor(()=>evaluate('window.heldReleased===true'),'The held response did not return.');await settle();};
  const apiCall = (route,method='GET',body) => evaluate(`(async()=>{const {token}=await(await fetch('/api/session',{method:'POST',headers:{'x-loredock-client':'web'}})).json();
    const response=await fetch('/api'+${JSON.stringify(route)},{method:${JSON.stringify(method)},headers:{'content-type':'application/json','x-loredock-csrf':token},
    ${body===undefined?'':`body:JSON.stringify(${JSON.stringify(body)}),`}});const result=await response.json();if(!response.ok)throw Error(JSON.stringify(result));return result;})()`);
  const noOverflow = async () => assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  const coverage = () => waitFor(() => evaluate("document.querySelector('.code-coverage-counts')?.textContent.includes('121 of 121')"), 'Complete code coverage did not appear.');
  const disclose = async open => { await evaluate(`document.querySelector('.code-inventory-details').open=${open}`); await settle(); };
  const fileRows = () => evaluate("[...document.querySelectorAll('.code-files > li')].map(row=>({id:row.dataset.fileId,path:row.querySelector('code').textContent}))");
  const pageOffset = offset => waitFor(() => evaluate(`document.querySelector('.code-files')?.dataset.codeOffset==='${offset}' && document.querySelector('.code-files button:not([disabled])')!==null`), 'Code file page did not load.');
  const inspect = index => evaluate(`document.querySelectorAll('.code-files > li button')[${index}].click()`);
  const fileReady = () => waitFor(() => evaluate("document.querySelector('.code-file-facts')!==null"), 'File facts did not load.');
  const query = value => evaluate(`(()=>{const e=document.getElementById('source-query');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const search = async value => { await query(value); await click('Search'); };
  const searchDone = () => waitFor(()=>evaluate("document.querySelector('.search button').disabled===false"),'Search did not finish.');
  const symbolReady = value => text(`exact symbol matches for ${value}`);
  const noSymbols = () => evaluate("document.querySelector('.symbol-matches')===null");
  const enter = async () => {
    await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
    await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  };
  await page.send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
  await page.send('Page.navigate',{url:'http://127.0.0.1:4244'}); await text('Where should I look?');
  assert.equal((await apiCall('/health')).modelExecution,false);
  const paths=fixture.manifest.sources.map(source=>path.join(fixture.root,'sources',source.id==='portal'?hostileLabel:source.id));
  await input(paths.join('\n')); await click('Preview repositories'); await text('20 new repositories'); await click('Add 20 repositories');
  await waitFor(()=>evaluate("[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Index sources'&&!button.disabled)"),'Index action did not become available.');
  await click('Index sources'); await coverage(); await text('6 files with syntax gaps (7 messages)');
  assert.equal(await evaluate("document.querySelector('.code-inventory-details').open"),false);
  await noOverflow(); await evaluate("document.querySelector('.code-inventory').scrollIntoView()"); await screenshot('code-coverage-mobile.png');
  await evaluate("document.querySelector('.code-inventory-details > summary').focus()"); await enter(); await pageOffset(0);
  const first=await fileRows(); assert.equal(first.length,50);
  assert.equal(await evaluate("document.querySelector('.code-files > li > strong').textContent"),hostileLabel);
  assert.equal(await evaluate("document.querySelectorAll('.code-inventory img').length"),0);
  await evaluate("document.querySelector('.code-files > li button').focus()"); await enter(); await fileReady();
  assert.equal(await evaluate("document.activeElement===document.querySelector('.code-file-facts h4')"),true);
  await noOverflow(); await screenshot('code-facts-mobile.png');
  await evaluate("document.querySelector('.code-file-facts button').focus()"); await enter(); await text('Source evidence');
  assert.equal(await evaluate("document.activeElement===document.querySelector('.evidence h2')"),true);
  assert.equal(await evaluate("document.querySelector('.evidence strong').textContent"),hostileLabel);
  const initial=(await apiCall('/code-analysis')).inventories[0]; assert.equal(initial.counts.parsed,121);

  assert.equal(await evaluate("document.querySelectorAll('#source-query').length"),1);
  await search('Orders.accept'); await symbolReady('Orders.accept'); await searchDone();
  assert.equal(await evaluate("document.querySelector('.symbol-matches li strong').textContent"),'Orders.accept');
  await evaluate("document.querySelector('.symbol-matches button').focus()"); await enter(); await text('Source evidence');
  assert.equal(await evaluate("document.activeElement===document.querySelector('.evidence h2')"),true);
  assert.equal(await evaluate("document.querySelector('.evidence strong').textContent"),'order-api');
  await search('loadProbe000004'); await symbolReady('loadProbe000004'); await searchDone();
  assert.equal(await evaluate("document.querySelector('.symbol-matches li p').textContent.startsWith("+JSON.stringify(hostileLabel)+")"),true);
  assert.equal(await evaluate("document.querySelectorAll('.symbol-matches img').length"),0);
  await noOverflow(); await evaluate("document.querySelector('.symbol-matches').scrollIntoView()"); await screenshot('symbol-search-mobile.png');
  await hold('/api/evidence/'); await evaluate("document.querySelector('.symbol-matches button').click()"); await held();
  await query('edited query'); await release(); assert.equal(await evaluate("document.querySelector('.evidence')===null"),true); assert.equal(await noSymbols(),true);

  await hold('/api/code-symbols?'); await search('accept'); await held();
  assert.ok(await evaluate("document.querySelectorAll('.results button.result').length")>0);
  await query('different query'); await release(); await searchDone(); assert.equal(await noSymbols(),true);
  assert.equal(await evaluate("document.querySelectorAll('.results button.result').length"),0);
  await hold('/api/search?'); await search('accept'); await held(); await symbolReady('accept');
  await query('replacement query'); await release(); await searchDone(); assert.equal(await noSymbols(),true);
  assert.equal(await evaluate("document.querySelectorAll('.results button.result').length"),0);
  await evaluate(`(()=>{const native=window.fetch;window.fetch=async(...args)=>{if(String(args[0]).includes('/api/code-symbols?')){window.fetch=native;return Response.json({error:{message:'Owned lookup failure'}},{status:503});}return native(...args);};})()`);
  await search('accept'); await text('Supported symbols: lookup failed'); await searchDone();
  assert.ok(await evaluate("document.querySelectorAll('.results button.result').length")>0);
  await search('OrderBadge'); await text('Supported symbols: no displayed matches'); await searchDone();
  await evaluate("document.querySelector('.symbol-coverage').open=true"); await text('No match does not establish absence');

  await hold(`/files/${first[0].id}`); await inspect(0); await held(); await disclose(false);
  await disclose(true); await pageOffset(0); await inspect(1); await fileReady();
  const selected=await evaluate("document.querySelector('.code-file-facts h4').textContent");
  await release(); assert.equal(await evaluate("document.querySelector('.code-file-facts h4').textContent"),selected);
  await hold('/api/evidence/'); await evaluate("document.querySelector('.code-file-facts button').click()"); await held();
  await disclose(false); await release(); assert.equal(await evaluate("document.querySelector('.evidence')===null"),true);
  await disclose(true); await pageOffset(0); await click('Next code files'); await pageOffset(50); const second=await fileRows();
  await click('Next code files'); await pageOffset(100); const third=await fileRows();
  assert.deepEqual([first.length,second.length,third.length],[50,50,21]); assert.equal(new Set([...first,...second,...third].map(row=>row.id)).size,121);
  await noOverflow(); await evaluate("document.querySelector('.code-pages').scrollIntoView()"); await screenshot('code-page-three-mobile.png');
  await hold(['/files?offset=50','/api/code-symbols?']); await click('Previous code files'); await search('accept'); await held(); await click('Update knowledge');
  await waitFor(async()=>{const state=await apiCall('/project');return state.publishedBuildId!==initial.buildId;},'The refreshed index did not publish.');
  await waitFor(async()=>{const value=(await apiCall('/code-analysis')).inventories[0];return value.buildId!==initial.buildId&&value.published;},'Refreshed code analysis did not publish.');
  const refreshedBuild=(await apiCall('/project')).publishedBuildId;
  await waitFor(()=>evaluate(`document.querySelector('option[value="${refreshedBuild}"]')!==null`),'The refreshed publication did not reach the UI.');
  await coverage(); await release(); assert.equal(await evaluate("document.querySelector('.code-files')===null"),true); assert.equal(await noSymbols(),true);
  const beforeRestart=(await apiCall('/code-analysis')).inventories.map(run=>run.id);
  await stop(daemon); daemon=start(process.execPath,['dist/index.js'],daemonDir,env); await ready(daemon);
  await page.send('Page.reload'); await coverage();
  assert.deepEqual((await apiCall('/code-analysis')).inventories.map(run=>run.id),beforeRestart);

  await hold('/api/project'); await held();
  await evaluate("document.querySelector('.advanced').open=true;const e=document.getElementById('exclusions');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'src');e.dispatchEvent(new Event('input',{bubbles:true}));");
  await click('Save policy'); await waitFor(()=>evaluate("document.querySelector('.code-inventory')===null"),'The new policy did not clear coverage.');
  await release(); assert.equal(await evaluate("document.querySelector('.code-inventory')===null"),true);
  await apiCall('/policy','PUT',{excludedPaths:[]});
  await waitFor(()=>evaluate("document.getElementById('exclusions').value===''"),'Restored policy did not reach the UI.');
  await click('Index sources'); await coverage();

  await disclose(true); await pageOffset(0); const policyFiles=await fileRows();
  await hold([`/files/${policyFiles[0].id}`,'/api/code-symbols?']); await inspect(0); await search('accept'); await held();
  await apiCall('/policy','PUT',{excludedPaths:['src']});
  await waitFor(()=>evaluate("document.querySelector('.code-inventory')===null"),'Policy change did not clear code coverage.');
  await release(); assert.equal(await evaluate("document.querySelector('.code-file-facts')===null"),true); assert.equal(await noSymbols(),true);
  await apiCall('/policy','PUT',{excludedPaths:[]});
  await waitFor(()=>evaluate("document.getElementById('exclusions').value===''"),'Restored policy did not reach the UI.');
  await text('Index sources'); await click('Index sources'); await coverage();
  await disclose(true); await pageOffset(0); const current=(await apiCall('/code-analysis')).inventories[0];
  const revoked=(await apiCall(`/code-analysis/${current.id}/files`)).files[0];
  await hold([`/files/${revoked.fileId}`,'/api/code-symbols?']); await inspect(0); await search('accept'); await held(); await apiCall(`/sources/${revoked.sourceId}/revoke`,'POST');
  await waitFor(()=>evaluate("document.querySelectorAll('.sources > li').length===19"),'Source revocation did not reach the page.');
  await release(); assert.equal(await evaluate("document.querySelector('.code-file-facts')===null && document.querySelector('.code-files')===null"),true); assert.equal(await noSymbols(),true);
  await noOverflow();
  const result={schemaVersion:'loredock-code-coverage-browser/2',sources:20,candidateFiles:121,modelRequests:0,answerModeDisabled:true,
    automaticAnalysis:true,unsupportedFiles:6,gapMessages:7,collapsedDetails:true,keyboardDisclosure:true,keyboardFileFacts:true,
    keyboardOriginalEvidence:true,escapedSourceLabels:true,filePages:[50,50,21],uniqueFiles:121,
    delayedFileReplacementFenced:true,delayedOriginalCollapseFenced:true,delayedPageRefreshFenced:true,
    restartPreservesInventoryIds:true,lateProjectPollFenced:true,delayedFilePolicyFenced:true,delayedFileRevocationFenced:true,
    sharedSearchInput:true,exactQualifiedSymbol:true,keyboardSymbolOriginal:true,escapedSymbolSource:true,
    textSearchIndependentOfSymbolFailure:true,textAvailableBeforeSymbols:true,delayedSymbolQueryEditFenced:true,delayedTextQueryEditFenced:true,
    delayedSymbolOriginalEditFenced:true,delayedSymbolRefreshFenced:true,delayedSymbolPolicyFenced:true,delayedSymbolRevocationFenced:true,
    unsupportedSymbolHasExplicitLimitation:true,mobileWidth:390,horizontalOverflow:false};
  await writeFile(path.join(output,'browser-result.json'),JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify({output,...result},null,2));
} catch(error) {
  if(page){await writeFile(path.join(output,'failure.png'),Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    const value=await page.send('Runtime.evaluate',{expression:'document.body?.innerText.slice(0,16384)',returnByValue:true});await writeFile(path.join(output,'failure.txt'),String(value.result.value));}
  throw error;
} finally {
  page?.close(); for(const record of children.reverse())await stop(record); await rm(fixture.root,{recursive:true,force:true});
}
