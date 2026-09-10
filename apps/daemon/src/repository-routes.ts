import { Hono } from 'hono';
import type { RepositoryService } from './repository-service.js';
import { input } from './settings-routes.js';

export function repositoryRoutes(service: RepositoryService) {
  const routes = new Hono();
  routes.get('/:workspaceId/repositories', (c) => c.json({ repositories: service.list(c.req.param('workspaceId')) }));
  routes.get('/:workspaceId/repositories/:repositoryId', (c) => c.json(service.get(c.req.param('workspaceId'), c.req.param('repositoryId'))));
  routes.post('/:workspaceId/repositories', async (c) => c.json(await service.register(c.req.param('workspaceId'), await input(c)), 201));
  routes.post('/:workspaceId/repositories/clone', async (c) => c.json(await service.startClone(c.req.param('workspaceId'), await input(c)), 202));
  return routes;
}
