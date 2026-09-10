import assert from 'node:assert/strict';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { chmodSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, type TestContext } from 'node:test';
import { openStorage, resolveDataRoot } from '../src/index.js';
import { migrate, migrations } from '../src/migrations.js';

const baselineMigrations = migrations.slice(0, 1);

function fixture(t: TestContext) {
  const root = mkdtempSync(path.join(tmpdir(), 'aew-storage-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

async function worker(t: TestContext, mode: string, root: string) {
  const child = fork(new URL('./worker.ts', import.meta.url), [mode, root], {
    execArgv: ['--import', 'tsx'], stdio: ['ignore', 'ignore', 'pipe', 'ipc']
  });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) await kill(child); });
  const result = await new Promise<{ ready?: boolean; code?: string }>((resolve, reject) => {
    let stderr = '';
    child.stderr?.on('data', (chunk) => { stderr += String(chunk); });
    const timer = setTimeout(() => reject(new Error('Fixture child did not become ready.')), 10000);
    child.once('message', (message) => { clearTimeout(timer); resolve(message as { ready?: boolean; code?: string }); });
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error(`Fixture exited before readiness: ${stderr}`)); });
  });
  return { child, result };
}
async function kill(child: ChildProcess) {
  const exited = once(child, 'exit');
  child.kill('SIGKILL');
  await exited;
}

test('data paths follow Linux, macOS and Windows conventions without depending on the host', () => {
  const linux = { platform: 'linux' as const, home: '/home/fixture', env: {} };
  assert.equal(resolveDataRoot(linux), '/home/fixture/.local/share/ai-engineering-workbench');
  assert.equal(resolveDataRoot({ ...linux, env: { XDG_DATA_HOME: '/data with spaces' } }), '/data with spaces/ai-engineering-workbench');
  assert.equal(resolveDataRoot({ ...linux, env: { XDG_DATA_HOME: 'relative' } }), resolveDataRoot(linux));
  assert.equal(resolveDataRoot({ platform: 'darwin', home: '/Users/fixture', env: {} }), '/Users/fixture/Library/Application Support/ai-engineering-workbench');
  assert.equal(resolveDataRoot({ platform: 'win32', home: 'C:\\Users\\fixture', env: {} }), 'C:\\Users\\fixture\\AppData\\Local\\ai-engineering-workbench');
  assert.equal(resolveDataRoot({ platform: 'win32', home: 'C:\\Users\\fixture', env: { LOCALAPPDATA: 'D:\\Local' } }), 'D:\\Local\\ai-engineering-workbench');
  assert.equal(resolveDataRoot({ ...linux, env: { AEW_DATA_DIR: '/tmp/isolated' } }), '/tmp/isolated');
  for (const value of ['', 'relative', '~/data', 'bad\0path']) {
    assert.throws(() => resolveDataRoot({ ...linux, env: { AEW_DATA_DIR: value } }), { code: 'INVALID_DATA_DIR' });
  }
});

test('initialization is persistent and idempotent with private directories and versioned schema', (t) => {
  const dataRoot = path.join(fixture(t), 'data with spaces');
  const storage = openStorage({ dataRoot });
  t.after(() => storage.close());
  assert.equal(storage.status().schemaVersion, migrations.length);
  assert.equal(storage.status().foreignKeys, true);
  assert.equal(storage.status().journalMode, 'wal');
  for (const dir of ['repositories', 'tasks', 'worktrees', 'logs']) assert.ok(lstatSync(path.join(dataRoot, dir)).isDirectory());
  if (process.platform !== 'win32') {
    assert.equal(lstatSync(dataRoot).mode & 0o777, 0o700);
    assert.equal(lstatSync(storage.paths.database).mode & 0o777, 0o600);
  }
  const inspect = new DatabaseSync(storage.paths.database);
  const before = inspect.prepare('SELECT * FROM schema_migrations').all();
  assert.deepEqual(inspect.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name), ['schema_migrations', 'ai_connections', 'workspaces', 'model_profiles', 'repositories', 'tasks', 'task_repositories', 'artifact_imports', 'artifacts', 'artifact_context', 'stage_runs']);
  inspect.close();
  storage.close();
  storage.close();
  assert.throws(() => storage.status(), { code: 'STORAGE_CLOSED' });
  const reopened = openStorage({ dataRoot });
  t.after(() => reopened.close());
  const after = new DatabaseSync(reopened.paths.database);
  assert.deepEqual(after.prepare('SELECT * FROM schema_migrations').all(), before);
  after.close();
  reopened.close();
});

