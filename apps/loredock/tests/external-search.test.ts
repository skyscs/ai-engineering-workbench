import assert from 'node:assert/strict';
import {copyFile, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {gunzipSync} from 'node:zlib';
import {test, type TestContext} from 'node:test';
import {CatalogStore, type FileRow} from '../src/store.js';
import {Catalog} from '../src/catalog.js';
import {CodeAnalysis} from '../src/code-analysis.js';
import {retrieveAnswerContext} from '../src/answer-context.js';
import {Corrections} from '../src/corrections.js';
import {codeFlows} from '../src/code-flows.js';
import {removeExternalSearchSchema} from './legacy-schema.js';
// @ts-expect-error The frozen snapshot helper is plain JavaScript.
import {literalIndexSnapshot} from '../../../scripts/loredock-search-control-study.mjs';
// @ts-expect-error Historical assessor/contract verification does not execute the archived experiment.
import {assessSearchStorage, verifySearchStorageContract} from '../../../scripts/loredock-search-storage-study.mjs';
// @ts-expect-error Owned fixture helpers are plain JavaScript.
import {createLoreDockFixture, fixtureGit} from '../../../scripts/loredock-fixture.mjs';

function validate(store: CatalogStore) {
  store.db.exec("INSERT INTO search(search,rank) VALUES('integrity-check',1)");
  assert.equal(store.one<{n: number}>('SELECT count(*) AS n FROM literal_search_documents')!.n, store.one<{n: number}>('SELECT count(*) AS n FROM spans')!.n);
  assert.equal(store.one('SELECT 1 FROM pragma_foreign_key_check LIMIT 1'), undefined);
}
async function setup(t: TestContext) {
  const fixture = await createLoreDockFixture(), directory = path.join(fixture.root, 'catalog');
  await writeFile(path.join(fixture.root, 'sources/portal/unicode.md'), 'Café alpha alpha.\nQuoted "alpha" and dash-token.\n');
  fixtureGit(fixture.root, 'portal', ['add', 'unicode.md']); fixtureGit(fixture.root, 'portal', ['commit', '-qm', 'Add owned literal-search edge cases']);
  let store: CatalogStore | undefined = new CatalogStore(directory), catalog = new Catalog(store), analysis = new CodeAnalysis(catalog);
  const close = async () => {if (store) {await analysis.stop(); await catalog.stop(); store.close(); store = undefined;}};
  t.after(async () => {await close(); await rm(fixture.root, {recursive: true, force: true});});
  for (const source of ['portal','order-api','order-worker']) await catalog.addSource(path.join(fixture.root, 'sources', source));
  const index = async (requestId: string) => {
    const state = catalog.state(), build = catalog.start(requestId, state.sourceSetVersion, state.policyVersion); await catalog.idle();
    assert.ok(store!.build(build.id).published); return build.id;
  };
  const first = await index('first'), second = await index('second');
  return {fixture, directory, first, second, index, close, get store() {return store!;}, get catalog() {return catalog;}, get analysis() {return analysis;},
    async reopen() {await close(); store = new CatalogStore(directory); catalog = new Catalog(store); analysis = new CodeAnalysis(catalog);}};
}
const queries = ['orders', 'tenantId', 'café', 'alpha', 'dash-token', '" OR *', 'noSuch055'];
function readQueries(catalog: Catalog, builds: string[]) {
  return builds.flatMap(build => queries.map(query => {
    const terms = query.trim().split(/\s+/).map(term => '"' + term.replaceAll('"','""') + '"').join(' AND ');
    return {literal: catalog.search(query, build), context: retrieveAnswerContext(catalog, query, build),
      scores: catalog.store.all(`SELECT search.rowid,search.spanId,rank,snippet(search,1,'','','…',24) AS snippet FROM search
        JOIN spans s ON s.id=search.spanId JOIN files f ON f.id=s.fileId WHERE search MATCH ? AND f.buildId=? ORDER BY rank,search.rowid`, terms, build)};
  }));
}
function logicalRows(db: DatabaseSync) {
  return db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => {
    const table = `"${String(row.name).replaceAll('"','""')}"`;
    const order = /WITHOUT ROWID/i.test(String(row.sql)) ? db.prepare(`PRAGMA table_info(${table})`).all().filter(c => Number(c.pk) > 0)
      .sort((a,b) => Number(a.pk) - Number(b.pk)).map(c => `"${String(c.name).replaceAll('"','""')}"`).join(',') : 'rowid';
    return [row.name, db.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all()];
  });
}

