import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { interfaceRepositories } from '../fixtures/loredock-interfaces/corpus.mjs';
import { interfaceContract } from '../fixtures/loredock-interfaces/cases.mjs';
import { digest } from './loredock-fixture.mjs';

export const interfaceRepositoryIds = Object.keys(interfaceRepositories);
export function interfaceGit(root, id, args, trim = true) {
  assert.ok(interfaceRepositoryIds.includes(id), 'Unknown interface-fixture repository.');
  const output = execFileSync('git', ['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',
    '-c','commit.gpgsign=false','-c','core.autocrlf=false','-c','user.name=LoreDock Fixture',
    '-c','user.email=fixture@example.invalid',...args], {
    cwd:path.join(root,'sources',id),encoding:'utf8',timeout:10000,
    env:{PATH:process.env.PATH,HOME:root,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_ATTR_NOSYSTEM:'1',LC_ALL:'C',
      GIT_AUTHOR_DATE:'2026-03-01T00:00:00Z',GIT_COMMITTER_DATE:'2026-03-01T00:00:00Z'},
  });
  return trim ? output.trimEnd() : output;
}

export async function createInterfaceFixture() {
  const root = await mkdtemp(path.join(tmpdir(),'loredock-interface-fixture-'));
  try {
    await mkdir(path.join(root,'empty-template'));
    await mkdir(path.join(root,'outside')); await writeFile(path.join(root,'outside/canary.txt'),'SYNTHETIC_OUTSIDE_READ_CANARY\n');
    const sources=[],evidence=[],allowedPaths={};
    for (const [id,spec] of Object.entries(interfaceRepositories)) {
      const directory=path.join(root,'sources',id); await mkdir(directory,{recursive:true});
      interfaceGit(root,id,['init','--quiet','--object-format=sha1','--initial-branch=main',`--template=${path.join(root,'empty-template')}`]);
      for (const [relative,content] of Object.entries(spec.files)) {
        assert.ok(!path.isAbsolute(relative) && !relative.split('/').includes('..'));
        const target=path.join(directory,relative); await mkdir(path.dirname(target),{recursive:true}); await writeFile(target,content);
      }
      await writeFile(path.join(directory,'.env'),'SYNTHETIC_EXCLUDED_VALUE=not-a-credential\n');
      await writeFile(path.join(directory,'opaque.bin'),Buffer.from([0,255,0,1]));
      await symlink('../../outside/canary.txt',path.join(directory,'outside-link'));
      interfaceGit(root,id,['add','--all']); interfaceGit(root,id,['commit','--quiet','-m','Add prospective freight interface sources']);
      const revision=interfaceGit(root,id,['rev-parse','HEAD']);
      sources.push({id,kind:'git',revision,objectFormat:'sha1',refLabel:'main',excluded:[
        {path:'.env',reason:'policy'},{path:'opaque.bin',reason:'binary'},{path:'outside-link',reason:'symlink'},
      ]}); allowedPaths[id]=Object.keys(spec.files);
      for (const [relative,content] of Object.entries(spec.files)) evidence.push({id:`${id}/${relative}`,sourceId:id,revision,path:relative,
        blobId:interfaceGit(root,id,['rev-parse',`${revision}:${relative}`]),startLine:1,endLine:content.trimEnd().split('\n').length,contentHash:digest(content)});
    }
    const manifest={schemaVersion:'loredock-interface-fixture/1',projectId:'synthetic-freight-interfaces',environment:'mixed-declarations',deploymentCoherence:'unknown',
      sources,revisionVector:Object.fromEntries(sources.map(source=>[source.id,source.revision])),
      policy:{version:'interface-fixture-policy/1',sourceMode:'committed-only',modelExecution:'disabled',executeSourceCommands:false,followSymlinks:false,allowedPaths},
      coverage:{eligibleFiles:evidence.length,excludedFiles:sources.length*3,extractedFiles:0,reason:'Fixture generation is not production ingestion.'},evidence};
    await writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    // Reviewer text is outside every registered source root.
    await writeFile(path.join(root,'oracle.json'),JSON.stringify(interfaceContract,null,2)+'\n');
    return {root,manifest,oracle:interfaceContract};
  } catch(error) {await rm(root,{recursive:true,force:true});throw error;}
}

export function interfaceBaseline(fixture) {
  return {schemaVersion:'loredock-interface-baseline/1',sourceCount:fixture.manifest.sources.length,eligibleFiles:fixture.manifest.evidence.length,
    revisionVector:fixture.manifest.revisionVector,manifestHash:digest(JSON.stringify(fixture.manifest)),contractHash:digest(JSON.stringify(interfaceContract))};
}
if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  const fixture=await createInterfaceFixture();console.log(JSON.stringify({root:fixture.root,baseline:interfaceBaseline(fixture)},null,2));
}
