import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, type TestContext } from 'node:test';
import { GitClient, WorktreeGit, worktreePlan } from '@aew/git';
import { openStorage } from '@aew/storage';
import type { StageRun } from '@aew/core';
import { createApp } from '../src/app.js';
import { RepositoryService } from '../src/repository-service.js';
import { WorktreeService } from '../src/worktree-service.js';

async function fixture(t: TestContext, count = 1) {
  const root = mkdtempSync(path.join(tmpdir(), 'aew-worktree-service-'));
  const env = { ...process.env, HOME: root, XDG_CONFIG_HOME: root, GIT_CONFIG_NOSYSTEM: '1' };
  const git = (args: string[], cwd: string) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd, env, stdio: 'pipe', encoding: 'utf8' }).trim();
  const storage = openStorage({ dataRoot: path.join(root, 'data') }), client = new GitClient({ env });
  const repositories = new RepositoryService(storage, client), service = new WorktreeService(storage, client);
  t.after(async () => { await service.close(); await repositories.close(); storage.close(); rmSync(root, { recursive: true, force: true }); });
  const workspaceId = storage.settings.createWorkspace({ name: 'Fixture', connection: { name: 'CLI', configHome: root } }).workspace.id;
  const ids: string[] = [];
  for (let index = 0; index < count; index++) {
    const source = path.join(root, `source ${index}`); mkdirSync(source);
    git(['init', '-b', 'trunk'], source); writeFileSync(path.join(source, 'file'), 'committed'); git(['add', '.'], source); git(['commit', '-m', 'Fixture'], source);
    const repository = await repositories.register(workspaceId, { name: `Source ${index}`, source }); ids.push(repository.id);
    writeFileSync(path.join(source, 'file'), 'dirty');
  }
  const task = storage.tasks.create(workspaceId, { title: 'Investigation', description: 'Fixture context.', repositoryIds: ids });
  const app = createApp({ settings: storage.settings, tasks: storage.tasks, repositories, worktrees: service });
  const origin = 'http://127.0.0.1:4242';
  const session = await app.request(`${origin}/api/session`, { method: 'POST', headers: { host: '127.0.0.1:4242', origin, 'x-aew-client': 'web' } });
  const headers = { host: '127.0.0.1:4242', origin, cookie: session.headers.get('set-cookie')!.split(';')[0]!,
    'x-aew-csrf': (await session.json() as { csrfToken: string }).csrfToken, 'content-type': 'application/json' };
  const base = `/api/workspaces/${workspaceId}/tasks/${task.id}`;
  const request = (route: string, method = 'GET', body?: unknown, overrides = {}) => app.request(`${origin}${route}`, {
    method, headers: { ...headers, ...overrides }, ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { root, env, git, storage, client, repositories, service, workspaceId, task, request, base };
}
async function finished(f: Pick<Awaited<ReturnType<typeof fixture>>, 'storage' | 'workspaceId' | 'task'>, id: string) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const run = f.storage.tasks.getRun(f.workspaceId, f.task.id, id);
    if (!['queued', 'running'].includes(run.status)) return run;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Worktree fixture did not finish.');
}

