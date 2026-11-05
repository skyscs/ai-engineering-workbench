// Passive preload: its memory, timer and synchronous journal overhead belong to this process.
import { openSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import path from 'node:path';

if (!path.isAbsolute(process.env.AEW_FLOW_OUTPUT ?? '')) throw new Error('A fresh owned monitor output directory is required.');
const descriptor = openSync(path.join(process.env.AEW_FLOW_OUTPUT, 'memory-timer.jsonl'), 'wx', 0o600);
let previous = performance.now(), closed = false;
function sample(event) {
  const now = performance.now(), memory = process.memoryUsage();
  writeSync(descriptor, JSON.stringify({ event, now, gapMs: now - previous, ...memory,
    processHighWaterRssBytes: process.resourceUsage().maxRSS * 1024 }) + '\n'); previous = now;
}
sample('start');
const timer = setInterval(() => sample('sample'), 10); timer.unref();
process.once('exit', code => {
  if (closed) return; closed = true; clearInterval(timer); sample('exit-' + code); fsyncSync(descriptor); closeSync(descriptor);
});
