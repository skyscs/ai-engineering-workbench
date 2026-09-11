import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createReleaseFixture, releaseSnapshot } from '../release-fixtures.mjs';

for (const kind of ['single','interaction','revision']) test(`release fixture ${kind} reproduces its known defect with unchanged history`,async()=>{
  const f=await createReleaseFixture(kind), before=await releaseSnapshot(f);
  try {
    const module=async(r,file)=>import(pathToFileURL(path.join(f.repositories[r].source,file)).href);
    const historical=async(r,file,index)=>import('data:text/javascript,'+encodeURIComponent(execFileSync('git',['show',`${f.repositories[r].commits[index].sha}:${file}`],{cwd:f.repositories[r].source,encoding:'utf8'})));
    if(kind==='single') {
      assert.equal((await module(0,'price.mjs')).discountedTotal(1999,15),1700);
      assert.equal((await historical(0,'price.mjs',0)).discountedTotal(1999,15),1699);
    } else if(kind==='interaction') {
      const client=await module(0,'retry.mjs');
      assert.equal(client.retryOptions((await module(1,'config.mjs')).config).delayMs,2);
      assert.equal(client.retryOptions((await historical(1,'config.mjs',0)).config).delayMs,2000);
    } else {
      const current=await module(0,'cache.mjs'), old=await historical(0,'cache.mjs',0), load=tenant=>tenant==='alpha'?'Alpha kettle':'Beta lamp';
      assert.equal(current.title('alpha','42',load),'Alpha kettle'); assert.equal(current.title('beta','42',load),'Alpha kettle');
      assert.equal(old.title('alpha','42',load),'Alpha kettle'); assert.equal(old.title('beta','42',load),'Beta lamp');
      assert.equal((await module(0,'view.mjs')).display('Beta lamp',false),'Beta lamp');
    }
    assert.deepEqual(await releaseSnapshot(f),before);
  } finally {await rm(f.root,{recursive:true,force:true});}
});
