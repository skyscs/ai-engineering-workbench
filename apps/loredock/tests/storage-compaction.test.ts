import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, readFile, readdir, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {test, type TestContext} from 'node:test';
import {CatalogStore} from '../src/store.js';
import {Catalog} from '../src/catalog.js';
import {CodeAnalysis} from '../src/code-analysis.js';
import {codeFlows} from '../src/code-flows.js';
import {Corrections} from '../src/corrections.js';
// @ts-expect-error The explicit maintenance command is plain JavaScript.
import {compactStorage, compactionArguments} from '../../../scripts/loredock-compact.mjs';
// @ts-expect-error The read-only maintenance command is plain JavaScript.
import {auditStorage} from '../../../scripts/loredock-storage.mjs';
// @ts-expect-error The owned synthetic generator is plain JavaScript.
import {createLoreDockFixture, fixtureGit} from '../../../scripts/loredock-fixture.mjs';

function snapshot(db: DatabaseSync) {
  const tables = db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  return tables.map(row => {
    const table = `"${String(row.name).replaceAll('"','""')}"`;
    const order = /WITHOUT ROWID/i.test(String(row.sql)) ? db.prepare(`PRAGMA table_info(${table})`).all()
      .filter(column => Number(column.pk) > 0).sort((a,b) => Number(a.pk) - Number(b.pk))
      .map(column => `"${String(column.name).replaceAll('"','""')}"`).join(',') : 'rowid';
    return [row.name, db.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all()];
  });
}

async function fixture(t: TestContext) {
  const generated = await createLoreDockFixture(), directory = path.join(generated.root, 'compact data');
  await writeFile(path.join(generated.root, 'sources/order-worker/large.md'), 'Synthetic removable page allocation.\n'.repeat(18000));
  fixtureGit(generated.root, 'order-worker', ['add', 'large.md']); fixtureGit(generated.root, 'order-worker', ['commit', '-qm', 'Add owned removable storage pressure']);
  let store = new CatalogStore(directory), catalog = new Catalog(store), analysis = new CodeAnalysis(catalog), closed = false;
  const close = async () => {if (!closed) {await analysis.stop(); await catalog.stop(); store.close(); closed = true;}};
  t.after(async () => {await close(); await rm(generated.root, {recursive: true, force: true});});
  const sources = [];
  for (const name of ['portal', 'order-api', 'order-worker']) sources.push(await catalog.addSource(path.join(generated.root, 'sources', name)));
  const index = async (request: string) => {
    const project = store.project(), build = catalog.start(request, project.sourceSetVersion, project.policyVersion);
    await catalog.idle(); assert.ok(store.build(build.id).published); return build.id;
  };
  const first = await index('initial'); await index('refresh');
  catalog.revoke(sources[2]!.id);
  const current = await index('after-removal'), run = analysis.start('code', current); await analysis.idle();
  return {directory, first, current, run, index, close, get store() {return store;}, get catalog() {return catalog;}, get analysis() {return analysis;},
    reopen() {store = new CatalogStore(directory); catalog = new Catalog(store); analysis = new CodeAnalysis(catalog); closed = false;}};
}

