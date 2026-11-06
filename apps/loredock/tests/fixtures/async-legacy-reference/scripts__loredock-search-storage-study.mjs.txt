import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFile, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {isDeepStrictEqual} from 'node:util';
import {externalSearchStore, searchStorageAllocation, validateExternalSearch} from './loredock-external-search-prototype.mjs';
import {createCapacityFixture} from './loredock-capacity-fixture.mjs';
import {scaleGit} from './loredock-scale-fixture.mjs';
import {storageQueries, storageStages, storageGate} from '../fixtures/loredock-search-storage/cases.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const capture = fn => {try {return {value: fn()};} catch (error) {return {error: {code: error.code ?? null, message: error.message}};}};
export async function verifySearchStorageContract({implementation = false} = {}) {
  const baseline = JSON.parse(await readFile(path.join(root, 'fixtures/loredock-search-storage/baseline.json'), 'utf8'));
  for (const [file, digest] of Object.entries(baseline.hashes)) {
    if (!implementation && (file.startsWith('apps/') || file === 'pnpm-lock.yaml')) continue;
    assert.equal(hash(await readFile(path.join(root, file))), digest, `Frozen storage input changed: ${file}`);
  }
  const amendment = JSON.parse(await readFile(path.join(root, 'fixtures/loredock-search-storage/comparison-amendment.json'), 'utf8'));
  for (const [file, digest] of Object.entries(amendment.hashes)) assert.equal(hash(await readFile(path.join(root, file))), digest);
  return {baseline, amendment};
}

function identityMap(store, builds) {
  return Object.fromEntries(store.all(`SELECT s.id,f.buildId,f.sourceId,f.path,bs.revision,s.startLine,s.endLine,s.hash
    FROM spans s JOIN files f ON f.id=s.fileId JOIN build_sources bs ON bs.buildId=f.buildId AND bs.sourceId=f.sourceId`).map(row => {
    const {id,buildId,...identity} = row;
    return [id, JSON.stringify({generation: builds.indexOf(buildId), ...identity})];
  }));
}
export function comparableQuery(result, identities, exact) {
  if (exact) return result;
  const mapped = JSON.parse(JSON.stringify(result), (_key, value) => typeof value === 'string' && Object.hasOwn(identities, value) ? identities[value] : value);
  if (mapped.literal.value) mapped.literal.value.buildId = 'new-generation';
  if (mapped.context.value) {
    const context = mapped.context.value; delete context.inputHash; context.buildId = 'new-generation';
    for (const comparison of context.interfaces?.comparisons ?? []) {
      delete comparison.id;
      // These are unranked support sets, sorted by newly generated UUIDs in production.
      comparison.evidenceIds.sort();
    }
  }
  return mapped;
}
export function assessSearchStorage(result) {
  const differences = (left, right, prefix = '') => {
    if (isDeepStrictEqual(left, right)) return [];
    if (Array.isArray(left) !== Array.isArray(right)) return [prefix];
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return [prefix];
    return [...new Set([...Object.keys(left), ...Object.keys(right)])].flatMap(key => differences(left[key], right[key], prefix ? `${prefix}.${key}` : key)).slice(0,20);
  };
  const comparisons = result.stages.flatMap(stage => stage.queries.map(row => {
    const fields = differences(comparableQuery(row.baseline, stage.baselineIdentities, row.exact), comparableQuery(row.candidate, stage.candidateIdentities, row.exact));
    return {stage: stage.name, generation: row.generation, query: row.query, equal: fields.length === 0, fields};
  }));
  const measured = result.stages.find(stage => stage.name === 'converted')?.allocation;
  const literalRatio = measured ? measured.candidate.literalBytes / measured.baseline.literalBytes : null;
  const totalRatio = measured ? measured.candidate.totalBytes / measured.baseline.totalBytes : null;
  const expectedComparisons = result.queryCount * 13;
  const complete = result.queryCount === storageQueries.length && isDeepStrictEqual(result.stages.map(stage => stage.name), storageStages)
    && comparisons.length === expectedComparisons && result.stages.every((stage, index) => isDeepStrictEqual(
      stage.queries.map(row => [row.generation,row.query,row.exact]),
      Array.from({length: index < 2 ? 2 : 3}, (_, generation) => storageQueries.map(query => [generation,query,generation < 2])).flat()));
  const validResponses = result.stages.every(stage => stage.queries.every(row => [row.baseline,row.candidate].every(response =>
    ['literal','scores','questionScores','context'].every(key => Object.hasOwn(response[key], 'value')))));
  const mechanical = complete && validResponses && comparisons.every(row => row.equal) && result.lifecycle.length === 4
    && result.lifecycle.every(row => row.passed) && !result.error;
  return {schemaVersion: 'loredock-search-storage-summary/1', comparisons: comparisons.length, expectedComparisons,
    equalComparisons: comparisons.filter(row => row.equal).length, failures: comparisons.filter(row => !row.equal),
    mechanical, literalRatio, totalRatio, passed: Boolean(mechanical && measured
      && measured.baseline.freePages === 0 && measured.candidate.freePages === 0
      && Number.isFinite(literalRatio) && Number.isFinite(totalRatio) && literalRatio > 0 && totalRatio > 0
      && literalRatio <= 1 - storageGate.minimumLiteralSaving && totalRatio <= storageGate.maximumTotalRatio)};
}

