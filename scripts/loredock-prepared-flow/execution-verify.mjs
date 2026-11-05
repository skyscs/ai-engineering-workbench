// Pre-consumption validation; this module never imports application code.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { hash, repository, save } from './io.mjs';

export function assertLaunchBoundary({ manifest, family, directory, claimPath, argv, env, cwd, executable, parent, command, events, pid }) {
  assert.equal(manifest.schemaVersion, 'prepared-flow-execution-seal/1');
  assert.equal(family, 'kiln-prepared-flow-127'); assert.equal(manifest.plan.family, family);
  assert.equal(directory, path.join(manifest.plan.ownerOutput, 'run/matrix'));
  assert.equal(claimPath, manifest.plan.claimPath);
  assert.deepEqual(argv, manifest.driver.args); assert.equal(executable, manifest.driver.args[0]);
  assert.equal(cwd, manifest.repository); assert.deepEqual(env, manifest.driver.env);
  assert.deepEqual(command, manifest.driver);
  assert.deepEqual(parent.args, manifest.command); assert.equal(parent.executable, manifest.command[0]);
  const bootstrap = events.filter(row => row.event === 'subreaper-verified');
  assert.equal(bootstrap.length, 1); assert.equal(bootstrap[0].pid, parent.pid);
  assert.equal(bootstrap[0].isolated, 1); assert.equal(bootstrap[0].noSite, 1);
  const started = events.filter(row => row.event === 'started');
  assert.equal(started.length, 1); assert.deepEqual(started[0].limits, manifest.limits);
  const drivers = events.filter(row => row.event === 'driver-started');
  assert.equal(drivers.length, 1); assert.equal(drivers[0].pid, pid);
  assert(!events.some(row => ['finished', 'signal', 'error', 'ceiling'].includes(row.event)));
}

export async function verifyExecution({ directory, claimPath, family, manifestPath }) {
  assert.equal(await realpath(manifestPath), manifestPath);
  const raw = await readFile(manifestPath), manifest = JSON.parse(raw);
  assert.equal(manifest.repository, path.resolve(repository));
  const owner = manifest.plan.ownerOutput;
  const parent = { pid: process.ppid, executable: await realpath('/proc/' + process.ppid + '/exe'),
    args: (await readFile('/proc/' + process.ppid + '/cmdline', 'utf8')).split('\0').filter(Boolean) };
  const command = JSON.parse(await readFile(path.join(owner, 'command.json')));
  const events = (await readFile(path.join(owner, 'owner.jsonl'), 'utf8')).trimEnd().split('\n').map(JSON.parse);
  assertLaunchBoundary({ manifest, family, directory, claimPath, argv: process.argv, env: { ...process.env },
    cwd: process.cwd(), executable: process.execPath, parent, command, events, pid: process.pid });
  const began = performance.now();
  const verified = await promisify(execFile)(manifest.command[0], ['-I', '-S', '-B',
    path.join(repository, 'scripts/loredock-prepared-flow/execution-seal.py'), 'verify', manifestPath],
  { cwd: repository, env: manifest.driver.env, timeout: 180000, maxBuffer: 1048576 });
  const result = JSON.parse(verified.stdout);
  assert.equal(result.manifestSha256, hash(raw)); assert.equal(result.verified, true);
  assert.equal(verified.stderr, '');
  const proof = { manifestPath, manifestSha256: hash(raw), sourceCommit: manifest.sourceCommit,
    indexSha256: manifest.index.sha256, verificationMs: performance.now() - began, verification: result,
    parent, candidateImportsBeforeClaim: 0, candidateReadsBeforeClaim: 0, resourceQualification: false };
  await save(path.join(owner, 'run', 'execution-verification.json'), proof);
  return proof;
}
