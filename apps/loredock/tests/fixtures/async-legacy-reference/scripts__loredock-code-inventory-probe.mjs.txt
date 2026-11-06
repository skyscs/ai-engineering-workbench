import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {createCapacityFixture,capacityBaseline} from './loredock-capacity-fixture.mjs';
import {verifyCapacityContract} from './loredock-capacity-benchmark.mjs';
import {scanCodeInventory,verifyCodeInventoryContract} from './loredock-code-inventory.mjs';
import {scaleGit} from './loredock-scale-fixture.mjs';
import {digest} from './loredock-fixture.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export function inspectInventoryCoverage(pass,code,declarations,probes) {
  const retained=pass.records.filter(row=>row.status==='parsed');
  const symbols=retained.flatMap(row=>row.facts.symbols.map(symbol=>({source:row.source,path:row.path,revision:row.revision,
    symbol:symbol.qualifiedName,role:symbol.role,range:row.ranges.symbols.find(range=>range.key===symbol.key),factsHash:row.factsHash})));
  const defaultSymbols=code.nodes.filter(node=>node.kind==='symbol');
  const missingDefaultSymbols=defaultSymbols.filter(node=>!symbols.some(symbol=>symbol.source===node.sourceName&&symbol.path===node.path&&symbol.symbol===node.label
    &&symbol.range.startLine===node.startLine&&symbol.range.endLine===node.endLine)).map(node=>({source:node.sourceName,path:node.path,symbol:node.label}));
  const exactSymbols=probes.map(probe=>{
    const expected=/loadProbe\d+/.exec(probe.question)?.[0];assert.ok(expected);
    const source=probe.requiredRepositories[0],file=probe.evidence[0].slice(source.length+1);
    return {id:probe.id,expected,source,path:file,found:symbols.some(symbol=>symbol.source===source&&symbol.path===file&&symbol.symbol===expected)};
  });
  const handlers=declarations.nodes.filter(node=>node.kind==='handler-reference').map(node=>{
    const matches=symbols.filter(symbol=>symbol.source===node.sourceName&&symbol.role==='java-method'&&symbol.symbol===node.label);
    return {source:node.sourceName,handler:node.label,syntaxMatches:matches,
      defaultSymbolPresent:defaultSymbols.some(symbol=>symbol.sourceName===node.sourceName&&symbol.label===node.label),
      interpretation:'Exact method-name syntax in this source only; route binding and runtime execution are unverified.'};
  });
  return {defaultSymbols:defaultSymbols.length,missingDefaultSymbols,exactSymbols,handlers,
    additionalUniqueHandlerSyntax:handlers.filter(row=>row.syntaxMatches.length===1&&!row.defaultSymbolPresent)};
}

