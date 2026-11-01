import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFile, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {isDeepStrictEqual} from 'node:util';
import {externalSearchStore, searchStorageAllocation} from './loredock-external-search-prototype.mjs';
import {createCapacityFixture} from './loredock-capacity-fixture.mjs';
import {scaleGit} from './loredock-scale-fixture.mjs';
import {storageQueries} from '../fixtures/loredock-search-storage/cases.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const variants = ['unchanged','rebuilt','external'], stages = ['measured','reopened'];
const json = value => JSON.stringify(value, null, 2) + '\n';
const hash = value => createHash('sha256').update(value).digest('hex');
export async function verifySearchControlContract({implementation = false} = {}) {
  const contract = JSON.parse(await readFile(path.join(root, 'fixtures/loredock-search-control/baseline.json'), 'utf8'));
  for (const [file,digest] of Object.entries(contract.hashes)) {
    if (!implementation && (file.startsWith('apps/') || file === 'pnpm-lock.yaml')) continue;
    assert.equal(hash(await readFile(path.join(root, file))), digest, `Frozen rebuild-control input changed: ${file}`);
  }
  return contract;
}
function nonLiteralRecords(store) {
  return store.all("SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .filter(row => row.name !== 'search' && !row.name.startsWith('search_') && !row.name.startsWith('literal_search_')).map(row => {
      const table = `"${row.name.replaceAll('"','""')}"`, digest = createHash('sha256'); let count = 0;
      const order = /WITHOUT ROWID/i.test(row.sql) ? store.all(`PRAGMA table_info(${table})`).filter(column => column.pk)
        .sort((a,b) => a.pk-b.pk).map(column => `"${column.name.replaceAll('"','""')}"`).join(',') : 'rowid';
      for (const record of store.db.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).iterate()) {digest.update(JSON.stringify(record) + '\n'); count++;}
      return {table: row.name, count, sha256: digest.digest('hex')};
    });
}
export function literalIndexSnapshot(store) {
  store.db.exec("INSERT INTO search(search,rank) VALUES('integrity-check',1)");
  store.db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS temp.literal_control_vocabulary USING fts5vocab(main,'search','instance')");
  const vocabulary = store.all('SELECT term,doc,col,offset FROM temp.literal_control_vocabulary ORDER BY term COLLATE BINARY,doc,col,offset')
    .map(row => [row.term,row.doc,row.col,row.offset]);
  const documents = store.all('SELECT rowid,spanId,CAST(text AS BLOB) AS bytes FROM search ORDER BY rowid').map(row => [row.rowid,row.spanId,hash(row.bytes)]);
  const documentSizes = store.all('SELECT id,hex(sz) AS size FROM search_docsize ORDER BY id').map(row => [row.id,row.size]);
  const totals = store.one('SELECT hex(block) AS value FROM search_data WHERE id=1').value;
  const components = store.all(`SELECT coalesce(s.tbl_name,d.name) AS tableName,sum(d.pgsize) AS bytes FROM dbstat d
    LEFT JOIN sqlite_schema s ON s.name=d.name GROUP BY coalesce(s.tbl_name,d.name) ORDER BY tableName`);
  return {vocabulary, documents, documentSizes, totals, nonLiteralRecords: nonLiteralRecords(store),
    allocation: {...searchStorageAllocation(store), components}};
}
function ranked(store, table, expression, buildId) {
  if (!expression) return [];
  const snippet = table === 'search' ? ",snippet(search,1,'','','…',24) AS snippet" : '';
  return store.all(`SELECT ${table}.rowid,${table}.spanId,rank${snippet} FROM ${table}
    JOIN spans s ON s.id=${table}.spanId JOIN files f ON f.id=s.fileId JOIN sources src ON src.id=f.sourceId
    WHERE ${table} MATCH ? AND f.buildId=? AND f.status='indexed' AND src.status='active' ORDER BY rank,${table}.rowid`, expression, buildId);
}
export function assessSearchControl(result) {
  const checks = [], queryChecks = [];
  const validQuery = row => {
    const value = row.result, context = value?.context;
    if (!value || !context || !Array.isArray(value.literal?.hits) || !Array.isArray(value.scores)
      || !Array.isArray(value.questionScores) || !Array.isArray(context.spans)) return false;
    const {inputHash, ...contents} = context;
    return value.literal.buildId === row.buildId && context.buildId === row.buildId && context.question === row.query
      && inputHash === hash(JSON.stringify(contents));
  };
  const shape = isDeepStrictEqual(result.stages.map(stage => stage.name), stages) && result.builds.length === 2 && result.expectedSpanCount > 0;
  for (const stage of result.stages) {
    const reference = stage.variants.unchanged;
    if (!reference) continue;
    checks.push({stage: stage.name, check: 'variant set', passed: isDeepStrictEqual(Object.keys(stage.variants), variants)});
    for (const variant of variants) {
      const value = stage.variants[variant]; if (!value) continue;
      checks.push({stage: stage.name, variant, check: 'complete documents and queries', passed: value.documents.length === result.expectedSpanCount
        && value.documentSizes.length === result.expectedSpanCount && value.vocabulary.length > 0
        && value.queries.every(validQuery)
        && isDeepStrictEqual(value.queries.map(row => [row.buildId,row.query]), result.builds.flatMap(buildId => storageQueries.map(query => [buildId,query])))});
      if (variant === 'unchanged') continue;
      for (const key of ['vocabulary','documents','documentSizes','totals','nonLiteralRecords']) {
        checks.push({stage: stage.name, variant, check: key, passed: isDeepStrictEqual(reference[key], value[key])});
      }
      for (let index = 0; index < reference.queries.length; index++) {
        const expected = reference.queries[index], actual = value.queries[index];
        queryChecks.push({stage: stage.name, variant, buildId: expected.buildId, query: expected.query,
          passed: Boolean(actual && isDeepStrictEqual(expected.result, actual.result))});
      }
    }
  }
  const first = result.stages.find(stage => stage.name === 'measured'), reopened = result.stages.find(stage => stage.name === 'reopened');
  if (first && reopened) for (const variant of variants) {
    const before = first.variants[variant], after = reopened.variants[variant];
    checks.push({variant, check: 'restart preserves measured records', passed: Boolean(before && after
      && ['vocabulary','documents','documentSizes','totals','nonLiteralRecords','queries'].every(key => isDeepStrictEqual(before[key], after[key])))});
  }
  const measured = result.stages.find(stage => stage.name === 'measured')?.variants;
  const rebuilt = measured?.rebuilt?.allocation, external = measured?.external?.allocation;
  const literalRatio = rebuilt && external ? external.literalBytes / rebuilt.literalBytes : null;
  const totalRatio = rebuilt && external ? external.totalBytes / rebuilt.totalBytes : null;
  const mechanical = shape && !result.error && queryChecks.length === 112 && queryChecks.every(check => check.passed)
    && checks.length === 31 && checks.every(check => check.passed);
  return {schemaVersion: 'loredock-search-control-summary/1', queryComparisons: queryChecks.length,
    equalQueryComparisons: queryChecks.filter(check => check.passed).length, checks: checks.length,
    failures: [...checks,...queryChecks].filter(check => !check.passed), mechanical, literalRatio, totalRatio,
    passed: Boolean(mechanical && rebuilt && external && variants.every(name => measured[name].allocation.freePages === 0)
      && Number.isFinite(literalRatio) && Number.isFinite(totalRatio) && literalRatio > 0 && totalRatio > 0
      && literalRatio <= .90 && totalRatio <= .95)};
}

