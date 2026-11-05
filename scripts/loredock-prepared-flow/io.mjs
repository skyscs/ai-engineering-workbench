import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { openSync, closeSync, writeSync, fsyncSync } from 'node:fs';
import { mkdir, writeFile, readFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repository = fileURLToPath(new URL('../../', import.meta.url));
export const hash = value => createHash('sha256').update(value).digest('hex');
export const normalized = error => ({ name: error.name, code: error.code ?? null, message: error.message, stack: error.stack,
  ...error instanceof AggregateError ? { errors: error.errors.map(normalized) } : {} });
export const save = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
export async function until(callback, message, milliseconds = 15000) {
  const deadline = performance.now() + milliseconds;
  while (performance.now() < deadline) {
    const value = await callback(); if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(message);
}
export function journal(file) {
  const descriptor = openSync(file, 'wx', 0o600); let closed = false;
  return { append(value) { assert(!closed); writeSync(descriptor, JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n'); fsyncSync(descriptor); },
    close() { if (!closed) { closed = true; fsyncSync(descriptor); closeSync(descriptor); } } };
}
export async function inventory(directory) {
  const result = {};
  async function visit(relative) {
    for (const name of (await readdir(path.join(directory, relative))).sort()) {
      const file = path.join(relative, name), stat = await lstat(path.join(directory, file));
      assert(!stat.isSymbolicLink(), 'Owned artifact tree contains a symlink: ' + file);
      if (stat.isDirectory()) await visit(file);
      else {
        assert(stat.isFile(), 'Owned artifact is not a regular file: ' + file);
        const bytes = await readFile(path.join(directory, file)); result[file] = { bytes: bytes.length, sha256: hash(bytes) };
      }
    }
  }
  await visit(''); return result;
}
// No deleting teardown, source execution or application imports. Failures retain partial trees.
export async function materialize(directory, corpus) {
  await mkdir(directory); const revisions = {}, originals = [];
  for (const [name, files] of Object.entries(corpus)) {
    assert(/^[a-z0-9-]+$/.test(name)); const source = path.join(directory, name); await mkdir(source);
    const git = args => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false',
      '-c', 'commit.gpgsign=false', '-c', 'user.name=LoreDock Fixture', '-c', 'user.email=fixture@example.invalid', ...args], {
      cwd: source, encoding: 'utf8', timeout: 10000,
      env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_ATTR_NOSYSTEM: '1', LC_ALL: 'C',
        GIT_AUTHOR_DATE: '2026-03-03T00:00:00Z', GIT_COMMITTER_DATE: '2026-03-03T00:00:00Z' } }).trimEnd();
    git(['init', '-q', '--object-format=sha1', '--initial-branch=main', '--template=']);
    for (const [file, text] of Object.entries(files)) {
      assert(!path.isAbsolute(file) && !file.split('/').includes('..'));
      const target = path.join(source, file); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, text, { flag: 'wx' });
      originals.push({ source: name, path: file, bytes: Buffer.byteLength(text), sha256: hash(text) });
    }
    git(['add', '--all']); git(['commit', '-qm', 'Add owned prepared-flow sources']);
    revisions[name] = { revision: git(['rev-parse', 'HEAD']), tree: git(['rev-parse', 'HEAD^{tree}']) };
  }
  return { revisions, originals, paths: Object.keys(corpus).map(name => path.join(directory, name)) };
}
export async function launch({ directory, data, controlled = false, fault = false }) {
  await mkdir(directory); const descriptors = ['stdout', 'stderr'].map(name => openSync(path.join(directory, name + '.log'), 'wx', 0o600));
  const entry = controlled ? 'scripts/loredock-prepared-flow/launcher.mjs' : 'apps/loredock/dist/index.js';
  const args = ['--import', path.join(repository, 'scripts/loredock-prepared-flow/monitor.mjs'), path.join(repository, entry)];
  const env = { PATH: process.env.PATH, LC_ALL: 'C', LOREDOCK_DATA_DIR: data, LOREDOCK_ANSWERS: '1', LOREDOCK_PREPARED_ANSWERS: '1',
    AEW_FLOW_OUTPUT: directory, ...fault ? { AEW_FLOW_FAULTS: '1' } : {} };
  const began = performance.now(), child = spawn(process.execPath, args, { cwd: repository, env, detached: true, stdio: ['ignore', ...descriptors, 'ipc'] });
  for (const descriptor of descriptors) closeSync(descriptor);
  const pending = new Map(); let id = 0, ended = false, spawnError;
  const exit = new Promise(resolve => {
    child.once('error', error => { spawnError = normalized(error); });
    child.once('close', (code, signal) => { ended = true;
      for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('Owned daemon exited before control reply.')); } pending.clear();
      resolve({ code, signal, spawnError: spawnError ?? null, wallMs: performance.now() - began }); });
  });
  child.on('message', value => {
    const waiting = pending.get(value.id); if (!waiting) return; pending.delete(value.id); clearTimeout(waiting.timer);
    if (value.error) waiting.reject(Object.assign(new Error(value.error.message), value.error)); else waiting.resolve(value.result);
  });
  let stopPromise;
  const stop = () => stopPromise ??= (async () => {
    if (!ended) try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    const timer = setTimeout(() => { if (!ended) try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }, 10000);
    try { const result = await exit; await save(path.join(directory, 'exit.json'), result); return result; } finally { clearTimeout(timer); }
  })();
  try {
    await save(path.join(directory, 'process.json'), { executable: process.execPath, args, env, pid: child.pid, controlled, fault });
    await until(async () => {
      if (ended) throw new Error('Owned daemon exited before listening: ' + JSON.stringify(await exit));
      return (await readFile(path.join(directory, 'stdout.log'), 'utf8')).includes('LoreDock listening on http://127.0.0.1:4244');
    }, 'Owned daemon did not listen.', 10000);
  } catch (error) {
    try { await stop(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Daemon startup and cleanup both failed.'); }
    throw error;
  }
  return { pid: child.pid, child, directory, readyMs: performance.now() - began, stop, exit,
    command(name, parameters = {}) {
      assert(controlled, 'Control channel is only available on the declared controlled bootstrap.');
      return new Promise((resolve, reject) => {
        const request = ++id, timer = setTimeout(() => { pending.delete(request); reject(new Error('Control timeout: ' + name)); }, 10000);
        pending.set(request, { resolve, reject, timer }); child.send({ id: request, name, parameters });
      });
    } };
}

export async function client(directory) {
  await mkdir(directory); const origin = 'http://127.0.0.1:4244'; let sequence = 0, cookie, token;
  const events = journal(path.join(directory, 'requests.jsonl'));
  async function request(route, method = 'GET', body, { allowError = false, timeout = 10000 } = {}) {
    const id = String(++sequence).padStart(5, '0'), started = performance.now();
    const headers = { origin, 'content-type': 'application/json', ...cookie ? { cookie, 'x-loredock-csrf': token } : { 'x-loredock-client': 'web' } };
    events.append({ event: 'request', id, route, method, body: body ?? null, removedHeaders: ['cookie', 'x-loredock-csrf'] });
    try {
      const response = await fetch(origin + '/api' + route, { method, headers, signal: AbortSignal.timeout(timeout), ...body === undefined ? {} : { body: JSON.stringify(body) } });
      const reader = response.body.getReader(), chunks = []; let bytes = 0;
      while (true) {
        const row = await reader.read(); if (row.done) break;
        bytes += row.value.length;
        if (bytes > 2 * 1024 * 1024) {
          await reader.cancel();
          if (route !== '/session') await writeFile(path.join(directory, id + '.partial.bin'), Buffer.concat(chunks), { flag: 'wx' });
          throw new Error('Response exceeds driver retention cap; partial bytes retained except session secrets.');
        }
        chunks.push(Buffer.from(row.value));
      }
      const raw = Buffer.concat(chunks).toString('utf8'), elapsedMs = performance.now() - started;
      if (route !== '/session') await writeFile(path.join(directory, id + '.json'), raw, { flag: 'wx' });
      const value = JSON.parse(raw);
      if (route === '/session') { cookie = response.headers.get('set-cookie')?.split(';')[0]; token = value.token; assert(cookie && token); }
      if (route === '/session') await writeFile(path.join(directory, id + '.json'), JSON.stringify({ ...value, token: '[removed-session-token]' }), { flag: 'wx' });
      events.append({ event: 'response', id, status: response.status, bytes: Buffer.byteLength(raw), elapsedMs,
        removedBodyFields: route === '/session' ? ['token'] : [], removedHeaders: ['set-cookie'] });
      if (!allowError) assert(response.ok, `${method} ${route}: ${response.status} ${raw}`);
      return { value, status: response.status, bytes: Buffer.byteLength(raw), elapsedMs };
    } catch (error) { events.append({ event: 'failure', id, error: normalized(error) }); throw error; }
  }
  try { await request('/session', 'POST'); } catch (error) { events.close(); throw error; }
  return { request, close: () => events.close() };
}
