import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createLoreDockFixture } from '../loredock-fixture.mjs';
import { CatalogStore } from '../../apps/loredock/dist/store.js';
import { Catalog } from '../../apps/loredock/dist/catalog.js';
import { AnswerWitnessStore } from '../../apps/loredock/dist/answer-witness-store.js';

const entry = fileURLToPath(new URL('../loredock-controlled-server/launcher.mjs', import.meta.url));
async function until(check, message) {
  const end = performance.now() + 10000;
  for (;;) { const value = await check(); if (value) return value;
    assert(performance.now() < end, message); await delay(50); }
}
function launch(t, output) {
  const child = spawn(process.execPath, [entry, output], { env: { PATH: process.env.PATH, LC_ALL: 'C' },
    detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let bytes = 0, stderrBytes = 0, pending = '', stderr = '', streamError, outcome, timedOut = false, next = 0, commandPending = false;
  const rows = [];
  const kill = signal => { if (!outcome && child.pid) try { process.kill(-child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') streamError ??= error; } };
  child.once('error', error => { streamError = error; }); child.stdin.on('error', error => { if (!outcome) streamError ??= error; });
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    try {
      bytes += Buffer.byteLength(chunk); assert(bytes <= 65536, 'Controlled stdout exceeded its bound.'); pending += chunk;
      for (;;) { const end = pending.indexOf('\n'); if (end < 0) break;
        const line = pending.slice(0, end); pending = pending.slice(end + 1);
        assert(Buffer.byteLength(line) <= 4096 && rows.length < 64); rows.push(JSON.parse(line)); }
    } catch (error) { streamError ??= error; kill('SIGTERM'); }
  });
  child.stderr.on('data', chunk => { stderrBytes += Buffer.byteLength(chunk);
    if (stderrBytes <= 65536) stderr += chunk;
    else { streamError ??= new Error('Controlled stderr exceeded its bound.'); kill('SIGTERM'); } });
  const exited = new Promise(resolve => child.once('close', (code, signal) => { outcome = { code, signal }; resolve(outcome); }));
  const watchdog = setTimeout(() => { timedOut = true; kill('SIGKILL'); }, 45000);
  let closing;
  const close = () => closing ??= (async () => {
    kill('SIGTERM'); const cleanup = setTimeout(() => kill('SIGKILL'), 10000);
    try { await exited; } finally { clearTimeout(cleanup); clearTimeout(watchdog); }
  })();
  t.after(close);
  async function row(match) {
    return until(() => {
      if (streamError) throw streamError;
      const value = rows.find(match); if (value) return value;
      assert(!outcome, 'Controlled server exited before the expected record: ' + stderr); return false;
    }, 'Controlled server record was not received.');
  }
  return { output, child, rows, row, kill, close,
    async ready() { return row(value => value.stage === 'ready'); },
    async command(command) {
      assert(!commandPending); commandPending = true; const id = ++next;
      try { child.stdin.write(JSON.stringify({ id, command }) + '\n'); return await row(value => value.stage === 'reply' && value.id === id); }
      finally { commandPending = false; }
    },
    async exit(code = 0) {
      const result = await exited; clearTimeout(watchdog);
      assert.equal(timedOut, false, stderr); assert.ifError(streamError); assert.equal(pending, '');
      assert.deepEqual(result, { code, signal: null }, stderr); return rows.find(value => value.stage === 'stopped');
    },
  };
}
async function client(port) {
  let cookie, token;
  async function request(route, method = 'GET', body, overrides = {}) {
    const raw = body === undefined ? undefined : JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const req = httpRequest({ hostname: '127.0.0.1', port, path: '/api' + route, method, agent: false,
        headers: { host: '127.0.0.1:4244', origin: 'http://127.0.0.1:4244', 'x-loredock-client': 'web',
          ...cookie ? { cookie, 'x-loredock-csrf': token } : {}, ...raw ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(raw) } : {}, ...overrides } }, response => {
        let value = ''; response.setEncoding('utf8');
        response.on('data', chunk => { value += chunk; if (Buffer.byteLength(value) > 1048576) response.destroy(new Error('Controlled HTTP response exceeds 1 MiB.')); });
        response.once('error', reject); response.once('end', () => { try { resolve({ status: response.statusCode, value: JSON.parse(value), headers: response.headers }); } catch (error) { reject(error); } });
      });
      req.setTimeout(5000, () => req.destroy(new Error('Controlled HTTP request timed out.'))); req.once('error', reject); req.end(raw);
    });
  }
  const session = await request('/session', 'POST'); assert.equal(session.status, 200);
  cookie = session.headers['set-cookie'][0].split(';')[0]; token = session.value.token;
  return { request, async json(route, method, body, status = 200) { const response = await request(route, method, body); assert.equal(response.status, status, JSON.stringify(response.value)); return response.value; } };
}

