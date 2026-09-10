import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { GitClient } from '@aew/git';
import { openStorage } from '@aew/storage';
import { createApp } from '../src/app.js';
import { RepositoryService } from '../src/repository-service.js';

async function fixture(t: TestContext) {
  const root = mkdtempSync(path.join(tmpdir(), 'aew-repository-http-'));
  const source = path.join(root, 'source space 日本語'); mkdirSync(source);
  const env = { ...process.env, HOME: root, XDG_CONFIG_HOME: root, GIT_CONFIG_NOSYSTEM: '1' };
  const git = (args: string[]) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: source, env, stdio: 'pipe' });
  git(['init', '-b', 'trunk']); writeFileSync(path.join(source, 'file'), 'original'); git(['add', '.']); git(['commit', '-m', 'Fixture commit']);
  const storage = openStorage({ dataRoot: path.join(root, 'data') });
  const service = new RepositoryService(storage, new GitClient({ env }));
  t.after(async () => { await service.close(); storage.close(); rmSync(root, { recursive: true, force: true }); });
  const workspace = storage.settings.createWorkspace({ name: 'Fixture', connection: { name: 'Fixture' } }).workspace;
  const app = createApp({ repositories: service, settings: storage.settings });
  const origin = 'http://127.0.0.1:4242';
  const session = await app.request(`${origin}/api/session`, { method: 'POST', headers: { host: '127.0.0.1:4242', origin, 'x-aew-client': 'web' } });
  const headers = { host: '127.0.0.1:4242', origin, cookie: session.headers.get('set-cookie')!.split(';')[0]!,
    'x-aew-csrf': (await session.json() as { csrfToken: string }).csrfToken, 'content-type': 'application/json' };
  const route = `/api/workspaces/${workspace.id}/repositories`;
  const request = (route: string, method = 'GET', body?: unknown, overrides = {}) => app.request(`${origin}${route}`, {
    method, headers: { ...headers, ...overrides }, ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { root, source, storage, service, workspace, request, route };
}
async function finished(service: RepositoryService, workspaceId: string, id: string) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const row = service.get(workspaceId, id);
    if (row.status !== 'cloning') return row;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Clone fixture did not finish.');
}

test('registration persists metadata, rejects duplicates and protects workspace ownership/deletion', async (t) => {
  const { source, storage, service, workspace, request, route } = await fixture(t);
  writeFileSync(path.join(source, 'file'), 'dirty');
  const response = await request(route, 'POST', { name: 'Existing', source }); assert.equal(response.status, 201);
  const row = await response.json() as { id: string; commonGitDir: string };
  assert.equal(row.commonGitDir, path.join(source, '.git'));
  assert.equal(readFileSync(path.join(source, 'file'), 'utf8'), 'dirty');
  assert.equal((await request(route, 'POST', { name: 'Duplicate', source })).status, 409);
  const other = storage.settings.createWorkspace({ name: 'Other', connection: { name: 'Other' } }).workspace;
  assert.equal((await request(`/api/workspaces/${other.id}/repositories/${row.id}`)).status, 404);
  assert.equal((await request(`/api/workspaces/${workspace.id}`, 'DELETE')).status, 409);
  const before = service.get(workspace.id, row.id), root = storage.paths.root;
  await service.close(); storage.close();
  const reopened = openStorage({ dataRoot: root });
  try { assert.deepEqual(reopened.repositories.get(workspace.id, row.id), before); }
  finally { reopened.close(); }
});

test('clone API returns an operation before completion and publishes a persistent managed repository', async (t) => {
  const { source, storage, service, workspace, request, route } = await fixture(t);
  const response = await request(`${route}/clone`, 'POST', { name: 'Managed', source }); assert.equal(response.status, 202);
  const pending = await response.json() as { id: string; status: string }; assert.equal(pending.status, 'cloning');
  assert.equal((await request(`${route}/clone`, 'POST', { name: 'Duplicate', source })).status, 409);
  const row = await finished(service, workspace.id, pending.id);
  assert.equal(row.status, 'ready'); assert.equal(row.managedClone, true);
  assert.ok(row.localPath.startsWith(storage.paths.repositories + path.sep));
  assert.equal(row.baseRef, 'refs/remotes/origin/trunk'); assert.ok(row.resolvedCommitSha);
  assert.equal((await request(`${route}/${row.id}`)).status, 200);
  assert.equal(readFileSync(path.join(source, 'file'), 'utf8'), 'original');
});

test('failed clone cleans only its generated directory and retains normalized diagnostics', async (t) => {
  const { source, service, workspace, request, route } = await fixture(t);
  const response = await request(`${route}/clone`, 'POST', { name: 'Bad ref', source, baseRef: 'missing' });
  const pending = await response.json() as { id: string };
  const row = await finished(service, workspace.id, pending.id);
  assert.equal(row.status, 'failed'); assert.equal(row.error?.code, 'INVALID_INPUT'); assert.equal(row.retainedFiles, false);
  assert.throws(() => readFileSync(path.join(row.localPath, '.git/HEAD')), { code: 'ENOENT' });
  assert.equal(readFileSync(path.join(source, 'file'), 'utf8'), 'original');
  const nonGit = path.dirname(source);
  const failed = await service.startClone(workspace.id, { name: 'Not Git', source: nonGit });
  const result = await finished(service, workspace.id, failed.id);
  assert.equal(result.error?.code, 'GIT_FAILED'); assert.equal(result.error?.exitCode, 128); assert.ok(result.error?.stderr);
  assert.equal(result.retainedFiles, false);
});

test('repository APIs reject unsafe requests before invoking Git', async (t) => {
  const { source, storage, workspace, request, route } = await fixture(t);
  const input = { name: 'Fixture', source };
  assert.equal((await request(route, 'GET', undefined, { cookie: '' })).status, 401);
  assert.equal((await request(route, 'POST', input, { 'x-aew-csrf': '' })).status, 403);
  assert.equal((await request(`${route}/clone`, 'POST', input, { origin: 'https://evil.example' })).status, 403);
  for (const body of [{ ...input, workspaceId: 'forged' }, { ...input, env: { TOKEN: 'synthetic' } }, { ...input, name: 'x'.repeat(17000) }]) {
    assert.equal((await request(route, 'POST', body)).status, 400);
  }
  for (const source of ['ext::unsafe', 'https://user:synthetic-secret@example.invalid/repo']) {
    const response = await request(`${route}/clone`, 'POST', { name: 'Rejected', source });
    assert.equal(response.status, 400); assert.ok(!(await response.text()).includes('synthetic-secret'));
  }
  assert.equal(storage.repositories.list(workspace.id).length, 0);
});

test('shutdown cancels an active clone and records its cleanup before storage closes', async (t) => {
  const { root, source, storage, workspace } = await fixture(t);
  const fake = path.join(root, 'slow-git');
  writeFileSync(fake, `#!${process.execPath}\nsetInterval(()=>{},1000);`, { mode: 0o700 });
  const service = new RepositoryService(storage, new GitClient({ executable: fake }));
  const pending = await service.startClone(workspace.id, { name: 'Interrupted', source });
  await new Promise((resolve) => setTimeout(resolve, 50));
  await service.close();
  const row = storage.repositories.get(workspace.id, pending.id);
  assert.equal(row.status, 'failed'); assert.equal(row.error?.code, 'GIT_CANCELLED'); assert.equal(row.retainedFiles, false);
});
