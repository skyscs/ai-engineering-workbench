import {spawn} from 'node:child_process';
import {access,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createScaleFixture} from './loredock-scale-fixture.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const url='http://127.0.0.1:4244';
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
export const demoEnvironment=(environment,dataDirectory)=>({...environment,LOREDOCK_DATA_DIR:dataDirectory,LOREDOCK_ANSWERS:'0',LOREDOCK_DEVELOPMENT:'0'});
export const demoRestartCommand=dataDirectory=>`LOREDOCK_DATA_DIR=${quote(dataDirectory)} LOREDOCK_ANSWERS=0 LOREDOCK_DEVELOPMENT=0 pnpm loredock`;

export async function requireFreeDemoPort(port=4244) {
  await new Promise((resolve,reject)=>{
    const probe=createServer(socket=>socket.destroy());probe.once('error',error=>reject(Object.assign(new Error(`Port ${port} is unavailable (${error.code??'UNKNOWN'}). Stop your existing LoreDock instance before starting a demo.`),{code:error.code})));
    probe.listen({host:'127.0.0.1',port,exclusive:true},()=>probe.close(error=>error?reject(error):resolve()));
  });
}

export async function prepareDemo(services,{signal,onProgress=()=>{}}={}) {
  signal?.throwIfAborted();const fixture=await createScaleFixture(),dataDirectory=path.join(fixture.root,'demo-data');
  await mkdir(dataDirectory,{mode:0o700});
  onProgress({stage:'created',root:fixture.root,dataDirectory});
  let store,catalog,analysis,closing,timer;
  const stop=()=>closing??=Promise.allSettled([analysis?.stop(),catalog?.stop()]);
  const interrupt=()=>{void stop();};
  try {
    signal?.throwIfAborted();store=new services.CatalogStore(dataDirectory);catalog=new services.Catalog(store);analysis=new services.CodeAnalysis(catalog);
    signal?.addEventListener('abort',interrupt,{once:true});signal?.throwIfAborted();
    const paths=fixture.manifest.sources.map(source=>path.join(fixture.root,'sources',source.id));
    if(paths.length!==20)throw new Error('The bundled demo must contain exactly twenty repositories.');
    const preview=await catalog.previewSources(paths);signal?.throwIfAborted();
    await catalog.registerSources({paths,previewHash:preview.previewHash,requestId:'demo-sources'});signal?.throwIfAborted();
    const state=catalog.state(),started=catalog.start('demo-index',state.sourceSetVersion,state.policyVersion);
    onProgress({stage:'indexing',buildId:started.id});
    timer=setInterval(()=>onProgress({stage:'index-progress',indexed:store.build(started.id).coverage.indexed}),2000);
    await catalog.idle();clearInterval(timer);timer=undefined;signal?.throwIfAborted();
    const build=store.build(started.id);
    if(!build.published||build.coverage.indexed!==fixture.manifest.evidence.length||build.coverage.failed||build.coverage.pending) {
      throw new Error(`The demo index is incomplete (${build.status}; ${build.coverage.indexed}/${fixture.manifest.evidence.length} files). Data is retained; no automatic retry was started.`);
    }
    const run=analysis.start('demo-code',build.id);onProgress({stage:'analyzing',inventoryId:run.id});await analysis.idle();signal?.throwIfAborted();
    const inventory=analysis.get(run.id),expectedCode=fixture.manifest.evidence.filter(ref=>/\.(?:ts|js|vue|java)$/i.test(ref.path)).length;
    if(!inventory.published||inventory.candidates!==expectedCode||inventory.counts.parsed!==expectedCode) {
      throw new Error(`The demo code inventory is incomplete (${inventory.status}; ${inventory.counts.parsed??0}/${expectedCode} files). Data is retained; no automatic retry was started.`);
    }
    const result={schemaVersion:'loredock-demo/1',createdAt:new Date().toISOString(),root:fixture.root,dataDirectory,sourceCount:paths.length,
      build,inventory,modelRequests:0,answerModeEnabled:false,retention:'Generated repositories and application data are retained on exit.'};
    await writeFile(path.join(fixture.root,'demo.json'),JSON.stringify(result,null,2)+'\n');signal?.throwIfAborted();return result;
  } finally {
    clearInterval(timer);signal?.removeEventListener('abort',interrupt);
    try {const outcomes=await stop();const errors=outcomes.filter(result=>result.status==='rejected').map(result=>result.reason);if(errors.length)throw new AggregateError(errors,'Demo services could not shut down.');}
    finally {store?.close();}
  }
}

