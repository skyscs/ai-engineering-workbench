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
    assert.equal(upgraded.status().schemaVersion, migrations.length);
    upgraded.settings.createWorkspace(workspaceInput('Upgraded'));
    const check = new DatabaseSync(upgraded.paths.database);
    try { assert.deepEqual(check.prepare('SELECT * FROM schema_migrations WHERE version = 1').get(), original); }
    finally { check.close(); }
  } finally { upgraded.close(); }
});

test('configuration directory is canonical, explicit and locked after task boundary creation',async(t)=>{
  const f=fixture(t), fs=await import('node:fs');
  const home=path.join(f.root,'personal'), alias=path.join(f.root,'alias'), other=path.join(f.root,'corporate');
  fs.mkdirSync(home); fs.mkdirSync(other); fs.symlinkSync(home,alias);
  for(const configHome of ['relative','~/personal',path.join(f.root,'missing'),f.storage.paths.database]) {
    assert.throws(()=>f.settings.createWorkspace({name:'Rejected',connection:{name:'CLI',configHome}}),{code:'INVALID_INPUT'});
  }
  const saved=f.settings.createWorkspace({name:'Personal',connection:{name:'CLI',configHome:alias}});
  assert.equal(saved.connection.configHome,home);
  f.settings.lockWorkspaceBoundary(saved.workspace.id);
  const input={name:'Renamed',configHome:home,configProfile:null,executablePath:null};
  f.settings.updateConnection(saved.workspace.id,input);
  assert.throws(()=>f.settings.updateConnection(saved.workspace.id,{...input,configHome:other}),{code:'BOUNDARY_LOCKED'});
  assert.throws(()=>f.settings.updateConnection(saved.workspace.id,{...input,configHome:null}),{code:'BOUNDARY_LOCKED'});
  const db=new DatabaseSync(f.storage.paths.database);
  try { assert.throws(()=>db.prepare('UPDATE ai_connections SET config_home = ? WHERE id = ?').run(other,saved.connection.id),/workspace_boundary_locked/); }
  finally { db.close(); }
  f.storage.close(); const reopened=openStorage({dataRoot:f.root});
  try { assert.equal(reopened.settings.getWorkspace(saved.workspace.id).connection.configHome,home); } finally { reopened.close(); }
});

