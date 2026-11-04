import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, symlinkSync, truncateSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CatalogStore } from '../src/store.js';
import { Catalog } from '../src/catalog.js';
import { OperationBudget } from '../src/operation-budget.js';
import type { NativeStorageOptions } from '../src/native-receipt-files.js';
import type { NativeReceiptContent, ReceiptProjection } from '../src/native-receipt-types.js';
import { CatalogStore as ReferenceStore } from './fixtures/integration-reference/index.js';
import { recordFixture, serialized, sealProjection, sourceId } from './fixtures/native-receipt-record.js';
// @ts-expect-error Source-only maintenance has no application recovery or native file operations.
import { auditStorage } from '../../../scripts/loredock-storage.mjs';
// @ts-expect-error Existing offline source-only compaction.
import { compactStorage } from '../../../scripts/loredock-compact.mjs';
// @ts-expect-error Existing read-only source history report.
import { auditHistory } from '../../../scripts/loredock-history.mjs';

async function setup(t: TestContext, options: NativeStorageOptions = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'native-storage-')); let store = new CatalogStore(directory, options);
  t.after(async () => { store.close(); await rm(directory, { recursive: true, force: true }); });
  return { directory, get store() { return store; }, get folder() { return path.join(directory, 'path-receipts', store.receipts.catalogId); },
    reopen(next: NativeStorageOptions = {}) { store.close(); store = new CatalogStore(directory, next); return store; } };
}
function content(store: CatalogStore, label = 'inspect', source = sourceId): NativeReceiptContent {
  const record = JSON.parse(JSON.stringify(recordFixture()).replaceAll(sourceId, source)) as NativeReceiptContent;
  record.catalogId = store.receipts.catalogId; const projection = JSON.parse(record.projectionJson) as ReceiptProjection;
  projection.graph.nodes[0]!.label = label; Object.assign(projection.roots.items[0]!, { label });
  record.projectionJson = JSON.stringify(sealProjection(projection)); return record;
}
function publish(store: CatalogStore, record: NativeReceiptContent, guard: () => unknown = () => undefined) {
  const budget = new OperationBudget(); try { return store.receipts.publish(serialized(record), budget, guard); } finally { budget.close(); }
}
function read(store: CatalogStore, id: string) {
  const budget = new OperationBudget(); try { return store.receipts.read(id, budget); } finally { budget.close(); }
}
function source(store: CatalogStore, id = sourceId) {
  store.run("INSERT INTO sources VALUES (?, 'client', ?, ?, 'active', 'none')", id, '/owned/' + id, '/owned/' + id + '/.git'); return id;
}

test('owned storage is lazy, bounded, content-idempotent and source-read-only through reopen and close', async t => {
  const s = await setup(t, { limits: { records: 2 } }), id = s.store.receipts.catalogId;
  assert.equal(existsSync(path.join(s.directory, 'path-receipts')), false);
  const before = s.store.one<{ n: number }>('SELECT total_changes() n')!.n, first = content(s.store), saved = publish(s.store, first);
  assert.equal(saved.created, true); assert.equal(read(s.store, saved.receiptHash).serialized, serialized(first).toString());
  const second = publish(s.store, content(s.store, 'second')); assert.equal(second.created, true);
  assert.equal(publish(s.store, first).created, false);
  assert.throws(() => publish(s.store, content(s.store, 'third')), { code: 'CAPTURE_STORAGE_FULL' });
  assert.equal(s.store.one<{ n: number }>('SELECT total_changes() n')!.n, before);
  assert.deepEqual(readdirSync(s.folder).sort(), [saved.receiptHash + '.json', second.receiptHash + '.json'].sort());
  assert.throws(() => new CatalogStore(s.directory), /already in use/);
  const old = s.store.receipts; s.reopen(); assert.equal(s.store.receipts.catalogId, id);
  assert.equal(read(s.store, saved.receiptHash).serialized, serialized(first).toString());
  assert.throws(() => { const budget = new OperationBudget(); try { old.read(saved.receiptHash, budget); } finally { budget.close(); } }, { code: 'CLOSED_RECEIPT_STORAGE' });
  s.store.close(); s.store.close();
});