test('failed migration rolls back DDL, data and version history as one transaction', () => {
  const db = new DatabaseSync(':memory:');
  try {
    migrate(db, baselineMigrations);
    const before = db.prepare('SELECT * FROM schema_migrations').all();
    const broken = [...baselineMigrations, { version: 2, name: 'broken', sql: 'CREATE TABLE partial (id INTEGER); INSERT INTO missing VALUES (1);' }];
    assert.throws(() => migrate(db, broken), { code: 'MIGRATION_FAILED' });
    assert.equal(db.prepare('PRAGMA user_version').get()!.user_version, 1);
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='partial'").get(), undefined);
    assert.deepEqual(db.prepare('SELECT * FROM schema_migrations').all(), before);
    assert.equal(migrate(db, baselineMigrations), 1);
    assert.throws(() => migrate(db, [{ ...migrations[0]!, sql: migrations[0]!.sql + '\n-- changed' }]), { code: 'MIGRATION_MISMATCH' });
  } finally { db.close(); }
});

test('failure on a fresh database also rolls back migration bookkeeping', () => {
  const db = new DatabaseSync(':memory:');
  try {
    assert.throws(() => migrate(db, [...baselineMigrations, { version: 2, name: 'broken', sql: 'INVALID SQL;' }]), { code: 'MIGRATION_FAILED' });
    assert.equal(db.prepare('PRAGMA user_version').get()!.user_version, 0);
    assert.equal(db.prepare('PRAGMA application_id').get()!.application_id, 0);
    assert.deepEqual(db.prepare('SELECT name FROM sqlite_master').all(), []);
    assert.equal(migrate(db, baselineMigrations), 1);
  } finally { db.close(); }
});

test('SQLite automatic rollback preserves the original migration failure', () => {
  const db = new DatabaseSync(':memory:');
  try {
    migrate(db, baselineMigrations);
    assert.throws(() => migrate(db, [...baselineMigrations, { version: 2, name: 'automatic_rollback', sql: `
      CREATE TABLE rollback_fixture (id INTEGER);
      CREATE TRIGGER rollback_insert BEFORE INSERT ON rollback_fixture
      BEGIN SELECT RAISE(ROLLBACK, 'fixture rollback'); END;
      INSERT INTO rollback_fixture VALUES (1);
    ` }]), (error: unknown) => {
      assert.equal((error as { code: string }).code, 'MIGRATION_FAILED');
      assert.match(String(((error as Error).cause as AggregateError).errors[0]), /fixture rollback/);
      return true;
    });
    assert.equal(db.prepare('PRAGMA user_version').get()!.user_version, 1);
    assert.equal(migrate(db, baselineMigrations), 1);
  } finally { db.close(); }
});

test('a newer schema and an unrelated database are refused without rewriting their contents', (t) => {
  const dataRoot = fixture(t);
  const storage = openStorage({ dataRoot });
  const file = storage.paths.database;
  storage.close();
  const newer = new DatabaseSync(file);
  newer.exec('PRAGMA user_version = 99');
  newer.close();
  const before = readFileSync(file);
  assert.throws(() => openStorage({ dataRoot }), { code: 'SCHEMA_TOO_NEW' });
  assert.deepEqual(readFileSync(file), before);
  const foreign = new DatabaseSync(':memory:');
  try {
    foreign.exec('CREATE TABLE unrelated (id INTEGER)');
    assert.throws(() => migrate(foreign), { code: 'UNKNOWN_DATABASE' });
    assert.equal(foreign.prepare('PRAGMA user_version').get()!.user_version, 0);
  } finally { foreign.close(); }
});