test('schema 8 migration preserves every token, rowid, rank setting, original, historical context, review and code fact', async t => {
  const state = await setup(t), run = state.analysis.start('inventory', state.second); await state.analysis.idle();
  const projection = codeFlows(state.catalog), edge = projection.edges[0]!;
  const corrections = new Corrections(state.catalog), note = corrections.save({requestId: 'review', buildId: state.second, targetKind: 'code-link', targetId: edge.id,
    projectionHash: projection.inputHash, expectedRevision: state.catalog.state().correctionRevision, expectedPreviousId: null,
    action: 'clarify', statement: 'Synthetic migration review.', environment: 'local'});
  const context = retrieveAnswerContext(state.catalog, 'orders');
  state.store.run(`INSERT INTO answer_attempts (id,requestId,payloadHash,question,buildId,policyVersion,registryVersion,status,context,inputHash,connection,model,effort,promptVersion,schemaVersion,result,createdAt)
    VALUES ('saved','saved','hash','orders',?,?,?,'succeeded',?,?,'{}','fixture','medium','fixture','fixture','{}','now')`,
    state.second, state.store.project().policyVersion, state.store.project().sourceSetVersion, JSON.stringify(context), context.inputHash);
  for (const source of state.store.sources()) state.store.run("INSERT INTO answer_sources VALUES ('saved',?)", source.id);
  removeExternalSearchSchema(state.store.db);
  state.store.db.exec("UPDATE search SET rowid=rowid+5000; INSERT INTO search(search,rank) VALUES('rank','bm25(0.0, 2.0)'); INSERT INTO search(search,rank) VALUES('automerge',0)");
  const before = literalIndexSnapshot(state.store), reads = readQueries(state.catalog, [state.first, state.second]);
  const originals = state.store.all<{id: string}>('SELECT id FROM spans').map(row => state.catalog.evidence(row.id));
  const settings = state.store.all('SELECT * FROM search_config ORDER BY k'), inventory = state.analysis.get(run.id), review = corrections.history(note.id);
  await state.reopen(); const after = literalIndexSnapshot(state.store);
  assert.equal(state.store.one<{user_version: number}>('PRAGMA user_version')!.user_version, 9);
  for (const key of ['vocabulary','documents','documentSizes','totals','nonLiteralRecords']) assert.deepEqual(after[key], before[key], key);
  assert.deepEqual(state.store.all('SELECT * FROM search_config ORDER BY k'), settings);
  assert.deepEqual(readQueries(state.catalog, [state.first, state.second]), reads);
  assert.deepEqual(originals.map(row => state.catalog.evidence(row.id)), originals);
  assert.deepEqual(state.analysis.get(run.id), inventory); assert.deepEqual(new Corrections(state.catalog).history(note.id), review);
  assert.equal(state.store.one("SELECT name FROM sqlite_schema WHERE name='search_content'"), undefined); validate(state.store);
  await state.reopen(); assert.deepEqual(readQueries(state.catalog, [state.first, state.second]), reads);
  const build = state.store.build(await state.index('refresh')); assert.equal(build.refresh!.reusedFiles, build.coverage.indexed); validate(state.store);
  const source = state.store.sources().find(source => source.name === 'portal')!;
  state.catalog.revoke(source.id); validate(state.store);
  assert.equal(state.store.one<{n: number}>(`SELECT count(*) AS n FROM literal_search_documents d JOIN spans s ON s.id=d.spanId
    JOIN files f ON f.id=s.fileId WHERE f.sourceId=?`, source.id)!.n, 0);
  assert.equal(state.store.one<{context: unknown}>("SELECT context FROM answer_attempts WHERE id='saved'")!.context, null);
  assert.ok(state.catalog.search('alpha', state.first).hits.length === 0);
  state.store.db.exec('VACUUM'); await state.reopen(); validate(state.store);
  state.catalog.updatePolicy(['config']); assert.throws(() => state.catalog.search('orders', state.first), {code: 'POLICY_CHANGED'});
});

