import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, type TestContext } from 'node:test';
import { openStorage } from '../src/index.js';
import { migrate, migrations } from '../src/migrations.js';

const workspaceInput = { name: 'Engineering', connection: { name: 'Local CLI' } };
function fixture(t: TestContext, artifactLimits = { fileBytes: 100, taskBytes: 200, contextBytes: 40 }) {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'aew-task-test-'));
  const storage = openStorage({ dataRoot: root, artifactLimits });
  const workspaceId = storage.settings.createWorkspace(workspaceInput).workspace.id;
  const repository = storage.repositories.register(workspaceId, 'Fixture', { localPath: path.join(root, 'repo'), commonGitDir: path.join(root, 'repo/.git'),
    remoteUrl: null, defaultBranch: 'refs/heads/main', baseRef: 'refs/heads/main', resolvedCommitSha: 'a'.repeat(40), shallow: false });
  const input = { title: 'Investigate regression', description: 'A defect.\nDetails.', repositoryIds: [repository.id] };
  t.after(async () => { await storage.tasks.artifacts.close(); storage.close(); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, storage, workspaceId, input, repository };
}
const stream = (bytes: Uint8Array) => new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes); controller.close(); } });
function upload(f: ReturnType<typeof fixture>, taskId: string, text = 'A log line.\n', name = 'trace.log') {
  const bytes = Buffer.from(text);
  return f.storage.tasks.artifacts.import(f.workspaceId, taskId, { name, size: bytes.length, mimeType: 'text/plain' }, stream(bytes));
}

test('task creation locks the boundary atomically and rejects cross-workspace repositories', (t) => {
  const f = fixture(t), { storage, workspaceId, input } = f;
  const other = storage.settings.createWorkspace(workspaceInput).workspace.id;
  assert.throws(() => storage.tasks.create(other, input), { code: 'INVALID_INPUT' });
  assert.equal(storage.settings.getWorkspace(other).workspace.boundaryLocked, false);
  assert.deepEqual(storage.tasks.list(other), []);
  const db = new DatabaseSync(storage.paths.database);
  try {
    db.exec("CREATE TRIGGER reject_task BEFORE INSERT ON task_repositories BEGIN SELECT RAISE(ABORT, 'injected task failure'); END");
    assert.throws(() => storage.tasks.create(workspaceId, input), /injected task failure/);
    assert.equal(storage.settings.getWorkspace(workspaceId).workspace.boundaryLocked, false);
    assert.deepEqual(storage.tasks.list(workspaceId), []);
    db.exec('DROP TRIGGER reject_task');
    const task = storage.tasks.create(workspaceId, input);
    assert.throws(() => storage.tasks.get(other, task.id), { code: 'NOT_FOUND' });
    assert.throws(() => storage.settings.updateConnection(workspaceId, { name: 'Other', configProfile: 'other' }), { code: 'BOUNDARY_LOCKED' });
    db.prepare('DELETE FROM task_repositories WHERE task_id = ?').run(task.id);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
    assert.equal(storage.settings.getWorkspace(workspaceId).workspace.boundaryLocked, true);
    assert.throws(() => storage.settings.deleteWorkspace(workspaceId), { code: 'BOUNDARY_LOCKED' });
  } finally { db.close(); }
});

