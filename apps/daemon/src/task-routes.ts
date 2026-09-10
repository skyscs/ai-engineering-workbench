import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { Hono } from 'hono';
import { DomainError } from '@aew/core';
import type { TaskStore } from '@aew/storage';
import { input } from './settings-routes.js';

export function taskRoutes(tasks: TaskStore) {
  const routes = new Hono();
  routes.get('/:workspaceId/tasks', (c) => c.json({ tasks: tasks.list(c.req.param('workspaceId')) }));
  routes.post('/:workspaceId/tasks', async (c) => c.json(tasks.create(c.req.param('workspaceId'), await input(c, 512 * 1024)), 201));
  routes.get('/:workspaceId/tasks/:taskId', (c) => c.json(tasks.detail(c.req.param('workspaceId'), c.req.param('taskId'))));
  routes.put('/:workspaceId/tasks/:taskId/context', async (c) => c.json(tasks.artifacts.selectContext(c.req.param('workspaceId'), c.req.param('taskId'), await input(c, 256 * 1024))));
  routes.post('/:workspaceId/tasks/:taskId/artifacts', async (c) => {
    const body = c.req.raw.body;
    if (!body) throw new DomainError('INVALID_INPUT', 'A raw file body is required.');
    let name: string;
    try { name = decodeURIComponent(c.req.header('x-aew-filename') ?? ''); }
    catch { throw new DomainError('INVALID_INPUT', 'The filename header must be URI encoded.'); }
    const size = c.req.header('x-aew-file-size') ?? '';
    if (!/^\d{1,16}$/.test(size)) throw new DomainError('INVALID_INPUT', 'A declared file size is required.');
    return c.json(await tasks.artifacts.import(c.req.param('workspaceId'), c.req.param('taskId'), {
      name, size: Number(size), mimeType: c.req.header('content-type') ?? 'application/octet-stream'
    }, body), 201);
  });
  routes.get('/:workspaceId/tasks/:taskId/artifacts/:artifactId/download', (c) => {
    const { artifact, fd } = tasks.artifacts.open(c.req.param('workspaceId'), c.req.param('taskId'), c.req.param('artifactId'));
    // Use the already validated handle, never a second path resolution.
    const stream = createReadStream('', { fd, autoClose: true });
    const filename = encodeURIComponent(artifact.originalFilename).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    c.header('Content-Disposition', `attachment; filename="artifact"; filename*=UTF-8''${filename}`);
    c.header('Content-Type', 'application/octet-stream');
    c.header('Content-Length', String(artifact.byteSize));
    c.header('X-Content-Type-Options', 'nosniff');
    return c.body(Readable.toWeb(stream) as ReadableStream<Uint8Array>);
  });
  return routes;
}