test('publication failure removes new files, preserves existing records and keeps cleanup errors explicit', async t => {
  let fail: string | undefined, guardCalls = 0;
  const s = await setup(t, { observe(stage) { if (stage === fail) { fail = undefined; throw new Error('Owned injected failure.'); } } });
  const original = content(s.store), saved = publish(s.store, original), originalBytes = readFileSync(path.join(s.folder, saved.receiptHash + '.json'));
  for (const stage of ['pending-written', 'linked', 'before-unlink', 'before-sync']) {
    fail = stage; assert.throws(() => publish(s.store, content(s.store, stage)), /Owned injected failure/);
    assert.deepEqual(readdirSync(s.folder), [saved.receiptHash + '.json']); assert.deepEqual(readFileSync(path.join(s.folder, saved.receiptHash + '.json')), originalBytes);
  }
  assert.throws(() => publish(s.store, original, () => { if (++guardCalls === 3) throw new Error('Existing result fenced.'); }), /fenced/);
  assert.deepEqual(readFileSync(path.join(s.folder, saved.receiptHash + '.json')), originalBytes);
  assert.throws(() => publish(s.store, content(s.store, 'async'), () => Promise.resolve()), { code: 'INVALID_RECEIPT_GUARD' });
  assert.throws(() => publish(s.store, content(s.store, 'close'), () => s.store.close()), { code: 'RECEIPT_STORAGE_BUSY' });
  assert.equal(publish(s.store, original).created, false);
  let active = false;
  s.reopen({ observe(stage) { if (active && stage === 'before-sync') throw new Error('Injected fsync failure.'); } }); active = true;
  assert.throws(() => publish(s.store, content(s.store, 'sync-failure')), { code: 'RECEIPT_CLEANUP_FAILED' });
  assert.throws(() => read(s.store, saved.receiptHash), { code: 'DISABLED_RECEIPT_STORAGE' });
  s.reopen(); assert.deepEqual(readFileSync(path.join(s.folder, saved.receiptHash + '.json')), originalBytes);
});

test('startup removes only a bounded recognized pending file and retains a complete lost-response record', async t => {
  const s = await setup(t), value = content(s.store), saved = publish(s.store, value), file = path.join(s.folder, saved.receiptHash + '.json');
  s.store.close(); writeFileSync(path.join(s.folder, '.pending'), '{"incomplete":');
  s.reopen(); assert.equal(existsSync(path.join(s.folder, '.pending')), false); assert.equal(read(s.store, saved.receiptHash).serialized, serialized(value).toString());
  s.store.close(); const bytes = readFileSync(file); writeFileSync(file, '{}'); writeFileSync(path.join(s.folder, '.pending'), 'partial');
  assert.throws(() => new CatalogStore(s.directory), { code: 'CORRUPT_RECEIPT' });
  assert.equal(readFileSync(path.join(s.folder, '.pending'), 'utf8'), 'partial'); assert.equal(readFileSync(file, 'utf8'), '{}');
  writeFileSync(file, bytes); s.reopen(); assert.equal(publish(s.store, value).created, false);
});

test('descriptor reads reject growth and truncation; foreign IDs and filenames cannot become imports', async t => {
  let mutation: 'grow' | 'truncate' | undefined;
  const s = await setup(t, { observe(stage, name) { if (stage === 'read-sized' && mutation) {
    const selected = mutation; mutation = undefined; const file = path.join(s.folder, name);
    if (selected === 'grow') appendFileSync(file, 'x'); else truncateSync(file, 1);
  } } });
  const value = content(s.store), saved = publish(s.store, value), file = path.join(s.folder, saved.receiptHash + '.json'), bytes = readFileSync(file);
  for (const kind of ['grow', 'truncate'] as const) { mutation = kind;
    assert.throws(() => read(s.store, saved.receiptHash), { code: 'RECEIPT_FILE_CHANGED' }); writeFileSync(file, bytes);
  }
  assert.throws(() => read(s.store, '../loredock.db'), { code: 'INVALID_RECEIPT_ID' });
  assert.throws(() => publish(s.store, { ...value, catalogId: randomUUID() }), { code: 'RECEIPT_CATALOG_MISMATCH' });
  s.store.close(); renameSync(file, path.join(s.folder, 'f'.repeat(64) + '.json'));
  assert.throws(() => new CatalogStore(s.directory), { code: 'CORRUPT_RECEIPT' });
});

