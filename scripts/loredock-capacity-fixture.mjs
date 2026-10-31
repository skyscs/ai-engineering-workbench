import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {createScaleFixture,scaleBaseline,scaleGit} from './loredock-scale-fixture.mjs';
import {digest} from './loredock-fixture.mjs';
import {capacityWorkload,capacityFile} from '../fixtures/loredock-capacity/workload.mjs';

// Smaller shapes are for normal CI only; the benchmark verifies the frozen full manifest.
export async function createCapacityFixture(filesPerSource = capacityWorkload.filesPerSource) {
  assert.ok(Number.isInteger(filesPerSource) && filesPerSource > 0 && filesPerSource <= capacityWorkload.filesPerSource);
  const base=await createScaleFixture(),{root}=base,parentBaseline=scaleBaseline(base);
  try {
    const manifest=structuredClone(base.manifest);
    manifest.schemaVersion='loredock-capacity-fixture/1';manifest.projectId='synthetic-commerce-capacity';
    manifest.workload={...capacityWorkload,filesPerSource};manifest.parentBaseline=parentBaseline;
    const probes=[];
    for(const [sourceIndex,source] of manifest.sources.entries()) {
      const originalRevision=source.revision, additions=[];
      await mkdir(path.join(root,'sources',source.id,capacityWorkload.directory));
      for(let fileIndex=0;fileIndex<filesPerSource;fileIndex++) {
        const file=capacityFile(sourceIndex,fileIndex);assert.equal(Buffer.byteLength(file.text),capacityWorkload.fileBytes);
        await writeFile(path.join(root,'sources',source.id,file.path),file.text);additions.push(file);
      }
      scaleGit(root,source.id,['add','--',capacityWorkload.directory]);
      scaleGit(root,source.id,['commit','-qm','Add deterministic synthetic capacity sources']);
      source.parentRevision=originalRevision;source.revision=scaleGit(root,source.id,['rev-parse','HEAD']);
      assert.equal(scaleGit(root,source.id,['rev-parse','HEAD^']),originalRevision);
      const tree=new Map(scaleGit(root,source.id,['ls-tree','-rz','--full-tree','HEAD'],false).split('\0').filter(Boolean).map(row=>{
        const [entry,file]=row.split('\t');return [file,entry.split(' ')[2]];
      }));
      for(const original of manifest.evidence.filter(ref=>ref.sourceId===source.id)) {
        const bytes=await readFile(path.join(root,'sources',source.id,original.path));
        assert.equal(digest(bytes),original.contentHash);assert.equal(tree.get(original.path),original.blobId);
        original.revision=source.revision;original.sizeBytes=bytes.length;
      }
      for(const file of additions) {
        const blobId=createHash('sha1').update(`blob ${Buffer.byteLength(file.text)}\0`).update(file.text).digest('hex');
        assert.equal(tree.get(file.path),blobId);
        manifest.evidence.push({id:`${source.id}/${file.path}`,sourceId:source.id,revision:source.revision,path:file.path,blobId,
          startLine:1,endLine:file.text.trimEnd().split('\n').length,contentHash:digest(file.text),sizeBytes:Buffer.byteLength(file.text)});
        manifest.policy.allowedPaths[source.id].push(file.path);
      }
      manifest.revisionVector[source.id]=source.revision;
      if(capacityWorkload.probeSources.includes(sourceIndex)) {
        const file=additions.at(-1);probes.push({id:`capacity-${sourceIndex}`,question:`Where is ${file.symbol} declared?`,
          requiredRepositories:[source.id],evidence:[`${source.id}/${file.path}`],maxCandidates:2});
      }
      assert.equal(scaleGit(root,source.id,['status','--porcelain=v1']),'');
    }
    manifest.coverage={...manifest.coverage,eligibleFiles:manifest.evidence.length,eligibleBytes:manifest.evidence.reduce((sum,ref)=>sum+ref.sizeBytes,0),
      reason:'Owned workload generation does not establish production index or semantic coverage.'};
    await writeFile(path.join(root,'capacity-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    await writeFile(path.join(root,'capacity-probes.json'),JSON.stringify(probes,null,2)+'\n');
    return {root,manifest,probes,parentBaseline};
  } catch(error) {await rm(root,{recursive:true,force:true});throw error;}
}

export function capacityBaseline(fixture) {
  return {schemaVersion:'loredock-capacity-baseline/1',sourceCount:fixture.manifest.sources.length,
    filesPerSource:fixture.manifest.workload.filesPerSource,fileBytes:fixture.manifest.workload.fileBytes,
    eligibleFiles:fixture.manifest.coverage.eligibleFiles,eligibleBytes:fixture.manifest.coverage.eligibleBytes,
    excludedFiles:fixture.manifest.coverage.excludedFiles,revisionVector:fixture.manifest.revisionVector,
    manifestHash:digest(JSON.stringify(fixture.manifest)),probesHash:digest(JSON.stringify(fixture.probes)),parentBaseline:fixture.parentBaseline};
}
