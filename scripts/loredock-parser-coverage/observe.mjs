import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { HeapLedger } from './ledger.mjs';
import { plan } from './plan.mjs';

const [mode, output, source, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0); assert(plan.modes.includes(mode));
for (const value of [output, source]) assert(path.isAbsolute(value ?? ''));
assert.equal(process.versions.node, plan.node); assert.deepEqual(process.execArgv, []); assert(!process.env.NODE_OPTIONS);
mkdirSync(output);
const began = performance.now(), cpu = process.cpuUsage();
const save = (file, data) => writeFileSync(path.join(output, file), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
for (const file of ['events.jsonl', 'parent.jsonl']) writeFileSync(path.join(output, file), '', { flag: 'wx' });
let eventCount = 0, sampleCount = 0, previous = began;
function event(type, data = {}) {
  if (++eventCount > plan.eventLimit) throw new Error('Observer event bound exceeded.');
  appendFileSync(path.join(output, 'events.jsonl'), JSON.stringify({ at: performance.now(), type, ...data }) + '\n');
}
event('observer-entry', { pid: process.pid, ppid: process.ppid, mode, timeOrigin: performance.timeOrigin,
  monotonicNs: String(process.hrtime.bigint()), execArgv: process.execArgv });
const ledger = new HeapLedger({ emit: ({ type, ...data }) => event(type, data), requestLimit: plan.workerRequestLimit });
const require = createRequire(import.meta.url), workers = require('node:worker_threads'), OriginalWorker = workers.Worker;
const threads = [];
workers.Worker = class ObservedWorker extends OriginalWorker {
  constructor(entry, options) {
    const createdAt = performance.now(); super(entry, options);
    const returnedAt = performance.now(), id = this.threadId;
    const row = { id, entry: String(entry), createdAt, returnedAt, exited: false, requests: 0, replies: 0 };
    threads.push(row); ledger.add(id, createdAt, returnedAt, () => this.getHeapStatistics());
    event('worker-created', { ...row, execArgv: options?.execArgv ?? null, environmentKeys: options?.env ? Object.keys(options.env) : null });
    this.once('online', () => event('worker-online', { id }));
    this.on('message', frame => { row.replies++; event('worker-reply', { id, ordinal: row.replies, bytes: frame?.byteLength ?? null }); });
    this.once('exit', code => { row.exited = true; ledger.exit(id); event('worker-exit', { id, code }); });
    const post = this.postMessage;
    this.postMessage = (...args) => { row.requests++; event('worker-request', { id, ordinal: row.requests, bytes: args[0]?.byteLength ?? null }); return post.apply(this, args); };
    ledger.request(id);
  }
};
syncBuiltinESMExports();
function sample() {
  if (++sampleCount > plan.parentSampleLimit) throw new Error('Observer parent sample bound exceeded.');
  const at = performance.now();
  appendFileSync(path.join(output, 'parent.jsonl'), JSON.stringify({ at, gapMs: at - previous,
    memory: process.memoryUsage(), processHighWaterRssBytes: process.resourceUsage().maxRSS * 1024 }) + '\n');
  previous = at; ledger.tick();
}
const timer = setInterval(sample, plan.intervalMs); sample();
let server, failure = null, lifecycle = {}, unregister;
try {
  if (mode === 'source') {
    event('loader-registration-start');
    const appRequire = createRequire(new URL('../../apps/loredock/package.json', import.meta.url));
    const { register } = await import(pathToFileURL(appRequire.resolve('tsx/esm/api')).href);
    unregister = register({ tsconfig: false }); event('loader-registration-end');
  }
  const directory = mode === 'source' ? 'src' : 'dist', extension = mode === 'source' ? 'ts' : 'js';
  const moduleURL = name => new URL(`../../apps/loredock/${directory}/${name}.${extension}`, import.meta.url);
  event('application-import-start');
  const { LoreDockServer } = await import(moduleURL('server')); event('application-import-end');
  event('server-construction-start'); server = new LoreDockServer({ directory: path.join(output, 'data'), port: 0 });
  event('server-construction-end');
  event('identity-and-warm-start'); const port = await server.start(); event('listening', { port, owner: server.catalog.parser.snapshot() });
  lifecycle.port = port; lifecycle.listeningAt = performance.now();
  assert(!Object.keys(require.cache).some(file => /[\\/]typescript[\\/]lib[\\/]/.test(file)), 'The parent loaded the compiler.');
  event('source-registration-start'); await server.catalog.addSource(source); event('source-registration-end');
  event('index-start'); const state = server.catalog.state(); server.catalog.start('observation', state.sourceSetVersion, state.policyVersion);
  await server.catalog.idle(); const buildId = server.catalog.state().publishedBuildId; assert(buildId); event('index-end', { buildId });
  // Inspect the real server-owned service; do not construct a competing service or alter follow behavior.
  const analysis = server.analysis; assert(analysis);
  event('native-analysis-start');
  const existing = analysis.list().find(row => row.buildId === buildId && row.currentParser);
  const run = existing ?? analysis.start('observation-native', buildId); await analysis.idle();
  lifecycle.native = analysis.get(run.id); assert(lifecycle.native.published); assert.equal(lifecycle.native.counts.parsed, 1);
  event('native-analysis-end', { id: run.id, status: lifecycle.native.status });
  event('foreground-graph-start'); const { codeFlows } = await import(moduleURL('code-flows'));
  const graph = await codeFlows(server.catalog); assert(graph.nodes.some(row => row.kind === 'http-request'));
  const graphBytes = JSON.stringify(graph); save('graph.json', graph);
  lifecycle.graphSha256 = createHash('sha256').update(graphBytes).digest('hex'); lifecycle.graphNodes = graph.nodes.length;
  event('foreground-graph-end'); event('idle-start'); await delay(plan.idleMs); event('idle-end');
} catch (error) {
  failure = { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack }; event('failure', failure);
} finally {
  event('stop-start');
  try {
    await server?.stop(); lifecycle.stopped = server?.catalog.parser.snapshot() ?? null;
    assert(!lifecycle.stopped?.owner?.owned); assert(!lifecycle.stopped?.active); event('stop-end', { owner: lifecycle.stopped });
    if (server) {
      event('catalog-reopen-start'); const { DatabaseSync } = await import('node:sqlite');
      const db = new DatabaseSync(path.join(output, 'data/loredock.db'), { readOnly: true });
      try { lifecycle.integrity = db.prepare('PRAGMA integrity_check').get(); lifecycle.foreignKeyFailures = db.prepare('PRAGMA foreign_key_check').all();
        assert.equal(lifecycle.integrity.integrity_check, 'ok'); assert.equal(lifecycle.foreignKeyFailures.length, 0);
      } finally { db.close(); }
      event('catalog-reopen-end');
    }
  } catch (error) { failure ??= { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack }; event('cleanup-failure', failure); }
  clearInterval(timer); sample();
  // Let already-delivered settlements run once; never await an unbounded heap request.
  await Promise.resolve(); const heap = ledger.close();
  save('heap.json', heap); event('observer-close', { pending: heap.requests.filter(row => row.status === 'pending').length });
  workers.Worker = OriginalWorker; syncBuiltinESMExports(); unregister?.();
  save('result.json', { candidate: process.env.COVERAGE_CANDIDATE, mode, node: process.versions.node, pid: process.pid,
    began, ended: performance.now(), processCpu: process.cpuUsage(cpu), resourceUsage: process.resourceUsage(),
    lifecycle, failure, threads, sampleCount, eventCount, plan, resourceQualification: false,
    coverage: 'No pre-observer JavaScript, exact worker sample instants or complete nested/internal isolate census. Parent and worker maxima are diagnostic only.' });
  process.once('exit', code => event('process-exit', { code, liveObservedWorkers: threads.filter(row => !row.exited).map(row => row.id) }));
  if (failure) process.exitCode = 1;
}
