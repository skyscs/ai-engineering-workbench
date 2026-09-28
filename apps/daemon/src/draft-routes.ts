import { realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { DomainError } from '@aew/core';
import type { LaunchService } from './launch-service.js';
import { input } from './settings-routes.js';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('INVALID_INPUT', 'Expected an object.');
  return value as Record<string, unknown>;
}
export function draftRoutes(service: LaunchService) {
  const routes = new Hono(), drafts = service.storage.drafts;
  routes.get('/', c => c.json({ drafts: drafts.list(), limitBytes: drafts.limit }));
  routes.post('/', async c => { const value = object(await input(c)); return c.json(drafts.create(value.id as string), 201); });
  routes.get('/setup-options', async c => {
    const directories: string[] = [];
    for (const candidate of [process.env.CODEX_HOME, path.join(homedir(), '.codex')]) {
      if (!candidate) continue;
      try { const resolved = await realpath(candidate); if ((await stat(resolved)).isDirectory() && !directories.includes(resolved)) directories.push(resolved); } catch { /* Missing candidates are not selected or created. */ }
    }
    return c.json({ directories });
  });
  routes.post('/from-task', async c => {
    const value = object(await input(c));
    const task = service.storage.tasks.get(String(value.workspaceId), String(value.taskId));
    const latest = service.storage.tasks.detail(task.workspaceId, task.id).latestRun;
    return c.json(drafts.adopt(task.id, { workspaceId: task.workspaceId, repositoryIds: task.repositoryIds, description: task.description, source: '', modelProfileId: latest?.modelProfileId ?? null }));
  });
  routes.get('/:id', c => c.json(drafts.get(c.req.param('id'))));
  routes.post('/:id/copy', async c => { const value = object(await input(c)); return c.json(drafts.copy(c.req.param('id'), value.id as string), 201); });
  routes.put('/:id', async c => { const value = object(await input(c, 512 * 1024)); return c.json(drafts.save(c.req.param('id'), value.revision as number, value.input)); });
  routes.delete('/:id', c => { drafts.discard(c.req.param('id')); return c.body(null, 204); });
  routes.put('/:id/files/:fileId', async c => {
    let name: string;
    try { name = decodeURIComponent(c.req.header('x-aew-filename') ?? ''); }
    catch { throw new DomainError('INVALID_INPUT', 'Invalid filename.'); }
    const reader = c.req.raw.body?.getReader();
    if (!reader) throw new DomainError('INVALID_INPUT', 'A text file is required.');
    let size = 0; const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const result = await reader.read(); if (result.done) break;
        size += result.value.length;
        if (size > drafts.limit) throw new DomainError('INVALID_INPUT', 'This text file exceeds the draft budget. Attach a smaller file.');
        chunks.push(result.value);
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    return c.json(drafts.putFile(c.req.param('id'), c.req.param('fileId'), name, Buffer.concat(chunks)));
  });
  routes.patch('/:id/files/:fileId', async c => {
    const value = object(await input(c));
    if (typeof value.included !== 'boolean') throw new DomainError('INVALID_INPUT', 'Choose whether to include this file.');
    return c.json(drafts.changeFile(c.req.param('id'), c.req.param('fileId'), value.included));
  });
  routes.delete('/:id/files/:fileId', c => c.json(drafts.changeFile(c.req.param('id'), c.req.param('fileId'), null)));
  routes.post('/:id/launch', async c => {
    const value = object(await input(c));
    return c.json(service.start(c.req.param('id'), value.requestId as string, value.revision as number), 202);
  });
  routes.post('/:id/cancel', async c => {
    const value = object(await input(c));
    const operation = drafts.operation(value.requestId as string);
    if (operation.draftId !== c.req.param('id')) throw new DomainError('NOT_FOUND', 'Attempt not found in this investigation.');
    return c.json(service.cancel(operation.id));
  });
  return routes;
}
