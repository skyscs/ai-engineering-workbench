import assert from 'node:assert/strict';
import {copyFile, mkdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {test, type TestContext} from 'node:test';
import {CatalogStore} from '../src/store.js';
import {Catalog} from '../src/catalog.js';
import {CodeAnalysis} from '../src/code-analysis.js';
import {retrieveAnswerContext, questionTerms} from '../src/answer-context.js';
import {Corrections} from '../src/corrections.js';
import {declarationMap} from '../src/system-map.js';
// @ts-expect-error The isolated experimental adapter is plain JavaScript.
import {externalSearchStore, validateExternalSearch} from '../../../scripts/loredock-external-search-prototype.mjs';
// @ts-expect-error The isolated comparison harness is plain JavaScript.
import {compareSearchStorage, assessSearchStorage, verifySearchStorageContract} from '../../../scripts/loredock-search-storage-study.mjs';
// @ts-expect-error Owned fixture helpers are plain JavaScript.
import {createLoreDockFixture, fixtureGit} from '../../../scripts/loredock-fixture.mjs';

const CandidateStore = externalSearchStore(CatalogStore) as typeof CatalogStore;
async function setup(t: TestContext) {
  const fixture = await createLoreDockFixture(), baselineDir = path.join(fixture.root, 'baseline'), candidateDir = path.join(fixture.root, 'candidate');
  await writeFile(path.join(fixture.root, 'sources/portal/unicode.md'), 'Café alpha alpha.\nQuoted "alpha" and dash-token.\n');
  fixtureGit(fixture.root, 'portal', ['add', 'unicode.md']); fixtureGit(fixture.root, 'portal', ['commit', '-qm', 'Add owned literal-search edge cases']);
  let baseline: CatalogStore | undefined = new CatalogStore(baselineDir), candidate: CatalogStore | undefined;
  let left = new Catalog(baseline), right: Catalog | undefined;
  t.after(async () => {await left.stop(); await right?.stop(); baseline?.close(); candidate?.close(); await rm(fixture.root, {recursive: true, force: true});});
  for (const source of ['portal','order-api','order-worker']) await left.addSource(path.join(fixture.root, 'sources', source));
  const index = async (catalog: Catalog, requestId: string) => {
    const state = catalog.state(), build = catalog.start(requestId, state.sourceSetVersion, state.policyVersion); await catalog.idle();
    assert.ok(catalog.store.build(build.id).published); return build.id;
  };
  const first = await index(left, 'first'); await left.stop(); baseline.close(); baseline = undefined;
  await mkdir(candidateDir); await copyFile(path.join(baselineDir, 'loredock.db'), path.join(candidateDir, 'loredock.db'));
  baseline = new CatalogStore(baselineDir); left = new Catalog(baseline);
  candidate = new CandidateStore(candidateDir); right = new Catalog(candidate);
  return {fixture, first, index, get baseline() {return baseline!;}, get candidate() {return candidate!;}, get left() {return left;}, get right() {return right!;},
    async reopenCandidate() {await right!.stop(); candidate!.close(); candidate = undefined; candidate = new CandidateStore(candidateDir); right = new Catalog(candidate);}};
}

test('external literal search preserves row identities, ranks, snippets, originals, refresh, purge and VACUUM behavior', async t => {
  const state = await setup(t), queries = ['orders', 'tenantId', 'café', 'alpha', 'dash-token', '" OR *', 'noSuch053'];
  const compare = () => {for (const query of queries) assert.deepEqual(state.right.search(query, state.first), state.left.search(query, state.first));};
  const scored = (store: CatalogStore) => store.all("SELECT rowid,spanId,rank,snippet(search,1,'','','…',24) AS snippet FROM search WHERE search MATCH 'alpha' ORDER BY rank,rowid");
  compare(); assert.deepEqual(scored(state.candidate), scored(state.baseline));
  for (const {id} of state.baseline.all<{id: string}>('SELECT id FROM spans')) assert.deepEqual(state.right.evidence(id), state.left.evidence(id));
  const build = state.candidate.build(await state.index(state.right, 'refresh'));
  await state.index(state.left, 'refresh');
  assert.equal(build.refresh!.reusedFiles, build.coverage.indexed); validateExternalSearch(state.candidate);
  const before = state.right.search('alpha'); state.candidate.db.exec('VACUUM'); await state.reopenCandidate();
  assert.deepEqual(state.right.search('alpha'), before); validateExternalSearch(state.candidate);
  const source = state.candidate.sources().find(source => source.name === 'portal')!;
  state.right.revoke(source.id); state.left.revoke(source.id); compare();
  assert.equal(state.candidate.one<{n: number}>(`SELECT count(*) AS n FROM literal_search_documents d JOIN spans s ON s.id=d.spanId
    JOIN files f ON f.id=s.fileId WHERE f.sourceId=?`, source.id)!.n, 0); validateExternalSearch(state.candidate);
  state.left.updatePolicy(['config']); state.right.updatePolicy(['config']);
  assert.throws(() => state.left.search('orders', state.first), {code: 'POLICY_CHANGED'});
  assert.throws(() => state.right.search('orders', state.first), {code: 'POLICY_CHANGED'});
});

test('an insertion failure rolls back the new mapping, span and original file checkpoint together', async t => {
  const state = await setup(t), project = state.candidate.project(), build = state.candidate.start('rollback', project.sourceSetVersion, project.policyVersion);
  const source = state.candidate.sources()[0]!, id = 'owned-failing-file';
  state.candidate.run("INSERT INTO files (id,buildId,sourceId,path,mode,blob,size) VALUES (?,?,?,'failure.md','100644','fixture',5)", id, build.id, source.id);
  const file = state.candidate.one<import('../src/store.js').FileRow>('SELECT * FROM files WHERE id=?', id)!;
  const before = state.candidate.one<{n: number}>('SELECT count(*) AS n FROM literal_search_documents')!.n;
  const original = state.candidate.run.bind(state.candidate);
  state.candidate.run = (sql, ...args) => {if (sql.startsWith('INSERT INTO question_search')) throw new Error('Owned checkpoint failure.'); return original(sql, ...args);};
  assert.throws(() => state.candidate.finishFile(file, {raw: Buffer.from('alpha'), text: 'alpha', metadata: {}}), /Owned checkpoint failure/);
  state.candidate.run = original;
  assert.equal(state.candidate.one<{n: number}>('SELECT count(*) AS n FROM literal_search_documents')!.n, before);
  assert.equal(state.candidate.one<{n: number}>('SELECT count(*) AS n FROM spans WHERE fileId=?', id)!.n, 0);
  assert.equal(state.candidate.one<{raw: unknown; status: string}>('SELECT raw,status FROM files WHERE id=?', id)!.raw, null);
  await state.reopenCandidate(); assert.equal(state.candidate.buildRow(build.id).status, 'interrupted'); validateExternalSearch(state.candidate);
});

test('conversion rejects inconsistent original/search content and releases its owned store', async t => {
  const state = await setup(t), directory = path.join(state.fixture.root, 'corrupt'); await mkdir(directory);
  state.baseline.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); await copyFile(path.join(state.fixture.root, 'baseline/loredock.db'), path.join(directory, 'loredock.db'));
  const bad = new CatalogStore(directory); bad.run("UPDATE spans SET text='changed original' WHERE id=(SELECT id FROM spans LIMIT 1)"); bad.close();
  assert.throws(() => new CandidateStore(directory), /must agree/);
  const reopened = new CatalogStore(directory);
  try {assert.equal(reopened.one("SELECT name FROM sqlite_schema WHERE name='literal_search_documents'"), undefined);}
  finally {reopened.close();}
});

