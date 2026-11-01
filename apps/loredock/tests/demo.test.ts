import assert from 'node:assert/strict';
import {access,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {test,type TestContext} from 'node:test';
import {Catalog} from '../src/catalog.js';
import {CatalogStore} from '../src/store.js';
import {CodeAnalysis} from '../src/code-analysis.js';
import {lookupCodeSymbols} from '../src/code-symbols.js';
// @ts-expect-error The source-build launcher is plain JavaScript.
import {prepareDemo} from '../../../scripts/loredock-demo.mjs';

type Progress = {stage:string;root?:string;dataDirectory?:string};
function owned(t:TestContext,observe: (event:Progress)=>void = ()=>{}) {
  let root='',dataDirectory='';const stages:string[]=[];
  t.after(async()=>{if(root)await rm(root,{recursive:true,force:true});});
  return {onProgress(event:Progress) {stages.push(event.stage);if(event.root)root=event.root;if(event.dataDirectory)dataDirectory=event.dataDirectory;observe(event);},
    get root(){return root;},get dataDirectory(){return dataDirectory;},stages};
}

test('the synthetic demo publishes twenty owned sources and code facts, then releases ownership while retaining data',async t=>{
  const state=owned(t),demo=await prepareDemo({Catalog,CatalogStore,CodeAnalysis},{onProgress:state.onProgress});
  assert.equal(demo.sourceCount,20);assert.equal(demo.build.coverage.indexed,79);assert.equal(demo.build.coverage.excluded,60);
  assert.equal(demo.inventory.candidates,21);assert.equal(demo.inventory.counts.parsed,21);assert.equal(demo.inventory.filesWithGaps,6);assert.equal(demo.inventory.gaps,7);
  assert.deepEqual(JSON.parse(await readFile(path.join(state.root,'demo.json'),'utf8')),demo);
  const store=new CatalogStore(state.dataDirectory),catalog=new Catalog(store),analysis=new CodeAnalysis(catalog);
  try {
    const sources=catalog.state().sources;assert.equal(sources.length,20);
    for(const source of sources)assert.ok(source.path.startsWith(path.join(state.root,'sources')+path.sep));
    assert.equal(store.all('SELECT id FROM builds').length,1);assert.equal(analysis.list().length,1);assert.equal(analysis.list()[0]!.id,demo.inventory.id);
    const found=await lookupCodeSymbols(analysis,'StockProjection.accept',demo.build.id);
    assert.equal(found.matches.length,1);assert.equal(found.matches[0]!.qualifiedName,'synthetic.stock.StockProjection.accept');
    const original=catalog.evidence(found.matches[0]!.evidence[0]!.id);assert.equal(original.sourceName,'inventory-worker');
    assert.equal(original.buildId,demo.build.id);assert.equal(store.all('SELECT id FROM answer_attempts').length,0);
  } finally {await analysis.stop();await catalog.stop();store.close();}
  await access(path.join(state.root,'sources/portal/.git'));await access(path.join(state.dataDirectory,'loredock.db'));
});

test('an unpublished demo index is retained without analysis or automatic retry',async t=>{
  class LimitedCatalog extends Catalog {constructor(store:CatalogStore){super(store,undefined,{wallMs:0});}}
  const state=owned(t);
  await assert.rejects(prepareDemo({Catalog:LimitedCatalog,CatalogStore,CodeAnalysis},{onProgress:state.onProgress}),/demo index is incomplete/);
  assert.equal(state.stages.filter(stage=>stage==='indexing').length,1);assert.ok(!state.stages.includes('analyzing'));
  const store=new CatalogStore(state.dataDirectory);
  try {assert.equal(store.all('SELECT id FROM builds').length,1);assert.equal(store.all('SELECT id FROM code_analyses').length,0);}
  finally {store.close();}
  await access(path.join(state.root,'sources/order-api/.git'));
});

test('interrupted demo preparation stops owned indexing, retains its roots and releases the store',async t=>{
  const controller=new AbortController(),state=owned(t,event=>{if(event.stage==='indexing')controller.abort();});
  await assert.rejects(prepareDemo({Catalog,CatalogStore,CodeAnalysis},{onProgress:state.onProgress,signal:controller.signal}),{name:'AbortError'});
  assert.ok(!state.stages.includes('analyzing'));const store=new CatalogStore(state.dataDirectory);
  try {assert.deepEqual(store.all<{status:string}>('SELECT status FROM builds').map(row=>row.status),['interrupted']);assert.equal(store.all('SELECT id FROM code_analyses').length,0);}
  finally {store.close();}
  await access(path.join(state.root,'sources/order-worker/.git'));
});

test('early cancellation retains the printed data directory even before the first store opens',async t=>{
  const controller=new AbortController(),state=owned(t,event=>{if(event.stage==='created')controller.abort();});
  await assert.rejects(prepareDemo({Catalog,CatalogStore,CodeAnalysis},{onProgress:state.onProgress,signal:controller.signal}),{name:'AbortError'});
  assert.deepEqual(state.stages,['created']);await access(state.dataDirectory);
  await assert.rejects(access(path.join(state.dataDirectory,'loredock.db')),{code:'ENOENT'});
});

test('incomplete demo analysis is reported once and retained instead of announcing a ready project',async t=>{
  class LimitedAnalysis extends CodeAnalysis {constructor(catalog:Catalog){super(catalog,{documents:0});}}
  const state=owned(t);
  await assert.rejects(prepareDemo({Catalog,CatalogStore,CodeAnalysis:LimitedAnalysis},{onProgress:state.onProgress}),/demo code inventory is incomplete/);
  assert.equal(state.stages.filter(stage=>stage==='analyzing').length,1);const store=new CatalogStore(state.dataDirectory);
  try {assert.equal(store.all('SELECT id FROM builds').length,1);assert.equal(store.all('SELECT id FROM code_analyses').length,1);assert.equal(store.all('SELECT id FROM answer_attempts').length,0);}
  finally {store.close();}
  await assert.rejects(access(path.join(state.root,'demo.json')),{code:'ENOENT'});
});
