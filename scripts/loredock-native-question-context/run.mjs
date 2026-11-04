import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyFreeze, repository, jsonFile } from './identity.mjs';

const output = process.env.LOREDOCK_QUESTION_CONTEXT_OUTPUT;
assert(typeof output === 'string' && path.isAbsolute(output) && path.resolve(output) === output);
const checked = await verifyFreeze(); await mkdir(output);
const start = { schemaVersion: 'native-question-context-observed-start/1', pid: process.pid, date: new Date().toISOString(),
  sealHash: checked.sealHash, runtime: checked.runtime, watchdogMs: 300000, modelAttempts: 0, attempts: 1 };
await writeFile(path.join(output, 'start.json'), JSON.stringify(start, null, 2) + '\n', { flag: 'wx' });
const stdout = openSync(path.join(output, 'worker.stdout'), 'wx'), stderr = openSync(path.join(output, 'worker.stderr'), 'wx');
const childFile = fileURLToPath(new URL('./worker.mjs', import.meta.url));
const outcome = { executable: process.execPath, args: [childFile, output], nodeOptions: null, timeout: false, interrupted: null };
let child, timer, grace, closed = false; const began = performance.now();
const kill = signal => { if (!child?.pid || closed) return; try { process.kill(-child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') outcome.killError = error.message; } };
const stop = () => { kill('SIGTERM'); clearTimeout(grace); grace = setTimeout(() => kill('SIGKILL'), 1000); };
const listeners = ['SIGINT', 'SIGTERM'].map(signal => [signal, () => { outcome.interrupted = signal; stop(); }]);
for (const [signal, callback] of listeners) process.on(signal, callback);
try {
  await new Promise(resolve => {
    child = spawn(process.execPath, [childFile, output], { cwd: repository, detached: true, stdio: ['ignore', stdout, stderr], env: { PATH: process.env.PATH, LC_ALL: 'C' } });
    outcome.pid = child.pid; timer = setTimeout(() => { outcome.timeout = true; stop(); }, 300000);
    child.once('error', error => { outcome.spawnError = error.message; });
    child.once('close', (exit, signal) => { closed = true; outcome.exit = exit; outcome.signal = signal; resolve(); });
  });
} finally {
  clearTimeout(timer); clearTimeout(grace); if (!closed) kill('SIGKILL'); closeSync(stdout); closeSync(stderr);
  for (const [signal, callback] of listeners) process.removeListener(signal, callback);
  outcome.wallMs = performance.now() - began;
  await writeFile(path.join(output, 'worker-exit.json'), JSON.stringify(outcome, null, 2) + '\n', { flag: 'wx' });
}
let assessment;
try { assessment = JSON.parse(await readFile(path.join(output, 'assessment.json'), 'utf8')); }
catch (error) { const ledger = await jsonFile('fixtures/loredock-native-question-context-run/protocol.json');
  assessment = { pass: false, prospective: 44, cases: ledger.cases.map(row => ({ id: row.id, state: 'blocked', reason: 'No complete independent assessment; inspect retained raw case files.' })), error: error.message }; }
const pass = outcome.exit === 0 && outcome.signal === null && !outcome.timeout && !outcome.interrupted && assessment.pass;
await writeFile(path.join(output, 'result.json'), JSON.stringify({ pass, outcome, assessment }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ pass, output, exit: outcome.exit, signal: outcome.signal, prospective: 44 })); process.exitCode = pass ? 0 : 1;