test('protected worktree API prepares both repositories, snapshots read roots and blocks cleanup during an active run', async (t) => {
  const f = await fixture(t, 2), prepare = `${f.base}/worktrees/prepare`;
  assert.equal((await f.request(prepare, 'POST', {}, { cookie: '' })).status, 401);
  assert.equal((await f.request(prepare, 'POST', {}, { 'x-aew-csrf': '' })).status, 403);
  assert.equal((await f.request(prepare, 'POST', { destination: '/arbitrary' })).status, 400);
  assert.equal((await f.request(prepare.replace(f.workspaceId, 'missing'), 'POST', {})).status, 404);
  const response = await f.request(prepare, 'POST', {}); assert.equal(response.status, 202);
  const run = await response.json() as StageRun;
  assert.equal((await f.request(prepare, 'POST', {})).status, 409);
  assert.equal((await finished(f, run.id)).status, 'succeeded');
  assert.equal((await f.request(`${f.base}/runs/${run.id}`)).status, 200);
  assert.equal(f.storage.tasks.get(f.workspaceId, f.task.id).status, 'CONTEXT_READY');
  const rows = f.storage.tasks.worktrees.list(f.workspaceId, f.task.id);
  for (const row of rows) { assert.equal(row.status, 'ready'); assert.equal(readFileSync(path.join(row.sourcePath!, 'file'), 'utf8'), 'dirty'); }
  const investigation = f.storage.tasks.createRun(f.workspaceId, f.task.id, { stage: 'investigation', modelProfileId: null, promptVersion: 'v1', schemaVersion: 'v1' });
  assert.ok(investigation.inputSnapshot.repositories.every((r) => r.worktreePath && r.managedPinRef && r.resolvedCommitSha));
  const cleanup = `${f.base}/worktrees/${rows[0]!.repositoryId}/cleanup`;
  assert.equal((await f.request(cleanup, 'POST', {})).status, 409);
  f.storage.tasks.transitionRun(f.workspaceId, f.task.id, investigation.id, 'cancelled');
  const removed = await f.request(cleanup, 'POST', {}); assert.equal(removed.status, 202);
  assert.equal((await finished(f, (await removed.json() as StageRun).id)).status, 'succeeded');
  assert.equal(f.storage.tasks.get(f.workspaceId, f.task.id).status, 'CREATED');
  assert.equal(existsSync(rows[0]!.worktreePath!), false);
  assert.equal(f.git(['rev-parse', rows[0]!.managedPinRef!], rows[0]!.sourcePath!), rows[0]!.resolvedCommitSha);
});

test('partial preparation failure reuses verified members on retry and permits correcting an unresolved base', async (t) => {
  const f = await fixture(t, 2), [first, second] = f.task.repositoryIds;
  f.service.setBaseRef(f.workspaceId, f.task.id, second!, { baseRef: 'missing' });
  const failed = await finished(f, f.service.start(f.workspaceId, f.task.id).id);
  assert.equal(failed.status, 'failed'); assert.equal(f.storage.tasks.get(f.workspaceId, f.task.id).status, 'CREATED');
  const ready = f.storage.tasks.worktrees.get(f.workspaceId, f.task.id, first!), inode = statSync(ready.worktreePath!).ino;
  assert.equal(ready.status, 'ready');
  assert.throws(() => f.service.setBaseRef(f.workspaceId, f.task.id, first!, { baseRef: 'other' }), { code: 'CONFLICT' });
  f.service.setBaseRef(f.workspaceId, f.task.id, second!, { baseRef: 'refs/heads/trunk' });
  assert.equal((await finished(f, f.service.start(f.workspaceId, f.task.id).id)).status, 'succeeded');
  assert.equal(statSync(ready.worktreePath!).ino, inode);
  assert.equal(f.storage.tasks.get(f.workspaceId, f.task.id).status, 'CONTEXT_READY');
  assert.equal(f.storage.tasks.getRun(f.workspaceId, f.task.id, failed.id).status, 'failed');
});

test('dirty cleanup fails without deleting files and shared Git locks reject synchronization', async (t) => {
  const f = await fixture(t);
  const run = f.service.start(f.workspaceId, f.task.id);
  assert.throws(() => f.repositories.startSync(f.workspaceId, f.task.repositoryIds[0]!), { code: 'CONFLICT' });
  assert.equal((await finished(f, run.id)).status, 'succeeded');
  const row = f.storage.tasks.worktrees.list(f.workspaceId, f.task.id)[0]!;
  writeFileSync(path.join(row.worktreePath!, 'untracked'), 'preserve');
  assert.equal((await finished(f, f.service.start(f.workspaceId, f.task.id, row.repositoryId).id)).status, 'failed');
  assert.equal(readFileSync(path.join(row.worktreePath!, 'untracked'), 'utf8'), 'preserve');
  unlinkSync(path.join(row.worktreePath!, 'untracked'));
  assert.equal((await finished(f, f.service.start(f.workspaceId, f.task.id, row.repositoryId).id)).status, 'succeeded');
  assert.equal(f.storage.tasks.worktrees.get(f.workspaceId, f.task.id, row.repositoryId).status, 'removed');
});

