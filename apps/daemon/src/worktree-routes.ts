import { Hono } from 'hono';
import type { WorktreeService } from './worktree-service.js';
import { input } from './settings-routes.js';
import { DomainError } from '@aew/core';

function empty(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length) throw new DomainError('INVALID_INPUT', 'This operation accepts an empty JSON object.');
}

export function worktreeRoutes(service: WorktreeService) {
  const routes = new Hono();
  routes.put('/:workspaceId/tasks/:taskId/worktrees/:repositoryId/base-ref', async (c) => c.json(service.setBaseRef(c.req.param('workspaceId'), c.req.param('taskId'), c.req.param('repositoryId'), await input(c))));
  routes.post('/:workspaceId/tasks/:taskId/worktrees/prepare', async (c) => { empty(await input(c)); return c.json(service.start(c.req.param('workspaceId'), c.req.param('taskId')), 202); });
  routes.post('/:workspaceId/tasks/:taskId/worktrees/:repositoryId/cleanup', async (c) => { empty(await input(c)); return c.json(service.start(c.req.param('workspaceId'), c.req.param('taskId'), c.req.param('repositoryId')), 202); });
  return routes;
}
