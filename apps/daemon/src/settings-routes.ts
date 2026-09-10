import { Hono, type Context } from 'hono';
import { DomainError } from '@aew/core';
import type { SettingsRepository } from '@aew/storage';

export async function input(context: Context, limit = 16384): Promise<unknown> {
  if (context.req.header('content-type')?.split(';')[0]?.trim() !== 'application/json') {
    throw new DomainError('INVALID_INPUT', 'Use application/json for settings requests.');
  }
  // Bound streamed bodies too; Content-Length alone does not establish the size.
  const reader = context.req.raw.body?.getReader();
  if (!reader) throw new DomainError('INVALID_INPUT', 'A JSON body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new DomainError('INVALID_INPUT', `JSON requests must not exceed ${limit} bytes.`);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new DomainError('INVALID_INPUT', 'The request body must be valid JSON.'); }
}

export function settingsRoutes(settings: SettingsRepository) {
  const routes = new Hono();
  routes.get('/', (c) => c.json({ workspaces: settings.listWorkspaces() }));
  routes.post('/', async (c) => c.json(settings.createWorkspace(await input(c)), 201));
  routes.get('/:workspaceId', (c) => c.json(settings.getWorkspace(c.req.param('workspaceId'))));
  routes.patch('/:workspaceId', async (c) => c.json(settings.renameWorkspace(c.req.param('workspaceId'), await input(c))));
  routes.delete('/:workspaceId', (c) => { settings.deleteWorkspace(c.req.param('workspaceId')); return c.body(null, 204); });
  routes.put('/:workspaceId/connection', async (c) => c.json(settings.updateConnection(c.req.param('workspaceId'), await input(c))));
  routes.post('/:workspaceId/model-profiles', async (c) => c.json(settings.createModelProfile(c.req.param('workspaceId'), await input(c)), 201));
  routes.get('/:workspaceId/model-profiles/:profileId', (c) => c.json(settings.getModelProfile(c.req.param('workspaceId'), c.req.param('profileId'))));
  routes.put('/:workspaceId/model-profiles/:profileId', async (c) => c.json(settings.updateModelProfile(c.req.param('workspaceId'), c.req.param('profileId'), await input(c))));
  routes.delete('/:workspaceId/model-profiles/:profileId', (c) => {
    settings.deleteModelProfile(c.req.param('workspaceId'), c.req.param('profileId'));
    return c.body(null, 204);
  });
  return routes;
}
