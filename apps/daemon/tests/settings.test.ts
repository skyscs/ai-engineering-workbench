import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { test, type TestContext } from 'node:test';
import { openStorage } from '@aew/storage';
import { createApp } from '../src/app.js';

const origin = 'http://127.0.0.1:4242';
const body = (name: string) => ({ name, connection: { name: `${name} connection`, configProfile: null } });
async function fixture(t: TestContext) {
  const dataRoot = mkdtempSync(path.join(tmpdir(), 'aew-settings-http-'));
  const storage = openStorage({ dataRoot });
  t.after(() => { storage.close(); rmSync(dataRoot, { recursive: true, force: true }); });
  const app = createApp({ settings: storage.settings });
  const session = await app.request(`${origin}/api/session`, {
    method: 'POST', headers: { host: '127.0.0.1:4242', origin, 'x-aew-client': 'web' }
  });
  const { csrfToken } = await session.json() as { csrfToken: string };
  const headers = { host: '127.0.0.1:4242', origin, 'content-type': 'application/json', 'x-aew-csrf': csrfToken,
    cookie: session.headers.get('set-cookie')!.split(';')[0]! };
  function request(route: string, method = 'GET', value?: unknown) {
    return app.request(`${origin}/api${route}`, { method, headers, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
  }
  return { storage, app, headers, request };
}

test('workspace HTTP CRUD returns persistent metadata and never claims a verified connection', async (t) => {
  const { request, storage } = await fixture(t);
  assert.deepEqual(await (await request('/workspaces')).json(), { workspaces: [] });
  const response = await request('/workspaces', 'POST', body('API fixture'));
  assert.equal(response.status, 201);
  const created = await response.json() as { workspace: { id: string }; connection: { verificationStatus: string } };
  assert.equal(created.connection.verificationStatus, 'not_verified');
  const base = `/workspaces/${created.workspace.id}`;
  assert.equal((await request(base, 'PATCH', { name: 'Renamed' })).status, 200);
  assert.equal((await request(`${base}/connection`, 'PUT', { name: 'Named connection', configProfile: 'corporate' })).status, 200);
  const profile = await (await request(`${base}/model-profiles`, 'POST', { name: 'Opaque model', modelIdentifier: 'org/proxy@v3', reasoningEffort: 'medium' })).json() as { id: string };
  assert.equal((await request(`${base}/model-profiles/${profile.id}`, 'PUT', { name: 'CLI default' })).status, 200);
  assert.equal(storage.settings.getWorkspace(created.workspace.id).workspace.name, 'Renamed');
  assert.equal((await request(`${base}/model-profiles/${profile.id}`, 'DELETE')).status, 204);
  assert.equal((await request(base, 'DELETE')).status, 204);
  assert.equal((await request(base)).status, 404);
});

test('settings mutations require session, Origin and CSRF; invalid bodies never reach persistence', async (t) => {
  const { app, headers, request, storage } = await fixture(t);
  assert.equal((await app.request(`${origin}/api/workspaces`, { headers: { host: '127.0.0.1:4242' } })).status, 401);
  for (const invalid of [{ ...headers, 'x-aew-csrf': '' }, { ...headers, origin: 'https://evil.example' }]) {
    assert.equal((await app.request(`${origin}/api/workspaces`, { method: 'POST', headers: invalid, body: JSON.stringify(body('Rejected')) })).status, 403);
  }
  for (const raw of ['{', 'null', '[]', JSON.stringify({ ...body('Rejected'), token: 'synthetic-secret' }),
    JSON.stringify({ ...body('x'.repeat(17000)) })]) {
    const response = await app.request(`${origin}/api/workspaces`, { method: 'POST', headers, body: raw });
    assert.equal(response.status, 400);
    assert.ok(!(await response.text()).includes('synthetic-secret'));
  }
  assert.equal((await app.request(`${origin}/api/workspaces`, { method: 'POST', headers: { ...headers, 'content-type': 'text/plain' }, body: '{}' })).status, 400);
  assert.equal((await request('/workspaces/missing', 'PATCH', { name: 'Missing' })).status, 404);
  assert.equal(storage.settings.listWorkspaces().length, 0);
});

test('server rejects cross-workspace profiles and forged boundary changes, including updates', async (t) => {
  const { request, storage } = await fixture(t);
  const a = storage.settings.createWorkspace(body('A')), b = storage.settings.createWorkspace(body('B'));
  const profile = storage.settings.createModelProfile(a.workspace.id, { name: 'Owned by A' });
  const route = `/workspaces/${b.workspace.id}/model-profiles/${profile.id}`;
  for (const method of ['GET', 'PUT', 'DELETE']) {
    assert.equal((await request(route, method, method === 'PUT' ? { name: 'Attempted edit' } : undefined)).status, 404);
  }
  const base = `/workspaces/${a.workspace.id}`;
  assert.equal((await request(base, 'PATCH', { name: 'A', aiConnectionId: b.connection.id })).status, 400);
  storage.settings.lockWorkspaceBoundary(a.workspace.id);
  assert.equal((await request(`${base}/connection`, 'PUT', { name: 'Changed', configProfile: 'other-account' })).status, 409);
  assert.equal((await request(base, 'PATCH', { name: 'A', boundaryLocked: false })).status, 400);
  assert.equal((await request(base, 'DELETE')).status, 409);
  assert.deepEqual(storage.settings.getModelProfile(a.workspace.id, profile.id), profile);
});
