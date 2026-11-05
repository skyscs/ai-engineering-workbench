// External owner: bounds the driver and its explicitly registered child groups, retaining all files.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdir, readdir, lstat } from 'node:fs/promises';
import { identity, sameProcess, groupMembers } from './ownership.mjs';
import { journal, normalized, save, until, repository } from './io.mjs';

async function storage(directory) {
  let bytes = 0, files = 0, entries = 0;
  async function visit(root) {
    for (const name of await readdir(root)) {
      if (++entries > 200000) throw new Error('Owned output metadata exceeds the watchdog entry bound.');
      const file = path.join(root, name); let stat;
      try { stat = await lstat(file); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      if (stat.isDirectory()) { try { await visit(file); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
      else { bytes += stat.size; files++; } // Includes symlink bytes, never follows their targets.
    }
  }
  await visit(directory); return { bytes, files, entries };
}
export async function supervise({ script, output, args = [], wallMs = 2400000, storageBytes = 2147483648, graceMs = 10000 }) {
  assert(path.isAbsolute(script) && path.isAbsolute(output) && path.resolve(output) === output);
  assert(Number.isSafeInteger(wallMs) && wallMs > 0 && wallMs <= 2400000);
  assert(Number.isSafeInteger(storageBytes) && storageBytes > 0 && storageBytes <= 2147483648);
  assert(Number.isSafeInteger(graceMs) && graceMs > 0 && graceMs <= 10000);
  await mkdir(output);
  const log = journal(path.join(output, 'owner.jsonl')), samples = journal(path.join(output, 'storage.jsonl'));
  const report = { schemaVersion: 'prepared-flow-owner/1', errors: [], reason: null, killed: [], owned: [], peakStorageBytes: 0,
    measurements: 'Storage is sampled every second; wall timeout and shutdown run outside the measured driver. No deletion or retry.', wallMs, storageBytes, graceMs };
  const directory = path.join(output, 'run'), env = { PATH: process.env.PATH, LC_ALL: 'C',
    ...process.env.HOME ? { HOME: process.env.HOME } : {}, AEW_FLOW_SUPERVISED: '1' };
  const descriptors = ['stdout', 'stderr'].map(name => openSync(path.join(output, name + '.log'), 'wx', 0o600));
  const began = performance.now(), child = spawn(process.execPath, [script, directory, ...args], { cwd: repository, env, detached: true, stdio: ['ignore', ...descriptors, 'ipc'] });
  descriptors.forEach(closeSync);
  let interrupted, timer, diskTimer, processTimer, sampling, observing, cleanup;
  const registrations = new Set();
  const exited = new Promise(resolve => {
    child.once('error', error => { report.errors.push(normalized(error)); });
    child.once('close', (code, signal) => { resolve({ code, signal }); });
  });
  const active = async row => { const current = await identity(row.pid); return sameProcess(row, current) && !['Z', 'X'].includes(current.state); };
  const groupActive = async row => (await Promise.all((row.members ?? [row]).map(active))).some(Boolean);
  async function observe(row) {
    if (!await groupActive(row)) return;
    for (const member of await groupMembers(row.group)) {
      row.members ??= [];
      if (!row.members.some(known => sameProcess(known, member))) {
        row.members.push(member); log.append({ event: 'owned-group-member', leader: row.pid, identity: member });
      }
    }
  }
  async function observeAll() {
    if (observing) return observing;
    observing = (async () => { for (const row of report.owned) await observe(row); })();
    try { await observing; } finally { observing = null; }
  }
  const signal = async (row, name) => {
    await observe(row);
    if (!await groupActive(row)) return;
    log.append({ event: 'owned-signal', identity: row, signal: name });
    try { process.kill(-row.group, name); if (name === 'SIGKILL') report.killed.push(row.pid); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  const stop = reason => cleanup ??= (async () => {
    if (report.reason === null || report.reason === 'completed') report.reason = reason;
    log.append({ event: 'stop', reason });
    await Promise.allSettled([...registrations]);
    await observeAll();
    // Freeze the driver first so it cannot launch another unregistered child during teardown.
    const driver = report.owned.find(row => row.kind === 'driver');
    if (driver) await signal(driver, 'SIGSTOP');
    const services = report.owned.filter(row => row.kind !== 'driver');
    for (const row of services) await signal(row, 'SIGTERM');
    try { await until(async () => !(await Promise.all(services.map(groupActive))).some(Boolean), 'Owned services did not drain.', graceMs, 25); }
    catch {
      for (const row of services) await signal(row, 'SIGKILL');
      // Successful kill(2) delivery is not proof that the kernel has stopped each process yet.
      await until(async () => !(await Promise.all(services.map(groupActive))).some(Boolean), 'Owned services survived forced termination.', 5000, 25);
    }
    if (driver) { await signal(driver, 'SIGTERM'); await signal(driver, 'SIGCONT'); }
    const forced = setTimeout(() => { if (driver) void signal(driver, 'SIGKILL').catch(error => report.errors.push(normalized(error))); }, graceMs);
    try { await exited; } finally { clearTimeout(forced); }
  })();
  const onSignal = name => { interrupted = true; void stop('owner-' + name).catch(error => report.errors.push(normalized(error))); };
  const sigint = () => onSignal('SIGINT'), sigterm = () => onSignal('SIGTERM');
  process.on('SIGINT', sigint); process.on('SIGTERM', sigterm);
  child.on('message', message => {
    if (message?.type !== 'owned-register') return;
    const task = (async () => {
      const actual = await identity(message.identity?.pid);
      assert(sameProcess(message.identity, actual) && actual.parent === child.pid && actual.group === actual.pid, 'Registration is not a direct owned child group.');
      assert(['daemon', 'browser'].includes(message.kind), 'Unknown child group kind.');
      const relative = path.relative(directory, message.directory);
      assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Child output is outside the owned run.');
      const row = { ...actual, kind: message.kind, directory: message.directory, members: [actual] };
      assert(!report.owned.some(value => value.pid === row.pid && value.started === row.started), 'Duplicate process registration.');
      report.owned.push(row); log.append({ event: 'registered', identity: row });
      if (cleanup) { await signal(row, 'SIGTERM'); throw new Error('Owner is stopping.'); }
      child.send({ type: 'owned-registration', id: message.id });
    })().catch(error => {
      report.errors.push(normalized(error));
      if (child.connected) child.send({ type: 'owned-registration', id: message.id, error: error.message });
      void stop('registration-failure').catch(failure => report.errors.push(normalized(failure)));
    }).finally(() => registrations.delete(task));
    registrations.add(task);
  });
  async function sample() {
    if (sampling) return;
    sampling = (async () => {
      const value = await storage(output); samples.append({ elapsedMs: performance.now() - began, ...value });
      report.peakStorageBytes = Math.max(report.peakStorageBytes, value.bytes);
      if (value.bytes >= storageBytes) void stop('storage-ceiling').catch(error => report.errors.push(normalized(error)));
    })().catch(error => { report.errors.push(normalized(error)); void stop('storage-observer-failure').catch(failure => report.errors.push(normalized(failure))); });
    try { await sampling; } finally { sampling = null; }
  }
  try {
    const driver = await identity(child.pid); assert(driver && driver.parent === process.pid && driver.group === child.pid);
    report.owned.push({ ...driver, kind: 'driver', directory, members: [driver] });
    await save(path.join(output, 'command.json'), { executable: process.execPath, args: [script, directory, ...args], env });
    log.append({ event: 'started', driver, wallMs, storageBytes });
    timer = setTimeout(() => { void stop('wall-ceiling').catch(error => report.errors.push(normalized(error))); }, Math.max(1, wallMs - (performance.now() - began)));
    diskTimer = setInterval(() => { void sample(); }, 1000);
    processTimer = setInterval(() => { void observeAll().catch(error => {
      report.errors.push(normalized(error)); void stop('process-observer-failure').catch(failure => report.errors.push(normalized(failure)));
    }); }, 100);
    await sample(); report.driverExit = await exited;
    await Promise.allSettled([...registrations]);
    if (cleanup) await cleanup;
    // Even a driver that fails before its finally block must not leave a detached daemon.
    await observeAll();
    if ((await Promise.all(report.owned.filter(row => row.kind !== 'driver').map(groupActive))).some(Boolean)) await stop('driver-left-owned-process');
    report.reason ??= report.driverExit.code === 0 && !interrupted ? 'completed' : 'driver-failure';
  } catch (error) { report.errors.push(normalized(error)); await stop('owner-failure'); }
  finally {
    clearTimeout(timer); clearInterval(diskTimer); clearInterval(processTimer); if (sampling) await sampling; if (observing) await observing;
    await sample(); if (cleanup) await cleanup;
    report.elapsedMs = performance.now() - began;
    report.survivingOwnedProcesses = [];
    for (const row of report.owned) if (await groupActive(row)) report.survivingOwnedProcesses.push(row);
    process.off('SIGINT', sigint); process.off('SIGTERM', sigterm);
    log.append({ event: 'finished', reason: report.reason, survivingOwnedProcesses: report.survivingOwnedProcesses });
    samples.close(); log.close(); await save(path.join(output, 'result.json'), report);
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const name = process.argv[2]; assert(/^[a-z-]+\.mjs$/.test(name ?? ''));
  const report = await supervise({ script: fileURLToPath(new URL(name, import.meta.url)), output: process.argv[3], args: process.argv.slice(4) });
  console.log(JSON.stringify(report, null, 2));
  if (report.reason !== 'completed' || report.errors.length || report.survivingOwnedProcesses.length) process.exitCode = 1;
}