test('empty external-content conversion admits future source indexing', async t => {
  const fixture = await createLoreDockFixture(), store = new CandidateStore(path.join(fixture.root, 'empty')), catalog = new Catalog(store);
  t.after(async () => {await catalog.stop(); store.close(); await rm(fixture.root, {recursive: true, force: true});});
  validateExternalSearch(store); await catalog.addSource(path.join(fixture.root, 'sources/order-api'));
  const state = catalog.state(); catalog.start('new', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  assert.ok(catalog.search('orders').hits.length); validateExternalSearch(store);
});

test('the full comparison lifecycle rehearses on three owned sources and recounts failures from retained query data', async t => {
  await verifySearchStorageContract();
  const fixture = await createLoreDockFixture(); t.after(() => rm(fixture.root, {recursive: true, force: true}));
  const result = await compareSearchStorage({CatalogStore, Catalog, CodeAnalysis, retrieveAnswerContext, questionTerms, Corrections, declarationMap},
    fixture, {expectedFiles: 18, expectedCodeFiles: 5});
  assert.equal(result.error, undefined); assert.equal(result.summary.mechanical, true, JSON.stringify(result.summary));
  assert.equal(result.summary.comparisons, 182); assert.equal(result.lifecycle.length, 4);
  const missing = structuredClone(result); missing.lifecycle.pop(); assert.equal(assessSearchStorage(missing).mechanical, false);
  const changed = structuredClone(result);
  const query = changed.stages[2].queries.find((row: {generation: number; candidate: {literal: {value: {hits: unknown[]}}}}) => row.generation === 2 && row.candidate.literal.value.hits.length);
  query.candidate.literal.value.hits[0].snippet = 'Incorrect snippet';
  assert.ok(assessSearchStorage(changed).failures.length > 0);
  const dropped = structuredClone(result); let checkedSupport = false;
  for (const row of dropped.stages[2].queries) {
    if (row.generation !== 2 || !row.candidate.context.value.interfaces.comparisons.length) continue;
    row.candidate.context.value.interfaces.comparisons[0].evidenceIds.reverse();
    assert.equal(assessSearchStorage(dropped).mechanical, true);
    row.candidate.context.value.interfaces.comparisons[0].evidenceIds.pop();
    assert.equal(assessSearchStorage(dropped).mechanical, false); checkedSupport = true; break;
  }
  assert.equal(checkedSupport, true);
  const failedBoth = structuredClone(result);
  failedBoth.stages[0].queries[0].baseline.literal = {error: {message: 'failure'}};
  failedBoth.stages[0].queries[0].candidate.literal = {error: {message: 'failure'}};
  assert.equal(assessSearchStorage(failedBoth).mechanical, false);
});
