import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, rm, readFile, cp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { services } from '../loredock-native-qualification/services.mjs';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { receiptFixture } from '../loredock-receipt-fixture.mjs';
import { QuestionPreparations } from '../../apps/loredock/dist/question-preparation.js';
import { AnswerWitnessStore, preparedAnswerRequestHash } from '../../apps/loredock/dist/answer-witness-store.js';
import { Answers } from '../../apps/loredock/dist/answers.js';
import { validateQuestionWitness } from '../../apps/loredock/dist/question-witness.js';
import { loadPriorRuntime } from '../../apps/loredock/tests/fixtures/native-before-analysis-writes/load.mjs';
import { verifyAnswerStorageDelta } from '../../apps/loredock/tests/fixtures/answer-witness-reference/verify.mjs';
import { auditStorage } from '../loredock-storage.mjs';
import { auditHistory } from '../loredock-history.mjs';
import { compactStorage } from '../loredock-compact.mjs';

const code = expected => error => error.code === expected;
const hash = value => createHash('sha256').update(value).digest('hex');
const question = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
function corpus() {
  const value = corpusFactory();
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete value['a-permit-ui'][`ui/${name}.vue`];
  return value;
}
async function setup(t, analyze = true) {
  const parent = await mkdtemp(path.join(tmpdir(), 'answer-witness-'));
  const fixture = await receiptFixture(parent, corpus(), services), owner = new QuestionPreparations(fixture.analysis);
  t.after(async () => { await owner.stop(); await fixture.close(); await rm(parent, { recursive: true, force: true }); });
  if (analyze) await fixture.analyze();
  const start = owner.start('prepare', question); await owner.idle(); const preview = owner.review(start.id);
  let snapshot; const marker = new Error('Keep the ready snapshot for storage tests.');
  assert.throws(() => owner.promote(preview.id, preview.reviewedHash, value => { snapshot = value; throw marker; }), error => error === marker);
  const storage = new AnswerWitnessStore(fixture.catalog);
  const input = () => ({ id: randomUUID(), requestId: randomUUID(), preparationId: preview.id,
    connection: { executable: process.execPath, configHome: parent, profile: null }, model: 'gpt-5.6-terra', effort: 'medium' });
  return { fixture, owner, storage, input, snapshot, preview, parent };
}

test('schema-11 promotion commits exact owned strings and all dependencies without a model or native history write', async t => {
  const { fixture, owner, storage, input, snapshot, preview } = await setup(t), request = input();
  const before = fixture.counters();
  const promoted = owner.promote(preview.id, preview.reviewedHash, value => storage.create(request, value));
  assert.equal(promoted.value.id, request.id); assert.equal(owner.get(preview.id).status, 'consumed'); promoted.release();
  assert.deepEqual(storage.read(request.id), snapshot);
  const row = fixture.store.one('SELECT * FROM answer_attempts WHERE id=?', request.id), witness = JSON.parse(snapshot.witnessJson);
  assert.equal(row.inputKind, 'prepared-question/1'); assert.equal(row.status, 'preparing'); assert.equal(row.runtime, null);
  assert.equal(row.payloadHash, preparedAnswerRequestHash(preview.id, preview.reviewedHash));
  assert.deepEqual(fixture.store.all('SELECT sourceId FROM answer_sources WHERE answerId=? ORDER BY sourceId', request.id).map(row => row.sourceId), witness.sourceIds);
  assert.equal(witness.sourceIds.length, 4); assert.equal(new Set(preview.context.spans.map(row => row.sourceId)).size, 3);
  const savedBudget = new services.OperationBudget(); try { assert.deepEqual(fixture.store.receipts.ids(savedBudget), []); } finally { savedBudget.close(); }
  assert.equal(fixture.counters().gitCalls, before.gitCalls); assert.equal(fixture.counters().factReads, before.factReads);
  assert.deepEqual(storage.stats(), { records: 1, retained: 1, purged: 0, bytes: Buffer.byteLength(snapshot.witnessJson) });
  const legacy = new Answers(fixture.catalog, { prepare() { throw new Error('Must not dispatch.'); } });
  assert.throws(() => legacy.get(request.id), code('ANSWER_INPUT_UNSUPPORTED')); await legacy.stop();
  assert.equal((await validateQuestionWitness(fixture.catalog, storage.read(request.id))).reviewedHash, preview.reviewedHash);
});