test('duplicate and traversal filenames remain metadata; imported bytes survive source removal and restart', async (t) => {
  const f = fixture(t), task = f.storage.tasks.create(f.workspaceId, f.input);
  const source = path.join(f.root, 'source.log'); fs.writeFileSync(source, 'original bytes');
  const bytes = fs.readFileSync(source);
  const first = await f.storage.tasks.artifacts.import(f.workspaceId, task.id, { name: '../../source.log', size: bytes.length, mimeType: 'text/plain' }, stream(bytes));
  const second = await upload(f, task.id, 'different bytes', '../../source.log');
  fs.unlinkSync(source);
  assert.notEqual(first.id, second.id);
  assert.equal(first.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(fs.readFileSync(path.join(f.storage.paths.tasks, task.id, 'artifacts', first.id), 'utf8'), 'original bytes');
  const before = f.storage.tasks.detail(f.workspaceId, task.id);
  f.storage.close();
  const reopened = openStorage({ dataRoot: f.root, artifactLimits: before.limits });
  try { assert.deepEqual(reopened.tasks.detail(f.workspaceId, task.id), before); }
  finally { reopened.close(); }
});

test('streamed size and total quotas reject incomplete, oversized and concurrent uploads without publishing partial artifacts', async (t) => {
  const f = fixture(t, { fileBytes: 20, taskBytes: 25, contextBytes: 40 }), task = f.storage.tasks.create(f.workspaceId, f.input);
  const store = f.storage.tasks.artifacts;
  for (const [size, actual] of [[2, 3], [3, 2], [21, 21]]) {
    await assert.rejects(store.import(f.workspaceId, task.id, { name: 'size.log', size: size!, mimeType: 'text/plain' }, stream(Buffer.alloc(actual!, 65))), { code: 'INVALID_INPUT' });
  }
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(c) { controller = c; c.enqueue(Buffer.from('partial')); } });
  const pending = store.import(f.workspaceId, task.id, { name: 'interrupted.log', size: 10, mimeType: 'text/plain' }, body);
  await assert.rejects(upload(f, task.id), { code: 'CONFLICT' });
  controller.error(new Error('Disconnected'));
  await assert.rejects(pending, { code: 'CONFLICT' });
  assert.deepEqual(store.list(f.workspaceId, task.id), []);
  assert.deepEqual(fs.readdirSync(path.join(f.storage.paths.tasks, task.id, 'artifacts')), []);
  await upload(f, task.id, 'a'.repeat(20));
  await assert.rejects(upload(f, task.id, 'b'.repeat(6)), { code: 'INVALID_INPUT' });
  await upload(f, task.id, 'b'.repeat(5));
  assert.equal(store.list(f.workspaceId, task.id).length, 2);
});

test('disk-full writes roll back the owned staging file and quota so an explicit retry succeeds', async (t) => {
  const f = fixture(t), task = f.storage.tasks.create(f.workspaceId, f.input);
  const original = fs.writeSync;
  fs.writeSync = (() => { throw Object.assign(new Error('Synthetic disk full'), { code: 'ENOSPC' }); }) as typeof fs.writeSync;
  syncBuiltinESMExports();
  try { await assert.rejects(upload(f, task.id), /disk is full/); }
  finally { fs.writeSync = original; syncBuiltinESMExports(); }
  assert.deepEqual(f.storage.tasks.artifacts.list(f.workspaceId, task.id), []);
  assert.deepEqual(fs.readdirSync(path.join(f.storage.paths.tasks, task.id, 'artifacts')), []);
  await upload(f, task.id);
});

test('restart verifies and finalizes a renamed file after database publication failure exactly once', async (t) => {
  const f = fixture(t), task = f.storage.tasks.create(f.workspaceId, f.input);
  const db = new DatabaseSync(f.storage.paths.database);
  db.exec("CREATE TRIGGER reject_artifact BEFORE INSERT ON artifacts BEGIN SELECT RAISE(ABORT, 'injected finalization failure'); END");
  await assert.rejects(upload(f, task.id), /Restart the daemon/);
  assert.equal(f.storage.tasks.artifacts.list(f.workspaceId, task.id).length, 0);
  assert.equal(f.storage.tasks.get(f.workspaceId, task.id).contextRevision, 1);
  db.exec('DROP TRIGGER reject_artifact'); db.close(); f.storage.close();
  for (let attempt = 0; attempt < 2; attempt++) {
    const reopened = openStorage({ dataRoot: f.root });
    assert.equal(reopened.tasks.artifacts.list(f.workspaceId, task.id).length, 1);
    assert.equal(reopened.tasks.get(f.workspaceId, task.id).contextRevision, 2);
    reopened.close();
  }
});

