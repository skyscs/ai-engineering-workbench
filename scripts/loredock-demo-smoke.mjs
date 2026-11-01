import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {access,mkdtemp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {demoEnvironment,requireFreeDemoPort} from './loredock-demo.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),owned=await mkdtemp(path.join(tmpdir(),'loredock-demo-browser-'));
const output=process.env.LOREDOCK_SMOKE_OUTPUT??await mkdtemp(path.join(tmpdir(),'loredock-demo-result-'));await mkdir(output,{recursive:true});
const normal=path.join(owned,'normal-data');await mkdir(normal);await writeFile(path.join(normal,'sentinel.txt'),'Normal data stays unchanged.\n');
const environment={...process.env,TMPDIR:owned,LOREDOCK_DATA_DIR:normal,LOREDOCK_ANSWERS:'1',LOREDOCK_DEVELOPMENT:'1'},children=[];
function start(command,args,cwd=root,env=environment) {
  const child=spawn(command,args,{cwd,env,detached:true,stdio:['ignore','pipe','pipe']}),record={child,output:'',ended:false};
  record.exit=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{record.ended=true;record.code=code;record.signal=signal;resolve(code);});});
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>record.output=(record.output+chunk).slice(-32768));
  children.push(record);return record;
}
async function waitFor(fn,message,timeout=20000) {
  const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,40));}throw new Error(message);
}
async function stop(record,signal='SIGTERM') {
  if(record.ended)return;process.kill(-record.child.pid,signal);
  const timer=setTimeout(()=>{if(!record.ended)try{process.kill(-record.child.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}},10000);
  try{await record.exit;}finally{clearTimeout(timer);}
}
async function connect(url) {
  const socket=new WebSocket(url);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let id=0;const pending=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data),entry=pending.get(message.id);if(!entry)return;pending.delete(message.id);clearTimeout(entry.timer);
    if(message.error)entry.reject(new Error(message.error.message));else entry.resolve(message.result);});
  return {close:()=>socket.close(),send:(method,params={})=>new Promise((resolve,reject)=>{const requestId=++id,timer=setTimeout(()=>{pending.delete(requestId);reject(new Error(`CDP timeout: ${method}`));},10000);
    pending.set(requestId,{resolve,reject,timer});socket.send(JSON.stringify({id:requestId,method,params}));})};
}
const ready=(record,marker,timeout=20000)=>waitFor(()=>{if(record.ended)throw new Error(record.output);return record.output.includes(marker);},`Missing launcher state: ${marker}`,timeout);
const demoRoot=record=>{const found=record.output.match(/^Demo root: (.+)$/m)?.[1];assert.ok(found?.startsWith(owned+path.sep));return found;};
let page;
try {
  await requireFreeDemoPort();
  const launcher=start('pnpm',['loredock:demo']);await ready(launcher,'Demo ready:',60000);
  const preparedRoot=demoRoot(launcher),demo=JSON.parse(await readFile(path.join(preparedRoot,'demo.json'),'utf8'));
  assert.equal(demo.sourceCount,20);assert.equal(demo.build.coverage.indexed,79);assert.equal(demo.inventory.examined,21);
  assert.ok(launcher.output.includes('Model calls are disabled.'));assert.ok(launcher.output.includes('Reopen later:'));
  assert.deepEqual(await readdir(normal),['sentinel.txt']);assert.equal(await readFile(path.join(normal,'sentinel.txt'),'utf8'),'Normal data stays unchanged.\n');
  const chrome=start('google-chrome',['--headless','--no-sandbox','--disable-gpu','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${path.join(owned,'browser')}`,'about:blank']);
  await ready(chrome,'DevTools listening on');const endpoint=new URL(chrome.output.match(/DevTools listening on (ws:\/\/\S+)/)[1]);
  const targets=await(await fetch(`http://${endpoint.host}/json/list`)).json();page=await connect(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
  await page.send('Page.enable');
  const evaluate=async expression=>{const value=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(value.exceptionDetails)throw new Error(value.exceptionDetails.exception?.description??'Browser evaluation failed.');return value.result.value;};
  const text=value=>waitFor(()=>evaluate(`document.body?.innerText.includes(${JSON.stringify(value)})`),`Missing UI text: ${value}`);
  const api=route=>evaluate(`(async()=>{await fetch('/api/session',{method:'POST',headers:{'x-loredock-client':'web'}});const response=await fetch('/api'+${JSON.stringify(route)});if(!response.ok)throw Error('API '+response.status);return response.json();})()`);
  const screenshot=async name=>writeFile(path.join(output,name),Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await page.send('Page.navigate',{url:'http://127.0.0.1:4244'});await text('21 of 21 code files examined');await text('20 / 20');
  assert.equal((await api('/health')).modelExecution,false);assert.equal((await api('/project')).publishedBuildId,demo.build.id);
  assert.equal(await evaluate("document.querySelector('.connected-sources').open"),false);
  assert.equal(await evaluate("document.getElementById('repository-path').value"),'');await screenshot('prepared-demo-mobile.png');
  await evaluate(`(()=>{const e=document.getElementById('source-query');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'StockProjection.accept');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate("document.querySelector('.search button').click()");await text('exact symbol matches for StockProjection.accept');
  assert.equal(await evaluate("document.querySelector('.symbol-matches li strong').textContent"),'synthetic.stock.StockProjection.accept');
  await evaluate("document.querySelector('.symbol-matches button').focus()");
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await text('Source evidence');
  assert.equal(await evaluate("document.activeElement===document.querySelector('.evidence h2')"),true);
  assert.equal(await evaluate("document.querySelector('.evidence strong').textContent"),'inventory-worker');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await screenshot('demo-original-mobile.png');
  const before=(await api('/code-analysis')).inventories.map(run=>run.id),rootsBefore=await readdir(owned);
  const blocked=start(process.execPath,['scripts/loredock-demo.mjs']);await waitFor(()=>blocked.ended,'Occupied-port launch did not stop.');
  assert.equal(blocked.code,1);assert.match(blocked.output,/Port 4244 is unavailable/);assert.ok(!blocked.output.includes('Demo root:'));
  assert.deepEqual(await readdir(owned),rootsBefore);assert.equal((await api('/project')).publishedBuildId,demo.build.id);
  await writeFile(path.join(preparedRoot,'manual-note.txt'),'Owned manual exploration is retained.\n');
  await stop(launcher,'SIGINT');assert.ok(launcher.output.includes('Demo data retained:'));await requireFreeDemoPort();
  await access(path.join(demo.dataDirectory,'loredock.db'));assert.equal(await readFile(path.join(preparedRoot,'manual-note.txt'),'utf8'),'Owned manual exploration is retained.\n');
  const resumed=start(process.execPath,['dist/index.js'],path.join(root,'apps/loredock'),demoEnvironment(environment,demo.dataDirectory));
  await ready(resumed,'LoreDock listening');await page.send('Page.reload');await text('21 of 21 code files examined');
  assert.equal((await api('/project')).publishedBuildId,demo.build.id);assert.deepEqual((await api('/code-analysis')).inventories.map(run=>run.id),before);
  assert.equal((await api('/health')).modelExecution,false);await stop(resumed);await requireFreeDemoPort();
  const interrupted=start(process.execPath,['scripts/loredock-demo.mjs']);await ready(interrupted,'Indexing twenty generated repositories');const interruptedRoot=demoRoot(interrupted);
  await stop(interrupted,'SIGINT');assert.ok(!interrupted.output.includes('Demo ready:'));assert.ok(interrupted.output.includes('Demo data retained:'));await requireFreeDemoPort();
  const {CatalogStore}=await import('../apps/loredock/dist/store.js');const interruptedStore=new CatalogStore(path.join(interruptedRoot,'demo-data'));
  try {assert.deepEqual(interruptedStore.all('SELECT status FROM builds').map(row=>row.status),['interrupted']);assert.equal(interruptedStore.all('SELECT id FROM code_analyses').length,0);}
  finally {interruptedStore.close();}
  assert.deepEqual(await readdir(normal),['sentinel.txt']);
  const result={schemaVersion:'loredock-demo-browser/1',command:'pnpm loredock:demo',sources:20,indexedFiles:79,excludedFiles:60,codeFiles:21,
    syntaxGapFiles:6,syntaxGapMessages:7,modelRequests:0,inheritedAnswerModeOverridden:true,inheritedDataDirectoryUntouched:true,
    preparedUiWithoutPathInput:true,shortJavaSearch:true,keyboardOriginalEvidence:true,occupiedPortRejectedBeforeFixture:true,existingDaemonUnaffected:true,
    shutdownRetainsSourcesAndData:true,manualFileRetained:true,reopenPreservesIndexAndInventory:true,interruptedPreparationRetained:true,noAutomaticRetry:true,
    mobileWidth:390,horizontalOverflow:false};
  await writeFile(path.join(output,'browser-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({output,...result},null,2));
} catch(error) {
  await writeFile(path.join(output,'process-output.txt'),children.map((record,index)=>`Owned process ${index}:\n${record.output}`).join('\n'));
  if(page){await writeFile(path.join(output,'failure.png'),Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    const value=await page.send('Runtime.evaluate',{expression:'document.body?.innerText.slice(0,16384)',returnByValue:true});await writeFile(path.join(output,'failure.txt'),String(value.result.value));}
  throw error;
} finally {page?.close();for(const record of children.reverse())await stop(record);await rm(owned,{recursive:true,force:true});}
