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
import {removeExternalSearchSchema} from './legacy-schema.js';
// @ts-expect-error The explicit maintenance command is plain JavaScript.
import {compactStorage} from '../../../scripts/loredock-compact.mjs';
// @ts-expect-error The explicit maintenance command is plain JavaScript.
import {auditStorage, storageArguments} from '../../../scripts/loredock-storage.mjs';
// @ts-expect-error The owned fixture generator is plain JavaScript.
import {createLoreDockFixture} from '../../../scripts/loredock-fixture.mjs';

async function setup(t: TestContext) {
  const fixture = await createLoreDockFixture(), directory = path.join(fixture.root, 'audit-data');
  let closed = false;
  const store = new CatalogStore(directory), catalog = new Catalog(store), analysis = new CodeAnalysis(catalog);
  const close = async () => {if (!closed) {await analysis.stop(); await catalog.stop(); store.close(); closed = true;}};
  t.after(async () => {await close(); await rm(fixture.root, {recursive: true, force: true});});
  const source = await catalog.addSource(path.join(fixture.root, 'sources/order-api'));
  const start = async (requestId: string) => {
    const project = store.project(), build = catalog.start(requestId, project.sourceSetVersion, project.policyVersion);
    await catalog.idle(); assert.ok(store.build(build.id).published); return build;
  };
  return {fixture, directory, store, catalog, analysis, source, start, close};
}

test('storage accounting includes UTF-8/NUL, shared literal text and mapping pages without exporting content', async t => {
  const {store, directory, start} = await setup(t); await start('first');
  const file = store.one<{id: string; metadata: string}>('SELECT id,metadata FROM files WHERE raw IS NOT NULL LIMIT 1')!;
  const metadataBytes = store.all<{metadata: string}>('SELECT metadata FROM files').reduce((sum, row) => sum + Buffer.byteLength(row.metadata), 0);
  const marker = 'private-marker-雪\u0000é';
  store.run('UPDATE files SET metadata=? WHERE id=?', marker, file.id);
  const report = auditStorage(directory);
  assert.equal(report.schemaVersion, 'loredock-storage-audit/2'); assert.equal(report.databaseVersion, 9);
  assert.equal(report.payloads.literalSearch.contentStorage, 'shared-original-spans');
  assert.equal(report.payloads.literalSearch.copiedTextBytes, 0);
  const literalPages = store.one<{bytes: number}>(`SELECT sum(d.pgsize) AS bytes FROM dbstat d
    JOIN sqlite_schema s ON s.name=d.name WHERE s.tbl_name LIKE 'search_%' OR s.tbl_name='literal_search_documents'`)!.bytes;
  assert.equal(report.sqlite.allocations.literalSearch, literalPages);
  const originals = store.all<{raw: Uint8Array | null; metadata: string}>('SELECT raw,metadata FROM files');
  const spans = store.all<{text: string}>('SELECT text FROM spans');
  assert.equal(report.payloads.originals.bytes, originals.reduce((sum, row) => sum + (row.raw?.length ?? 0), 0));
  assert.equal(report.payloads.fileMetadata.bytes, metadataBytes - Buffer.byteLength(file.metadata) + Buffer.byteLength(marker));
  assert.equal(report.payloads.spans.bytes, spans.reduce((sum, row) => sum + Buffer.byteLength(row.text), 0));
  assert.equal(report.payloads.literalSearch.bytes, report.payloads.spans.bytes);
  assert.ok(report.payloads.questionSearch.bytes > report.payloads.spans.bytes);
  assert.equal(Object.values<number>(report.sqlite.allocations).reduce((sum, bytes) => sum + bytes, 0)
    + report.sqlite.freePageBytes + report.sqlite.unassignedBytes, report.sqlite.allocatedBytes);
  assert.ok(report.sqlite.allocations.literalSearch > 0); assert.ok(report.sqlite.allocations.questionSearch > 0);
  assert.equal(report.disk.observedFileBytes, report.disk.files.reduce((sum: number, file: {bytes: number | null}) => sum + (file.bytes ?? 0), 0));
  const text = JSON.stringify(report);
  for (const forbidden of [directory, marker, 'order-api', file.id]) assert.ok(!text.includes(forbidden));
});

