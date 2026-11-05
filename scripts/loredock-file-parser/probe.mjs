import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';

const [output, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0); assert(path.isAbsolute(output)); assert.equal(process.versions.node, '22.23.2');
assert.deepEqual(process.execArgv, []); assert(!process.env.NODE_OPTIONS);
mkdirSync(output);
const save = (name, value) => writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
for (const name of ['events', 'samples', 'worker-samples']) writeFileSync(path.join(output, name + '.jsonl'), '', { flag: 'wx' });
const append = (name, value) => appendFileSync(path.join(output, name + '.jsonl'), JSON.stringify(value) + '\n');
const began = performance.now(), cpu = process.cpuUsage(), threads = [];
const event = (type, value = {}) => append('events', { now: performance.now(), type, ...value });
const workers = createRequire(import.meta.url)('node:worker_threads'), OriginalWorker = workers.Worker;
workers.Worker = class ObservedWorker extends OriginalWorker {
  constructor(entry, options) {
    const created = performance.now(); super(entry, options);
    const item = { worker: this, threadId: this.threadId, created, exited: false, pending: null, requests: 0, skipped: 0 };
    threads.push(item);
    event('worker-created', { threadId: item.threadId, created, entry: String(entry), execArgv: options.execArgv,
      environmentKeys: Object.keys(options.env), workerData: options.workerData });
    this.once('online', () => event('worker-online', { threadId: item.threadId }));
    this.once('exit', code => { item.exited = true; event('worker-exit', { threadId: item.threadId, code }); });
    assert.equal(typeof this.getHeapStatistics, 'function'); assert.equal(typeof this.cpuUsage, 'function');
  }
};
syncBuiltinESMExports();
let previous = began;
function sample() {
  const now = performance.now(); append('samples', { now, gapMs: now - previous, memory: process.memoryUsage(),
    processHighWaterRssBytes: process.resourceUsage().maxRSS * 1024 }); previous = now;
  for (const item of threads) {
    if (item.exited) continue;
    if (item.pending) { item.skipped++; event('worker-sample-pending', { threadId: item.threadId }); continue; }
    const requested = performance.now(), id = ++item.requests;
    event('worker-sample-request', { threadId: item.threadId, id, requested });
    item.pending = Promise.allSettled([Promise.resolve().then(() => item.worker.getHeapStatistics()),
      Promise.resolve().then(() => item.worker.cpuUsage())]).then(([heap, cpu]) => {
      const outcome = value => value.status === 'fulfilled' ? { status: 'fulfilled', value: value.value }
        : { status: 'rejected', name: value.reason?.name ?? null, code: value.reason?.code ?? null };
      append('worker-samples', { threadId: item.threadId, id, requested, completed: performance.now(), heap: outcome(heap), cpu: outcome(cpu) });
    }).finally(() => { item.pending = null; });
  }
}
const timer = setInterval(sample, 10); sample();
const inputs = [
  ['src/client.ts', 'export function load() { return fetch("/orders", { headers: { "X-Tenant": "demo" } }); }'],
  ['src/client.js', 'export function publish(event) { kafka.send("orders-created", event); }'],
  ['src/Checkout.vue', '<script setup lang="ts">function checkout() { fetch("/orders"); }</script><template><button @click="checkout">Buy</button></template>'],
  ['src/Orders.java', 'class Orders { public void send(String order) { kafka.send("orders-created", order); } }'],
  ['src/unicode.ts', '// 🚢 café\nexport function getOrder() { return fetch("/orders"); }'],
  ['src/broken.ts', 'export function ( {'],
  ['src/Unsupported.vue', '<template><div>Unsupported envelope</div></template>'],
  ['src/Escapes.java', String.raw`class Escapes { String value = "\u000a"; }`],
];
save('inputs.json', inputs);
let parser, failure = null;
try {
  event('import-start'); const { OwnedFileParser } = await import('../../apps/loredock/dist/file-parser.js'); event('import-end');
  assert.equal(threads.length, 0); parser = new OwnedFileParser(); assert.equal(threads.length, 0);
  event('start'); await parser.start({ deadline: performance.now() + 5000 }); event('ready', parser.snapshot());
  for (let index = 0; index < inputs.length; index++) {
    const [file, content] = inputs[index]; event('parse-start', { index });
    const facts = await parser.parse(file, content, { deadline: performance.now() + 5000 });
    save(`facts-${index}.json`, facts); event('parse-end', { index, symbols: facts.symbols.length, operations: facts.operations.length, gaps: facts.gaps.length });
  }
  event('idle-start'); await delay(50); event('idle-end');
} catch (error) { failure = { name: error.name, code: error.code ?? null }; event('failure', failure); }
finally {
  event('stop-start');
  try { await parser?.stop(); } catch (error) { failure ??= { name: error.name, code: error.code ?? null }; event('stop-failure', failure); }
  event('stop-end', parser?.snapshot() ?? {}); clearInterval(timer); sample();
  await Promise.allSettled(threads.flatMap(item => item.pending ? [item.pending] : []));
  workers.Worker = OriginalWorker; syncBuiltinESMExports();
  const survivors = threads.filter(item => !item.exited).map(item => item.threadId);
  save('result.json', { resourceQualification: false, node: process.versions.node, pid: process.pid, began,
    ended: performance.now(), processCpu: process.cpuUsage(cpu), failure, survivors,
    owner: parser?.snapshot() ?? null, threads: threads.map(({ threadId, created, requests, skipped, exited }) => ({ threadId, created, requests, skipped, exited })) });
  if (failure || survivors.length || threads.length !== 1) process.exitCode = 1;
}
