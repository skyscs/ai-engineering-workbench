import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import { serveStatic } from '@hono/node-server/serve-static';
import { Catalog } from './catalog.js';
import { CatalogError } from './types.js';
import type { Answers } from './answers.js';
import type { TextConnection } from '@aew/ai';
import { declarationMap } from './system-map.js';
import { codeFlows } from './code-flows.js';
import { Corrections } from './corrections.js';
import { indexChanges } from './index-changes.js';
import { Reconciliation } from './reconciliation.js';
import { projectOrientation } from './orientation.js';
import { sourceCandidatePreview } from './source-candidates.js';
import type { CodeAnalysis } from './code-analysis.js';
import type { CodeAnalysisFollow } from './code-analysis-follow.js';
import { lookupCodeSymbols } from './code-symbols.js';

export function createApp(catalog: Catalog, options: { publicDir?: string; development?: boolean; answers?: Answers; codeAnalysis?: CodeAnalysis; codeFollow?: CodeAnalysisFollow } = {}) {
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
  app.get('/api/health', c => c.json({ service: 'loredock', version: '0.1.0', modelExecution: Boolean(options.answers), codeAnalysis: Boolean(options.codeAnalysis) }));
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
  app.post('/api/sources/preview', async c => c.json(await catalog.previewSources((await body(c.req)).paths)));
  app.post('/api/sources/register', async c => c.json(await catalog.registerSources(await body(c.req)), 201));
  app.post('/api/sources/:id/revoke', c => { catalog.revoke(c.req.param('id')); return c.json(catalog.state()); });
  app.put('/api/policy', async c => { const input = await body(c.req); catalog.updatePolicy(input.excludedPaths); return c.json(catalog.state()); });
  app.post('/api/builds', async c => {
    const input = await body(c.req);
    if (typeof input.requestId !== 'string' || !Number.isSafeInteger(input.sourceSetVersion) || !Number.isSafeInteger(input.policyVersion)) throw new CatalogError('INVALID_REQUEST', 'Request ID and current source/policy versions are required.');
    return c.json(catalog.start(input.requestId, input.sourceSetVersion as number, input.policyVersion as number), 202);
  });
  app.get('/api/builds/:id', c => c.json(catalog.store.build(c.req.param('id'))));
  app.get('/api/builds/:id/files', c => c.json({ files: catalog.files(c.req.param('id')), limit: 100 }));
  app.get('/api/builds/:id/changes', c => c.json(indexChanges(catalog, c.req.param('id'))));
  app.post('/api/builds/:id/:action', c => c.json(catalog.control(c.req.param('id'), c.req.param('action'))));
  app.get('/api/search', c => c.json(catalog.search(c.req.query('q') ?? '', c.req.query('buildId'))));
  app.get('/api/evidence/:id', c => c.json(catalog.evidence(c.req.param('id'))));
  app.get('/api/system-map', c => c.json(declarationMap(catalog, c.req.query('buildId'))));
  app.get('/api/code-flows', c => c.json(codeFlows(catalog, c.req.query('buildId'))));
  app.get('/api/orientation', c => c.json(projectOrientation(catalog, c.req.query('buildId'))));
  const codeAnalysis = options.codeAnalysis;
  if (codeAnalysis) {
    app.get('/api/code-symbols', async c => c.json(await lookupCodeSymbols(codeAnalysis, c.req.query('q') ?? '', c.req.query('buildId'))));
    app.get('/api/code-analysis', c => c.json(options.codeFollow?.state() ?? { inventories: codeAnalysis.list(), pendingBuildId: null, automaticError: null }));
    app.post('/api/code-analysis', async c => {
      const input = await body(c.req), project = catalog.store.project();
      if (Object.keys(input).some(key => !['requestId', 'buildId', 'policyVersion', 'sourceSetVersion'].includes(key))
        || typeof input.requestId !== 'string' || typeof input.buildId !== 'string' || !input.buildId || input.buildId.length > 100
        || !Number.isSafeInteger(input.policyVersion) || !Number.isSafeInteger(input.sourceSetVersion)) {
        throw new CatalogError('INVALID_REQUEST', 'A request ID, published index and current source/policy versions are required.');
      }
      if (input.policyVersion !== project.policyVersion || input.sourceSetVersion !== project.sourceSetVersion
        || catalog.readBuild(input.buildId).sourceSetVersion !== project.sourceSetVersion) {
        throw new CatalogError('CONFLICT', 'Sources or policy changed. Update knowledge before analyzing code.', 409);
      }
      return c.json(codeAnalysis.start(input.requestId, input.buildId), 202);
    });
    app.get('/api/code-analysis/:id/files', c => {
      const offset = c.req.query('offset');
      if (offset !== undefined && !/^(0|[1-9]\d{0,4})$/.test(offset)) throw new CatalogError('INVALID_PAGE', 'Choose an available code-file page.');
      return c.json({ files: codeAnalysis.files(c.req.param('id'), offset === undefined ? 0 : Number(offset)), offset: offset === undefined ? 0 : Number(offset), limit: 50 });
    });
    app.get('/api/code-analysis/:id/files/:fileId', c => c.json(codeAnalysis.file(c.req.param('id'), c.req.param('fileId'))));
    app.post('/api/code-analysis/:id/:action', async c => {
      const text = await c.req.text();
      if (text.trim()) {
        let input: unknown;
        try { input = JSON.parse(text); } catch { throw new CatalogError('INVALID_JSON', 'Code analysis controls take no arguments.'); }
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new CatalogError('INVALID_REQUEST', 'Code analysis controls take no arguments.');
      }
      const action = c.req.param('action');
      if (action !== 'pause' && action !== 'resume' && action !== 'cancel') throw new CatalogError('INVALID_ACTION', 'Unknown code analysis action.');
      return c.json(codeAnalysis.control(c.req.param('id'), action));
    });
  }
  app.post('/api/candidates/preview', async c => {
    const input = await body(c.req);
    if (Object.keys(input).some(key => key !== 'question' && key !== 'buildId' && key !== 'relatedOffset') || typeof input.question !== 'string'
      || (input.buildId !== undefined && typeof input.buildId !== 'string')) {
      throw new CatalogError('INVALID_REQUEST', 'A question and optional index version are required.');
    }
    return c.json(sourceCandidatePreview(catalog, input.question, input.buildId as string | undefined, input.relatedOffset));
  });
  const corrections = new Corrections(catalog);
  app.get('/api/corrections', c => c.json(corrections.list(c.req.query('buildId'))));
  app.get('/api/corrections/:id/history', c => c.json(corrections.history(c.req.param('id'))));
  app.post('/api/corrections', async c => c.json(corrections.save(await body(c.req)), 201));
  const reconciliation = new Reconciliation(catalog);
  app.get('/api/correction-reconciliation', c => c.json(reconciliation.preview(c.req.query('buildId'), c.req.query('fromBuildId'))));
  app.post('/api/corrections/reapply', async c => c.json(reconciliation.reapply(await body(c.req)), 201));
  const answers = options.answers;
  if (answers) {
    app.get('/api/answers', c => c.json(answers.state()));
    app.put('/api/answers/configuration', async c => c.json(await answers.configure(await body(c.req) as unknown as TextConnection)));
    app.post('/api/answers/preview', async c => {
      const input = await body(c.req);
      if (typeof input.question !== 'string' || (input.buildId !== undefined && typeof input.buildId !== 'string')) throw new CatalogError('INVALID_REQUEST', 'A question and optional index version are required.');
      return c.json(answers.preview(input.question, input.buildId as string | undefined));
    });
    app.post('/api/answers', async c => {
      const input = await body(c.req);
      if (![input.requestId, input.question, input.buildId, input.inputHash].every(value => typeof value === 'string')) throw new CatalogError('INVALID_REQUEST', 'Request ID and reviewed question context are required.');
      return c.json(answers.start(input.requestId as string, input.question as string, input.buildId as string, input.inputHash as string), 202);
    });
    app.get('/api/answers/:id', c => c.json(answers.get(c.req.param('id'))));
    app.post('/api/answers/:id/cancel', c => c.json(answers.cancel(c.req.param('id'))));
  }
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
