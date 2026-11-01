import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {CatalogStore} from '../apps/loredock/dist/store.js';
import {Catalog} from '../apps/loredock/dist/catalog.js';
import {CodeAnalysis} from '../apps/loredock/dist/code-analysis.js';
import {retrieveAnswerContext} from '../apps/loredock/dist/answer-context.js';
import {prepareDemo} from './loredock-demo.mjs';
import {auditStorage} from './loredock-storage.mjs';
import {literalIndexSnapshot} from './loredock-search-control-study.mjs';
import {scaleGit} from './loredock-scale-fixture.mjs';
import {storageQueries} from '../fixtures/loredock-search-storage/cases.mjs';

const [output, legacyRoot] = process.argv.slice(2), repo = fileURLToPath(new URL('../', import.meta.url));
assert.ok(output && legacyRoot && path.isAbsolute(output) && path.isAbsolute(legacyRoot), 'Use absolute output and pinned legacy checkout directories.');
const git = (cwd, args) => execFileSync('git', ['-C',cwd,...args], {encoding: 'utf8'}).trim();
const legacyCommit = git(legacyRoot, ['rev-parse','HEAD']);
assert.equal(legacyCommit, '753d134d16c38c870ec365b8835145b24a641d18');
assert.equal(git(legacyRoot, ['status','--porcelain','--untracked-files=no']), '');
assert.equal(git(repo, ['status','--porcelain','--untracked-files=no']), '', 'Commit the implementation before this smoke.');
const legacy = {};
for (const name of ['store','catalog','code-analysis','answer-context']) Object.assign(legacy, await import(pathToFileURL(path.join(legacyRoot, 'apps/loredock/dist', `${name}.js`))));
const hash = value => createHash('sha256').update(value).digest('hex');
const implementation = {};
for (const [name, root] of [['legacy',legacyRoot],['current',repo]]) {
  implementation[name] = {};
  for (const file of (await readdir(path.join(root,'apps/loredock/dist'))).filter(file => file.endsWith('.js')).sort()) {
    implementation[name][file] = hash(await readFile(path.join(root,'apps/loredock/dist',file)));
  }
}
function readQueries(catalog, builds, retrieve) {
  return builds.flatMap(buildId => storageQueries.map(query => {
    const terms = query.trim().split(/\s+/).slice(0,20).map(term => '"'+term.replaceAll('"','""')+'"').join(' AND ');
    return {buildId, query, literal: catalog.search(query,buildId), context: retrieve(catalog,query,buildId),
      scores: catalog.store.all(`SELECT search.rowid,search.spanId,rank,snippet(search,1,'','','…',24) AS snippet
        FROM search JOIN spans s ON s.id=search.spanId JOIN files f ON f.id=s.fileId
        WHERE search MATCH ? AND f.buildId=? ORDER BY rank,search.rowid`, terms, buildId)};
  }));
}
let root, store, catalog, analysis;
const close = async () => {if (store) {await analysis?.stop(); await catalog?.stop(); store.close(); store = undefined;}};
try {
  await mkdir(output, {recursive: true});
  const demo = await prepareDemo(legacy, {onProgress: event => {if (event.root) root = event.root;}});
  store = new legacy.CatalogStore(demo.dataDirectory); catalog = new legacy.Catalog(store); analysis = new legacy.CodeAnalysis(catalog);
  assert.equal(store.one('PRAGMA user_version').user_version, 8);
  const sources = store.sources().map(source => source.name), sourceState = () => sources.map(source => ({source,
    head: scaleGit(root,source,['rev-parse','HEAD']), status: scaleGit(root,source,['status','--porcelain'])}));
  const sourceBefore = sourceState(), project = store.project(), second = catalog.start('refresh',project.sourceSetVersion,project.policyVersion);
  await catalog.idle(); assert.equal(store.build(second.id).coverage.indexed,79);
  const code = analysis.start('refresh-code',second.id); await analysis.idle(); assert.equal(analysis.get(code.id).counts.parsed,21);
  store.db.exec("INSERT INTO search(search,rank) VALUES('rank','bm25(0.0, 2.0)'); INSERT INTO search(search,rank) VALUES('automerge',0)");
  const builds = [demo.build.id,second.id], before = literalIndexSnapshot(store), queries = readQueries(catalog,builds,legacy.retrieveAnswerContext);
  const inventory = analysis.get(code.id), auditBefore = auditStorage(demo.dataDirectory);
  await close();
  store = new CatalogStore(demo.dataDirectory); catalog = new Catalog(store); analysis = new CodeAnalysis(catalog);
  assert.equal(store.one('PRAGMA user_version').user_version,9);
  const after = literalIndexSnapshot(store), preserved = {};
  for (const key of ['vocabulary','documents','documentSizes','totals','nonLiteralRecords']) {
    assert.deepEqual(after[key],before[key],key); preserved[key] = {equal: true, sha256: hash(JSON.stringify(after[key]))};
  }
  assert.deepEqual(readQueries(catalog,builds,retrieveAnswerContext),queries); assert.deepEqual(analysis.get(code.id),inventory);
  const auditMigrated = auditStorage(demo.dataDirectory); assert.equal(auditMigrated.payloads.literalSearch.copiedTextBytes,0);
  await close();
  const command = ['--silent','loredock:compact','--data-dir',demo.dataDirectory];
  const compaction = JSON.parse(execFileSync('pnpm',command,{cwd:repo,encoding:'utf8'}));
  assert.equal(compaction.after.databaseVersion,9); assert.equal(compaction.after.sqlite.freePages,0);
  store = new CatalogStore(demo.dataDirectory); catalog = new Catalog(store); analysis = new CodeAnalysis(catalog);
  assert.deepEqual(readQueries(catalog,builds,retrieveAnswerContext),queries); assert.deepEqual(analysis.get(code.id),inventory);
  const state = catalog.state(), refresh = catalog.start('after-migration',state.sourceSetVersion,state.policyVersion);
  await catalog.idle(); const refreshed = store.build(refresh.id); assert.equal(refreshed.refresh.reusedFiles,79);
  catalog.revoke(store.sources().find(source => source.name==='portal').id);
  store.db.exec("INSERT INTO search(search,rank) VALUES('integrity-check',1)");
  assert.equal(store.one('SELECT count(*) AS n FROM literal_search_documents').n,store.one('SELECT count(*) AS n FROM spans').n);
  assert.deepEqual(store.all('PRAGMA foreign_key_check'),[]); assert.deepEqual(sourceState(),sourceBefore);
  const result = {schemaVersion:'loredock-search-migration-smoke/1',checkedAt:new Date().toISOString(),commit:git(repo,['rev-parse','HEAD']),legacyCommit,
    node:process.version,sqliteVersion:store.one('SELECT sqlite_version() AS version').version,implementation,
    sources:20,indexedFilesPerBuild:79,codeFiles:21,modelRequests:0,sourceCheckoutsUnchanged:true,
    preserved,tokenInstances:before.vocabulary.length,documents:before.documents.length,queryComparisons:queries.length*2,
    savedInventoryPreserved:true,refreshReused:refreshed.refresh.reusedFiles,purgeIntegrityPassed:true,
    before:auditBefore,migrated:auditMigrated,compaction};
  await writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({passed:true,output,queries:result.queryComparisons,tokens:result.tokenInstances,
    before:auditBefore.sqlite.allocatedBytes,after:compaction.after.sqlite.allocatedBytes,reclaimed:compaction.reclaimedSqliteBytes}));
} finally {await close(); if(root) await rm(root,{recursive:true,force:true});}
