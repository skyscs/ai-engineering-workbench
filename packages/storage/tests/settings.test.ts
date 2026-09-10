import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, type TestContext } from 'node:test';
import { openStorage } from '../src/index.js';
import { migrate, migrations } from '../src/migrations.js';

function fixture(t: TestContext) {
  const root = mkdtempSync(path.join(tmpdir(), 'aew-settings-test-'));
  const storage = openStorage({ dataRoot: root });
  t.after(() => { storage.close(); rmSync(root, { recursive: true, force: true }); });
  return { root, storage, settings: storage.settings };
}
const workspaceInput = (name: string) => ({ name, connection: { name: `${name} connection`, configProfile: null, executablePath: null } });
const profileInput = { name: 'Corporate reasoning', modelIdentifier: 'company/router:model-v2', reasoningEffort: 'medium' };

test('workspace, owned connection and profile edits survive a storage restart', (t) => {
  const { root, storage, settings } = fixture(t);
  const first = settings.createWorkspace(workspaceInput('Payments'));
  const id = first.workspace.id;
  assert.equal(first.workspace.aiConnectionId, first.connection.id);
  assert.equal(first.connection.verificationStatus, 'not_verified');
  const profile = settings.createModelProfile(id, profileInput);
  assert.equal(profile.aiConnectionId, first.connection.id);
  settings.renameWorkspace(id, { name: 'Payments investigation' });
  settings.updateConnection(id, { name: 'Corporate', configProfile: 'company_gateway', executablePath: '/opt/company/codex' });
  settings.updateModelProfile(id, profile.id, { ...profileInput, reasoningEffort: 'high' });
  const before = settings.getWorkspace(id);
  storage.close();
  const reopened = openStorage({ dataRoot: root });
  try { assert.deepEqual(reopened.settings.getWorkspace(id), before); }
  finally { reopened.close(); }
  assert.throws(() => settings.listWorkspaces(), { code: 'STORAGE_CLOSED' });
});

test('cross-workspace profile reads, updates and deletes cannot cross the connection boundary', (t) => {
  const { settings } = fixture(t);
  const a = settings.createWorkspace(workspaceInput('A')), b = settings.createWorkspace(workspaceInput('B'));
  const profile = settings.createModelProfile(a.workspace.id, profileInput);
  for (const action of [
    () => settings.getModelProfile(b.workspace.id, profile.id),
    () => settings.updateModelProfile(b.workspace.id, profile.id, profileInput),
    () => settings.deleteModelProfile(b.workspace.id, profile.id)
  ]) assert.throws(action, { code: 'NOT_FOUND' });
  assert.throws(() => settings.renameWorkspace(b.workspace.id, { name: 'B', aiConnectionId: a.connection.id }), { code: 'INVALID_INPUT' });
  assert.throws(() => settings.updateModelProfile(a.workspace.id, profile.id, { ...profileInput, aiConnectionId: b.connection.id }), { code: 'INVALID_INPUT' });
  assert.deepEqual(settings.getModelProfile(a.workspace.id, profile.id), profile);
});

test('locked boundaries survive restart and block launch edits or deletion while allowing cosmetic names', (t) => {
  const { root, storage, settings } = fixture(t);
  const { workspace, connection } = settings.createWorkspace(workspaceInput('Protected'));
  settings.lockWorkspaceBoundary(workspace.id);
  settings.lockWorkspaceBoundary(workspace.id);
  assert.throws(() => settings.updateConnection(workspace.id, { name: 'Changed', configProfile: 'another_account' }), { code: 'BOUNDARY_LOCKED' });
  assert.throws(() => settings.updateConnection(workspace.id, { name: 'Changed', executablePath: '/opt/other/codex' }), { code: 'BOUNDARY_LOCKED' });
  assert.throws(() => settings.deleteWorkspace(workspace.id), { code: 'BOUNDARY_LOCKED' });
  settings.updateConnection(workspace.id, { name: 'Clearer label', configProfile: null, executablePath: null });
  settings.renameWorkspace(workspace.id, { name: 'Clearer workspace label' });
  const db = new DatabaseSync(storage.paths.database);
  try {
    assert.throws(() => db.prepare('UPDATE workspaces SET boundary_locked = 0 WHERE id = ?').run(workspace.id), /workspace_boundary_locked/);
    assert.throws(() => db.prepare('UPDATE ai_connections SET config_profile = ? WHERE id = ?').run('bypass', connection.id), /workspace_boundary_locked/);
  } finally { db.close(); }
  storage.close();
  const reopened = openStorage({ dataRoot: root });
  try { assert.equal(reopened.settings.getWorkspace(workspace.id).workspace.boundaryLocked, true); }
  finally { reopened.close(); }
});