function logicalRecords(store) {
  const tables = store.all("SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .filter(row => row.name !== 'search' && !row.name.startsWith('search_') && !row.name.startsWith('literal_search_'));
  return tables.map(row => {
    const table = `"${row.name.replaceAll('"','""')}"`;
    const order = /WITHOUT ROWID/i.test(row.sql) ? store.all(`PRAGMA table_info(${table})`).filter(column => column.pk)
      .sort((a,b) => a.pk-b.pk).map(column => `"${column.name.replaceAll('"','""')}"`).join(',') : 'rowid';
    return [row.name, store.all(`SELECT * FROM ${table} ORDER BY ${order}`)];
  });
}
function scoreRows(catalog, table, expression, buildId) {
  if (!expression) return [];
  const snippet = table === 'search' ? ",snippet(search,1,'','','…',24) AS snippet" : '';
  return catalog.store.all(`SELECT ${table}.rowid,${table}.spanId,rank${snippet} FROM ${table}
    JOIN spans s ON s.id=${table}.spanId JOIN files f ON f.id=s.fileId JOIN sources src ON src.id=f.sourceId
    WHERE ${table} MATCH ? AND f.buildId=? AND src.status='active' AND f.status='indexed' ORDER BY rank,${table}.rowid`, expression, buildId);
}

export async function compareSearchStorage(services, fixture, {expectedFiles, expectedCodeFiles, queries = storageQueries, checkpoint = async () => {}}) {
  const {CatalogStore, Catalog, CodeAnalysis, retrieveAnswerContext, questionTerms, Corrections, declarationMap} = services;
  const CandidateStore = externalSearchStore(CatalogStore), baselineDir = path.join(fixture.root, 'study-baseline'), candidateDir = path.join(fixture.root, 'study-candidate');
  const result = {schemaVersion: 'loredock-search-storage-study/1', queryCount: queries.length, expectedFiles, expectedCodeFiles, modelRequests: 0, stages: [], lifecycle: []};
  let left, right, leftAnalysis, rightAnalysis;
  const mark = (name, fn) => {fn(); result.lifecycle.push({name, passed: true});};
  const index = async (catalog, request) => {
    const project = catalog.store.project(), build = catalog.start(request, project.sourceSetVersion, project.policyVersion); await catalog.idle();
    const recorded = catalog.store.build(build.id); assert.ok(recorded.published); assert.equal(recorded.coverage.indexed, expectedFiles); return recorded;
  };
  const stop = async () => {
    await leftAnalysis?.stop(); await rightAnalysis?.stop(); await left?.stop(); await right?.stop();
    left?.store.close(); right?.store.close(); left = right = leftAnalysis = rightAnalysis = undefined;
  };
  const open = () => {
    left = new Catalog(new CatalogStore(baselineDir)); right = new Catalog(new CandidateStore(candidateDir));
    leftAnalysis = new CodeAnalysis(left); rightAnalysis = new CodeAnalysis(right);
  };
  try {
    left = new Catalog(new CatalogStore(baselineDir));
    result.sqliteVersion = left.store.one('SELECT sqlite_version() AS version').version;
    for (const source of fixture.manifest.sources) await left.addSource(path.join(fixture.root, 'sources', source.id));
    const first = await index(left, 'first'), second = await index(left, 'second');
    leftAnalysis = new CodeAnalysis(left); const inventory = leftAnalysis.start('code', second.id); await leftAnalysis.idle();
    assert.equal(leftAnalysis.get(inventory.id).counts.parsed, expectedCodeFiles);
    const projection = declarationMap(left), edge = projection.edges.find(edge => edge.kind === 'contract-match'); assert.ok(edge);
    new Corrections(left).save({requestId: 'storage-review', buildId: second.id, targetKind: 'declaration-link', targetId: edge.id,
      projectionHash: projection.inputHash, expectedRevision: left.state().correctionRevision, expectedPreviousId: null,
      action: 'clarify', statement: 'Synthetic retained engineer note for storage equivalence.', environment: 'local'});
    const context = retrieveAnswerContext(left, queries[0], second.id), project = left.store.project();
    left.store.run(`INSERT INTO answer_attempts (id,requestId,payloadHash,question,buildId,policyVersion,registryVersion,status,context,inputHash,connection,model,effort,promptVersion,schemaVersion,result,createdAt)
      VALUES ('storage-answer','storage-answer','fixture',?,?,?,?,'succeeded',?,?,'{}','fixture','medium','fixture','fixture','{}','fixture')`,
      context.question, second.id, project.policyVersion, project.sourceSetVersion, JSON.stringify(context), context.inputHash);
    for (const source of left.store.sources()) left.store.run("INSERT INTO answer_sources VALUES ('storage-answer',?)", source.id);
    await stop(); await mkdir(candidateDir); await copyFile(path.join(baselineDir, 'loredock.db'), path.join(candidateDir, 'loredock.db'));
    await writeFile(path.join(candidateDir, 'EXPERIMENT_ONLY.txt'), 'Owned external-search prototype. Do not open with the production writer.\n'); open();
    const baselineBuilds = [first.id, second.id], candidateBuilds = [...baselineBuilds];
    mark('conversion retains all non-literal-search records', () => assert.deepEqual(logicalRecords(right.store), logicalRecords(left.store)));
    mark('all copied original evidence and code payloads agree', () => {
      for (const {id} of left.store.all('SELECT id FROM spans')) assert.deepEqual(right.evidence(id), left.evidence(id));
      for (const {fileId} of left.store.all('SELECT fileId FROM code_analysis_files WHERE runId=?', inventory.id)) {
        assert.deepEqual(rightAnalysis.file(inventory.id, fileId), leftAnalysis.file(inventory.id, fileId));
      }
    });
    left.store.db.exec('VACUUM'); right.store.db.exec('VACUUM');
    const runStage = async name => {
      validateExternalSearch(right.store); left.store.db.exec("INSERT INTO search(search,rank) VALUES('integrity-check',1)");
      const stage = {name, baselineIdentities: identityMap(left.store, baselineBuilds), candidateIdentities: identityMap(right.store, candidateBuilds),
        allocation: {baseline: searchStorageAllocation(left.store), candidate: searchStorageAllocation(right.store)}, queries: []};
      result.stages.push(stage);
      for (let generation = 0; generation < baselineBuilds.length; generation++) for (const query of queries) {
        const measure = (catalog, buildId) => {
          const started = performance.now(), expression = query.trim().split(/\s+/).slice(0,20).map(term => '"' + term.replaceAll('"','""') + '"').join(' AND ');
          const literal = capture(() => catalog.search(query, buildId));
          const literalMs = performance.now() - started;
          const scores = capture(() => scoreRows(catalog, 'search', expression, buildId));
          const questionScores = capture(() => scoreRows(catalog, 'question_search', questionTerms(query).map(term => '"'+term+'"').join(' OR '), buildId));
          const context = capture(() => retrieveAnswerContext(catalog, query, buildId));
          return {value: {literal, scores, questionScores, context}, literalMs};
        };
        const baseline = measure(left, baselineBuilds[generation]), candidate = measure(right, candidateBuilds[generation]);
        stage.queries.push({generation, query, exact: generation < 2, baseline: baseline.value, candidate: candidate.value,
          durationsMs: {baseline: baseline.literalMs, candidate: candidate.literalMs}});
      }
      await checkpoint(result);
    };
    await runStage('converted'); await stop(); open(); await runStage('reopened');
    const refreshedLeft = await index(left, 'third'), refreshedRight = await index(right, 'third');
    baselineBuilds.push(refreshedLeft.id); candidateBuilds.push(refreshedRight.id);
    mark('both new generations reuse every indexed original', () => {
      assert.equal(refreshedLeft.refresh.reusedFiles, expectedFiles); assert.equal(refreshedRight.refresh.reusedFiles, expectedFiles);
    });
    await runStage('refreshed');
    const source = left.store.sources().find(source => source.name === 'portal'); assert.ok(source);
    const revokedIds = left.store.all('SELECT s.id FROM spans s JOIN files f ON f.id=s.fileId WHERE f.sourceId=?', source.id).map(row => row.id);
    const candidateRevokedIds = right.store.all('SELECT s.id FROM spans s JOIN files f ON f.id=s.fileId WHERE f.sourceId=?', source.id).map(row => row.id);
    left.revoke(source.id); right.revoke(source.id);
    mark('revocation removes every affected mapping and original, and purges retained notes/answers', () => {
      for (const id of revokedIds) assert.throws(() => left.evidence(id), /unavailable/);
      for (const id of candidateRevokedIds) {assert.throws(() => right.evidence(id), /unavailable/); assert.equal(right.store.one('SELECT id FROM literal_search_documents WHERE spanId=?', id), undefined);}
      for (const catalog of [left,right]) {
        assert.equal(catalog.store.one("SELECT context FROM answer_attempts WHERE id='storage-answer'").context, null);
        assert.equal(catalog.store.one('SELECT count(*) AS n FROM corrections WHERE purged=0').n, 0);
      }
    });
    await runStage('revoked'); left.store.db.exec('VACUUM'); right.store.db.exec('VACUUM'); await stop(); open(); await runStage('compacted');
    result.summary = assessSearchStorage(result); await checkpoint(result);
  } catch (error) {
    result.error = {code: error.code ?? null, message: error.message}; result.summary = assessSearchStorage(result); await checkpoint(result);
  } finally {await stop();}
  return result;
}

async function main() {
  assert.equal(process.argv.length, 3, 'Pass one absolute output directory. User data directories are not accepted.');
  const output = process.argv[2]; assert.ok(path.isAbsolute(output));
  const frozen = await verifySearchStorageContract({implementation: true});
  assert.equal(execFileSync('git', ['status','--porcelain'], {cwd: root, encoding: 'utf8'}).trim(), '', 'Commit the implementation before measurement.');
  await mkdir(output, {recursive: true}); await mkdir(path.join(root, '.loredock-evaluations'), {recursive: true});
  const commit = execFileSync('git', ['rev-parse','HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  await writeFile(path.join(root, '.loredock-evaluations/task053-search-storage.json'), json({commit, output, startedAt: new Date().toISOString()}), {flag: 'wx'});
  const modules = await Promise.all(['store','catalog','code-analysis','answer-context','corrections','system-map'].map(name => import(pathToFileURL(path.join(root, `apps/loredock/dist/${name}.js`)))));
  const services = Object.assign({}, ...modules), fixture = await createCapacityFixture(storageGate.filesPerSource);
  try {
    const implementation = {};
    for (const file of ['scripts/loredock-search-storage-study.mjs','scripts/loredock-external-search-prototype.mjs',
      ...(await readdir(path.join(root, 'apps/loredock/dist'))).filter(name => name.endsWith('.js')).map(name => `apps/loredock/dist/${name}`)]) {
      implementation[file] = hash(await readFile(path.join(root, file)));
    }
    const checkpoint = async result => writeFile(path.join(output, 'raw-result.json.gz'), gzipSync(json({frozen, commit, node: process.version, implementation, result})));
    const result = await compareSearchStorage(services, fixture, {expectedFiles: storageGate.eligibleFiles, expectedCodeFiles: storageGate.codeFiles, checkpoint});
    for (const source of fixture.manifest.sources) {
      assert.equal(scaleGit(fixture.root, source.id, ['rev-parse','HEAD']), source.revision);
      assert.equal(scaleGit(fixture.root, source.id, ['status','--porcelain']), '');
    }
    result.sourceCheckoutsUnchanged = true; result.checkedAt = new Date().toISOString(); await checkpoint(result);
    await writeFile(path.join(output, 'summary.json'), json(result.summary)); console.log(json(result.summary));
    if (!result.summary.passed) process.exitCode = 1;
  } finally {await rm(fixture.root, {recursive: true, force: true});}
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {console.error(error); process.exitCode = 1;});
}
