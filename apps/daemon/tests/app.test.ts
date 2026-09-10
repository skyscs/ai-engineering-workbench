import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { openStorage } from '@aew/storage';

const host = '127.0.0.1:4242';
const origin = `http://${host}`;

function request(app: ReturnType<typeof createApp>, route: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('host')) headers.set('host', host);
  return app.request(`${origin}${route}`, { ...init, headers });
}

async function session(app: ReturnType<typeof createApp>) {
  const response = await request(app, '/api/session', {
    method: 'POST', headers: { origin, 'x-aew-client': 'web' }
  });
  assert.equal(response.status, 200);
  const cookieHeader = response.headers.get('set-cookie')!;
  assert.match(cookieHeader, /HttpOnly/i);
  assert.match(cookieHeader, /SameSite=Strict/i);
  assert.match(cookieHeader, /Path=\/api/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json() as { csrfToken: string };
  return { cookie: cookieHeader.split(';')[0]!, token: body.csrfToken };
}

test('health is public but only accessible through the configured local host', async () => {
  const app = createApp();
  const response = await request(app, '/api/health');
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { status: string }).status, 'ok');
  for (const invalid of ['evil.example:4242', '127.0.0.1:9999', 'localhost:4242']) {
    assert.equal((await request(app, '/api/health', { headers: { host: invalid } })).status, 403);
  }
  assert.equal((await app.request(`${origin}/api/health`)).status, 403);
});

test('storage status uses a real initialized database and requires a local session', async () => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'aew-http-storage-test-'));
  const storage = openStorage({ dataRoot });
  try {
    const app = createApp({ storageStatus: () => storage.status() });
    assert.equal((await request(app, '/api/storage')).status, 401);
    const { cookie } = await session(app);
    const response = await request(app, '/api/storage', { headers: { cookie } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const status = await response.json() as Record<string, unknown>;
    assert.equal(status.status, 'ready');
    assert.equal(status.schemaVersion, 4);
    assert.equal(status.foreignKeys, true);
    assert.equal(status.journalMode, 'wal');
    assert.ok(!JSON.stringify(status).includes(dataRoot));
    assert.equal((await request(app, '/api/storage', { headers: { cookie, origin: 'https://evil.example' } })).status, 403);
    const unavailable = createApp();
    const other = await session(unavailable);
    assert.equal((await request(unavailable, '/api/storage', { headers: { cookie: other.cookie } })).status, 503);
  } finally {
    storage.close();
    await rm(dataRoot, { recursive: true, force: true });
  }
});

test('rejects cross-origin and opaque-origin requests, even for session bootstrap', async () => {
  const app = createApp();
  for (const invalid of ['https://evil.example', 'null', 'http://127.0.0.1:5173']) {
    const response = await request(app, '/api/session', {
      method: 'POST', headers: { origin: invalid, 'x-aew-client': 'web' }
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal(response.headers.get('set-cookie'), null);
  }
  assert.equal((await request(app, '/api/session', { method: 'POST' })).status, 403);
  assert.equal((await request(app, '/api/session', { method: 'POST', headers: { origin } })).status, 403);
  assert.equal((await request(app, '/api/health', { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
});

test('only development accepts the exact Vite proxy origin and host', async () => {
  const app = createApp({ development: true });
  const response = await request(app, '/api/session', {
    method: 'POST', headers: { host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173', 'x-aew-client': 'web' }
  });
  assert.equal(response.status, 200);
});

test('sensitive reads require a session; mutations require its CSRF token and origin', async () => {
  const app = createApp();
  assert.equal((await request(app, '/api/unknown')).status, 401);
  const first = await session(app);
  const second = await session(app);
  for (const headers of [
    { cookie: first.cookie, origin },
    { cookie: first.cookie, origin, 'x-aew-csrf': 'incorrect' },
    { cookie: first.cookie, origin, 'x-aew-csrf': second.token },
    { cookie: first.cookie, 'x-aew-csrf': first.token }
  ]) {
    assert.equal((await request(app, '/api/session', { method: 'DELETE', headers })).status, 403);
  }
  assert.equal((await request(app, '/api/unknown', { headers: { cookie: first.cookie } })).status, 404);
  assert.equal((await request(app, '/api/session', {
    method: 'DELETE', headers: { cookie: first.cookie, origin, 'x-aew-csrf': first.token }
  })).status, 204);
  assert.equal((await request(app, '/api/unknown', { headers: { cookie: first.cookie } })).status, 401);
});

test('sessions expire and are not shared by another daemon instance', async () => {
  let clock = 0;
  const app = createApp({ now: () => clock });
  const { cookie } = await session(app);
  assert.equal((await request(createApp(), '/api/unknown', { headers: { cookie } })).status, 401);
  clock += 8 * 60 * 60 * 1000;
  assert.equal((await request(app, '/api/unknown', { headers: { cookie } })).status, 401);
});

test('session bootstrap reuses an existing session without rotating other tabs', async () => {
  const app = createApp();
  const { cookie, token } = await session(app);
  const response = await request(app, '/api/session', {
    method: 'POST', headers: { cookie, origin, 'x-aew-client': 'web' }
  });
  assert.equal((await response.json() as { csrfToken: string }).csrfToken, token);
});

test('production assets and SPA routes work while unknown API routes remain JSON', async () => {
  const publicDir = await mkdtemp(path.join(os.tmpdir(), 'aew-static-test-'));
  try {
    await writeFile(path.join(publicDir, 'index.html'), '<html><body>Workbench</body></html>');
    await writeFile(path.join(publicDir, 'app.js'), 'console.log("asset");');
    const app = createApp({ publicDir });
    const { cookie } = await session(app);
    for (const route of ['/', '/tasks/example']) {
      const response = await request(app, route);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /Workbench/);
    }
    assert.match(await (await request(app, '/app.js')).text(), /asset/);
    for (const route of ['/api', '/api/missing']) {
      const response = await request(app, route, { headers: { cookie } });
      assert.equal(response.status, 404);
      assert.match(response.headers.get('content-type')!, /application\/json/);
      assert.equal((await response.json() as { error: { code: string } }).error.code, 'NOT_FOUND');
    }
  } finally {
    await rm(publicDir, { recursive: true, force: true });
  }
});