test('invalid metadata never leaves an orphan connection or stores arbitrary runtime settings', (t) => {
  const { storage, settings } = fixture(t);
  for (const input of [null, {}, [], { ...workspaceInput(''), extraRuntimeArgs: ['--unsafe'] },
    { ...workspaceInput('A'), connection: { name: 'Invalid', configProfile: '../auth' } },
    { ...workspaceInput('A'), connection: { name: 'Invalid', executablePath: 'codex --unsafe' } },
    { ...workspaceInput('A'), connection: { name: 'Invalid', token: 'synthetic-secret' } }]) {
    assert.throws(() => settings.createWorkspace(input), { code: 'INVALID_INPUT' });
  }
  const db = new DatabaseSync(storage.paths.database);
  try { assert.equal(db.prepare('SELECT count(*) AS n FROM ai_connections').get()!.n, 0); }
  finally { db.close(); }
  const id = settings.createWorkspace(workspaceInput('Valid')).workspace.id;
  for (const value of [{ ...profileInput, reasoningEffort: 'invented' }, { ...profileInput, modelIdentifier: '--unsafe' },
    { ...profileInput, env: { TOKEN: 'synthetic' } }, { ...profileInput, name: 'x'.repeat(121) },
    { ...profileInput, modelIdentifier: 'line\nbreak' }]) {
    assert.throws(() => settings.createModelProfile(id, value), { code: 'INVALID_INPUT' });
  }
  const defaults = settings.createModelProfile(id, { name: 'CLI defaults' });
  assert.equal(defaults.modelIdentifier, null);
  assert.equal(defaults.reasoningEffort, null);
});

test('deleting an unused workspace removes only its own connection and profiles', (t) => {
  const { storage, settings } = fixture(t);
  const a = settings.createWorkspace(workspaceInput('A')), b = settings.createWorkspace(workspaceInput('B'));
  settings.createModelProfile(a.workspace.id, profileInput);
  const retained = settings.createModelProfile(b.workspace.id, profileInput);
  settings.deleteWorkspace(a.workspace.id);
  assert.throws(() => settings.getWorkspace(a.workspace.id), { code: 'NOT_FOUND' });
  assert.deepEqual(settings.getModelProfile(b.workspace.id, retained.id), retained);
  const db = new DatabaseSync(storage.paths.database);
  try {
    assert.equal(db.prepare('SELECT count(*) AS n FROM ai_connections WHERE id = ?').get(a.connection.id)!.n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM model_profiles WHERE ai_connection_id = ?').get(a.connection.id)!.n, 0);
    assert.throws(() => db.prepare('UPDATE model_profiles SET ai_connection_id = ? WHERE id = ?').run('missing', retained.id), /profile_connection_immutable/);
    assert.throws(() => db.prepare("INSERT INTO workspaces (id,name,ai_connection_id,created_at,updated_at) VALUES ('bad','bad','missing','now','now')").run(), /FOREIGN KEY/);
  } finally { db.close(); }
});

test('workspace insertion failure rolls back the connection and leaves storage usable', (t) => {
  const { storage, settings } = fixture(t);
  const db = new DatabaseSync(storage.paths.database);
  try {
    db.exec(`CREATE TRIGGER reject_workspace BEFORE INSERT ON workspaces
      BEGIN SELECT RAISE(ABORT, 'injected_workspace_failure'); END;`);
    assert.throws(() => settings.createWorkspace(workspaceInput('Rejected')), /injected_workspace_failure/);
    assert.equal(db.prepare('SELECT count(*) AS n FROM ai_connections').get()!.n, 0);
    assert.deepEqual(settings.listWorkspaces(), []);
    db.exec('DROP TRIGGER reject_workspace');
    assert.equal(settings.createWorkspace(workspaceInput('Recovered')).workspace.name, 'Recovered');
  } finally { db.close(); }
});

test('upgrade from Task 002 preserves its migration record and creates usable settings', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'aew-settings-upgrade-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const db = new DatabaseSync(path.join(root, 'workbench.db'));
  migrate(db, migrations.slice(0, 1));
  const original = db.prepare('SELECT * FROM schema_migrations WHERE version = 1').get();
  db.close();
  const upgraded = openStorage({ dataRoot: root });
  try {
    assert.equal(upgraded.status().schemaVersion, 2);
    upgraded.settings.createWorkspace(workspaceInput('Upgraded'));
    const check = new DatabaseSync(upgraded.paths.database);
    try { assert.deepEqual(check.prepare('SELECT * FROM schema_migrations WHERE version = 1').get(), original); }
    finally { check.close(); }
  } finally { upgraded.close(); }
});
