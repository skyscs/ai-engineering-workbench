import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { DomainError } from '@aew/core';
import { input } from './settings-routes.js';
import type { RuntimeService } from './runtime-service.js';
import { exportReport } from './report-export.js';

export function runtimeRoutes(service: RuntimeService) {
  const routes = new Hono();
  const base = '/:workspaceId/tasks/:taskId';
  routes.post(`${base}/interventions`, async (c) => {
    const result = service.intervene(c.req.param('workspaceId'), c.req.param('taskId'), await input(c));
    return c.json(result, result.run ? 202 : 201);
  });
  routes.get(`${base}/interventions`, (c) => {
    const w = c.req.param('workspaceId'), t = c.req.param('taskId');
    return c.json({ interventions: service.storage.tasks.interventions.history(w, t), constraints: service.storage.tasks.interventions.constraints(w, t) });
  });
  routes.post(`${base}/constraints/:constraintId/deactivate`, async (c) => c.json(service.storage.tasks.interventions.deactivate(c.req.param('workspaceId'), c.req.param('taskId'), c.req.param('constraintId'), await input(c)), 201));
  routes.post(`${base}/investigations`, async (c) => c.json(service.startInvestigation(c.req.param('workspaceId'), c.req.param('taskId'), await input(c)), 202));
  routes.get(`${base}/investigations`, (c) => c.json({ reports: service.storage.tasks.investigations.list(c.req.param('workspaceId'), c.req.param('taskId')) }));
  routes.get(`${base}/investigations/:reportId/export`, async (c) => {
    const result = await exportReport(service, c.req.param('workspaceId'), c.req.param('taskId'), c.req.param('reportId'));
    c.header('Content-Type', 'text/markdown; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="${result.filename}"`);
    c.header('Content-Security-Policy', "sandbox; default-src 'none'");
    return c.body(result.markdown);
  });
  routes.get(`${base}/investigations/:reportId`, (c) => c.json(service.storage.tasks.investigations.get(c.req.param('workspaceId'), c.req.param('taskId'), c.req.param('reportId'))));
  routes.get(`${base}/investigations/:reportId/evidence/:evidenceId`, async (c) => c.json(await service.readEvidence(c.req.param('workspaceId'), c.req.param('taskId'), c.req.param('reportId'), c.req.param('evidenceId'))));
  routes.post(`${base}/runtime-runs`, async (c) => c.json(service.start(c.req.param('workspaceId'), c.req.param('taskId'), await input(c)), 202));
  routes.get(`${base}/runtime-runs/:runId`, (c) => c.json(service.storage.tasks.journal.detail(c.req.param('workspaceId'), c.req.param('taskId'), c.req.param('runId'))));
  routes.post(`${base}/runtime-runs/:runId/cancel`, async (c) => {
    const body = await input(c);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) throw new DomainError('INVALID_INPUT', 'Cancellation accepts an empty JSON object.');
    return c.json(service.cancel(c.req.param('workspaceId'), c.req.param('taskId'), c.req.param('runId')));
  });
  routes.get(`${base}/runtime-runs/:runId/events`, (c) => {
    const w = c.req.param('workspaceId'), t = c.req.param('taskId'), id = c.req.param('runId');
    const raw = c.req.header('last-event-id') ?? c.req.query('after') ?? '0';
    if (!/^\d{1,16}$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new DomainError('INVALID_INPUT', 'Invalid event cursor.');
    let cursor = Number(raw);
    service.storage.tasks.getRun(w, t, id);
    // Bound connection lifetime and backpressure; EventSource resumes using Last-Event-ID.
    return streamSSE(c, async (stream) => {
      const deadline = Date.now() + 30000;
      const timer = setTimeout(() => stream.abort(), 31000);
      try {
        while (!service.closing && !stream.aborted && Date.now() < deadline) {
          const events = service.storage.tasks.journal.events(w, t, id, cursor);
          for (const event of events) { await stream.writeSSE({ id: String(event.sequence), event: 'runtime', data: JSON.stringify(event) }); cursor = event.sequence; }
          const run = service.storage.tasks.getRun(w, t, id);
          if (!['queued', 'running'].includes(run.status) && events.length < 128) {
            await stream.writeSSE({ event: 'complete', data: JSON.stringify({ status: run.status }) }); return;
          }
          if (events.length < 128) { await stream.write(': heartbeat\n\n'); await stream.sleep(250); }
        }
      } finally { clearTimeout(timer); }
    });
  });
  return routes;
}
