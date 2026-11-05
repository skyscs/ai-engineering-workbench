import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { test } from 'node:test';
import { sampleProcessTree } from '../loredock-prepared-flow/process-tree.mjs';

test('passive process census includes a child spawned by a nonleader thread', { timeout: 20000 }, async t => {
  const script = `const { Worker } = require('node:worker_threads');
    const worker = new Worker(\`const { parentPort } = require('node:worker_threads');
      const { spawn } = require('node:child_process');
      const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
      child.on('spawn', () => parentPort.postMessage(child.pid));
      parentPort.on('message', () => { child.once('exit', () => process.exit(0)); child.kill(); });\`, { eval: true });
    worker.on('message', pid => process.stdout.write(pid + '\\n'));
    process.stdin.once('data', () => worker.postMessage('stop'));`;
  const child = spawn(process.execPath, ['-e', script], { detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const exit = once(child, 'exit');
  let stderr = ''; child.stderr.on('data', raw => { stderr += raw; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    await exit;
  });
  const descendant = Number((await once(child.stdout, 'data'))[0].toString().trim());
  assert(Number.isSafeInteger(descendant) && descendant > 0);
  const leaderChildren = (await readFile(`/proc/${child.pid}/task/${child.pid}/children`, 'utf8')).trim().split(/\s+/).map(Number);
  assert(!leaderChildren.includes(descendant), 'Control must expose the former main-thread-only omission.');
  const sample = await sampleProcessTree(child.pid);
  assert(sample.complete, JSON.stringify(sample));
  assert.deepEqual(sample.rows.map(row => row.pid).sort(), [child.pid, descendant].sort());
  const row = sample.rows.find(value => value.pid === descendant);
  assert.equal(row.parentPid, child.pid);
  assert.notEqual(row.discoveredFrom.tid, child.pid);
  assert(row.rssBytes > 0 && row.highWaterRssBytes >= row.rssBytes);
  assert(/^\d+$/.test(row.userTicks) && /^\d+$/.test(row.systemTicks));
  assert.equal(sample.rssBytes, sample.rows.reduce((sum, value) => sum + value.rssBytes, 0));
  const wrongIdentity = await sampleProcessTree(child.pid, '0');
  assert.equal(wrongIdentity.complete, false);
  assert.equal(wrongIdentity.rssBytes, 0);
  assert.deepEqual(wrongIdentity.rows[0].issues, [{ kind: 'root-identity-changed' }]);
  assert.equal(wrongIdentity.rows.length, 1);
  child.stdin.end('stop');
  assert.deepEqual(await exit, [0, null], stderr);
  const stopped = await sampleProcessTree(child.pid, sample.rows[0].startedTicks);
  assert.equal(stopped.complete, false);
  assert.equal(stopped.rssBytes, 0);
  assert.deepEqual(stopped.rows[0].issues, [{ kind: 'process-exited-during-sample' }]);
});