test('file insertion failure rolls back the new mapping, both FTS indexes and original checkpoint together', async t => {
  const state = await setup(t), project = state.store.project(), build = state.store.start('rollback', project.sourceSetVersion, project.policyVersion);
  const source = state.store.sources()[0]!, id = 'owned-failing-file';
  state.store.run("INSERT INTO files (id,buildId,sourceId,path,mode,blob,size) VALUES (?,?,?,'failure.md','100644','fixture',5)", id, build.id, source.id);
  const file = state.store.one<FileRow>('SELECT * FROM files WHERE id=?', id)!, before = logicalRows(state.store.db);
  const original = state.store.run.bind(state.store);
  state.store.run = (sql, ...args) => {if (sql.startsWith('INSERT INTO question_search')) throw new Error('Owned checkpoint failure.'); return original(sql, ...args);};
  assert.throws(() => state.store.finishFile(file, {raw: Buffer.from('alpha'), text: 'alpha', metadata: {}}), /Owned checkpoint failure/);
  state.store.run = original; assert.deepEqual(logicalRows(state.store.db), before); validate(state.store);
  await state.reopen(); assert.equal(state.store.buildRow(build.id).status, 'interrupted'); validate(state.store);
});

test('a failed purge rolls back postings and mappings while revocation remains fenced, then completes on retry', async t => {
  const state = await setup(t), source = state.store.sources().find(source => source.name === 'portal')!;
  state.store.revoke(source.id); const before = logicalRows(state.store.db), original = state.store.run.bind(state.store);
  state.store.run = (sql, ...args) => {if (sql.startsWith('DELETE FROM spans')) throw new Error('Owned purge failure.'); return original(sql, ...args);};
  assert.throws(() => state.store.purge(), /Owned purge failure/); state.store.run = original;
  assert.deepEqual(logicalRows(state.store.db), before); validate(state.store);
  assert.equal(state.catalog.search('alpha').hits.length, 0); assert.equal(state.store.source(source.id).purge, 'pending');
  state.store.purge(); validate(state.store); assert.equal(state.store.source(source.id).purge, 'completed');
  await state.reopen(); assert.equal(state.catalog.search('alpha').hits.length, 0); validate(state.store);
});