test('offline compaction shrinks purged allocation while preserving history, FTS ranking, notes, originals, code facts and refresh reuse', async t => {
  const state = await fixture(t), {store, catalog, analysis, directory} = state;
  const projection = codeFlows(catalog), edge = projection.edges[0]!; assert.ok(edge);
  const corrections = new Corrections(catalog), note = corrections.save({requestId: 'review', buildId: state.current, targetKind: 'code-link', targetId: edge.id,
    projectionHash: projection.inputHash, expectedRevision: catalog.state().correctionRevision, expectedPreviousId: null,
    action: 'clarify', statement: 'Synthetic engineer review retained through offline compaction.', environment: 'local'});
  store.run(`INSERT INTO answer_attempts (id,requestId,payloadHash,question,buildId,policyVersion,registryVersion,status,context,inputHash,connection,model,effort,promptVersion,schemaVersion,result,createdAt)
    VALUES ('fixture-answer','fixture-answer','hash','Synthetic stored answer row',?,?,?,'succeeded','{}','hash','{}','fixture','medium','fixture','fixture','{}','now')`,
    state.current, store.project().policyVersion, store.project().sourceSetVersion);
  const before = snapshot(store.db), inventory = analysis.get(state.run.id), review = corrections.history(note.id);
  const currentSearch = catalog.search('orders', state.current), historicalSearch = catalog.search('orders', state.first);
  const originals = currentSearch.hits.map(hit => catalog.evidence(hit.id)); assert.ok(originals.length);
  const questionRows = store.all("SELECT rowid,spanId,rank FROM question_search WHERE question_search MATCH 'order' ORDER BY rank,rowid");
  assert.ok(questionRows.length); await state.close();
  const report = compactStorage(directory);
  assert.equal(report.status, 'compacted'); assert.ok(report.before.sqlite.freePageBytes > 1024 * 1024);
  assert.ok(report.reclaimedSqliteBytes > 1024 * 1024); assert.equal(report.after.sqlite.freePages, 0);
  assert.deepEqual(report.before.payloads, report.after.payloads); assert.deepEqual(report.before.generations, report.after.generations);
  state.reopen(); assert.deepEqual(snapshot(state.store.db), before);
  assert.deepEqual(state.catalog.search('orders', state.current), currentSearch);
  assert.deepEqual(state.catalog.search('orders', state.first), historicalSearch);
  assert.deepEqual(state.store.all("SELECT rowid,spanId,rank FROM question_search WHERE question_search MATCH 'order' ORDER BY rank,rowid"), questionRows);
  assert.deepEqual(currentSearch.hits.map(hit => state.catalog.evidence(hit.id)), originals);
  assert.deepEqual(state.analysis.get(state.run.id), inventory); assert.deepEqual(new Corrections(state.catalog).history(note.id), review);
  const refreshed = state.store.build(await state.index('after-compaction'));
  assert.equal(refreshed.refresh!.reusedFiles, refreshed.coverage.indexed);
  assert.equal(refreshed.refresh!.baselineBuildId, state.current);
  console.log(JSON.stringify({compaction: {before: report.before.sqlite.allocatedBytes, after: report.after.sqlite.allocatedBytes,
    reclaimed: report.reclaimedSqliteBytes, logicalRowsPreserved: true, refreshReused: refreshed.refresh!.reusedFiles}}));
});

test('live ownership rejects compaction; the actual CLI returns a byte-preserving no-op for an empty catalog', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'loredock-compact-empty-')); t.after(() => rm(directory, {recursive: true, force: true}));
  const store = new CatalogStore(directory);
  try {assert.throws(() => compactStorage(directory), /in use/); assert.equal(store.project().policyVersion, 1);}
  finally {store.close();}
  const before = await readFile(path.join(directory, 'loredock.db'));
  const result = JSON.parse(execFileSync(process.execPath, [path.resolve('../../scripts/loredock-compact.mjs'), '--data-dir', directory], {encoding: 'utf8'}));
  assert.equal(result.status, 'unchanged'); assert.equal(result.reclaimedSqliteBytes, 0);
  assert.deepEqual(await readFile(path.join(directory, 'loredock.db')), before);
  const reopened = new CatalogStore(directory); reopened.close();
});

test('a separate database writer blocks compaction without recovery, retries or logical changes and releases ownership', async t => {
  const state = await fixture(t); await state.close();
  const database = new DatabaseSync(path.join(state.directory, 'loredock.db'));
  try {
    const before = snapshot(database); database.exec('BEGIN IMMEDIATE;');
    assert.throws(() => compactStorage(state.directory), /blocks compaction|locked/);
    database.exec('ROLLBACK;'); assert.deepEqual(snapshot(database), before);
    assert.ok(auditStorage(state.directory).sqlite.freePages > 0);
  } finally {database.close();}
  state.reopen(); assert.equal(state.store.project().publishedBuildId, state.current);
});

test('compaction refuses unsupported, missing and symlinked data before creating or upgrading a catalog', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'loredock-compact-invalid-')); t.after(() => rm(directory, {recursive: true, force: true}));
  assert.throws(() => compactStorage(directory), /existing/); assert.deepEqual(await readdir(directory), []);
  const store = new CatalogStore(directory); store.db.exec('PRAGMA user_version=9'); store.close();
  const database = path.join(directory, 'loredock.db'), before = await readFile(database);
  assert.throws(() => compactStorage(directory), /schema 8/); assert.deepEqual(await readFile(database), before);
  for (const name of ['loredock.db-journal', '.owner.db-wal', '.owner.db-shm']) {
    const sidecar = path.join(directory, name); await symlink(database, sidecar);
    assert.throws(() => compactStorage(directory), /regular files/); assert.throws(() => auditStorage(directory), /regular files/);
    await rm(sidecar);
  }
  await rm(path.join(directory, '.owner.db')); await symlink(database, path.join(directory, '.owner.db'));
  assert.throws(() => compactStorage(directory), /regular files/);
  for (const args of [[], ['--data-dir','relative'], ['--data-dir',directory,'--force']]) assert.throws(() => compactionArguments(args), /Usage/);
});