test('accounting and compaction retain schema 8 and report its copied text without recovery or migration', async t => {
  const {store, directory, start, close} = await setup(t); await start('first');
  const project = store.project(), pending = store.start('pending', project.sourceSetVersion, project.policyVersion);
  removeExternalSearchSchema(store.db);
  const scores = store.all("SELECT rowid,spanId,rank FROM search WHERE search MATCH 'orders' ORDER BY rank,rowid");
  await close(); const before = await readFile(path.join(directory, 'loredock.db'));
  const report = auditStorage(directory);
  assert.equal(report.databaseVersion, 8); assert.equal(report.payloads.literalSearch.contentStorage, 'copied');
  assert.equal(report.payloads.literalSearch.copiedTextBytes, report.payloads.literalSearch.bytes);
  assert.ok(report.payloads.literalSearch.bytes > 0); assert.deepEqual(await readFile(path.join(directory, 'loredock.db')), before);
  const compacted = compactStorage(directory); assert.equal(compacted.schemaVersion, 'loredock-storage-compaction/2');
  assert.equal(compacted.after.databaseVersion, 8); assert.deepEqual(compacted.after.payloads, report.payloads);
  const db = new DatabaseSync(path.join(directory, 'loredock.db'), {readOnly: true});
  try {assert.equal(db.prepare('PRAGMA user_version').get()!.user_version, 8);
    assert.equal(db.prepare('SELECT status FROM builds WHERE id=?').get(pending.id)!.status, 'preparing');
    assert.deepEqual(db.prepare("SELECT rowid,spanId,rank FROM search WHERE search MATCH 'orders' ORDER BY rank,rowid").all(), scores);}
  finally {db.close();}
});

test('unchanged refresh copies and overlapping dependencies are counted while live jobs and ownership survive', async t => {
  const {store, directory, start, analysis, source, catalog} = await setup(t);
  const first = await start('first'), before = auditStorage(directory);
  const second = await start('refresh'), run = analysis.start('code', second.id); await analysis.idle();
  const value = 'private-answer-and-engineer-note-雪';
  store.run(`INSERT INTO answer_attempts (id,requestId,payloadHash,question,buildId,policyVersion,registryVersion,status,context,inputHash,connection,model,effort,promptVersion,schemaVersion,createdAt)
    VALUES ('answer','answer','hash',?,?,1,1,'running',?,'hash',?,'fixture','medium','fixture','fixture','now')`, value, first.id, value, value);
  store.run("INSERT INTO answer_sources VALUES ('answer',?)", source.id);
  store.run(`INSERT INTO corrections (id,requestId,payloadHash,buildId,policyVersion,registryVersion,revision,targetKind,targetId,version,action,statement,environment,target,contentHash,createdAt)
    VALUES ('note','note','hash',?,1,1,1,'code-link','target',1,'clarify',?,?,?,'hash','now')`, first.id, value, value, value);
  store.run("INSERT INTO correction_sources VALUES ('note',?)", source.id);
  store.run("UPDATE code_analyses SET status='running' WHERE id=?", run.id);
  const project = store.project(), pending = store.start('pending', project.sourceSetVersion, project.policyVersion);
  const report = auditStorage(directory);
  assert.equal(report.generations.total, 3); assert.equal(report.generations.published, 2); assert.equal(report.generations.unfinished, 1);
  assert.equal(report.payloads.originals.bytes, before.payloads.originals.bytes * 2);
  assert.equal(report.payloads.spans.bytes, before.payloads.spans.bytes * 2);
  assert.equal(report.duplicateCandidates.originals.bytes, before.payloads.originals.bytes);
  assert.equal(report.dependencies.withAnswerAttempts, 1); assert.equal(report.dependencies.withEngineerReview, 1);
  assert.equal(report.dependencies.withCodeInventories, 1); assert.equal(report.dependencies.usedAsRefreshBaseline, 2);
  assert.equal(report.dependencies.withReusedFileReferences, 1);
  assert.equal(report.payloads.answerContexts.bytes, Buffer.byteLength(value));
  assert.equal(report.payloads.engineerNotes.bytes, 3 * Buffer.byteLength(value));
  assert.equal(report.payloads.codeFacts.bytes, store.one<{bytes: number}>('SELECT sum(payloadBytes) AS bytes FROM code_analysis_files')!.bytes);
  assert.ok(report.payloads.codeFacts.bytes > 0); assert.ok(!JSON.stringify(report).includes(value));
  assert.equal(store.buildRow(pending.id).status, 'preparing');
  assert.equal(store.one<{status: string}>("SELECT status FROM answer_attempts WHERE id='answer'")!.status, 'running');
  assert.equal(store.one<{status: string}>('SELECT status FROM code_analyses WHERE id=?', run.id)!.status, 'running');
  assert.throws(() => new CatalogStore(directory), /already in use/);
  catalog.revoke(source.id);
  const purged = auditStorage(directory);
  for (const key of ['originals','spans','literalSearch','questionSearch','codeFacts','answerContexts','engineerNotes']) assert.equal(purged.payloads[key].bytes, 0);
  assert.equal(purged.generations.total, 3); assert.equal(purged.dependencies.withEngineerReview, 1);
  assert.equal(purged.duplicateCandidates.originals.bytes, 0);
});

