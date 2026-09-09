import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

const HOST = '127.0.0.1';
const PORT = 4242;
const VERSION = '0.0.1';

const app = new Hono();

app.get('/api/health', (context) =>
  context.json({
    status: 'ok',
    service: 'ai-engineering-workbench-daemon',
    version: VERSION
  })
);

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(currentDir, '..');
const publicDir = path.join(packageDir, 'public');

if (existsSync(publicDir)) {
  app.use('/*', serveStatic({ root: publicDir }));
  app.get('*', serveStatic({ path: path.join(publicDir, 'index.html') }));
}

serve(
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