test('each transaction failure rolls back attempts, partial dependency inserts and witness while Ready remains usable', async t => {
  const { fixture, owner, storage, input, preview } = await setup(t);
  for (const [table, timing, condition] of [['answer_attempts', 'BEFORE', '1'], ['answer_sources', 'BEFORE', '(SELECT count(*) FROM answer_sources)=2'],
    ['answer_witnesses', 'BEFORE', '1'], ['answer_witnesses', 'AFTER', '1']]) {
    fixture.store.db.exec(`CREATE TRIGGER witness_test_failure ${timing} INSERT ON ${table} WHEN ${condition} BEGIN SELECT RAISE(ABORT,'Injected witness transaction failure.'); END;`);
    assert.throws(() => owner.promote(preview.id, preview.reviewedHash, value => storage.create(input(), value)), /Injected witness transaction failure/);
    for (const name of ['answer_attempts', 'answer_sources', 'answer_witnesses']) assert.equal(fixture.store.one('SELECT count(*) AS n FROM ' + name).n, 0);
    assert.equal(owner.get(preview.id).status, 'ready'); fixture.store.db.exec('DROP TRIGGER witness_test_failure');
  }
  const request = input(), result = owner.promote(preview.id, preview.reviewedHash, value => storage.create(request, value)); result.release();
  assert.equal(storage.read(request.id).reviewedHash, preview.reviewedHash);
});

test('source-only witnesses are required, terminal inputs are immutable and missing/new versions never fall back', async t => {
  const { fixture, storage, input, snapshot } = await setup(t, false), request = input(); storage.create(request, snapshot);
  assert.equal(JSON.parse(snapshot.witnessJson).compact.reason, 'INVENTORY_UNAVAILABLE');
  fixture.store.run("UPDATE answer_attempts SET status='failed',reason='Synthetic terminal result.' WHERE id=?", request.id);
  assert.deepEqual(storage.read(request.id), snapshot);
  for (const sql of ["UPDATE answer_attempts SET context='{}'", "UPDATE answer_attempts SET inputKind='legacy'",
    "UPDATE answer_witnesses SET witness='{}',witnessBytes=2", 'DELETE FROM answer_witnesses', 'DELETE FROM answer_sources',
    "UPDATE answer_witnesses SET reviewedHash='changed'"]) assert.throws(() => fixture.store.run(sql), /immutable|purge/);
  fixture.store.db.exec('DROP TRIGGER answer_witness_identity'); fixture.store.run("UPDATE answer_witnesses SET schemaVersion='unknown'");
  assert.throws(() => storage.read(request.id), code('ANSWER_WITNESS_INVALID'));
  fixture.store.db.exec('DROP TRIGGER answer_witness_delete'); fixture.store.run('DELETE FROM answer_witnesses');
  assert.throws(() => storage.read(request.id), code('ANSWER_WITNESS_MISSING'));
  assert.equal(auditHistory(fixture.store.directory).referenceChecks.preparedOwnershipViolations, 1);
});

test('all 64 retained records consume independent capacity and a refused 65th leaves a current preview Ready', async t => {
  const { fixture, owner, storage, input, snapshot, preview } = await setup(t, false);
  for (let i = 0; i < 64; i++) { const { id } = storage.create(input(), snapshot); fixture.store.run("UPDATE answer_attempts SET status='failed' WHERE id=?", id); }
  assert.equal(storage.stats().records, 64); const before = fixture.store.one('SELECT count(*) AS n FROM answer_attempts').n;
  assert.throws(() => owner.promote(preview.id, preview.reviewedHash, value => storage.create(input(), value)), code('ANSWER_WITNESS_LIMIT'));
  assert.equal(owner.get(preview.id).status, 'ready'); assert.equal(fixture.store.one('SELECT count(*) AS n FROM answer_attempts').n, before);
  const budget = new services.OperationBudget(); try { assert.deepEqual(fixture.store.receipts.ids(budget), []); } finally { budget.close(); }
});