test('ownership rejects another process and remains held after a rejected contender', async (t) => {
  const root = fixture(t);
  const storage = openStorage({ dataRoot: root });
  t.after(() => storage.close());
  assert.throws(() => openStorage({ dataRoot: root }), { code: 'DATA_DIR_IN_USE' });
  for (let attempt = 0; attempt < 2; attempt++) {
    const contender = await worker(t, 'try', root);
    assert.equal(contender.result.code, 'DATA_DIR_IN_USE');
    await once(contender.child, 'exit');
  }
  storage.close();
  const next = await worker(t, 'try', root);
  assert.equal(next.result.ready, true);
  await once(next.child, 'exit');
});

test('a killed owner releases ownership automatically for the next startup', async (t) => {
  const root = fixture(t);
  const owner = await worker(t, 'hold', root);
  assert.equal(owner.result.ready, true);
  assert.throws(() => openStorage({ dataRoot: root }), { code: 'DATA_DIR_IN_USE' });
  await kill(owner.child);
  const recovered = openStorage({ dataRoot: root });
  assert.equal(recovered.status().schemaVersion, migrations.length);
  recovered.close();
});

test('process death during migration leaves the previous schema ready for retry', async (t) => {
  const root = fixture(t);
  const storage = openStorage({ dataRoot: root });
  const file = storage.paths.database;
  storage.close();
  const interrupted = await worker(t, 'interrupt-migration', file);
  assert.equal(interrupted.result.ready, true);
  await kill(interrupted.child);
  const recovered = openStorage({ dataRoot: root });
  recovered.close();
  const db = new DatabaseSync(file);
  try {
    assert.equal(db.prepare('PRAGMA user_version').get()!.user_version, migrations.length);
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='incomplete'").get(), undefined);
    assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
  } finally { db.close(); }
});

test('an external database writer fails within a bounded busy timeout and startup can retry', (t) => {
  const root = fixture(t);
  const first = openStorage({ dataRoot: root });
  const file = first.paths.database;
  first.close();
  const writer = new DatabaseSync(file);
  try {
    writer.exec('BEGIN IMMEDIATE');
    const started = Date.now();
    assert.throws(() => openStorage({ dataRoot: root }), { code: 'STORAGE_INIT_FAILED' });
    assert.ok(Date.now() - started < 4000);
    writer.exec('ROLLBACK');
  } finally { writer.close(); }
  openStorage({ dataRoot: root }).close();
});

test('unwritable and redirected managed paths fail without claiming ownership permanently', (t) => {
  const root = fixture(t);
  const blocked = path.join(root, 'blocked');
  writeFileSync(blocked, 'not a directory');
  assert.throws(() => openStorage({ dataRoot: blocked }), { code: 'STORAGE_INIT_FAILED' });
  const dataRoot = path.join(root, 'data');
  mkdirSync(dataRoot);
  if (process.platform !== 'win32') {
    symlinkSync(blocked, path.join(dataRoot, 'workbench.db'));
    assert.throws(() => openStorage({ dataRoot }), { code: 'INVALID_STORAGE_PATH' });
    assert.equal(readFileSync(blocked, 'utf8'), 'not a directory');
  }
  if (process.platform !== 'win32' && process.getuid?.() !== 0) {
    const locked = path.join(root, 'locked');
    mkdirSync(locked);
    chmodSync(locked, 0o500);
    try { assert.throws(() => openStorage({ dataRoot: locked }), { code: 'STORAGE_INIT_FAILED' }); }
    finally { chmodSync(locked, 0o700); }
    openStorage({ dataRoot: locked }).close();
  }
});
