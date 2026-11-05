import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { supervise } from '../loredock-prepared-flow/watchdog.mjs';
import { identity, sameProcess } from '../loredock-prepared-flow/ownership.mjs';

async function exercise(t, mode, options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-flow-owner-')), script = path.join(root, 'owned-driver.mjs');
  const ownership = new URL('../loredock-prepared-flow/ownership.mjs', import.meta.url).href;
  await writeFile(script, `import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {registerOwnedProcess} from ${JSON.stringify(ownership)};
const output=process.argv[2]; await mkdir(output); await mkdir(output+'/daemon');
await writeFile(output+'/retained-original.txt','Owned original bytes remain after failure.');
const child=spawn(process.execPath,['-e',${JSON.stringify(mode === 'orphan'
    ? "const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});c.unref();setTimeout(()=>process.exit(0),300);"
    : "process.on('SIGTERM',()=>{});setInterval(()=>{},1000);")}],{detached:true,stdio:'ignore'});
await registerOwnedProcess(child,output+'/daemon','daemon');
await writeFile(output+'/owned-child.json',JSON.stringify({pid:child.pid}));
${mode === 'hang' ? "await new Promise(()=>{});"
    : mode === 'storage' ? "await writeFile(output+'/retained-large.bin',Buffer.alloc(65536,65));await new Promise(()=>{});"
      : mode === 'orphan' ? "await once(child,'exit');await new Promise(resolve=>setTimeout(resolve,300));process.exitCode=7;"
        : "child.unref();process.exitCode=7;"}
`);
  const output = path.join(root, 'output');
  const result = await supervise({ script, output, wallMs: 10000, graceMs: 200, ...options });
  t.diagnostic('Retained owned watchdog test: ' + root);
  assert.equal(await readFile(path.join(output, 'run/retained-original.txt'), 'utf8'), 'Owned original bytes remain after failure.');
  assert.deepEqual(result.survivingOwnedProcesses, []); assert.deepEqual(result.errors, []);
  assert(result.owned.some(row => row.kind === 'daemon'));
  return { result, output };
}

test('owner rejects reused PID identities', async () => {
  const current = await identity(process.pid); assert(current); assert(sameProcess(current, current));
  assert(!sameProcess(current, { ...current, started: current.started + '-other' }));
  assert(!sameProcess(current, { ...current, group: current.group + 1 }));
  assert(!sameProcess(current, null));
});
test('external wall watchdog stops a stuck driver and its TERM-resistant owned daemon', async t => {
  const { result } = await exercise(t, 'hang', { wallMs: 5000 });
  assert.equal(result.reason, 'wall-ceiling'); assert(result.killed.length > 0);
});
test('failed driver cannot abandon its detached owned daemon', async t => {
  const { result } = await exercise(t, 'failure');
  assert.equal(result.reason, 'driver-left-owned-process'); assert.equal(result.driverExit.code, 7);
});
test('observed descendants are drained after their process-group leader exits', async t => {
  const { result } = await exercise(t, 'orphan');
  assert.equal(result.reason, 'driver-left-owned-process');
  assert(result.owned.find(row => row.kind === 'daemon').members.length >= 2);
});
test('storage ceiling stops work and retains the file that exceeded it', async t => {
  const { result, output } = await exercise(t, 'storage', { storageBytes: 32768 });
  assert.equal(result.reason, 'storage-ceiling'); assert(result.peakStorageBytes >= 65536);
  assert.equal((await readFile(path.join(output, 'run/retained-large.bin'))).length, 65536);
});
