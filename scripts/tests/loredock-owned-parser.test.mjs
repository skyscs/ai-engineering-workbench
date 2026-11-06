import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { CatalogStore } from '../../apps/loredock/dist/store.js';

const root = new URL('../../', import.meta.url), application = new URL('apps/loredock/', root);
for (const source of [false, true]) test(`${source ? 'source' : 'emitted'} server keeps the compiler out of its parent and joins actual exit on SIGTERM`, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'owned-parser-server-'));
  const entry = new URL(source ? 'src/server.ts' : 'dist/server.js', application).href;
  const child = spawn(process.execPath, [...source ? ['--import', 'tsx'] : [],
    fileURLToPath(new URL('tests/fixtures/owned-parser-server.mjs', application)), entry, directory], {
    cwd: fileURLToPath(application), env: { PATH: process.env.PATH }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '', timedOut = false;
  const rows = []; let readyResolve, readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; }); void ready.catch(() => undefined);
  const exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => {
    readyReject(new Error('Server exited before readiness: ' + stderr)); resolve({ code, signal });
  }); });
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', value => {
    stdout += value;
    for (;;) { const end = stdout.indexOf('\n'); if (end < 0) break;
      const row = JSON.parse(stdout.slice(0, end)); stdout = stdout.slice(end + 1); rows.push(row); if (row.stage === 'ready') readyResolve(row); }
  });
  child.stderr.on('data', value => { stderr += value; });
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 10000);
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); await exited;
    clearTimeout(timer); await rm(directory, { recursive: true, force: true }); });
  const live = await ready; assert.equal(live.compilerLoaded, false); assert.equal(live.snapshot.owner.state, 'ready');
  const status = await new Promise((resolve, reject) => get({ hostname: '127.0.0.1', port: live.port,
    path: '/api/health', headers: { host: '127.0.0.1:4244' } }, response => {
    response.resume(); response.once('end', () => resolve(response.statusCode)); response.once('error', reject);
  }).once('error', reject));
  assert.equal(status, 200); child.kill('SIGTERM');
  assert.deepEqual(await exited, { code: 0, signal: null }); clearTimeout(timer); assert.equal(timedOut, false);
  const stopped = rows.find(row => row.stage === 'stopped'); assert(stopped, stderr);
  assert.equal(stopped.compilerLoaded, false); assert.equal(stopped.snapshot.active, false);
  assert.equal(stopped.snapshot.owner.state, 'closed'); assert.equal(stopped.snapshot.owner.owned, false);
  assert.equal(typeof stopped.snapshot.owner.exitCode, 'number'); assert.equal(stopped.snapshot.owner.generation, live.snapshot.owner.generation);
  const reopened = new CatalogStore(directory); reopened.close();
});