test('unexpected, symlink, FIFO, foreign-directory and oversize entries fail closed without deleting bytes', async t => {
  const cases = ['unknown', 'symlink', 'fifo', 'oversize', 'foreign-directory', 'root-symlink', 'too-many', 'oversize-pending'];
  for (const kind of cases) await t.test(kind, async sub => {
    const s = await setup(sub), saved = publish(s.store, content(s.store)), file = path.join(s.folder, saved.receiptHash + '.json'); s.store.close();
    let preserved = file;
    if (kind === 'unknown') { preserved = path.join(s.folder, 'unexpected'); writeFileSync(preserved, 'preserve'); }
    if (kind === 'symlink') { unlinkSync(file); symlinkSync(path.join(s.directory, 'loredock.db'), file); }
    if (kind === 'fifo') { unlinkSync(file); execFileSync('mkfifo', [file]); }
    if (kind === 'oversize') writeFileSync(file, Buffer.alloc(640 * 1024 + 1));
    if (kind === 'oversize-pending') { preserved = path.join(s.folder, '.pending'); writeFileSync(preserved, Buffer.alloc(640 * 1024 + 1)); }
    if (kind === 'foreign-directory') { preserved = path.join(s.directory, 'path-receipts', randomUUID()); mkdirSync(preserved); }
    if (kind === 'root-symlink') { const moved = path.join(s.directory, 'saved-owned'); renameSync(s.folder, moved); symlinkSync(moved, s.folder); preserved = s.folder; }
    if (kind === 'too-many') for (let index = 0; index < 65; index++) writeFileSync(path.join(s.folder, index.toString(16).padStart(64, '0') + '.json'), '{}');
    assert.throws(() => new CatalogStore(s.directory)); assert.equal(existsSync(preserved), true);
  });
});

test('revocation purges displayed and undisplayed dependencies, retains unrelated records and recovers partial deletion', async t => {
  let failName: string | undefined;
  const s = await setup(t, { observe(stage, name) { if (stage === 'before-unlink' && name === failName) throw new Error('Injected unlink failure.'); } });
  const revoked = source(s.store), unrelated = source(s.store, randomUUID());
  const first = publish(s.store, content(s.store, 'first', revoked)), other = publish(s.store, content(s.store, 'other', unrelated));
  const indirect = content(s.store, 'indirect', unrelated), projection = JSON.parse(indirect.projectionJson) as ReceiptProjection;
  indirect.dependencies.push({ ...indirect.dependencies[0]!, sourceId: revoked }); indirect.dependencies.sort((a, b) => a.sourceId < b.sourceId ? -1 : 1);
  projection.coverage.sources.push({ ...projection.coverage.sources[0]!, sourceId: revoked }); indirect.projectionJson = JSON.stringify(sealProjection(projection));
  const indirectSaved = publish(s.store, indirect);
  const beforePolicy = [first, other, indirectSaved].map(row => readFileSync(path.join(s.folder, row.receiptHash + '.json')));
  new Catalog(s.store).updatePolicy(['private']);
  assert.deepEqual([first, other, indirectSaved].map(row => readFileSync(path.join(s.folder, row.receiptHash + '.json'))), beforePolicy);
  const affected = [first.receiptHash, indirectSaved.receiptHash].sort(); failName = affected[1]! + '.json';
  s.store.revoke(revoked); assert.throws(() => s.store.purge(), /Injected unlink failure/);
  assert.equal(s.store.source(revoked).purge, 'pending'); assert.equal(existsSync(path.join(s.folder, affected[0] + '.json')), false);
  assert.equal(existsSync(path.join(s.folder, failName)), true); failName = undefined;
  s.reopen(); new Catalog(s.store); assert.equal(s.store.source(revoked).purge, 'completed');
  assert.deepEqual(readdirSync(s.folder), [other.receiptHash + '.json']); assert.ok(read(s.store, other.receiptHash));
});