export async function compareSearchControl(services, fixture, {expectedFiles, expectedCodeFiles, checkpoint = async () => {}}) {
  const {CatalogStore, Catalog, CodeAnalysis, retrieveAnswerContext, questionTerms} = services, CandidateStore = externalSearchStore(CatalogStore);
  const directories = Object.fromEntries(variants.map(name => [name, path.join(fixture.root, `control-${name}`)]));
  const result = {schemaVersion: 'loredock-search-control-study/1', expectedFiles, expectedCodeFiles, expectedSpanCount: 0, modelRequests: 0,
    builds: [], stages: [], preparationMs: {}};
  let preparer, analysis; const catalogs = {};
  const closeVariants = async () => {for (const name of variants) {const catalog = catalogs[name]; if (catalog) {await catalog.stop(); catalog.store.close(); delete catalogs[name];}}};
  try {
    preparer = new Catalog(new CatalogStore(directories.unchanged));
    result.sqliteVersion = preparer.store.one('SELECT sqlite_version() AS version').version;
    for (const source of fixture.manifest.sources) await preparer.addSource(path.join(fixture.root, 'sources', source.id));
    for (const requestId of ['first','second']) {
      const project = preparer.store.project(), build = preparer.start(requestId, project.sourceSetVersion, project.policyVersion); await preparer.idle();
      assert.ok(preparer.store.build(build.id).published); assert.equal(preparer.store.build(build.id).coverage.indexed, expectedFiles); result.builds.push(build.id);
    }
    analysis = new CodeAnalysis(preparer); const inventory = analysis.start('code', result.builds[1]); await analysis.idle();
    assert.equal(analysis.get(inventory.id).counts.parsed, expectedCodeFiles);
    result.expectedSpanCount = preparer.store.one('SELECT count(*) AS n FROM spans').n;
    await analysis.stop(); analysis = undefined; await preparer.stop(); preparer.store.close(); preparer = undefined;
    for (const name of ['rebuilt','external']) {await mkdir(directories[name]); await copyFile(path.join(directories.unchanged, 'loredock.db'), path.join(directories[name], 'loredock.db'));}
    for (const name of variants) {
      const started = performance.now(); catalogs[name] = new Catalog(new (name === 'external' ? CandidateStore : CatalogStore)(directories[name]));
      if (name === 'rebuilt') catalogs[name].store.db.exec("INSERT INTO search(search) VALUES('rebuild')");
      result.preparationMs[name] = performance.now() - started; catalogs[name].store.db.exec('VACUUM');
    }
    for (const name of stages) {
      const stage = {name, variants: {}}; result.stages.push(stage);
      for (const variant of variants) {
        const catalog = catalogs[variant], snapshot = literalIndexSnapshot(catalog.store), queries = [];
        stage.variants[variant] = {...snapshot, queries};
        for (const buildId of result.builds) for (const query of storageQueries) {
          const expression = query.trim().split(/\s+/).slice(0,20).map(term => '"'+term.replaceAll('"','""')+'"').join(' AND ');
          const questionExpression = questionTerms(query).map(term => '"'+term+'"').join(' OR ');
          queries.push({buildId, query, result: {literal: catalog.search(query, buildId), scores: ranked(catalog.store, 'search', expression, buildId),
            questionScores: ranked(catalog.store, 'question_search', questionExpression, buildId), context: retrieveAnswerContext(catalog, query, buildId)}});
        }
      }
      await checkpoint(result); await closeVariants();
      if (name === 'measured') for (const variant of variants) catalogs[variant] = new Catalog(new (variant === 'external' ? CandidateStore : CatalogStore)(directories[variant]));
    }
    result.summary = assessSearchControl(result); await checkpoint(result);
  } catch (error) {result.error = {code: error.code ?? null, message: error.message}; result.summary = assessSearchControl(result); await checkpoint(result);}
  finally {await analysis?.stop(); await preparer?.stop(); preparer?.store.close(); await closeVariants();}
  return result;
}