test('emitted controlled server owns prepared/legacy dispatch, cancellation and interrupted shutdown through real HTTP', async t => {
  const fixture = await createLoreDockFixture(), output = path.join(fixture.root, 'controlled');
  const run = launch(t, output); t.after(async () => { await run.close(); await rm(fixture.root, { recursive: true, force: true }); });
  const ready = await run.ready(); assert.equal(ready.parser.owner.state, 'ready'); assert.equal(ready.runtime.prepares, 0);
  const api = await client(ready.port);
  assert.equal((await api.request('/project', 'GET', undefined, { origin: 'https://foreign.invalid' })).status, 403);
  assert.equal((await api.json('/answers')).preparedQuestions, true);
  for (const name of ['portal', 'order-api', 'order-worker']) await api.json('/sources', 'POST', { path: path.join(fixture.root, 'sources', name) }, 201);
  const project = await api.json('/project');
  const build = await api.json('/builds', 'POST', { requestId: randomUUID(), policyVersion: project.policyVersion, sourceSetVersion: project.sourceSetVersion }, 202);
  await until(async () => { const value = await api.json('/builds/' + build.id); assert(!['failed', 'cancelled', 'interrupted'].includes(value.status)); return ['completed', 'partial'].includes(value.status); }, 'Synthetic index did not finish.');
  await until(async () => { const value = await api.json('/code-analysis'); assert.equal(value.automaticError, null); return value.inventories.some(row => row.published && row.buildId === build.id); }, 'Synthetic analysis did not publish.');
  await api.json('/answers/configuration', 'PUT', { executable: process.execPath, configHome: fixture.root, profile: null });
  const question = 'Which local topic is configured?';
  async function prepare() {
    const state = await api.json('/question-preparations', 'POST', { requestId: randomUUID(), question, buildId: build.id }, 202);
    await until(async () => { const value = await api.json('/question-preparations/' + state.id); assert(['preparing', 'ready'].includes(value.status), value.reason); return value.status === 'ready'; }, 'Controlled preparation did not become ready.');
    return api.json('/question-preparations/' + state.id + '/review');
  }
  async function dispatch() {
    const review = await prepare();
    const value = await api.json('/prepared-answers', 'POST', { requestId: randomUUID(), preparationId: review.id, reviewedHash: review.reviewedHash }, 202);
    return { review, value };
  }
  async function completed(id) { return until(async () => {
    const value = await api.json('/answers/' + id); assert(!['failed', 'fenced', 'interrupted'].includes(value.status), value.reason);
    return value.status === 'succeeded' ? value : false;
  }, 'Controlled answer did not succeed.'); }
  async function idle() { return until(async () => !(await run.command('stats')).runtime.active, 'Controlled runtime did not close.'); }

  const first = await dispatch(), answer = await completed(first.value.id); await idle();
  assert.equal(answer.inputKind, 'prepared-question/1'); assert.deepEqual(answer.context, first.review.context);
  const context = await api.json('/answers/preview', 'POST', { question });
  const legacy = await api.json('/answers', 'POST', { requestId: randomUUID(), question, buildId: context.buildId, inputHash: context.inputHash }, 202);
  await completed(legacy.id); await idle();

  await run.command('hold-run'); const cancelled = await dispatch();
  await until(async () => (await run.command('stats')).runtime.waiting === 'run', 'Controlled run hold was not reached.');
  assert.equal((await api.json('/answers/' + cancelled.value.id + '/cancel', 'POST', {})).status, 'cancelled'); await idle();
  await run.command('hold-prepare'); const interrupted = await dispatch();
  await until(async () => (await run.command('stats')).runtime.waiting === 'prepare', 'Controlled prepare hold was not reached.');
  run.kill('SIGTERM'); const terminal = await run.exit();
  assert.equal(terminal.failed, false); assert.equal(terminal.parser.active, false);
  assert.equal(terminal.parser.owner.owned, false); assert.equal(terminal.parser.owner.state, 'closed');
  assert.equal(terminal.parser.owner.generation, ready.parser.owner.generation); assert(terminal.shutdownMs <= 10000);
  assert.deepEqual({ prepares: terminal.runtime.prepares, calls: terminal.runtime.calls, closed: terminal.runtime.closed, aborted: terminal.runtime.aborted },
    { prepares: 4, calls: 3, closed: 3, aborted: 2 });
  assert.equal(terminal.modelCalls, 0); assert.equal(terminal.resourceQualification, false);
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'terminal.json'), 'utf8')), terminal);
  const store = new CatalogStore(path.join(output, 'data')), catalog = new Catalog(store);
  try {
    const snapshot = new AnswerWitnessStore(catalog).read(first.value.id), witness = JSON.parse(snapshot.witnessJson);
    const retained = JSON.parse(await readFile(path.join(output, 'runtime/request-1.json'), 'utf8'));
    assert.equal(retained.prompt, witness.prompt);
    assert.equal(store.one('SELECT status FROM answer_attempts WHERE id=?', cancelled.value.id).status, 'cancelled');
    assert.equal(store.one('SELECT status FROM answer_attempts WHERE id=?', interrupted.value.id).status, 'interrupted');
    assert.deepEqual((await readdir(path.join(output, 'runtime'))).sort(), ['output-1.json', 'output-2.json', 'request-1.json', 'request-2.json', 'request-3.json']);
  } finally { await catalog.stop(); store.close(); }
});