export async function probeCodeInventory(services,outputDirectory) {
  const frozen=await verifyCodeInventoryContract(),capacity=await verifyCapacityContract();
  const files=['scripts/loredock-code-inventory.mjs','scripts/loredock-code-inventory-probe.mjs',
    'apps/loredock/dist/code-typescript.js','apps/loredock/dist/code-java.js','apps/loredock/dist/code-facts.js','apps/loredock/dist/http-headers.js',
    'apps/loredock/node_modules/typescript/lib/typescript.js'];
  const implementation={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,
    typescriptVersion:JSON.parse(await readFile(path.join(root,'apps/loredock/node_modules/typescript/package.json'),'utf8')).version,
    hashes:Object.fromEntries(await Promise.all(files.map(async file=>[file,digest(await readFile(path.join(root,file)))])))};
  await mkdir(outputDirectory);
  const checkpoint=(name,value)=>writeFile(path.join(outputDirectory,name+'.json'),JSON.stringify(value,null,2)+'\n');
  await checkpoint('contract',{frozen,implementation,startedAt:new Date().toISOString()});
  const fixture=await createCapacityFixture();let catalog,store;
  try {
    const actual=capacityBaseline(fixture);for(const key of Object.keys(actual))assert.deepEqual(actual[key],capacity[key]);
    store=new services.CatalogStore(path.join(fixture.root,'data'));catalog=new services.Catalog(store);
    const paths=fixture.manifest.sources.map(source=>path.join(fixture.root,'sources',source.id)),preview=await catalog.previewSources(paths);
    await catalog.registerSources({paths,previewHash:preview.previewHash,requestId:'code-inventory'});
    const state=catalog.state(),started=catalog.start('code-inventory',state.sourceSetVersion,state.policyVersion);
    const progress=setInterval(()=>process.stderr.write(`Initial index: ${catalog.store.build(started.id).coverage.indexed} files indexed.\n`),20000);
    try {await catalog.idle();} finally {clearInterval(progress);}
    const build=catalog.store.build(started.id);await checkpoint('index',{build,limits:state.limits});
    let measurement;
    if(build.published) {
      const code=services.codeFlows(catalog,build.id),declarations=services.declarationMap(catalog,build.id);assert.equal(code.adapterVersion,frozen.adapterVersion);
      assert.equal(code.limits.fileBytes,frozen.limits.fileBytes);assert.equal(code.limits.fileSpans,frozen.limits.fileSpans);
      const projection=value=>({version:value.adapterVersion,coverage:value.coverage,limits:value.limits,omissions:value.omissions,
        declarationOmissions:value.declarationOmissions??null,nodes:value.nodes.length,edges:value.edges.length,gaps:value.gaps});
      const defaultProjections={code:projection(code),declarations:projection(declarations)};
      await checkpoint('default-projections',defaultProjections);
      const passes=[],gitTexts=new Map();
      for(let index=1;index<=frozen.passes;index++) {
        const pass=await scanCodeInventory(services,catalog,fixture,frozen.parserFingerprint,{gitTexts,buildId:build.id,
          progress:({visited,total,elapsedMs})=>process.stderr.write(`Extraction pass ${index}: ${visited}/${total} candidates; ${Math.round(elapsedMs)} ms.\n`)});
        assert.equal(pass.records.length,code.coverage.candidateDocuments);
        pass.coverageCheck=inspectInventoryCoverage(pass,code,declarations,fixture.probes);
        passes.push(pass);await checkpoint(`pass-${index}`,pass);
        process.stderr.write(`Extraction pass ${index}: ${pass.summary.examined}/${pass.summary.candidates} examined; ${pass.summary.failed} failures.\n`);
      }
      const differences=passes[0].records.filter((row,index)=>!isDeepStrictEqual(row,passes[1].records[index])).map(row=>({source:row.source,path:row.path}));
      measurement={status:'available',defaultProjections,passes,repeatPass:{samePinnedIndex:true,cacheImplementation:false,changedRecords:differences,
        summaryUnchanged:isDeepStrictEqual(passes[0].summary,passes[1].summary)}};
    } else measurement={status:'unavailable',reason:'The single initial index did not publish. No resume/retry or parsing was attempted.'};
    assert.equal(store.one('SELECT count(*) count FROM answer_attempts').count,0);
    for(const source of fixture.manifest.sources)assert.equal(scaleGit(fixture.root,source.id,['status','--porcelain=v1']),'');
    const result={schemaVersion:'loredock-code-inventory-result/1',checkedAt:new Date().toISOString(),frozen,implementation,sourceBaseline:capacity,
      initialIndexAttempts:1,refreshAttempts:0,build,indexLimits:state.limits,measurement,sourceCheckoutsUnchanged:true,
      modelRequests:0,answerAttempts:0,productionChanged:false,semanticAcceptance:false,independentReview:'pending',
      limitation:'Simple synthetic source volume, not representative framework complexity. Full file examination does not prove complete parser understanding, runtime behavior or a working persistent analysis cache.'};
    await checkpoint('result',result);return result;
  } finally {await catalog?.stop();store?.close();await rm(fixture.root,{recursive:true,force:true});}
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  assert.equal(process.argv.length,3,'Usage: node scripts/loredock-code-inventory-probe.mjs NEW_OUTPUT_DIRECTORY');
  const modules=await Promise.all(['catalog','store','map-document','code-typescript','code-java','code-flows','system-map'].map(name=>import(`../apps/loredock/dist/${name}.js`)));
  console.log(JSON.stringify(await probeCodeInventory(Object.assign({},...modules),path.resolve(process.argv[2])),null,2));
}