test('restart reconciles a completed Git worktree after database publication failure without recreating it', async (t) => {
  const f = await fixture(t), db = new DatabaseSync(f.storage.paths.database);
  db.exec("CREATE TRIGGER reject_ready BEFORE UPDATE OF status ON task_worktrees WHEN NEW.status = 'ready' BEGIN SELECT RAISE(ABORT, 'fixture publication failure'); END");
  assert.equal((await finished(f, f.service.start(f.workspaceId, f.task.id).id)).status, 'failed');
  const row = f.storage.tasks.worktrees.list(f.workspaceId, f.task.id)[0]!, inode = statSync(row.worktreePath!).ino;
  db.exec('DROP TRIGGER reject_ready'); db.close();
  await f.service.close(); f.storage.close();
  const storage = openStorage({ dataRoot: path.join(f.root, 'data') }), service = new WorktreeService(storage, new GitClient({ env: f.env }));
  try {
    await service.recover(); assert.equal(storage.tasks.get(f.workspaceId, f.task.id).status, 'CONTEXT_READY');
    assert.equal(statSync(row.worktreePath!).ino, inode);
    assert.equal(storage.tasks.detail(f.workspaceId, f.task.id).latestRun!.status, 'failed');
  } finally { await service.close(); storage.close(); }
});

test('restart finalizes a Git removal with pending metadata and interrupts its run while retaining the pin', async (t) => {
  const f = await fixture(t); assert.equal((await finished(f, f.service.start(f.workspaceId, f.task.id).id)).status, 'succeeded');
  const run = f.storage.tasks.createRun(f.workspaceId, f.task.id, { stage: 'context_preparation', modelProfileId: null, promptVersion: 'cleanup', schemaVersion: 'v1' });
  f.storage.tasks.transitionRun(f.workspaceId, f.task.id, run.id, 'running');
  const row = f.storage.tasks.worktrees.begin(f.workspaceId, f.task.id, f.task.repositoryIds[0]!, 'remove', run.id);
  await new WorktreeGit(f.client, f.storage.paths.worktrees).remove(worktreePlan(row));
  await f.service.close(); f.storage.close();
  const storage = openStorage({ dataRoot: path.join(f.root, 'data') }), service = new WorktreeService(storage, new GitClient({ env: f.env }));
  try {
    await service.recover(); assert.equal(storage.tasks.worktrees.get(f.workspaceId, f.task.id, row.repositoryId).status, 'removed');
    assert.equal(storage.tasks.getRun(f.workspaceId, f.task.id, run.id).error?.code, 'INTERRUPTED');
    assert.equal(f.git(['rev-parse', row.managedPinRef!], row.sourcePath!), row.resolvedCommitSha);
  } finally { await service.close(); storage.close(); }
});

test('shutdown terminates an active preparation and persists its failure before storage closes', async (t) => {
  const f = await fixture(t), fake = path.join(f.root, 'slow-git');
  writeFileSync(fake, `#!${process.execPath}\nsetInterval(()=>{},1000);`, { mode: 0o700 });
  const service = new WorktreeService(f.storage, new GitClient({ executable: fake, env: f.env }));
  const run = service.start(f.workspaceId, f.task.id); await service.close();
  const result = await finished(f, run.id);
  assert.equal(result.status, 'failed'); assert.equal(result.error?.code, 'GIT_CANCELLED');
  assert.equal(f.storage.tasks.worktrees.list(f.workspaceId, f.task.id)[0]!.status, 'failed');
});

test('shutdown waits for startup reconciliation and preserves the recorded worktree', async (t) => {
  const f = await fixture(t); assert.equal((await finished(f, f.service.start(f.workspaceId, f.task.id).id)).status, 'succeeded');
  const row = f.storage.tasks.worktrees.list(f.workspaceId, f.task.id)[0]!;
  const fake = path.join(f.root, 'slow-recovery-git'); writeFileSync(fake, `#!${process.execPath}\nsetInterval(()=>{},1000);`, { mode: 0o700 });
  const service = new WorktreeService(f.storage, new GitClient({ executable: fake, env: f.env }));
  const recovery = service.recover(); await service.close(); await recovery;
  assert.ok(existsSync(row.worktreePath!));
  assert.equal(f.storage.tasks.worktrees.list(f.workspaceId, f.task.id)[0]!.error?.code, 'GIT_CANCELLED');
});