test('source SQL failure keeps purge pending after native deletion, and corruption prevents guessed deletion', async t => {
  const s = await setup(t); source(s.store); const saved = publish(s.store, content(s.store));
  s.store.revoke(sourceId);
  s.store.db.exec("CREATE TRIGGER fail_purge BEFORE UPDATE OF purge ON sources WHEN NEW.purge='completed' BEGIN SELECT RAISE(ABORT,'Injected source purge failure.'); END;");
  assert.throws(() => s.store.purge(), /Injected source purge failure/); assert.equal(s.store.source(sourceId).purge, 'pending');
  assert.equal(existsSync(path.join(s.folder, saved.receiptHash + '.json')), false);
  s.store.db.exec('DROP TRIGGER fail_purge'); s.reopen(); new Catalog(s.store); assert.equal(s.store.source(sourceId).purge, 'completed');
  const next = source(s.store, randomUUID()), value = publish(s.store, content(s.store, 'corrupt', next));
  const file = path.join(s.folder, value.receiptHash + '.json'); writeFileSync(file, '{}'); s.store.revoke(next);
  assert.throws(() => s.store.purge(), { code: 'CORRUPT_RECEIPT' }); assert.equal(s.store.source(next).purge, 'pending'); assert.equal(readFileSync(file, 'utf8'), '{}');
});

test('schema identity migration is atomic, durable, private and rejected by a schema-9 owner', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'native-migration-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const legacy = new ReferenceStore(directory); source(legacy);
  const p = legacy.project(), pending = legacy.start('legacy-pending', p.sourceSetVersion, p.policyVersion); legacy.close();
  const run = CatalogStore.prototype.run;
  CatalogStore.prototype.run = function (sql, ...args) { if (sql.startsWith('INSERT INTO catalog_identity')) throw new Error('Injected identity migration failure.'); return run.call(this, sql, ...args); };
  try { assert.throws(() => new CatalogStore(directory), /Injected identity migration failure/); } finally { CatalogStore.prototype.run = run; }
  const before = new DatabaseSync(path.join(directory, 'loredock.db'), { readOnly: true });
  try { assert.equal(before.prepare('PRAGMA user_version').get()!.user_version, 9);
    assert.equal(before.prepare("SELECT name FROM sqlite_schema WHERE name='catalog_identity'").get(), undefined);
    assert.equal(before.prepare('SELECT status FROM builds WHERE id=?').get(pending.id)!.status, 'preparing'); } finally { before.close(); }
  const store = new CatalogStore(directory), id = store.receipts.catalogId;
  assert.equal(store.one<{ user_version: number }>('PRAGMA user_version')!.user_version, 10);
  assert.equal(store.buildRow(pending.id).status, 'interrupted'); assert.ok(!JSON.stringify(new Catalog(store).state()).includes(id));
  assert.throws(() => store.run('UPDATE catalog_identity SET id=?', randomUUID()), /immutable/);
  assert.throws(() => store.run('DELETE FROM catalog_identity'), /immutable/); store.close();
  assert.throws(() => new ReferenceStore(directory), /Unsupported/);
  const reopened = new CatalogStore(directory); assert.equal(reopened.receipts.catalogId, id); reopened.close();
});

test('complete stopped backup and source-only maintenance preserve identity and exact native files', async t => {
  const s = await setup(t), record = content(s.store), saved = publish(s.store, record), id = s.store.receipts.catalogId;
  s.store.close(); const originalBytes = readFileSync(path.join(s.folder, saved.receiptHash + '.json'));
  const report = auditStorage(s.directory), history = auditHistory(s.directory);
  assert.equal(report.databaseVersion, 10); assert.equal(history.databaseVersion, 10);
  assert.equal(report.payloads.literalSearch.contentStorage, 'shared-original-spans');
  assert.ok(report.limits.some((line: string) => line.includes('Native receipt'))); assert.ok(history.limits.some((line: string) => line.includes('Native receipt')));
  compactStorage(s.directory); assert.deepEqual(readFileSync(path.join(s.folder, saved.receiptHash + '.json')), originalBytes);
  const copy = await mkdtemp(path.join(tmpdir(), 'native-backup-')); t.after(() => rm(copy, { recursive: true, force: true })); cpSync(s.directory, copy, { recursive: true });
  const restored = new CatalogStore(copy); try { assert.equal(restored.receipts.catalogId, id); assert.equal(read(restored, saved.receiptHash).serialized, originalBytes.toString()); } finally { restored.close(); }
  s.reopen(); assert.equal(s.store.receipts.catalogId, id);
});