test('revoking a dependency outside the selected graph purges exact answer/witness text and retains quota tombstones', async t => {
  const { fixture, storage, input, snapshot } = await setup(t), request = input(); storage.create(request, snapshot);
  const context = JSON.parse(snapshot.contextJson), witness = JSON.parse(snapshot.witnessJson);
  const graphSources = new Set(context.spans.map(row => row.sourceId)), omitted = witness.sourceIds.find(id => !graphSources.has(id)); assert(omitted);
  fixture.catalog.revoke(omitted);
  assert.throws(() => storage.read(request.id), code('ANSWER_INPUT_FENCED'));
  const row = fixture.store.one('SELECT * FROM answer_witnesses WHERE answerId=?', request.id);
  assert.equal(row.witness, null); assert.equal(row.witnessBytes, 0); assert.equal(row.purged, 1); assert.equal(row.reviewedHash, snapshot.reviewedHash);
  assert.deepEqual(storage.stats(), { records: 1, retained: 0, purged: 1, bytes: 0 });
  const attempt = fixture.store.one('SELECT * FROM answer_attempts WHERE id=?', request.id);
  assert.equal(attempt.context, null); assert.equal(attempt.result, null); assert.equal(attempt.status, 'fenced');
});

test('SQL purge failure fences retained text and startup retries the complete dependent transaction', async t => {
  const { fixture, owner, storage, input, snapshot } = await setup(t), request = input(); storage.create(request, snapshot);
  const source = JSON.parse(snapshot.witnessJson).sourceIds[0];
  fixture.store.db.exec("CREATE TRIGGER witness_purge_failure BEFORE UPDATE OF raw ON files BEGIN SELECT RAISE(ABORT,'Injected purge interruption.'); END;");
  assert.throws(() => fixture.catalog.revoke(source), /Injected purge interruption/);
  assert.equal(fixture.store.source(source).purge, 'pending'); assert.throws(() => storage.read(request.id), code('ANSWER_INPUT_FENCED'));
  assert.equal(fixture.store.one('SELECT witness FROM answer_witnesses').witness, snapshot.witnessJson);
  assert.equal(fixture.store.one('SELECT context FROM answer_attempts').context, snapshot.contextJson);
  fixture.store.db.exec('DROP TRIGGER witness_purge_failure'); await owner.stop(); await fixture.restart();
  assert.equal(fixture.store.source(source).purge, 'completed'); assert.equal(fixture.store.one('SELECT witness FROM answer_witnesses').witness, null);
  assert.equal(fixture.store.one('SELECT context FROM answer_attempts').context, null);
});

test('inventory eviction and restart retain issued bytes while unfinished answers become interrupted without dispatch', async t => {
  const { fixture, owner, storage, input, snapshot } = await setup(t), request = input(); storage.create(request, snapshot);
  const receipt = JSON.parse(JSON.parse(snapshot.witnessJson).receipt), inventory = JSON.parse(receipt.projectionJson).identity.inventoryId;
  await fixture.analyze('second'); await fixture.analyze('third'); assert.throws(() => fixture.analysis.get(inventory), code('NOT_FOUND'));
  assert.deepEqual(storage.read(request.id), snapshot); await owner.stop(); await fixture.restart();
  const restored = new AnswerWitnessStore(fixture.catalog); assert.deepEqual(restored.read(request.id), snapshot);
  assert.equal(fixture.store.one('SELECT status FROM answer_attempts WHERE id=?', request.id).status, 'interrupted');
  assert.equal((await validateQuestionWitness(fixture.catalog, restored.read(request.id))).reviewedHash, snapshot.reviewedHash);
});