test('invalid legacy content/layout and mid-conversion errors preserve schema 8, pending recovery state and ownership', async t => {
  const state = await setup(t), project = state.store.project(); state.store.start('pending', project.sourceSetVersion, project.policyVersion);
  removeExternalSearchSchema(state.store.db); await state.close();
  const cases = [
    {name: 'mismatched text', sql: "UPDATE spans SET text='changed original' WHERE id=(SELECT id FROM spans LIMIT 1)", error: /must agree/},
    {name: 'missing document', sql: 'DELETE FROM search WHERE rowid=(SELECT min(rowid) FROM search)', error: /must agree/},
    {name: 'duplicate document', sql: 'INSERT INTO search(spanId,text) SELECT spanId,text FROM search LIMIT 1', error: /must agree/},
    {name: 'corrupt postings', sql: "UPDATE search_content SET c1='corrupt postings' WHERE id=(SELECT min(id) FROM search_content)", error: /malformed/},
    {name: 'conversion collision', sql: 'CREATE VIEW literal_search_content AS SELECT 1', error: /already exists/},
    {name: 'unsupported layout', sql: "DROP TABLE search; CREATE VIRTUAL TABLE search USING fts5(spanId UNINDEXED,text,tokenize='porter unicode61')", error: /Unsupported legacy/}
  ];
  for (const entry of cases) await t.test(entry.name, async () => {
    const directory = path.join(state.fixture.root, entry.name); await mkdir(directory);
    await copyFile(path.join(state.directory, 'loredock.db'), path.join(directory, 'loredock.db'));
    let db = new DatabaseSync(path.join(directory, 'loredock.db')); db.exec(entry.sql); const before = logicalRows(db); db.close();
    assert.throws(() => new CatalogStore(directory), entry.error);
    db = new DatabaseSync(path.join(directory, 'loredock.db'));
    try {assert.equal(db.prepare('PRAGMA user_version').get()!.user_version, 8); assert.deepEqual(logicalRows(db), before);
      assert.equal(db.prepare("SELECT name FROM sqlite_schema WHERE name='literal_search_documents'").get(), undefined);
      assert.equal(db.prepare("SELECT status FROM builds WHERE requestId='pending'").get()!.status, 'preparing');}
    finally {db.close();}
    const owner = new DatabaseSync(path.join(directory, '.owner.db')); owner.exec('BEGIN EXCLUSIVE; ROLLBACK;'); owner.close();
  });
});

test('empty legacy migration and fresh schema 9 both admit new indexing', async t => {
  const fixture = await createLoreDockFixture(); t.after(() => rm(fixture.root, {recursive: true, force: true}));
  for (const legacy of [false, true]) {
    const directory = path.join(fixture.root, `empty-${legacy}`); let store = new CatalogStore(directory);
    if (legacy) {removeExternalSearchSchema(store.db); store.close(); store = new CatalogStore(directory);}
    const catalog = new Catalog(store);
    try {validate(store); await catalog.addSource(path.join(fixture.root, 'sources/order-api'));
      const state = catalog.state(); catalog.start('new', state.sourceSetVersion, state.policyVersion); await catalog.idle();
      assert.ok(catalog.search('orders').hits.length); validate(store);}
    finally {await catalog.stop(); store.close();}
  }
});

test('the archived feasibility result recounts without executing its schema-8 experiment', async () => {
  await verifySearchStorageContract();
  const result = JSON.parse(gunzipSync(await readFile(new URL('../../../docs/fixtures/loredock-search-storage/raw-result.json.gz', import.meta.url))).toString()).result;
  assert.equal(assessSearchStorage(result).mechanical, true); assert.equal(assessSearchStorage(result).comparisons, 182);
  const saved = result.lifecycle.pop(); assert.equal(assessSearchStorage(result).mechanical, false); result.lifecycle.push(saved);
  const query = result.stages[2].queries.find((row: {generation: number; candidate: {literal: {value: {hits: unknown[]}}}}) => row.generation === 2 && row.candidate.literal.value.hits.length);
  const snippet = query.candidate.literal.value.hits[0].snippet; query.candidate.literal.value.hits[0].snippet = 'Incorrect snippet';
  assert.ok(assessSearchStorage(result).failures.length > 0); query.candidate.literal.value.hits[0].snippet = snippet;
  const row = result.stages[2].queries.find((row: {generation: number; candidate: {context: {value: {interfaces: {comparisons: unknown[]}}}}}) => row.generation === 2 && row.candidate.context.value.interfaces.comparisons.length);
  row.candidate.context.value.interfaces.comparisons[0].evidenceIds.reverse(); assert.equal(assessSearchStorage(result).mechanical, true);
  row.candidate.context.value.interfaces.comparisons[0].evidenceIds.pop(); assert.equal(assessSearchStorage(result).mechanical, false);
});