async function main() {
  assert.equal(process.argv.length, 3, 'Pass one absolute output directory. User data directories are not accepted.');
  const output = process.argv[2]; assert.ok(path.isAbsolute(output)); const frozen = await verifySearchControlContract({implementation: true});
  assert.equal(execFileSync('git', ['status','--porcelain'], {cwd: root, encoding: 'utf8'}).trim(), '', 'Commit implementation before measurement.');
  const commit = execFileSync('git', ['rev-parse','HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  await mkdir(output, {recursive: true}); await mkdir(path.join(root, '.loredock-evaluations'), {recursive: true});
  await writeFile(path.join(root, '.loredock-evaluations/task054-search-control.json'), json({commit, output, startedAt: new Date().toISOString()}), {flag: 'wx'});
  const modules = await Promise.all(['store','catalog','code-analysis','answer-context'].map(name => import(pathToFileURL(path.join(root, `apps/loredock/dist/${name}.js`)))));
  const services = Object.assign({}, ...modules), fixture = await createCapacityFixture(frozen.filesPerSource);
  try {
    const implementation = {};
    for (const file of ['scripts/loredock-search-control-study.mjs', 'scripts/loredock-external-search-prototype.mjs',
      ...(await readdir(path.join(root, 'apps/loredock/dist'))).filter(name => name.endsWith('.js')).map(name => `apps/loredock/dist/${name}`)]) implementation[file] = hash(await readFile(path.join(root, file)));
    const checkpoint = async result => writeFile(path.join(output, 'raw-result.json.gz'), gzipSync(json({frozen, commit, node: process.version, implementation, result})));
    const result = await compareSearchControl(services, fixture, {expectedFiles: frozen.eligibleFiles, expectedCodeFiles: frozen.codeFiles, checkpoint});
    for (const source of fixture.manifest.sources) {assert.equal(scaleGit(fixture.root, source.id, ['rev-parse','HEAD']), source.revision); assert.equal(scaleGit(fixture.root, source.id, ['status','--porcelain']), '');}
    result.sourceCheckoutsUnchanged = true; result.checkedAt = new Date().toISOString(); await checkpoint(result);
    await writeFile(path.join(output, 'summary.json'), json(result.summary)); console.log(json(result.summary)); if (!result.summary.passed) process.exitCode = 1;
  } finally {await rm(fixture.root, {recursive: true, force: true});}
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {console.error(error); process.exitCode = 1;});