test('cleanup refuses a substituted inode and a closed/cancelled budget cannot publish', async t => {
  let swap = false, moved = '';
  const s = await setup(t, { observe(stage, name) { if (swap && stage === 'linked') {
    swap = false; const file = path.join(s.folder, name); moved = path.join(s.directory, 'owned-interrupted-result'); renameSync(file, moved);
    writeFileSync(file, 'preserve substituted bytes'); throw new Error('Injected replacement.');
  } } });
  const original = publish(s.store, content(s.store)); swap = true;
  assert.throws(() => publish(s.store, content(s.store, 'replaced')), { code: 'RECEIPT_CLEANUP_FAILED' });
  const replaced = readdirSync(s.folder).find(name => name !== original.receiptHash + '.json')!;
  assert.equal(readFileSync(path.join(s.folder, replaced), 'utf8'), 'preserve substituted bytes');
  assert.equal(existsSync(moved), true); assert.throws(() => read(s.store, original.receiptHash), { code: 'DISABLED_RECEIPT_STORAGE' });
  unlinkSync(path.join(s.folder, replaced)); s.reopen();
  const closed = new OperationBudget(); closed.close();
  assert.throws(() => s.store.receipts.publish(serialized(content(s.store)), closed, () => undefined), { code: 'CLOSED_CAPTURE_BUDGET' });
  const controller = new AbortController(), cancelled = new OperationBudget({ signal: controller.signal }); controller.abort();
  assert.throws(() => s.store.receipts.publish(serialized(content(s.store)), cancelled, () => undefined), { code: 'CANCELLED' }); cancelled.close();
  assert.throws(() => s.store.receipts.read(original.receiptHash, {} as OperationBudget), { code: 'INVALID_CAPTURE_BUDGET' });
  assert.deepEqual(readdirSync(s.folder), [original.receiptHash + '.json']);
});

test('startup filesystem failure keeps the committed identity but does not run pending source recovery', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'native-startup-failure-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const old = new ReferenceStore(directory); source(old); const p = old.project(), pending = old.start('pending', p.sourceSetVersion, p.policyVersion); old.close();
  writeFileSync(path.join(directory, 'path-receipts'), 'owned layout obstruction');
  assert.throws(() => new CatalogStore(directory), { code: 'UNSAFE_RECEIPT_DIRECTORY' });
  const db = new DatabaseSync(path.join(directory, 'loredock.db')); let id: string;
  try {
    assert.equal(db.prepare('PRAGMA user_version').get()!.user_version, 10); id = db.prepare('SELECT id FROM catalog_identity').get()!.id as string;
    assert.equal(db.prepare('SELECT status FROM builds WHERE id=?').get(pending.id)!.status, 'preparing');
  } finally { db.close(); }
  unlinkSync(path.join(directory, 'path-receipts')); const store = new CatalogStore(directory);
  assert.equal(store.receipts.catalogId, id); assert.equal(store.buildRow(pending.id).status, 'interrupted');
  store.db.exec('DROP TRIGGER catalog_identity_update'); store.run("UPDATE catalog_identity SET id='invalid'"); store.close();
  assert.throws(() => new CatalogStore(directory), { code: 'CORRUPT_CATALOG_IDENTITY' });
});

test('storage constructors only reduce fixed bounds and capacity zero creates no native files', async t => {
  const s = await setup(t, { limits: { records: 0 } });
  assert.throws(() => publish(s.store, content(s.store)), { code: 'CAPTURE_STORAGE_FULL' });
  assert.equal(existsSync(path.join(s.directory, 'path-receipts')), false); s.store.close();
  for (const options of [{ limits: { records: 65 } }, { limits: { records: -1 } }, { limits: { bytes: 640 * 1024 + 1 } },
    { limits: { bytes: 0.5 } }, { limits: null }, { unknown: true }])
    assert.throws(() => new CatalogStore(s.directory, options as NativeStorageOptions), { code: 'INVALID_RECEIPT_STORAGE_LIMIT' });
  s.reopen({ limits: { bytes: 0 } }); assert.throws(() => publish(s.store, content(s.store)), { code: 'RECEIPT_BYTES_LIMIT' });
  s.reopen(); assert.equal(publish(s.store, content(s.store)).created, true);
});