test('recovery handles recorded incomplete and prepared staging files and retains unknown files', (t) => {
  const f = fixture(t), task = f.storage.tasks.create(f.workspaceId, f.input);
  const directory = path.join(f.storage.paths.tasks, task.id, 'artifacts'); fs.mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(f.storage.paths.database);
  function record(state: string) {
    const id = randomUUID(), bytes = Buffer.from('log');
    db.prepare(`INSERT INTO artifact_imports (id, task_id, destination, state, original_filename, mime_type, expected_size, sha256, created_at)
      VALUES (?, ?, ?, ?, 'log.txt', 'text/plain', 3, ?, 'now')`).run(id, task.id, `${task.id}/artifacts/${id}`, state, createHash('sha256').update(bytes).digest('hex'));
    fs.writeFileSync(path.join(directory, `${id}.upload`), bytes);
    return id;
  }
  const interrupted = record('uploading');
  fs.writeFileSync(path.join(directory, 'unknown'), 'preserve');
  f.storage.tasks.artifacts.recover();
  assert.equal(fs.existsSync(path.join(directory, `${interrupted}.upload`)), false);
  assert.equal(db.prepare('SELECT state FROM artifact_imports WHERE id = ?').get(interrupted)!.state, 'failed');
  const prepared = record('prepared');
  f.storage.tasks.artifacts.recover();
  assert.equal(fs.readFileSync(path.join(directory, prepared), 'utf8'), 'log');
  assert.equal(fs.readFileSync(path.join(directory, 'unknown'), 'utf8'), 'preserve');
  assert.equal(f.storage.tasks.artifacts.list(f.workspaceId, task.id).length, 1);
  db.close();
});

test('downloads reject cross-task IDs, file hardlinks, symlinks and redirected parent directories', async (t) => {
  const f = fixture(t), task = f.storage.tasks.create(f.workspaceId, f.input), other = f.storage.tasks.create(f.workspaceId, f.input);
  const artifact = await upload(f, task.id);
  const store = f.storage.tasks.artifacts, directory = path.join(f.storage.paths.tasks, task.id, 'artifacts'), file = path.join(directory, artifact.id);
  assert.throws(() => store.open(f.workspaceId, other.id, artifact.id), { code: 'NOT_FOUND' });
  fs.renameSync(file, `${file}.original`); fs.symlinkSync(`${file}.original`, file);
  assert.throws(() => store.open(f.workspaceId, task.id, artifact.id), { code: 'CONFLICT' });
  fs.unlinkSync(file); fs.linkSync(`${file}.original`, file);
  assert.throws(() => store.open(f.workspaceId, task.id, artifact.id), { code: 'CONFLICT' });
  fs.unlinkSync(file); fs.renameSync(`${file}.original`, file);
  fs.renameSync(directory, `${directory}.original`); fs.symlinkSync(`${directory}.original`, directory);
  assert.throws(() => store.open(f.workspaceId, task.id, artifact.id), { code: 'CONFLICT' });
});

