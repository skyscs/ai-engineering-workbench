import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, type TestContext } from 'node:test';
import { GitClient, WorktreeGit, worktreePlan } from '@aew/git';
import { openStorage } from '@aew/storage';
import { FakeRuntime, RuntimeError, type AIRuntime } from '@aew/ai';
import { RuntimeService } from '../src/runtime-service.js';
import type { StageRun } from '@aew/core';
import { createApp } from '../src/app.js';
import { RepositoryService } from '../src/repository-service.js';
import { WorktreeService } from '../src/worktree-service.js';

async function fixture(t: TestContext, runtime: AIRuntime = new FakeRuntime(goodEvents), count = 1, history = false) {
  const root = mkdtempSync(path.join(tmpdir(), 'aew-worktree-service-'));
  const env = { ...process.env, HOME: root, XDG_CONFIG_HOME: root, GIT_CONFIG_NOSYSTEM: '1' };
  const git = (args: string[], cwd: string) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd, env, stdio: 'pipe', encoding: 'utf8' }).trim();
  const storage = openStorage({ dataRoot: path.join(root, 'data') }), client = new GitClient({ env });
  const repositories = new RepositoryService(storage, client), service = new WorktreeService(storage, client);
  t.after(async () => { await runtimeService.close(); await service.close(); await repositories.close(); storage.close(); rmSync(root, { recursive: true, force: true }); });
  const workspaceId = storage.settings.createWorkspace({ name: 'Fixture', connection: { name: 'CLI', configHome: root } }).workspace.id;
  const ids: string[] = [];
  for (let index = 0; index < count; index++) {
    const source = path.join(root, `source ${index}`); mkdirSync(source);
    git(['init', '-b', 'trunk'], source); writeFileSync(path.join(source, 'file'), 'committed'); git(['add', '.'], source); git(['commit', '-m', 'Fixture'], source);
    if (history) {
      symlinkSync('/etc/passwd', path.join(source, 'linked'));
      writeFileSync(path.join(source, 'binary'), Buffer.from([0, 255]));
      git(['add', '.'], source); git(['commit', '-m', 'History fixture'], source);
    }
    const repository = await repositories.register(workspaceId, { name: `Source ${index}`, source }); ids.push(repository.id);
    writeFileSync(path.join(source, 'file'), 'dirty');
  }
  const task = storage.tasks.create(workspaceId, { title: 'Investigation', description: 'Fixture context.', repositoryIds: ids });
  assert.equal((await finished({ storage, workspaceId, task }, service.start(workspaceId, task.id).id)).status, 'succeeded');
  const runtimeService = new RuntimeService(storage, runtime, client);
  t.after(() => runtimeService.close());
  const app = createApp({ settings: storage.settings, tasks: storage.tasks, repositories, worktrees: service, runtime: runtimeService });
  const origin = 'http://127.0.0.1:4242';
  const session = await app.request(`${origin}/api/session`, { method: 'POST', headers: { host: '127.0.0.1:4242', origin, 'x-aew-client': 'web' } });
  const headers = { host: '127.0.0.1:4242', origin, cookie: session.headers.get('set-cookie')!.split(';')[0]!,
    'x-aew-csrf': (await session.json() as { csrfToken: string }).csrfToken, 'content-type': 'application/json' };
  const base = `/api/workspaces/${workspaceId}/tasks/${task.id}`;
  const request = (route: string, method = 'GET', body?: unknown, overrides = {}) => app.request(`${origin}${route}`, {
    method, headers: { ...headers, ...overrides }, ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { root, env, git, storage, client, repositories, service, workspaceId, task, request, base, runtimeService };
}
async function finished(f: { storage: ReturnType<typeof openStorage>; workspaceId: string; task: { id: string } }, id: string) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const run = f.storage.tasks.getRun(f.workspaceId, f.task.id, id);
    if (!['queued', 'running'].includes(run.status)) return run;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Worktree fixture did not finish.');
}

const preview = { summary: 'Synthetic preliminary result.', findings: ['The selected text supports this finding.'], unresolvedQuestions: [] };
const goodEvents = [{ type: 'runtime' as const, data: { version: 'fake-v1', configHome: '/fixture', profile: null, configurationFingerprint: 'fixture', accessMode: 'read' as const, enabledMcpServers: 0 as const } },
  { type: 'progress' as const, data: { message: 'Reading fixture history.' } }, { type: 'result' as const, data: preview }];


export { fixture, finished, preview, goodEvents };
