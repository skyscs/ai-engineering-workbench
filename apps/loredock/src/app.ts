import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import { serveStatic } from '@hono/node-server/serve-static';
import { Catalog } from './catalog.js';
import { CatalogError } from './types.js';

export function createApp(catalog: Catalog, options: { publicDir?: string; development?: boolean } = {}) {
  const app = new Hono();
  const hosts = new Set(['127.0.0.1:4244', ...options.development ? ['127.0.0.1:5174'] : []]);
  const origins = new Set([...hosts].map(host => `http://${host}`));
  const sessions = new Map<string, { token: string; expires: number }>();
  app.use('*', async (c, next) => {
    if (!hosts.has(c.req.header('host') ?? '')) return c.json({ error: { message: 'Use the local LoreDock URL.' } }, 403);
    const origin = c.req.header('origin');
    const navigation = c.req.method === 'GET' && c.req.path !== '/api' && !c.req.path.startsWith('/api/')
      && c.req.header('sec-fetch-mode') === 'navigate' && c.req.header('sec-fetch-dest') === 'document'
      && c.req.header('sec-fetch-user') === '?1' && origin === undefined;
    if ((origin !== undefined && !origins.has(origin)) || (c.req.header('sec-fetch-site') === 'cross-site' && !navigation)) return c.json({ error: { message: 'Cross-origin requests are not allowed.' } }, 403);
    c.header('X-Content-Type-Options', 'nosniff'); c.header('X-Frame-Options', 'DENY'); c.header('Referrer-Policy', 'no-referrer');
    if (!options.development) c.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    await next();
  });
  app.use('/api/*', bodyLimit({ maxSize: 16384, onError: c => c.json({ error: { message: 'Request exceeds 16 KiB.' } }, 413) }));
  app.use('/api/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    for (const [id, session] of sessions) if (session.expires <= Date.now()) sessions.delete(id);
    if (c.req.path === '/api/health' && c.req.method === 'GET') return next();
    if (c.req.path === '/api/session' && c.req.method === 'POST') {
      if (!origins.has(c.req.header('origin') ?? '') || c.req.header('x-loredock-client') !== 'web') return c.json({ error: { message: 'Open LoreDock in your browser.' } }, 403);
      return next();
    }
    const session = sessions.get(getCookie(c, 'loredock_session') ?? '');
    if (!session) return c.json({ error: { message: 'Reload to reconnect to LoreDock.' } }, 401);
    if (!['GET', 'HEAD'].includes(c.req.method)) {
      const token = Buffer.from(c.req.header('x-loredock-csrf') ?? ''), expected = Buffer.from(session.token);
      if (!origins.has(c.req.header('origin') ?? '') || token.length !== expected.length || !timingSafeEqual(token, expected)) return c.json({ error: { message: 'The request could not be verified.' } }, 403);
    }
    await next();
  });
  app.get('/api/health', c => c.json({ service: 'loredock', version: '0.1.0', modelExecution: false }));
  app.post('/api/session', c => {
    const existing = sessions.get(getCookie(c, 'loredock_session') ?? '');
    if (existing) return c.json({ token: existing.token });
    if (sessions.size >= 64) return c.json({ error: { message: 'Too many browser sessions.' } }, 429);
    const id = randomBytes(32).toString('hex'), token = randomBytes(32).toString('hex');
    sessions.set(id, { token, expires: Date.now() + 8 * 60 * 60 * 1000 });
    setCookie(c, 'loredock_session', id, { httpOnly: true, sameSite: 'Strict', path: '/api', maxAge: 28800 });
    return c.json({ token });
  });
  const body = async (request: { json(): Promise<unknown> }): Promise<Record<string, unknown>> => {
    let value: unknown;
    try { value = await request.json(); } catch { throw new CatalogError('INVALID_JSON', 'A JSON object is required.'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CatalogError('INVALID_JSON', 'A JSON object is required.');
    return value as Record<string, unknown>;
  };
  app.get('/api/project', c => c.json(catalog.state()));
  app.post('/api/sources', async c => {
    const input = await body(c.req);
    if (typeof input.path !== 'string' || input.path.length > 4096) throw new CatalogError('INVALID_PATH', 'Enter an absolute local repository path.');
    return c.json(await catalog.addSource(input.path), 201);
  });
  app.post('/api/sources/:id/revoke', c => { catalog.revoke(c.req.param('id')); return c.json(catalog.state()); });
  app.put('/api/policy', async c => { const input = await body(c.req); catalog.updatePolicy(input.excludedPaths); return c.json(catalog.state()); });
  app.post('/api/builds', async c => {
    const input = await body(c.req);
    if (typeof input.requestId !== 'string' || !Number.isSafeInteger(input.sourceSetVersion) || !Number.isSafeInteger(input.policyVersion)) throw new CatalogError('INVALID_REQUEST', 'Request ID and current source/policy versions are required.');
    return c.json(catalog.start(input.requestId, input.sourceSetVersion as number, input.policyVersion as number), 202);
  });
  app.get('/api/builds/:id', c => c.json(catalog.store.build(c.req.param('id'))));
  app.get('/api/builds/:id/files', c => c.json({ files: catalog.files(c.req.param('id')), limit: 100 }));
  app.post('/api/builds/:id/:action', c => c.json(catalog.control(c.req.param('id'), c.req.param('action'))));
  app.get('/api/search', c => c.json(catalog.search(c.req.query('q') ?? '', c.req.query('buildId'))));
  app.get('/api/evidence/:id', c => c.json(catalog.evidence(c.req.param('id'))));
  app.all('/api', c => c.json({ error: { message: 'Unknown API route.' } }, 404));
  app.all('/api/*', c => c.json({ error: { message: 'Unknown API route.' } }, 404));
  if (options.publicDir && existsSync(path.join(options.publicDir, 'index.html'))) {
    app.use('/*', serveStatic({ root: options.publicDir }));
    app.get('*', serveStatic({ path: path.join(options.publicDir, 'index.html') }));
  }
  app.onError((error, c) => {
    if (error instanceof CatalogError) return c.json({ error: { code: error.code, message: error.message } }, error.status);
    console.error(`LoreDock request failed (${error.name}).`);
    return c.json({ error: { message: 'The local operation failed. Check the daemon and retry.' } }, 500);
  });
  return app;
}