test('schema 7 migration never infers a home or rewrites history; legacy AI history blocks binding',t=>{
  const root=mkdtempSync(path.join(tmpdir(),'aew-home-upgrade-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const db=new DatabaseSync(path.join(root,'workbench.db')); migrate(db,migrations.slice(0,7));
  const history=db.prepare('SELECT * FROM schema_migrations').all();
  for(const id of ['unused','used']) {
    db.prepare("INSERT INTO ai_connections (id,name,runtime_type,created_at,updated_at) VALUES (?,?,'codex-cli','now','now')").run(id,id);
    db.prepare("INSERT INTO workspaces (id,name,ai_connection_id,boundary_locked,created_at,updated_at) VALUES (?,?,?,1,'now','now')").run(id,id,id);
  }
  db.exec("INSERT INTO tasks (id,workspace_id,title,description,created_at,updated_at) VALUES ('task','used','Old task','Context','now','now')");
  const snapshot=JSON.stringify({connection:{configProfile:null}});
  db.prepare("INSERT INTO stage_runs (id,task_id,ai_connection_id,stage,status,input_snapshot,created_at) VALUES ('run','task','used','investigation','failed',?,'now')").run(snapshot);
  db.close();
  const storage=openStorage({dataRoot:root});
  try {
    assert.equal(storage.settings.getWorkspace('unused').connection.configHome,null);
    assert.equal(storage.settings.getWorkspace('used').connection.configHome,null);
    storage.settings.updateConnection('unused',{name:'Bound explicitly',configHome:root});
    assert.equal(storage.settings.getWorkspace('unused').connection.configHome,root);
    assert.throws(()=>storage.settings.updateConnection('used',{name:'Forbidden',configHome:root}),{code:'BOUNDARY_LOCKED'});
    const check=new DatabaseSync(storage.paths.database);
    try {
      assert.deepEqual(check.prepare('SELECT * FROM schema_migrations WHERE version <= 7').all(),history);
      assert.equal(check.prepare("SELECT input_snapshot FROM stage_runs WHERE id = 'run'").get()!.input_snapshot,snapshot);
      assert.throws(()=>check.prepare("UPDATE ai_connections SET config_home = ? WHERE id = 'used'").run(root),/workspace_boundary_locked/);
    } finally { check.close(); }
  } finally { storage.close(); }
});

test('schema 8 preview history survives report migration without being promoted to an investigation', t => {
  const root=mkdtempSync(path.join(tmpdir(),'aew-report-upgrade-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const db=new DatabaseSync(path.join(root,'workbench.db')); migrate(db,migrations.slice(0,8));
  const history=db.prepare('SELECT * FROM schema_migrations').all();
  db.exec("INSERT INTO ai_connections (id,name,runtime_type,created_at,updated_at) VALUES ('cli','CLI','codex-cli','now','now'); INSERT INTO workspaces (id,name,ai_connection_id,created_at,updated_at) VALUES ('w','W','cli','now','now'); INSERT INTO tasks (id,workspace_id,title,description,context_ready,created_at,updated_at) VALUES ('t','w','T','Context',1,'now','now');");
  const snapshot=JSON.stringify({schemaVersion:'runtime-preview-v1'}), preview=JSON.stringify({summary:'Legacy preview',findings:[],unresolvedQuestions:[]});
  db.prepare("INSERT INTO stage_runs (id,task_id,ai_connection_id,stage,status,input_snapshot,created_at) VALUES ('run','t','cli','investigation','succeeded',?,'now')").run(snapshot);
  db.prepare("INSERT INTO run_execution (run_id,metadata_json,result_json) VALUES ('run','{}',?)").run(preview); db.close();
  const storage=openStorage({dataRoot:root});
  try {
    assert.equal(storage.tasks.get('w','t').status,'CONTEXT_READY');
    assert.deepEqual(storage.tasks.investigations.list('w','t'),[]);
    assert.deepEqual(storage.tasks.journal.detail('w','t','run').result,JSON.parse(preview));
    const check=new DatabaseSync(storage.paths.database);
    try { assert.deepEqual(check.prepare('SELECT * FROM schema_migrations WHERE version <= 8').all(),history); }
    finally { check.close(); }
  } finally { storage.close(); }
});

test('schema 9 migration preserves report content and snapshots while initializing provenance and dependency freshness', t => {
  const root=mkdtempSync(path.join(tmpdir(),'aew-interventions-upgrade-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const db=new DatabaseSync(path.join(root,'workbench.db')); migrate(db,migrations.slice(0,9));
  const history=db.prepare('SELECT * FROM schema_migrations').all();
  db.exec("INSERT INTO ai_connections (id,name,runtime_type,created_at,updated_at) VALUES ('cli','CLI','codex-cli','now','now'); INSERT INTO workspaces (id,name,ai_connection_id,created_at,updated_at) VALUES ('w','W','cli','now','now'); INSERT INTO tasks (id,workspace_id,title,description,context_revision,created_at,updated_at) VALUES ('t','w','T','Context',2,'now','now');");
  const snapshot=JSON.stringify({schemaVersion:'investigation-v1',constraints:[]});
  const result=JSON.stringify({investigation:{summary:'Legacy analysis',timeline:[]},rootCause:{status:'insufficient_evidence',summary:'More context needed.',evidenceIds:[],unresolvedQuestions:['Which commit?']},evidence:[]});
  for(const [n,revision] of [[1,1],[2,2]] as const) {
    db.prepare("INSERT INTO stage_runs (id,task_id,ai_connection_id,stage,status,input_snapshot,created_at) VALUES (?,'t','cli','investigation','succeeded',?,'now')").run(`run${n}`,snapshot);
    db.prepare("INSERT INTO run_execution (run_id,metadata_json,result_json) VALUES (?,'{}',?)").run(`run${n}`,result);
    db.prepare("INSERT INTO investigation_reports VALUES (?,?,'t',?,?,?,?,'now')").run(`report${n}`,`cause${n}`,`run${n}`,n,revision,result);
  }
  db.close(); const storage=openStorage({dataRoot:root});
  try {
    const reports=storage.tasks.investigations.list('w','t');
    assert.equal(reports[0]!.freshness,'fresh'); assert.equal(reports[1]!.freshness,'stale');
    assert.equal(reports[0]!.previousVersionId,null); assert.equal(reports[0]!.triggeredByInterventionId,null);
    assert.deepEqual(reports[0]!.result,JSON.parse(result)); assert.deepEqual(storage.tasks.interventions.constraints('w','t'),[]);
    const check=new DatabaseSync(storage.paths.database);
    try {
      assert.deepEqual(check.prepare('SELECT * FROM schema_migrations WHERE version <= 9').all(),history);
      assert.equal(check.prepare("SELECT input_snapshot FROM stage_runs WHERE id = 'run1'").get()!.input_snapshot,snapshot);
      assert.equal(check.prepare('SELECT COUNT(*) AS n FROM result_dependencies').get()!.n,4);
      assert.equal(check.prepare('SELECT COUNT(*) AS n FROM result_invalidations').get()!.n,2);
    } finally {check.close();}
  } finally { storage.close(); }
});
