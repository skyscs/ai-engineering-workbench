import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { openStorage, StorageError } from '@aew/storage';
import { RepositoryService } from './repository-service.js';
import { WorktreeService } from './worktree-service.js';
import { GitClient } from '@aew/git';

const HOST = '127.0.0.1';
const PORT = 4242;

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(currentDir, '..');
const publicDir = path.join(packageDir, 'public');

const storage = (() => {
  try { return openStorage({ artifactLimits: {
    ...(process.env.AEW_MAX_ARTIFACT_BYTES ? { fileBytes: Number(process.env.AEW_MAX_ARTIFACT_BYTES) } : {}),
    ...(process.env.AEW_MAX_TASK_ARTIFACT_BYTES ? { taskBytes: Number(process.env.AEW_MAX_TASK_ARTIFACT_BYTES) } : {}),
    ...(process.env.AEW_MAX_CONTEXT_BYTES ? { contextBytes: Number(process.env.AEW_MAX_CONTEXT_BYTES) } : {})
  } }); } catch (error) {
    console.error(error instanceof StorageError ? `${error.code}: ${error.message}` : 'Local storage initialization failed.');
    process.exit(1);
  }
})();
// Also releases ownership if startup fails before a server can accept requests.
process.once('exit', () => storage.close());
const git = new GitClient();
const repositories = new RepositoryService(storage, git);
const worktrees = new WorktreeService(storage, git);
let server: ReturnType<typeof serve> | undefined;
let stopping = false;
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
await worktrees.recover();
if (!stopping) {
const app = createApp({ publicDir, development: process.env.NODE_ENV === 'development',
  storageStatus: () => storage.status(), settings: storage.settings, repositories, tasks: storage.tasks, worktrees });

server = serve(
  {
    fetch: app.fetch,
    hostname: HOST,
    port: PORT
  },
  (info) => {
    const url = `http://${HOST}:${info.port}`;
    console.log(`AI Engineering Workbench daemon listening on ${url}`);

    if (process.env.AEW_OPEN_BROWSER !== '0' && existsSync(publicDir)) {
      openBrowser(url);
    }
  }
);

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${PORT} is already in use. Stop the other local daemon and try again.`
    : `Local daemon could not start (${error.code ?? 'UNKNOWN'}).`);
  process.exitCode = 1;
  shutdown();
});

}
function shutdown(): void {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => {
    console.error('Local daemon shutdown timed out.');
    process.exit(1);
  }, 5000);
  deadline.unref();
  void Promise.all([repositories.close(), worktrees.close(), storage.tasks.artifacts.close(), new Promise<void>((resolve) => {
    if (server) server.close(() => resolve()); else resolve();
  })]).then(() => {
    storage.close();
    clearTimeout(deadline);
  });
}

function openBrowser(url: string): void {
  const platform = process.platform;

  const child =
    platform === 'win32'
      ? spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' })
      : platform === 'darwin'
        ? spawn('open', [url], { detached: true, stdio: 'ignore' })
        : spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });

  child.on('error', () => {
    // Browser launch is a convenience. The daemon must continue running if it fails.
  });

  child.unref();
}
