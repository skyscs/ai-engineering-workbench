import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LoreDockServer } from './server.js';

function defaultDirectory() {
  if (process.platform === 'darwin') return path.join(homedir(), 'Library', 'Application Support', 'loredock');
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA ?? path.join(homedir(), 'AppData', 'Local'), 'loredock');
  return path.join(process.env.XDG_DATA_HOME ?? path.join(homedir(), '.local', 'share'), 'loredock');
}
const controller = new AbortController();
let server: LoreDockServer | undefined;
async function shutdown() {
  controller.abort();
  try { await server?.stop(); }
  catch (error) { console.error(error instanceof Error ? error.message : 'LoreDock shutdown failed.'); process.exitCode = 1; }
}
process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });
try {
  const preparedQuestionsEnabled = process.env.LOREDOCK_PREPARED_ANSWERS === '1';
  if (preparedQuestionsEnabled && process.env.LOREDOCK_ANSWERS !== '1')
    throw new Error('LOREDOCK_PREPARED_ANSWERS=1 requires LOREDOCK_ANSWERS=1.');
  server = new LoreDockServer({ directory: process.env.LOREDOCK_DATA_DIR ?? defaultDirectory(),
    publicDir: fileURLToPath(new URL('../public/', import.meta.url)), development: process.env.LOREDOCK_DEVELOPMENT === '1',
    answers: process.env.LOREDOCK_ANSWERS === '1', preparedAnswers: preparedQuestionsEnabled });
  controller.signal.throwIfAborted();
  const port = await server.start();
  console.log(`LoreDock listening on http://127.0.0.1:${port}`);
} catch (error) {
  if (!controller.signal.aborted) {
    console.error(`LoreDock could not start: ${error instanceof Error ? error.message : 'Unknown startup failure.'}`);
    process.exitCode = 1;
  }
  await shutdown();
}
