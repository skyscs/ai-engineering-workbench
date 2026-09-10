import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { openStorage } from '../src/index.js';
import { migrate, migrations } from '../src/migrations.js';

test('restart marks unfinished clones failed without deleting recorded or unknown files', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'aew-clone-recovery-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const first = openStorage({ dataRoot: root });
  const workspace = first.settings.createWorkspace({ name: 'Recovery', connection: { name: 'Fixture' } }).workspace;
  const target = path.join(first.paths.repositories, 'recorded', 'checkout');
  mkdirSync(path.dirname(target)); writeFileSync(path.join(path.dirname(target), 'partial'), 'retain');
  writeFileSync(path.join(first.paths.repositories, 'unknown'), 'untouched');
  first.repositories.beginClone(workspace.id, 'recorded', 'Interrupted', 'https://example.invalid/repo', target, null);
  first.close();
  const reopened = openStorage({ dataRoot: root });
  try {
    const result = reopened.repositories.get(workspace.id, 'recorded');
    assert.equal(result.status, 'failed'); assert.equal(result.error?.code, 'CLONE_INTERRUPTED'); assert.equal(result.retainedFiles, true);
    assert.equal(readFileSync(path.join(path.dirname(target), 'partial'), 'utf8'), 'retain');
    assert.equal(readFileSync(path.join(reopened.paths.repositories, 'unknown'), 'utf8'), 'untouched');
    assert.throws(() => reopened.settings.deleteWorkspace(workspace.id), { code: 'CONFLICT' });
  } finally { reopened.close(); }
});

test('schema version 2 upgrades without rewriting history and enforces repository workspace foreign keys', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'aew-registry-upgrade-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const before = new DatabaseSync(path.join(root, 'workbench.db')); migrate(before, migrations.slice(0, 2));
  const history = before.prepare('SELECT * FROM schema_migrations').all(); before.close();
  const storage = openStorage({ dataRoot: root });
  try {
    const db = new DatabaseSync(storage.paths.database);
    try {
      assert.deepEqual(db.prepare('SELECT * FROM schema_migrations WHERE version <= 2').all(), history);
      assert.throws(() => db.prepare(`INSERT INTO repositories (id,workspace_id,name,source,local_path,managed_clone,status,created_at,updated_at)
        VALUES ('bad','missing','bad','/source','/target',1,'cloning','now','now')`).run(), /FOREIGN KEY/);
    } finally { db.close(); }
  } finally { storage.close(); }
});

test('sync restart preserves last success and fails the pending attempt without retry', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'aew-sync-recovery-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const first = openStorage({ dataRoot: root });
  const workspace = first.settings.createWorkspace({ name: 'Sync', connection: { name: 'Fixture' } }).workspace;
  const metadata = { localPath: '/fixture/checkout', commonGitDir: '/fixture/common', remoteUrl: null,
    defaultBranch: null, baseRef: null, resolvedCommitSha: null, shallow: false };
  const row = first.repositories.register(workspace.id, 'Fixture', metadata);
  first.repositories.beginSync(workspace.id, row.id);
  first.repositories.finishSync(workspace.id, row.id, { status: 'succeeded', metadata, fetchedAt: '2026-09-10T10:00:00.000Z' });
  first.repositories.beginSync(workspace.id, row.id);
  const attempted = first.repositories.get(workspace.id, row.id).lastSyncAttemptAt;
  first.close();
  const reopened = openStorage({ dataRoot: root });
  try {
    const result = reopened.repositories.get(workspace.id, row.id);
    assert.equal(result.syncStatus, 'failed'); assert.equal(result.syncError?.code, 'SYNC_INTERRUPTED');
    assert.equal(result.lastFetchedAt, '2026-09-10T10:00:00.000Z'); assert.equal(result.lastSyncAttemptAt, attempted);
    assert.ok(result.lastSyncCompletedAt);
  } finally { reopened.close(); }
});

test('schema version 3 upgrades with unchanged migration history and idle sync defaults', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'aew-sync-upgrade-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const db = new DatabaseSync(path.join(root, 'workbench.db')); migrate(db, migrations.slice(0, 3));
  const history = db.prepare('SELECT * FROM schema_migrations').all(); db.close();
  const storage = openStorage({ dataRoot: root });
  try {
    const check = new DatabaseSync(storage.paths.database);
    try {
      assert.deepEqual(check.prepare('SELECT * FROM schema_migrations WHERE version <= 3').all(), history);
      assert.equal(storage.status().schemaVersion, 4);
    } finally { check.close(); }
    const workspace = storage.settings.createWorkspace({ name: 'Upgrade', connection: { name: 'Fixture' } }).workspace;
    const row = storage.repositories.register(workspace.id, 'Fixture', { localPath: '/fixture', commonGitDir: '/fixture/.git', remoteUrl: null,
      defaultBranch: null, baseRef: null, resolvedCommitSha: null, shallow: false });
    assert.equal(row.syncStatus, 'idle'); assert.equal(row.lastFetchedAt, null); assert.equal(row.syncError, null);
  } finally { storage.close(); }
});