test('stopped reporting, compaction and complete backup preserve prepared strings and report no source text', async t => {
  const { fixture, owner, storage, input, snapshot, parent } = await setup(t), request = input(); storage.create(request, snapshot);
  const directory = fixture.store.directory, expectedBytes = Buffer.byteLength(snapshot.witnessJson), report = auditStorage(directory), history = auditHistory(directory);
  assert.equal(report.databaseVersion, 11); assert.deepEqual(report.payloads.answerWitnesses, { rows: 1, bytes: expectedBytes, retained: 1, purged: 0 });
  assert.equal(history.generations.items[0].answerWitnesses.bytes, expectedBytes); assert.equal(history.referenceChecks.status, 'passed');
  assert(!JSON.stringify([report, history]).includes('PermitWriter.onMessage'));
  await owner.stop(); await fixture.paths.stop(); await fixture.analysis.stop(); await fixture.catalog.stop(); fixture.store.close();
  const compacted = compactStorage(directory); assert.deepEqual(compacted.before.payloads, compacted.after.payloads);
  const backup = path.join(parent, 'complete-backup'); await cp(directory, backup, { recursive: true });
  const restored = new services.CatalogStore(backup), catalog = new services.Catalog(restored);
  try { assert.deepEqual(new AnswerWitnessStore(catalog).read(request.id), snapshot); } finally { await catalog.stop(); restored.close(); }
});

test('genuine schema-10 runtime state migrates without rewriting legacy answers or native receipts and refuses downgrade', async t => {
  const parent = await mkdtemp(path.join(tmpdir(), 'witness-genuine-old-')), prior = await loadPriorRuntime();
  const fixture = await receiptFixture(parent, corpus(), prior.services); let stopped = false, current;
  t.after(async () => { current?.close(); if (!stopped) await fixture.close(); await rm(parent, { recursive: true, force: true }); });
  await fixture.analyze(); const captures = new prior.services.NativeCaptures(fixture.analysis);
  const saved = await captures.capture({ buildId: fixture.buildId }); await captures.stop();
  const legacy = new Answers(fixture.catalog, { async prepare() { throw new Error('Synthetic preflight stop.'); } });
  await legacy.configure({ executable: process.execPath, configHome: parent, profile: null });
  const preview = legacy.preview(question), attempt = legacy.start('legacy', question, fixture.buildId, preview.inputHash); await legacy.idle();
  const oldRow = fixture.store.one('SELECT * FROM answer_attempts WHERE id=?', attempt.id), oldResponse = legacy.get(attempt.id);
  const directory = fixture.store.directory, catalogId = fixture.store.receipts.catalogId;
  const file = path.join(directory, 'path-receipts', catalogId, saved.receiptId + '.json'), oldReceipt = await readFile(file);
  await legacy.stop(); await fixture.paths.stop(); await fixture.analysis.stop(); await fixture.catalog.stop(); fixture.store.close(); stopped = true;
  const execute = DatabaseSync.prototype.exec;
  DatabaseSync.prototype.exec = function(sql) {
    if (sql.includes('CREATE TABLE answer_witnesses')) { execute.call(this, sql.split('CREATE INDEX answer_source_purge')[0]); throw new Error('Injected partial schema migration.'); }
    return execute.call(this, sql);
  };
  try { assert.throws(() => new services.CatalogStore(directory), /Injected partial schema migration/); } finally { DatabaseSync.prototype.exec = execute; }
  const failed = new DatabaseSync(path.join(directory, 'loredock.db'), { readOnly: true });
  try { assert.equal(failed.prepare('PRAGMA user_version').get().user_version, 10);
    assert.equal(failed.prepare("SELECT name FROM sqlite_schema WHERE name='answer_witnesses'").get(), undefined);
    assert.deepEqual(failed.prepare('SELECT * FROM answer_attempts WHERE id=?').get(attempt.id), oldRow);
  } finally { failed.close(); }
  current = new services.CatalogStore(directory); const catalog = new services.Catalog(current);
  assert.equal(current.one('PRAGMA user_version').user_version, 11); const { inputKind, ...migrated } = current.one('SELECT * FROM answer_attempts WHERE id=?', attempt.id);
  assert.equal(inputKind, 'legacy'); assert.equal(JSON.stringify(migrated), JSON.stringify(oldRow)); assert.deepEqual(await readFile(file), oldReceipt);
  const currentAnswers = new Answers(catalog, { prepare() { throw new Error('Must not dispatch.'); } });
  assert.deepEqual(currentAnswers.get(attempt.id), oldResponse); await currentAnswers.stop(); await catalog.stop(); current.close(); current = undefined;
  assert.throws(() => new prior.services.CatalogStore(directory), /Unsupported LoreDock database version/);
  const db = new DatabaseSync(path.join(directory, 'loredock.db'), { readOnly: true });
  try { assert.equal(db.prepare('PRAGMA user_version').get().user_version, 11); } finally { db.close(); }
  current = new services.CatalogStore(directory); assert.equal(current.receipts.catalogId, catalogId);
  assert.deepEqual(await readFile(file), oldReceipt);
});

