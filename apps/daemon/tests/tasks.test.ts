import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { openStorage } from '@aew/storage';
import type { Artifact, Task } from '@aew/core';
import { createApp } from '../src/app.js';

async function fixture(t: TestContext) {
  const root = mkdtempSync(path.join(tmpdir(), 'aew-http-tasks-'));
  const storage = openStorage({ dataRoot: root, artifactLimits: { fileBytes: 100, taskBytes: 200 } });
  t.after(async () => { await storage.tasks.artifacts.close(); storage.close(); rmSync(root, { recursive: true, force: true }); });
  const app = createApp({ settings: storage.settings, tasks: storage.tasks });
  const host = '127.0.0.1:4242', origin = `http://${host}`;
  const session = await app.request(`${origin}/api/session`, { method: 'POST', headers: { host, origin, 'x-aew-client': 'web' } });
  const token = (await session.json() as { csrfToken: string }).csrfToken;
  const headers = { host, origin, cookie: session.headers.get('set-cookie')!.split(';')[0]!, 'x-aew-csrf': token };
  const request = (route: string, init: RequestInit = {}) => app.request(`${origin}/api${route}`, { ...init, headers: { ...headers, ...init.headers } });
  const workspaceId = storage.settings.createWorkspace({ name: 'HTTP fixture', connection: { name: 'CLI' } }).workspace.id;
  const repository = storage.repositories.register(workspaceId, 'Fixture', { localPath: path.join(root, 'repo'), commonGitDir: path.join(root, 'repo/.git'), remoteUrl: null,
    defaultBranch: null, baseRef: null, resolvedCommitSha: null, shallow: false });
  const base = `/workspaces/${workspaceId}/tasks`;
  const body = JSON.stringify({ title: 'Browser task', description: 'Multiline\ndescription', repositoryIds: [repository.id] });
  return { storage, app, request, base, body, workspaceId };
}

test('task and artifact routes enforce sessions, CSRF, ownership and immutable attachment headers', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request(f.base, { headers: { cookie: '' } })).status, 401);
  assert.equal((await f.request(f.base, { method: 'POST', headers: { 'x-aew-csrf': '', 'content-type': 'application/json' }, body: f.body })).status, 403);
  const response = await f.request(f.base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: f.body });
  assert.equal(response.status, 201); const task = await response.json() as Task;
  assert.equal(f.storage.settings.getWorkspace(f.workspaceId).workspace.boundaryLocked, true);
  const route = `${f.base}/${task.id}/artifacts`;
  const bytes = '<script>alert("fixture")</script>';
  const upload = { method: 'POST', headers: { 'x-aew-filename': encodeURIComponent('../../日本語.md'), 'x-aew-file-size': String(Buffer.byteLength(bytes)), 'content-type': 'text/plain' }, body: bytes };
  assert.equal((await f.request(route, { ...upload, headers: { ...upload.headers, 'x-aew-csrf': '' } })).status, 403);
  const imported = await f.request(route, upload); assert.equal(imported.status, 201);
  const artifact = await imported.json() as Artifact;
  const downloaded = await f.request(`${route}/${artifact.id}/download`);
  assert.equal(downloaded.status, 200); assert.equal(downloaded.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(downloaded.headers.get('content-type'), 'application/octet-stream');
  assert.match(downloaded.headers.get('content-disposition')!, /^attachment;.*filename\*=UTF-8''/);
  assert.equal(await downloaded.text(), bytes);
  assert.equal((await f.request(`${route}/${artifact.id}/download`, { headers: { cookie: '' } })).status, 401);
  assert.equal((await f.request(`${route}/${artifact.id}/download`, { headers: { origin: 'https://evil.example' } })).status, 403);
  const other = f.storage.tasks.create(f.workspaceId, JSON.parse(f.body));
  assert.equal((await f.request(`${f.base}/${other.id}/artifacts/${artifact.id}/download`)).status, 404);
  assert.equal((await f.request(`${f.base}/${task.id}/context`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify([{ artifactId: artifact.id, start: 0, end: artifact.byteSize }]) })).status, 200);
  const detail = await (await f.request(`${f.base}/${task.id}`)).json() as { context: { entries: { range: unknown }[] } };
  assert.ok(detail.context.entries[0]!.range);
  assert.equal((await f.request(`${f.base}/${task.id}/runs`, { method: 'POST' })).status, 404);
});

test('task transport rejects malformed metadata, unknown fields and streamed quota violations', async (t) => {
  const f = await fixture(t);
  for (const body of ['{', '{}', JSON.stringify({ ...JSON.parse(f.body), aiConnectionId: 'injected' }), JSON.stringify({ ...JSON.parse(f.body), repositoryIds: [] })]) {
    assert.equal((await f.request(f.base, { method: 'POST', headers: { 'content-type': 'application/json' }, body })).status, 400);
  }
  const task = f.storage.tasks.create(f.workspaceId, JSON.parse(f.body)), route = `${f.base}/${task.id}/artifacts`;
  for (const headers of [
    { 'x-aew-filename': '%zz', 'x-aew-file-size': '3' },
    { 'x-aew-filename': 'file.log', 'x-aew-file-size': '-1' },
    { 'x-aew-filename': 'file.log', 'x-aew-file-size': '2' },
    { 'x-aew-filename': 'file.log', 'x-aew-file-size': '101' }
  ]) assert.equal((await f.request(route, { method: 'POST', headers: { ...headers, 'content-type': 'text/plain' }, body: 'abc' })).status, 400);
  assert.deepEqual(f.storage.tasks.artifacts.list(f.workspaceId, task.id), []);
});