test('context selection is explicit, bounded, UTF-8 checked and leaves unsupported inputs excluded', async (t) => {
  const f = fixture(t), task = f.storage.tasks.create(f.workspaceId, f.input), store = f.storage.tasks.artifacts;
  const text = await upload(f, task.id, 'é'.repeat(20));
  const pdf = await upload(f, task.id, 'synthetic PDF', 'report.pdf'), image = await upload(f, task.id, 'synthetic image', 'shot.png');
  assert.ok(store.context(f.workspaceId, task.id).entries.every((entry) => entry.range === null));
  const select = (id: string, start: number, end: number) => store.selectContext(f.workspaceId, task.id, [{ artifactId: id, start, end }]);
  assert.throws(() => select(text.id, 0, 40), /context limit/);
  assert.throws(() => select(text.id, 1, 4), /UTF-8/);
  for (const id of [pdf.id, image.id]) assert.throws(() => select(id, 0, 4), /Only valid text/);
  assert.throws(() => select(randomUUID(), 0, 4), { code: 'NOT_FOUND' });
  const manifest = select(text.id, 0, 10);
  assert.equal(manifest.includedBytes, Buffer.byteLength(f.input.description) + 10);
  assert.equal(manifest.entries.find((entry) => entry.id === text.id)!.sha256, text.sha256);
  assert.equal(fs.readFileSync(path.join(f.storage.paths.tasks, task.id, 'artifacts', text.id), 'utf8'), 'é'.repeat(20));
});

test('run snapshots preserve context and profile settings, enforce ownership/busy state and interrupt on restart', async (t) => {
  const f = fixture(t), { storage, workspaceId } = f, task = storage.tasks.create(workspaceId, f.input);
  const artifact = await upload(f, task.id);
  storage.tasks.artifacts.selectContext(workspaceId, task.id, [{ artifactId: artifact.id, start: 0, end: artifact.byteSize }]);
  const profile = storage.settings.createModelProfile(workspaceId, { name: 'Model', modelIdentifier: 'fixture-model', reasoningEffort: 'medium' });
  const input = { stage: 'investigation' as const, modelProfileId: profile.id, promptVersion: 'v1', schemaVersion: 'v1' };
  const run = storage.tasks.createRun(workspaceId, task.id, input);
  assert.equal(run.status, 'queued');
  assert.equal(run.inputSnapshot.context.entries[0]!.sha256, artifact.sha256);
  assert.deepEqual(run.inputSnapshot.constraints, []);
  assert.throws(() => storage.tasks.createRun(workspaceId, task.id, input), { code: 'CONFLICT' });
  const another = storage.tasks.create(workspaceId, f.input);
  assert.throws(() => storage.tasks.createRun(workspaceId, another.id, input), { code: 'CONFLICT' });
  await assert.rejects(upload(f, task.id), { code: 'CONFLICT' });
  assert.throws(() => storage.tasks.artifacts.selectContext(workspaceId, task.id, []), { code: 'CONFLICT' });
  storage.settings.updateModelProfile(workspaceId, profile.id, { name: 'Changed' });
  assert.deepEqual(storage.tasks.getRun(workspaceId, task.id, run.id).inputSnapshot.profile, { ...profile });
  assert.throws(() => storage.settings.deleteModelProfile(workspaceId, profile.id), { code: 'CONFLICT' });
  assert.throws(() => storage.tasks.transitionRun(workspaceId, task.id, run.id, 'succeeded'), { code: 'INVALID_INPUT' });
  storage.tasks.transitionRun(workspaceId, task.id, run.id, 'running');
  storage.close();
  const reopened = openStorage({ dataRoot: f.root });
  try {
    const interrupted = reopened.tasks.getRun(workspaceId, task.id, run.id);
    assert.equal(interrupted.error?.code, 'INTERRUPTED'); assert.equal(interrupted.status, 'failed');
    assert.deepEqual(interrupted.inputSnapshot, run.inputSnapshot);
    assert.deepEqual(reopened.tasks.transitionRun(workspaceId, task.id, run.id, 'cancelled'), interrupted);
    const retry = reopened.tasks.createRun(workspaceId, task.id, input);
    assert.notEqual(retry.id, run.id);
    const cancelled = reopened.tasks.transitionRun(workspaceId, task.id, retry.id, 'cancelled');
    assert.deepEqual(reopened.tasks.transitionRun(workspaceId, task.id, retry.id, 'succeeded'), cancelled);
    const foreign = reopened.settings.createWorkspace(workspaceInput).workspace.id;
    const foreignProfile = reopened.settings.createModelProfile(foreign, { name: 'Other' });
    assert.throws(() => reopened.tasks.createRun(workspaceId, task.id, { ...input, modelProfileId: foreignProfile.id }), { code: 'NOT_FOUND' });
  } finally { reopened.close(); }
});