test('accepted source and emitted controls preserve exact storage deltas and every other application module', async () => {
  for (const name of ['store', 'answers']) await verifyAnswerStorageDelta(name);
  const root = new URL('../../', import.meta.url), manifest = JSON.parse(await readFile(new URL('apps/loredock/tests/fixtures/answer-witness-reference/manifest.json', root)));
  for (const [file, expected] of Object.entries(manifest.existingFiles)) {
    if (file.startsWith('scripts/') || /\/(store|answers)\.(ts|js)$/.test(file)) continue;
    const raw = await readFile(new URL(file, root)); assert.equal(raw.length, expected.bytes); assert.equal(hash(raw), expected.sha256, file);
  }
});

test('SQL quota constraints count actual UTF-8 bytes at 768 KiB and 48 MiB independently of JSON validity', async t => {
  const { fixture, storage, input, snapshot } = await setup(t, false), template = input();
  storage.create(template, snapshot);
  const original = fixture.store.one('SELECT * FROM answer_attempts WHERE id=?', template.id);
  // This isolates SQL byte limits. These deliberately non-JSON payloads are never
  // presented as valid prepared inputs, and the reader must refuse them.
  const columns = Object.keys(original), seed = (text, claimedBytes = Buffer.byteLength(text)) => fixture.store.transaction(() => {
    const id = randomUUID(), row = { ...original, id, requestId: id };
    fixture.store.run(`INSERT INTO answer_attempts (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, ...columns.map(key => row[key]));
    fixture.store.run(`INSERT INTO answer_witnesses (answerId,preparationId,schemaVersion,compositionVersion,promptVersion,contextHash,reviewedHash,witness,witnessBytes)
      VALUES (?,?,?,?,?,?,?,?,?)`, id, template.preparationId, 'loredock-answer-witness/1', 'loredock-prepared-question/1',
    'loredock-prepared-answer-v1', hash(snapshot.contextJson), snapshot.reviewedHash, text, claimedBytes); return id;
  });
  const maximum = '雪'.repeat(262144); assert.equal(Buffer.byteLength(maximum), 768 * 1024);
  assert.throws(() => seed(maximum, maximum.length), /CHECK constraint/);
  assert.throws(() => seed(maximum + 'x'), /CHECK constraint/); assert.equal(storage.stats().records, 1);
  const maxId = seed(maximum); assert.throws(() => storage.read(maxId), code('ANSWER_WITNESS_INVALID'));
  for (let i = 2; i < 64; i++) seed(maximum);
  assert.equal(storage.stats().bytes, 63 * 768 * 1024 + Buffer.byteLength(snapshot.witnessJson));
  // Fill the already existing valid row to the exact SQL byte boundary in this
  // isolated corruption fixture; normal storage updates are immutable.
  fixture.store.db.exec('DROP TRIGGER answer_witness_purge');
  fixture.store.run('UPDATE answer_witnesses SET witness=?,witnessBytes=? WHERE answerId=?', maximum, Buffer.byteLength(maximum), template.id);
  assert.equal(storage.stats().bytes, 48 * 1024 * 1024); assert.equal(storage.stats().records, 64);
  assert.throws(() => seed('x'), /capacity reached/);
  assert.equal(fixture.store.one('SELECT count(*) AS n FROM answer_attempts').n, 64);
});

test('stored corruption and foreign ownership fail even when their outer hashes are recomputed', async t => {
  const { fixture, storage, input, snapshot } = await setup(t), request = input(); storage.create(request, snapshot);
  fixture.store.db.exec('DROP TRIGGER answer_witness_identity; DROP TRIGGER answer_witness_purge; DROP TRIGGER prepared_answer_identity;');
  for (const mutate of [value => { value.catalogId = randomUUID(); }, value => { value.prompt += 'Invented'; },
    value => { value.compact.item.nodes[0][1] = 'Invented'; }, value => { value.dependencies.pop(); }, value => { value.schemaVersion = 'unsupported'; }]) {
    const witness = JSON.parse(snapshot.witnessJson); mutate(witness); const serialized = JSON.stringify(witness);
    const reviewedHash = hash(JSON.stringify(['loredock-prepared-question/1', snapshot.contextJson, serialized]));
    fixture.store.run('UPDATE answer_witnesses SET witness=?,witnessBytes=?,reviewedHash=?', serialized, Buffer.byteLength(serialized), reviewedHash);
    fixture.store.run('UPDATE answer_attempts SET payloadHash=?', preparedAnswerRequestHash(request.preparationId, reviewedHash));
    assert.throws(() => storage.read(request.id));
  }
  fixture.store.run('UPDATE answer_witnesses SET witness=?,witnessBytes=?,reviewedHash=?', snapshot.witnessJson, Buffer.byteLength(snapshot.witnessJson), snapshot.reviewedHash);
  fixture.store.run('UPDATE answer_attempts SET payloadHash=?', preparedAnswerRequestHash(request.preparationId, snapshot.reviewedHash));
  assert.deepEqual(storage.read(request.id), snapshot);
  fixture.catalog.updatePolicy(['private']); const reads = fixture.store.one.bind(fixture.store); let witnessReads = 0;
  fixture.store.one = (sql, ...args) => { if (sql.includes('FROM answer_witnesses')) witnessReads++; return reads(sql, ...args); };
  assert.throws(() => storage.read(request.id), code('ANSWER_INPUT_FENCED')); assert.equal(witnessReads, 0);
  assert.equal(reads('SELECT witness FROM answer_witnesses').witness, snapshot.witnessJson);
});

test('abrupt process exit after every insert stage leaves no partially committed prepared answer', async t => {
  const { fixture, owner, snapshot, input, parent } = await setup(t, false);
  const saved = path.join(parent, 'held-input.json'); await writeFile(saved, JSON.stringify({ snapshot, input: input() }));
  await owner.stop(); await fixture.paths.stop(); await fixture.analysis.stop(); await fixture.catalog.stop(); fixture.store.close();
  const moduleUrl = name => new URL('../../apps/loredock/dist/' + name + '.js', import.meta.url).href;
  const script = `import {readFileSync} from 'node:fs';
    import {CatalogStore} from ${JSON.stringify(moduleUrl('store'))};
    import {Catalog} from ${JSON.stringify(moduleUrl('catalog'))};
    import {AnswerWitnessStore} from ${JSON.stringify(moduleUrl('answer-witness-store'))};
    const [directory,inputFile,table]=process.argv.slice(1), input=JSON.parse(readFileSync(inputFile));
    const store=new CatalogStore(directory),catalog=new Catalog(store),run=store.run.bind(store);
    store.run=(sql,...args)=>{const result=run(sql,...args);if(sql.startsWith('INSERT INTO '+table)) process.exit(23);return result;};
    new AnswerWitnessStore(catalog).create(input.input,input.snapshot);process.exit(24);`;
  for (const table of ['answer_attempts', 'answer_sources', 'answer_witnesses']) {
    const directory = path.join(parent, table); await cp(fixture.store.directory, directory, { recursive: true });
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script, directory, saved, table], { encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 23, result.stderr); const store = new services.CatalogStore(directory), catalog = new services.Catalog(store);
    try { for (const name of ['answer_attempts', 'answer_sources', 'answer_witnesses']) assert.equal(store.one('SELECT count(*) AS n FROM ' + name).n, 0); }
    finally { await catalog.stop(); store.close(); }
  }
});
