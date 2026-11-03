import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { open, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { limitsFor, pinnedRuntime } from './limits.mjs';
import { createRssObservation } from './rss.mjs';

// Linux-only diagnostic launcher. No user corpus, environment or application entry point.
export async function runOwnedChild({ script, args = [], output, limits: reduced, signal }) {
  pinnedRuntime(); const limits = limitsFor(reduced);
  assert.ok(path.isAbsolute(script) && path.isAbsolute(output));
  assert.ok(args.every(value => typeof value === 'string'));
  await mkdir(output);
  let stdout, stderr;
  const command = ['--fsize=' + limits.fileBytes + ':' + limits.fileBytes, '--', process.execPath, script, output, ...args];
  const result = { schemaVersion: 'loredock-owned-heap-child/1', executable: '/usr/bin/prlimit', args: command,
    node: process.version, v8: process.versions.v8, limits, resourceAcceptance: false, errors: [], samples: 0, peakRssBytes: 0 };
  const began = performance.now(), rssObservation = createRssObservation();
  result.rssObservation = rssObservation.report;
  let child, stopped = false, grace, timer, poll, polling = false, closed = false, exited = false;
  const normalize = error => ({ name: error.name, code: error.code ?? null, message: error.message });
  function kill(signal) {
    if (child?.pid && !closed) try { process.kill(-child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') result.errors.push(normalize(error)); }
  }
  function stop(reason) {
    if (stopped || closed) return; stopped = true; result.stopped = reason; kill('SIGTERM');
    grace = setTimeout(() => kill('SIGKILL'), 1000);
  }
  const abort = () => stop('cancelled');
  try {
    stdout = await open(path.join(output, 'stdout.log'), 'wx'); stderr = await open(path.join(output, 'stderr.log'), 'wx');
    if (signal?.aborted) { result.stopped = 'cancelled'; result.exit = null; result.signal = null; }
    else await new Promise(resolve => {
      child = spawn('/usr/bin/prlimit', command, { cwd: output, detached: true, stdio: ['ignore', stdout.fd, stderr.fd],
        env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' } });
      result.pid = child.pid;
      child.once('error', error => result.errors.push(normalize(error)));
      child.once('exit', () => { exited = true; clearInterval(poll); });
      child.once('close', (exit, signal) => { closed = true; clearTimeout(timer); clearTimeout(grace); clearInterval(poll);
        result.exit = exit; result.signal = signal; resolve(); });
      signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => stop('watchdog'), limits.watchdogMs);
      poll = setInterval(async () => {
        if (polling || closed || exited || stopped || !child.pid) return; polling = true;
        try {
          let status;
          try { status = await readFile(`/proc/${child.pid}/status`, 'utf8'); }
          catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error; status = null; }
          if (closed || exited) return;
          const sample = rssObservation.sample(status, performance.now() - began);
          result.samples = rssObservation.report.samples; result.peakRssBytes = rssObservation.report.peakRssBytes;
          if (sample.overdue) stop('rss-unavailable');
          else if (sample.rss !== null && sample.rss > limits.sampledRssBytes) stop('sampled-rss-limit');
        } catch (error) {
          if (!closed && !exited) { result.errors.push(normalize(error)); stop('observer-error'); }
        } finally { polling = false; }
      }, 10);
    });
  } catch (error) {
    result.errors.push(normalize(error)); result.exit ??= null; result.signal ??= null;
    if (child && !closed) { kill('SIGKILL'); await new Promise(resolve => child.once('close', resolve)); }
  } finally {
    signal?.removeEventListener('abort', abort); clearTimeout(timer); clearTimeout(grace); clearInterval(poll);
    for (const file of [stdout, stderr]) if (file) try { await file.close(); } catch (error) { result.errors.push(normalize(error)); }
    result.wallMs = performance.now() - began;
    rssObservation.finish(result.wallMs);
    result.failed = result.exit !== 0 || result.signal !== null || Boolean(result.stopped) || result.errors.length > 0;
    await writeFile(path.join(output, 'exit.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  }
  return result;
}
