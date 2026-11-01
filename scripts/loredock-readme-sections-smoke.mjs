import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLoreDockFixture,fixtureGit,repositoryIds} from './loredock-fixture.mjs';
import {Catalog} from '../apps/loredock/dist/catalog.js';
import {CatalogStore} from '../apps/loredock/dist/store.js';
import {createApp} from '../apps/loredock/dist/app.js';

// Opt-in Linux/Chrome check. The proxy only dispatches to this process's owned app;
// it has no upstream network forwarding, so an existing port-4244 demo is untouched.
const root=fileURLToPath(new URL('../',import.meta.url)),origin='http://127.0.0.1:4244';
const output=process.env.LOREDOCK_SMOKE_OUTPUT??await mkdtemp(path.join(tmpdir(),'loredock-sections-result-'));
await mkdir(output,{recursive:true});
const fixture=await createLoreDockFixture(),children=[],checks=[],requests=[];
let store,catalog,proxy,page;
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
  const original='# Portal\nDocumented user interface context.\n\n'+'\n'.repeat(115)+'## Architecture\n'
    +'Documented boundary.\n'.repeat(125)+'### <img src=x onerror="window.sectionInjected=true">\nLiteral heading.\n'
    +'## '+ 'X'.repeat(160)+'\nLong label.\n```md\n## Hidden code heading\n```\n'
    +Array.from({length:14},(_,index)=>`## Term ${index+1}\nDocumented definition ${index+1}.\n`).join('');
  const readme=path.join(fixture.root,'sources/portal/README.md');await writeFile(readme,original);
  const commit=()=>{fixtureGit(fixture.root,'portal',['add','README.md']);fixtureGit(fixture.root,'portal',['commit','-qm','Update owned section-navigation fixture']);};commit();
  const revisions=()=>Object.fromEntries(repositoryIds.map(id=>[id,fixtureGit(fixture.root,id,['rev-parse','HEAD'])]));
  const initialRevisions=revisions();
  store=new CatalogStore(path.join(fixture.root,'data'));catalog=new Catalog(store);
  for(const id of repositoryIds)await catalog.addSource(path.join(fixture.root,'sources',id));
  const state=catalog.state(),build=catalog.start('sections-initial',state.sourceSetVersion,state.policyVersion);await catalog.idle();
  assert.equal(store.build(build.id).published,true);
  const app=createApp(catalog,{publicDir:path.join(root,'apps/loredock/public')});
  const sentinel='/__owned_probe/'+randomUUID();let sentinelHits=0;
  proxy=createServer(async(req,res)=>{
    try {
      const url=new URL(req.url);
      if(url.origin!==origin){res.writeHead(403);res.end('Only the owned test origin is supported.');return;}
      if(url.pathname===sentinel){sentinelHits++;res.writeHead(200,{'Content-Type':'text/html'});res.end('<p>'+sentinel+'</p>');return;}
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384)throw new Error('Test request exceeds its bound.');chunks.push(chunk);}
      const headers=new Headers();for(const [name,value]of Object.entries(req.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(','):value);
      const body=chunks.length?Buffer.concat(chunks):undefined;
      const response=await app.fetch(new Request(url,{method:req.method,headers,...body?{body}: {}}));
      requests.push({method:req.method,path:url.pathname,status:response.status});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
    }catch(error){res.writeHead(500);res.end(String(error));}
  });
  proxy.on('connect',(_req,socket)=>socket.destroy());
  await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
  const chrome=start('google-chrome',['--headless','--no-sandbox','--disable-gpu','--disable-background-networking',
    `--proxy-server=http://127.0.0.1:${proxy.address().port}`,'--proxy-bypass-list=<-loopback>',
    '--remote-debugging-port=0',`--user-data-dir=${path.join(fixture.root,'browser')}`,'about:blank']);
  await waitFor(()=>/DevTools listening on (ws:\/\/\S+)/.test(chrome.output),'Chrome did not start.');
  const endpoint=new URL(chrome.output.match(/DevTools listening on (ws:\/\/\S+)/)[1]);
  const targets=await(await fetch(`http://${endpoint.host}/json/list`)).json();page=await connect(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
  await page.send('Page.enable');
  const evaluate=async expression=>{const result=await page.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??'Browser evaluation failed.');return result.result.value;};
  const text=value=>waitFor(()=>evaluate(`document.body?.innerText.includes(${JSON.stringify(value)})`),`Missing UI text: ${value}`);
  const click=label=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('Button unavailable');b.click();})()`);
  const select=id=>evaluate(`(()=>{const s=document.querySelector('select[aria-label="Index version"]');s.value=${JSON.stringify(id)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const shown=id=>waitFor(()=>evaluate(`document.querySelector('.project-overview')?.dataset.buildId===${JSON.stringify(id)}`),'Selected overview did not load.');
  const portal="[...document.querySelectorAll('.orientation-card')].find(e=>e.querySelector('h3').textContent==='portal')";
  const screenshot=async name=>writeFile(path.join(output,name),Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await page.send('Page.navigate',{url:origin+sentinel});await text(sentinel);assert.equal(sentinelHits,1);
  checks.push('Browser proxy sentinel confirms owned transport before application navigation.');
  await page.send('Emulation.setDeviceMetricsOverride',{width:1280,height:1200,deviceScaleFactor:1,mobile:false});
  await page.send('Page.navigate',{url:origin});await shown(build.id);
  const initial=await evaluate("fetch('/api/orientation').then(r=>r.json())");
  const source=initial.sources.find(row=>row.sourceName==='portal');
  assert.equal(source.sections.length,12);assert.equal(source.omittedSections,6);assert.equal(source.sections[1].evidenceIds.length,3);
  assert.equal(await evaluate(`${portal}.querySelector('.readme-sections').open`),false);
  await evaluate(`${portal}.querySelector('.readme-sections > summary').click()`);
  assert.equal(await evaluate(`${portal}.querySelectorAll('.readme-sections li').length`),12);
  assert.equal(await evaluate(`${portal}.innerText.includes('6 additional headings are not listed')`),true);
  assert.equal(await evaluate(`${portal}.querySelectorAll('img').length`),0);
  assert.equal(await evaluate('window.sectionInjected===undefined'),true);
  assert.equal(await evaluate(`${portal}.innerText.includes('Hidden code heading')`),false);
  checks.push('Collapsed navigation, twelve-heading bound, six omissions and literal hostile title render correctly.');
  await evaluate(`${portal}.scrollIntoView()`);await screenshot('sections-desktop.png');
  await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await evaluate(`${portal}.querySelector('.readme-sections').scrollIntoView()`);await screenshot('sections-mobile.png');
  checks.push('The 390px layout has no horizontal overflow, including a 160-byte unbroken label.');
  await page.send('Emulation.setDeviceMetricsOverride',{width:1280,height:1200,deviceScaleFactor:1,mobile:false});
  for(let index=0;index<3;index++){
    await evaluate(`${portal}.querySelectorAll('.readme-sections li')[1].querySelectorAll('button')[${index}].click()`);
    const ref=initial.evidence[source.sections[1].evidenceIds[index]];
    await text(`Lines ${ref.startLine}–${ref.endLine}. Immutable committed snapshot`);
    assert.equal(await evaluate('document.activeElement.textContent'),'Source evidence');
  }
  checks.push('All three overlapping Architecture parts open original evidence and receive focus.');
  await writeFile(readme,'# Portal\nUpdated original context.\n\n## New section\nNew documented material.\n');commit();
  const refreshedRevisions=revisions();await click('Update knowledge');
  await waitFor(()=>catalog.state().publishedBuildId!==build.id,'The new index did not publish.');
  const next=catalog.state().publishedBuildId;await shown(next);
  assert.equal(await evaluate(`${portal}.textContent.includes('New section')`),true);
  await select(build.id);await shown(build.id);assert.equal(await evaluate(`${portal}.textContent.includes('Architecture')`),true);
  checks.push('Update knowledge exposes new headings; historical selection retains the original sections.');
  // Hold a real, completed response in the browser to exercise existing React fences.
  const hold=pattern=>evaluate(`(()=>{const native=window.fetch;let first=true,release;const gate=new Promise(r=>release=r);
    window.held=false;window.delivered=false;window.releaseHeld=release;window.restoreFetch=()=>{window.fetch=native;};
    window.fetch=async(...args)=>{const held=first&&String(args[0]).includes(${JSON.stringify(pattern)});if(held)first=false;
      const response=await native(...args);if(held){window.held=true;await gate;window.delivered=true;}return response;};})()`);
  const held=()=>waitFor(()=>evaluate('window.held===true'),'The response was not held.');
  const release=async()=>{await evaluate('window.releaseHeld()');await waitFor(()=>evaluate('window.delivered===true'),'Held response was not released.');
    await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await evaluate('window.restoreFetch()');};
  await select('');await shown(next);await hold('/api/orientation?');await select(build.id);await held();await select('');await shown(next);await release();
  assert.equal(await evaluate(`${portal}.textContent.includes('Architecture')`),false);await shown(next);
  checks.push('A delayed historical orientation response cannot replace the newly selected index.');
  await hold('/api/orientation?');await select(build.id);await held();
  await evaluate("[...document.querySelectorAll('.sources li')].find(e=>e.querySelector('strong').textContent==='portal').querySelector('button').click()");
  await click('Confirm removal');
  await waitFor(()=>evaluate(`!${portal}`),'Removed repository remained visible.');await release();
  assert.equal(await evaluate(`Boolean(${portal})`),false);
  checks.push('Source removal fences a delayed orientation response and removes section navigation.');
  await select('');await shown(next);
  await hold('/api/evidence/');
  await evaluate("document.querySelector('.orientation-card .readme-sections').open=true;document.querySelector('.orientation-card .readme-sections button').click()");await held();
  await evaluate("document.querySelector('.advanced').open=true;const e=document.getElementById('exclusions');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'README.md');e.dispatchEvent(new Event('input',{bubbles:true}))");await click('Save policy');
  await waitFor(()=>evaluate("!document.querySelector('.project-overview')?.dataset.buildId"),'Old-policy overview remained visible.');await release();
  assert.equal(await evaluate('Boolean(document.querySelector(".evidence"))'),false);
  checks.push('Policy changes remove old navigation and fence a delayed section evidence response.');
  assert.deepEqual(revisions(),refreshedRevisions);
  for(const id of repositoryIds)assert.equal(fixtureGit(fixture.root,id,['status','--porcelain=v1']),'');
  checks.push('Source heads and working trees are unchanged after the explicit owned fixture update.');
  assert.equal(requests.some(request=>request.path.startsWith('/api/answers')),false);
  const result={schemaVersion:'loredock-readme-sections-smoke/1',createdAt:new Date().toISOString(),
    implementationCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,
    chrome:execFileSync('google-chrome',['--version'],{encoding:'utf8'}).trim(),sourceCount:3,initialRevisions,refreshedRevisions,
    initialBuildId:build.id,refreshedBuildId:next,orientation:initial,checks,modelRequests:0,
    transport:'An owned loopback HTTP proxy dispatches directly to the compiled in-process app; no upstream forwarding or listener on port 4244.',
    requests};
  await writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({output,checks:checks.length,modelRequests:0}));
}finally{
  page?.close();for(const child of children.reverse())await stop(child);
  if(proxy)await new Promise(resolve=>{proxy.close(resolve);proxy.closeAllConnections();});
  await catalog?.stop();store?.close();await rm(fixture.root,{recursive:true,force:true});
}