test('upgrade from Task 005 preserves history and exposes task storage', (t) => {
  const root = fs.mkdtempSync(path.join(tmpdir(), 'aew-task-upgrade-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const db = new DatabaseSync(path.join(root, 'workbench.db')); migrate(db, migrations.slice(0, 4));
  const history = db.prepare('SELECT * FROM schema_migrations').all(); db.close();
  const storage = openStorage({ dataRoot: root });
  try {
    const check = new DatabaseSync(storage.paths.database);
    assert.deepEqual(check.prepare('SELECT * FROM schema_migrations WHERE version <= 4').all(), history); check.close();
    assert.equal(storage.status().schemaVersion, 5);
  } finally { storage.close(); }
});

test('SIGKILL during upload leaves a recorded partial file that restart cleans without publishing', async (t) => {
  const f = fixture(t), task = f.storage.tasks.create(f.workspaceId, f.input);
  f.storage.close();
  const child = fork(new URL('./worker.ts', import.meta.url), ['interrupt-upload', f.root], { execArgv: ['--import', 'tsx'], stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  const [message] = await once(child, 'message', { signal: AbortSignal.timeout(10000) });
  assert.deepEqual(message, { ready: true });
  const directory = path.join(f.root, 'tasks', task.id, 'artifacts');
  const staging = fs.readdirSync(directory)[0]!;
  assert.equal(fs.readFileSync(path.join(directory, staging), 'utf8'), 'partial');
  const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
  const reopened = openStorage({ dataRoot: f.root });
  try {
    assert.deepEqual(reopened.tasks.artifacts.list(f.workspaceId, task.id), []);
    assert.deepEqual(fs.readdirSync(directory), []);
    assert.equal(reopened.tasks.detail(f.workspaceId, task.id).imports[0]!.errorCode, 'INTERRUPTED');
    assert.equal(reopened.tasks.get(f.workspaceId, task.id).contextRevision, 1);
  } finally { reopened.close(); }
});

test('run input and terminal state cannot be rewritten through SQL and changed artifact bytes block a new run', async (t) => {
  const f = fixture(t), task = f.storage.tasks.create(f.workspaceId, f.input), store = f.storage.tasks;
  const artifact = await upload(f, task.id);
  store.artifacts.selectContext(f.workspaceId, task.id, [{ artifactId: artifact.id, start: 0, end: artifact.byteSize }]);
  const input = { stage: 'context_preparation' as const, modelProfileId: null, promptVersion: 'v1', schemaVersion: 'v1' };
  const run = store.createRun(f.workspaceId, task.id, input);
  store.transitionRun(f.workspaceId, task.id, run.id, 'running');
  store.transitionRun(f.workspaceId, task.id, run.id, 'succeeded');
  const db = new DatabaseSync(f.storage.paths.database);
  try {
    assert.throws(() => db.prepare("UPDATE stage_runs SET input_snapshot = '{}' WHERE id = ?").run(run.id), /run_(input|terminal)_immutable/);
    assert.throws(() => db.prepare("UPDATE stage_runs SET status = 'cancelled' WHERE id = ?").run(run.id), /run_terminal_immutable/);
    assert.throws(() => db.prepare("UPDATE artifacts SET sha256 = 'other' WHERE id = ?").run(artifact.id), /artifact_immutable/);
  } finally { db.close(); }
  const file = path.join(f.storage.paths.tasks, task.id, 'artifacts', artifact.id);
  fs.chmodSync(file, 0o600); fs.writeFileSync(file, 'x'.repeat(artifact.byteSize));
  assert.throws(() => store.createRun(f.workspaceId, task.id, input), /hash no longer matches/);
});