test('the real command reads a closed catalog without changing database bytes or recovery state', async t => {
  const {store, directory, start, close} = await setup(t); await start('first');
  const project = store.project(), pending = store.start('pending', project.sourceSetVersion, project.policyVersion);
  await close();
  const names = ['loredock.db', '.owner.db'], before = await Promise.all(names.map(name => readFile(path.join(directory, name))));
  const output = execFileSync(process.execPath, [path.resolve('../../scripts/loredock-storage.mjs'), '--data-dir', directory], {encoding: 'utf8'});
  const report = JSON.parse(output); assert.equal(report.generations.unfinished, 1);
  assert.deepEqual(await Promise.all(names.map(name => readFile(path.join(directory, name)))), before);
  const readonly = new DatabaseSync(path.join(directory, 'loredock.db'), {readOnly: true});
  try {assert.equal(readonly.prepare('SELECT status FROM builds WHERE id=?').get(pending.id)!.status, 'preparing');}
  finally {readonly.close();}
});

test('storage accounting rejects absent, foreign, unsupported and symlinked files without creating a catalog', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-audit-invalid-')); t.after(() => rm(root, {recursive: true, force: true}));
  assert.throws(() => auditStorage('relative'), /absolute/);
  assert.throws(() => auditStorage(root), /not found/); assert.deepEqual(await readdir(root), []);
  await writeFile(path.join(root, 'workbench.db'), 'owned sentinel');
  assert.throws(() => auditStorage(root), /Workbench/); await rm(path.join(root, 'workbench.db'));
  const database = path.join(root, 'loredock.db'), db = new DatabaseSync(database); db.exec('PRAGMA user_version=10'); db.close();
  const before = await readFile(database); assert.throws(() => auditStorage(root), /schema 8/); assert.deepEqual(await readFile(database), before);
  await symlink(database, path.join(root, 'loredock.db-wal')); assert.throws(() => auditStorage(root), /regular files/);
  await rm(path.join(root, 'loredock.db-wal')); await rm(database); await symlink(path.join(root, 'missing'), database);
  assert.throws(() => auditStorage(root), /regular files/);
  for (const args of [[], ['--data-dir','relative'], ['--data-dir',root,'--delete'], ['--path',root]]) assert.throws(() => storageArguments(args), /Usage/);
  assert.equal(storageArguments(['--data-dir',root]), root);
});