test('invalid bounded control input stops the actual owner and cannot become an execution command', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-control-boundary-'));
  const runs = [];
  try {
    for (const [index, raw] of [Buffer.from('x'.repeat(1025)), Buffer.from('{"id":1,"command":"exec"}\n'),
      Buffer.from('{"id":1,"id":1,"command":"stats"}\n'), Buffer.from([0xff, 10])].entries()) {
      const run = launch(t, path.join(root, String(index))); runs.push(run); await run.ready(); run.child.stdin.write(raw);
      const terminal = await run.exit(1); assert.equal(terminal.failed, true); assert.equal(terminal.parser.owner.owned, false);
      assert.equal(terminal.runtime.prepares, 0);
      const reopened = new CatalogStore(path.join(run.output, 'data')); reopened.close();
    }
  } finally { for (const run of runs) await run.close(); await rm(root, { recursive: true, force: true }); }
});

test('an existing output directory is rejected without modifying its contents', async t => {
  const output = await mkdtemp(path.join(tmpdir(), 'loredock-controlled-existing-'));
  await writeFile(path.join(output, 'canary'), 'Retain this existing directory.');
  const run = launch(t, output); t.after(async () => { await run.close(); await rm(output, { recursive: true, force: true }); });
  const terminal = await run.exit(1); assert.equal(terminal.parser, null);
  assert.deepEqual(await readdir(output), ['canary']); assert.equal(await readFile(path.join(output, 'canary'), 'utf8'), 'Retain this existing directory.');
});

test('a signal after startup begins joins the production owner before the catalog can reopen', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-controlled-startup-'));
  const run = launch(t, path.join(root, 'owned'));
  t.after(async () => { await run.close(); await rm(root, { recursive: true, force: true }); });
  await run.row(value => value.stage === 'starting'); run.kill('SIGTERM');
  const terminal = await run.exit();
  assert.equal(terminal.failed, false); assert.equal(terminal.runtime.prepares, 0);
  assert.equal(terminal.parser.active, false); assert.equal(terminal.parser.owner?.owned ?? false, false);
  const store = new CatalogStore(path.join(run.output, 'data')); store.close();
});
