import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { prepareSources } from './loredock-capture-memory/fixture.mjs';
import { corpusFactory } from './loredock-native-assessment/fixture.mjs';

// Opt-in functional startup/restart test on small owned sources, never a reserved family.
const root = fileURLToPath(new URL('../', import.meta.url)), output = process.env.LOREDOCK_PUBLIC_NATIVE_SMOKE_OUTPUT;
assert.ok(output && path.isAbsolute(output) && path.resolve(output) === output);
await mkdir(output); const directory = path.join(output, 'data'), origin = 'http://127.0.0.1:4244';
const report = { schemaVersion: 'public-native-path-smoke/1', head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  node: process.version, modelRequests: 0, resourceQualification: false, processes: [], checks: [], errors: [], failed: true };
const save = () => writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
const raw = (name, value) => writeFile(path.join(output, name + '.json'), typeof value === 'string' ? value : JSON.stringify(value, null, 2), { flag: 'wx' });
let owned, store, catalog;
async function waitFor(action, description) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) { if (await action()) return; await delay(100); }
  throw new Error(description);
}
async function start(label) {
  // Refuse an occupied port without issuing an HTTP request to an existing daemon.
  const probe = createServer(); probe.listen(4244, '127.0.0.1'); await once(probe, 'listening');
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  const child = spawn(process.execPath, [path.join(root, 'apps/loredock/dist/index.js')], {
    cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH, LC_ALL: 'C', LOREDOCK_DATA_DIR: directory },
  });
  const record = { label, pid: child.pid, exit: null, signal: null }, logs = [];
  owned = { child, record, ended: false, stdout: '', logs }; report.processes.push(record);
  for (const [name, stream] of [['stdout', child.stdout], ['stderr', child.stderr]]) {
    const log = createWriteStream(path.join(output, label + '.' + name), { flags: 'wx' }); stream.pipe(log);
    logs.push(new Promise((resolve, reject) => { log.on('finish', resolve); log.on('error', reject); }));
  }
  const owner = owned;
  child.stdout.on('data', chunk => { owner.stdout = (owner.stdout + chunk.toString()).slice(-16384); });
  owner.closed = new Promise(resolve => {
    child.on('error', error => { record.error = { name: error.name, message: error.message }; });
    child.on('close', (exit, signal) => { owner.ended = true; Object.assign(record, { exit, signal }); resolve(); });
  });
  await waitFor(() => { assert.ok(!owner.ended, 'Owned daemon exited before listening.'); return owner.stdout.includes('LoreDock listening on ' + origin); }, 'Owned daemon did not listen.');
  let cookie, token;
  const request = async (route, body) => {
    assert.ok(!owner.ended, 'Do not contact a daemon after losing process ownership.');
    const response = await fetch(origin + '/api' + route, { method: body === undefined ? 'GET' : 'POST',
      signal: AbortSignal.timeout(10000), headers: { origin, 'x-loredock-client': 'web', ...(cookie ? { cookie, 'x-loredock-csrf': token } : {}),
        ...body === undefined ? {} : { 'content-type': 'application/json' } }, ...body === undefined ? {} : { body: JSON.stringify(body) } });
    const text = await response.text(); assert.ok(response.ok, text);
    if (route === '/session') { cookie = response.headers.get('set-cookie').split(';')[0]; token = JSON.parse(text).token; }
    return { text, value: JSON.parse(text) };
  };
  await request('/session', {}); return request;
}
async function stop(signal) {
  if (!owned) return;
  const owner = owned;
  const send = value => { try { process.kill(-owner.child.pid, value); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
  if (!owner.ended) send(signal);
  const timer = setTimeout(() => { if (!owner.ended) { owner.record.forcedKill = true; send('SIGKILL'); } }, 5000);
  try { await owner.closed; await Promise.all(owner.logs); await raw(owner.record.label + '-exit', owner.record); }
  finally { clearTimeout(timer); owned = undefined; }
  assert.equal(owner.record.exit, 0); assert.equal(owner.record.signal, null); assert.ok(!owner.record.forcedKill && !owner.record.error);
}
try {
  store = new CatalogStore(directory); catalog = new Catalog(store);
  report.catalogId = store.receipts.catalogId; report.revisions = await prepareSources(output, corpusFactory(), { catalog });
  await catalog.stop(); catalog = undefined; store.close(); store = undefined;
  const first = await start('first'), health = await first('/health'); await raw('health', health.text);
  assert.equal(health.value.modelExecution, false); assert.equal(health.value.codeAnalysis, true);
  const project = (await first('/project')).value;
  const build = (await first('/builds', { requestId: 'public-native-startup', sourceSetVersion: project.sourceSetVersion, policyVersion: project.policyVersion })).value;
  await raw('build-start', build); await waitFor(async () => (await first('/builds/' + build.id)).value.published, 'Index did not publish.');
  let inventory;
  await waitFor(async () => { inventory = (await first('/code-analysis')).value.inventories.find(row => row.buildId === build.id && row.published && row.currentParser); return Boolean(inventory); }, 'Automatic analysis did not publish.');
  await raw('automatic-inventory', inventory);
  const paths = await first('/code-paths?buildId=' + build.id); await raw('first-paths', paths.text);
  assert.equal(paths.value.schemaVersion, 'loredock-code-paths/2'); assert.equal(paths.value.identity.adapter, 'connected-paths-v2');
  assert.equal(paths.value.identity.inventoryId, inventory.id); assert.equal(paths.value.identity.accounting.version, 'shared-capture-work/1');
  assert.equal(paths.value.graph.edges.find(edge => edge.kind === 'event-delivery').topicCheck.value, 'permit.granted.v3');
  report.checks.push('Actual compiled entry starts model-free, follows a new index automatically and serves native v2 with literal support.');
  await stop('SIGTERM'); store = new CatalogStore(directory); assert.equal(store.receipts.catalogId, report.catalogId); store.close(); store = undefined;
  const second = await start('second'), repeated = await second('/code-paths?buildId=' + build.id); await raw('restarted-paths', repeated.text);
  assert.equal(repeated.text, paths.text); await stop('SIGINT');
  store = new CatalogStore(directory); assert.equal(store.receipts.catalogId, report.catalogId); store.close(); store = undefined;
  report.checks.push('SIGTERM and SIGINT release catalog ownership; restart returns the exact native projection without fingerprint substitution.');
  for (const [name, revision] of Object.entries(report.revisions)) {
    const git = args => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', ...args], {
      cwd: path.join(output, 'sources', name), encoding: 'utf8', timeout: 10000,
      env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', LC_ALL: 'C' },
    }).trim();
    assert.equal(git(['rev-parse', 'HEAD']), revision); assert.equal(git(['status', '--porcelain']), '');
  }
  report.checks.push('All four owned source revisions and working trees remain unchanged.'); report.failed = false;
} catch (error) { report.errors.push({ name: error.name, message: error.message, stack: error.stack }); }
finally {
  for (const [phase, close] of [['process-close', () => stop('SIGTERM')], ['catalog-close', () => catalog?.stop()], ['store-close', () => store?.close()]]) {
    try { await close(); }
    catch (error) { report.failed = true; report.errors.push({ phase, name: error.name, message: error.message }); }
  }
  await save();
}
console.log(JSON.stringify({ output, failed: report.failed, checks: report.checks, errors: report.errors }));
process.exitCode = report.failed ? 1 : 0;