async function runDaemon(demo,signal) {
  signal.throwIfAborted();
  const child=spawn(process.execPath,['dist/index.js'],{cwd:path.join(root,'apps/loredock'),env:demoEnvironment(process.env,demo.dataDirectory),detached:true,stdio:['ignore','pipe','pipe']});
  let finished=false,listening=false,output='',timer;
  const send=name=>{if(finished||!child.pid)return;try{if(process.platform==='win32')child.kill(name);else process.kill(-child.pid,name);}catch(error){if(error.code!=='ESRCH')throw error;}};
  const interrupt=()=>{send('SIGTERM');timer=setTimeout(()=>send('SIGKILL'),5000);timer.unref();};
  signal.addEventListener('abort',interrupt,{once:true});if(signal.aborted)interrupt();
  child.stdout.on('data',chunk=>{
    process.stdout.write(chunk);output=(output+chunk).slice(-8192);
    if(!listening&&!signal.aborted&&output.includes(`LoreDock listening on ${url}`)) {
      listening=true;console.log(`Demo ready: ${demo.sourceCount} repositories, ${demo.build.coverage.indexed} indexed files, ${demo.inventory.examined} code files examined.`);
      console.log(`Syntax gaps: ${demo.inventory.filesWithGaps} files (${demo.inventory.gaps} messages). Model calls are disabled.`);
      console.log('Try StockProjection.accept in Explore the sources, or describe an OrderPlaced tenantId problem in Where should I look?.');
      console.log('Press Ctrl+C to stop. Generated repositories, notes and data will be retained.');
    }
  });
  child.stderr.on('data',chunk=>process.stderr.write(chunk));child.once('exit',()=>{finished=true;});
  try {
    const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,termination)=>resolve({code,termination}));});
    if(signal.aborted)return;
    if(result.code!==0||!listening)throw new Error(`Demo daemon exited (${result.termination??result.code??'UNKNOWN'}${listening?'':'; before listening'}). Data is retained.`);
  } finally {finished=true;clearTimeout(timer);signal.removeEventListener('abort',interrupt);}
}

export async function launchDemo() {
  if(process.argv.length!==2)throw new Error('Usage: pnpm loredock:demo (no source or data-path arguments).');
  await requireFreeDemoPort();
  try {await access(path.join(root,'apps/loredock/dist/index.js'));await access(path.join(root,'apps/loredock/public/index.html'));}
  catch {throw new Error('Build LoreDock first, or use pnpm loredock:demo to build and start the example.');}
  const modules=await Promise.all(['catalog','store','code-analysis'].map(name=>import(`../apps/loredock/dist/${name}.js`)));
  const controller=new AbortController();let directory;
  const interrupt=()=>controller.abort();process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
  try {
    console.log('Preparing a fresh synthetic LoreDock project. No corporate sources or model calls are used.');
    const demo=await prepareDemo(Object.assign({},...modules),{signal:controller.signal,onProgress:event=>{
      if(event.stage==='created') {directory=event.dataDirectory;console.log(`Demo root: ${event.root}`);console.log(`Demo data: ${directory}`);console.log(`Reopen later: ${demoRestartCommand(directory)}`);}
      else if(event.stage==='indexing')console.log('Indexing twenty generated repositories…');
      else if(event.stage==='index-progress')console.log(`Indexing: ${event.indexed} files indexed.`);
      else if(event.stage==='analyzing')console.log('Examining supported code syntax…');
    }});
    await runDaemon(demo,controller.signal);
  } catch(error) {if(controller.signal.aborted)console.log('Demo stopped. No automatic resume or retry was started.');else throw error;}
  finally {process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);if(directory)console.log(`Demo data retained: ${directory}`);}
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  try {await launchDemo();}catch(error){const code=error.code??error.status;console.error(`Demo failed${code===undefined?'':` (${code})`}: ${error.message}`);process.exitCode=1;}
}
