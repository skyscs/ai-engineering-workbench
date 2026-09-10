import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { serveStatic } from '@hono/node-server/serve-static';
import type { SettingsRepository, StorageStatus } from '@aew/storage';
import { DomainError } from '@aew/core';
import { settingsRoutes } from './settings-routes.js';
import { GitError } from '@aew/git';
import { repositoryRoutes } from './repository-routes.js';
import type { RepositoryService } from './repository-service.js';

const SESSION_COOKIE = 'aew_session';
const SESSION_SECONDS = 8 * 60 * 60;
const MAX_SESSIONS = 64;

export interface AppOptions {
  development?: boolean;
  publicDir?: string;
  now?: () => number;
  storageStatus?: () => StorageStatus;
  settings?: SettingsRepository;
  repositories?: RepositoryService;
}

/** Create a local HTTP application without opening sockets or launching a browser. */
export function createApp(options: AppOptions = {}) {
  const app = new Hono();
  const now = options.now ?? Date.now;
  const hosts = new Set(['127.0.0.1:4242']);
  if (options.development) hosts.add('127.0.0.1:5173');
  const origins = new Set([...hosts].map((host) => `http://${host}`));
  const sessions = new Map<string, { csrfToken: string; expiresAt: number }>();

  app.use('*', async (context, next) => {
    const host = context.req.header('host');
    const origin = context.req.header('origin');
    if (!host || !hosts.has(host)) {
      return context.json({ error: { code: 'INVALID_HOST', message: 'Use the local Workbench URL.' } }, 403);
    }
    if ((origin !== undefined && !origins.has(origin)) || context.req.header('sec-fetch-site') === 'cross-site') {
      return context.json({ error: { code: 'INVALID_ORIGIN', message: 'Cross-origin requests are not allowed.' } }, 403);
    }
    context.header('X-Content-Type-Options', 'nosniff');
    context.header('Referrer-Policy', 'no-referrer');
    context.header('X-Frame-Options', 'DENY');
    await next();
  });

  app.use('/api/*', async (context, next) => {
    context.header('Cache-Control', 'no-store');
    for (const [id, session] of sessions) {
      if (session.expiresAt <= now()) sessions.delete(id);
    }
    if (context.req.path === '/api/health' && ['GET', 'HEAD'].includes(context.req.method)) {
      return next();
    }
    if (context.req.path === '/api/session' && context.req.method === 'POST') {
      if (!origins.has(context.req.header('origin') ?? '') || context.req.header('x-aew-client') !== 'web') {
        return context.json({ error: { code: 'INVALID_SESSION_REQUEST', message: 'Open Workbench in the local browser.' } }, 403);
      }
      return next();
    }
    const session = sessions.get(getCookie(context, SESSION_COOKIE) ?? '');
    if (!session) {
      return context.json({ error: { code: 'SESSION_REQUIRED', message: 'Reconnect to the local daemon.' } }, 401);
    }
    if (!['GET', 'HEAD'].includes(context.req.method)) {
      const token = context.req.header('x-aew-csrf') ?? '';
      const expected = Buffer.from(session.csrfToken);
      const actual = Buffer.from(token);
      if (!origins.has(context.req.header('origin') ?? '') || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        return context.json({ error: { code: 'INVALID_CSRF', message: 'The request could not be verified.' } }, 403);
      }
    }
    await next();
  });

  app.get('/api/health', (context) => context.json({
    status: 'ok', service: 'ai-engineering-workbench-daemon', version: '0.0.1'
  }));

  app.get('/api/storage', (context) => {
    if (!options.storageStatus) {
      return context.json({ error: { code: 'STORAGE_UNAVAILABLE', message: 'Local storage is unavailable.' } }, 503);
    }
    return context.json(options.storageStatus());
  });

  app.post('/api/session', (context) => {
    const existingId = getCookie(context, SESSION_COOKIE);
    const existing = existingId ? sessions.get(existingId) : undefined;
    if (existing) return context.json({ csrfToken: existing.csrfToken });
    if (sessions.size >= MAX_SESSIONS) {
      return context.json({ error: { code: 'SESSION_LIMIT', message: 'Too many local sessions. Try again later.' } }, 429);
    }
    const id = randomBytes(32).toString('hex');
    const csrfToken = randomBytes(32).toString('hex');
    sessions.set(id, { csrfToken, expiresAt: now() + SESSION_SECONDS * 1000 });
    setCookie(context, SESSION_COOKIE, id, {
      httpOnly: true, sameSite: 'Strict', path: '/api', maxAge: SESSION_SECONDS
    });
    return context.json({ csrfToken });
  });

  app.delete('/api/session', (context) => {
    sessions.delete(getCookie(context, SESSION_COOKIE) ?? '');
    deleteCookie(context, SESSION_COOKIE, { path: '/api' });
    return context.body(null, 204);
  });

  if (options.settings) app.route('/api/workspaces', settingsRoutes(options.settings));
  if (options.repositories) app.route('/api/workspaces', repositoryRoutes(options.repositories));

  app.all('/api', (context) => context.json({ error: { code: 'NOT_FOUND', message: 'Unknown API route.' } }, 404));
  app.all('/api/*', (context) => context.json({ error: { code: 'NOT_FOUND', message: 'Unknown API route.' } }, 404));

  if (options.publicDir && existsSync(path.join(options.publicDir, 'index.html'))) {
    app.use('/*', serveStatic({ root: options.publicDir }));
    app.get('*', serveStatic({ path: path.join(options.publicDir, 'index.html') }));
  }
  app.onError((error, context) => {
    if (error instanceof DomainError) {
      return context.json({ error: { code: error.code, message: error.message } },
        error.code === 'NOT_FOUND' ? 404 : ['BOUNDARY_LOCKED', 'CONFLICT'].includes(error.code) ? 409 : 400);
    }
    if (error instanceof GitError) return context.json({ error: error.failure }, 422);
    // Do not include request bodies, cookies or exception messages in diagnostics.
    console.error(`HTTP request failed (${error.name}).`);
    return context.json({ error: { code: 'INTERNAL_ERROR', message: 'The local request failed.' } }, 500);
  });
  return app;
}
