import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { openStorage } from '../packages/storage/dist/index.js';

// Opt-in: requires a build and a free port 4242. All data stays in a fresh fixture.
const fixture = await mkdtemp(path.join(tmpdir(), 'aew-storage-smoke-'));
const daemon = fileURLToPath(new URL('../apps/daemon/', import.meta.url));
const children = [];
function start(root, development = false) {
  const child = spawn(process.execPath, development ? ['--import', 'tsx', 'src/dev.ts'] : ['dist/index.js'], {
    cwd: daemon, env: { ...process.env, AEW_DATA_DIR: root, AEW_OPEN_BROWSER: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const record = { child, output: '', ended: false };
  record.exit = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => { record.ended = true; resolve({ code, signal }); });
  });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => {
    record.output = (record.output + chunk.toString()).slice(-16384);
  });
  children.push(record);
  return record;
}
async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Daemon smoke deadline exceeded.')), 10000);
    })]);
  } finally { clearTimeout(timer); }
}
async function ready(record) {
  for (let attempt = 0; attempt < 500; attempt++) {
    if (record.output.includes('daemon listening on')) return;
    if (record.ended) throw new Error(record.output);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Daemon did not become ready.');
}
async function status() {
  const url = 'http://127.0.0.1:4242';
  assert.equal((await fetch(`${url}/api/storage`)).status, 401);
  const session = await fetch(`${url}/api/session`, {
    method: 'POST', headers: { origin: url, 'x-aew-client': 'web' }
  });
  assert.equal(session.status, 200);
  const cookie = session.headers.get('set-cookie').split(';')[0];
  const response = await fetch(`${url}/api/storage`, { headers: { cookie } });
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.schemaVersion, 1);
  assert.equal(value.foreignKeys, true);
  assert.equal(value.journalMode, 'wal');
  return value;
}
try {
  const root = path.join(fixture, 'primary');
  const first = start(root);
  await ready(first);
  const initial = await status();
  if (process.env.AEW_SMOKE_BROWSER === '1') {
    const browser = await promisify(execFile)('google-chrome', ['--headless', '--no-sandbox',
      '--disable-gpu', '--disable-background-networking', `--user-data-dir=${path.join(fixture, 'browser')}`,
      '--dump-dom', '--virtual-time-budget=5000', 'http://127.0.0.1:4242'], { timeout: 15000, maxBuffer: 1024 * 1024 });
    assert.match(browser.stdout, /Local daemon connected\./);
  }
  const duplicate = start(root);
  assert.equal((await bounded(duplicate.exit)).code, 1);
  assert.match(duplicate.output, /DATA_DIR_IN_USE/);
  const otherRoot = path.join(fixture, 'occupied-port');
  const occupied = start(otherRoot);
  assert.equal((await bounded(occupied.exit)).code, 1);
  assert.match(occupied.output, /Port 4242 is already in use/);
  openStorage({ dataRoot: otherRoot }).close();
  first.child.kill('SIGTERM');
  assert.equal((await bounded(first.exit)).code, 0);
  const db = new DatabaseSync(path.join(root, 'workbench.db'), { readOnly: true });
  const before = db.prepare('SELECT * FROM schema_migrations').all();
  db.close();
  const restarted = start(root, true);
  await ready(restarted);
  assert.deepEqual(await status(), initial);
  restarted.child.kill('SIGTERM');
  assert.equal((await bounded(restarted.exit)).code, 0);
  const check = new DatabaseSync(path.join(root, 'workbench.db'), { readOnly: true });
  assert.deepEqual(check.prepare('SELECT * FROM schema_migrations').all(), before);
  check.close();
  console.log(JSON.stringify({ fixture, status: initial, production: 'passed', developmentRestart: 'passed',
    browser: process.env.AEW_SMOKE_BROWSER === '1' ? 'passed' : 'not_requested',
    duplicateOwner: 'rejected', occupiedPortOwnershipReleased: true, gracefulShutdown: 'passed' }, null, 2));
} finally {
  for (const record of children) {
    if (!record.ended) { record.child.kill('SIGKILL'); await bounded(record.exit); }
  }
}
