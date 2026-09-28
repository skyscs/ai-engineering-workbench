import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { Catalog } from './catalog.js';
import { CatalogStore } from './store.js';

function defaultDirectory() {
  if (process.platform === 'darwin') return path.join(homedir(), 'Library', 'Application Support', 'loredock');
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA ?? path.join(homedir(), 'AppData', 'Local'), 'loredock');
  return path.join(process.env.XDG_DATA_HOME ?? path.join(homedir(), '.local', 'share'), 'loredock');
}
const store = new CatalogStore(process.env.LOREDOCK_DATA_DIR ?? defaultDirectory());
const catalog = new Catalog(store);
const app = createApp(catalog, { publicDir: fileURLToPath(new URL('../public/', import.meta.url)), development: process.env.LOREDOCK_DEVELOPMENT === '1' });
const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 4244 });
server.on('listening', () => console.log('LoreDock listening on http://127.0.0.1:4244'));
let closing = false;
async function shutdown() {
  if (closing) return; closing = true;
  server.close();
  await catalog.stop(); store.close();
}
server.on('error', error => { console.error(`LoreDock could not listen (${(error as NodeJS.ErrnoException).code ?? 'UNKNOWN'}). Check port 4244.`); void shutdown().finally(() => { process.exitCode = 1; }); });
process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });
