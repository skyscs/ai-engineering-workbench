import assert from 'node:assert/strict';
import {mkdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {test} from 'node:test';
import {Catalog} from '../src/catalog.js';
import {CatalogStore} from '../src/store.js';
import {projectOrientation,orientationLimits} from '../src/orientation.js';
// @ts-expect-error Synthetic fixture helpers intentionally use plain JavaScript.
import {createScaleFixture,scaleGit} from '../../../scripts/loredock-scale-fixture.mjs';

test('linked reading shares remaining slots in source rounds and never displaces twenty full-budget READMEs',async t=>{
  const fixture=await createScaleFixture() as {root:string;manifest:{sources:{id:string}[]}},sources=fixture.manifest.sources;
  let store:CatalogStore|undefined,catalog:Catalog|undefined;
  t.after(async()=>{await catalog?.stop();store?.close();await rm(fixture.root,{recursive:true,force:true});});
  const readme=(id:string)=>`# ${id}\nOriginal repository context.\n\n[Architecture](docs/architecture.md) [Terms](docs/terms.md) [Setup](docs/setup.md)\n`;
  const commit=(id:string)=>{scaleGit(fixture.root,id,['add','--all']);scaleGit(fixture.root,id,['commit','-qm','Update owned linked-reading documents']);};
  for(const {id} of sources){
    const directory=path.join(fixture.root,'sources',id);await mkdir(path.join(directory,'docs'),{recursive:true});
    await writeFile(path.join(directory,'README.md'),readme(id));
    for(const name of ['architecture','terms','setup'])await writeFile(path.join(directory,'docs',name+'.md'),`# ${name}\nOriginal ${id} documentation.\n`);
    commit(id);
  }
  store=new CatalogStore(path.join(fixture.root,'data'));catalog=new Catalog(store);
  for(const {id} of sources)await catalog.addSource(path.join(fixture.root,'sources',id));
  const index=async(request:string)=>{const state=catalog!.state();catalog!.start(request,state.sourceSetVersion,state.policyVersion);await catalog!.idle();};
  await index('linked-rounds');const value=projectOrientation(catalog);
  assert.equal(value.coverage.repositories,20);assert.equal(value.coverage.withContext,20);assert.equal(value.coverage.examinedDocuments,60);
  assert.equal(value.sources.flatMap(source=>source.reading).filter(row=>row.kind==='manifest').length,15);
  assert.deepEqual([0,1,2].map(round=>value.sources.filter(source=>source.linkedDocuments[round]!.state==='available').length),[20,5,0]);
  assert.ok(value.sources.slice(5).every(source=>source.linkedDocuments[1]!.state==='limited'));
  assert.ok(Buffer.byteLength(JSON.stringify(value))<=orientationLimits.outputBytes);
  const first=value.buildId;
  for(const {id} of sources){const prefix=readme(id);await writeFile(path.join(fixture.root,'sources',id,'README.md'),prefix+'x'.repeat(orientationLimits.fileBytes-Buffer.byteLength(prefix)));commit(id);}
  await index('linked-full-budget');const full=projectOrientation(catalog);
  assert.equal(full.coverage.withContext,20);assert.equal(full.coverage.parsedBytes,orientationLimits.textBytes);assert.equal(full.coverage.examinedDocuments,20);
  assert.ok(full.sources.every(source=>source.linkedDocuments.every(document=>document.state==='limited')));
  assert.equal(Object.values(full.evidence).some(ref=>ref.path.startsWith('docs/')),false);
  assert.equal(full.omissions['input-byte-limit'],75);
  const historical=projectOrientation(catalog,first);assert.deepEqual(historical.sources,value.sources);
});
