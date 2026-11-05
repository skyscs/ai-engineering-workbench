// Diagnostic attribution only; the raw 100 ms process-tree sampler stays unchanged.
import assert from 'node:assert/strict';
import { readFile, readlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { journal, normalized, save } from '../loredock-prepared-flow/io.mjs';

async function identity(pid) {
  const raw = await readFile('/proc/' + pid + '/stat', 'utf8');
  const fields = raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/);
  assert(fields.length >= 22); return { startedTicks: fields[19], parentPid: Number(fields[1]) };
}
const vanished = error => ['ENOENT', 'ESRCH'].includes(error.code);
export function roles(directory) {
  const log = journal(path.join(directory, 'roles.jsonl')), known = new Map(), errors = [];
  let pending, timer, latest = [];
  const clock = () => ({ now: performance.now(), timeOrigin: performance.timeOrigin, utcMs: Date.now() });
  async function sample() {
    if (pending) return pending;
    pending = (async () => {
      const lines = (await readFile(path.join(directory, 'process-tree.jsonl'), 'utf8')).trim().split('\n');
      const sample = JSON.parse(lines.at(-1)); latest = sample.rows;
      for (const row of latest) {
        if (!row.complete) continue;
        const key = row.pid + '-' + row.startedTicks;
        if (known.has(key)) continue;
        assert(known.size < 256, 'Diagnostic process identity cap exceeded.');
        try {
          const before = await identity(row.pid);
          if (before.startedTicks !== row.startedTicks || before.parentPid !== row.parentPid) continue;
          const argv = (await readFile('/proc/' + row.pid + '/cmdline')).toString().split('\0').filter(Boolean);
          const executable = await readlink('/proc/' + row.pid + '/exe'), after = await identity(row.pid);
          if (JSON.stringify(before) !== JSON.stringify(after)) continue;
          const value = { pid: row.pid, ...before, argv, executable,
            type: argv.find(arg => arg.startsWith('--type='))?.slice(7) ?? 'root-or-helper',
            utility: argv.find(arg => arg.startsWith('--utility-sub-type='))?.slice(19) ?? null };
          known.set(key, value); log.append({ event: 'role', ...clock(), sampleAt: sample.at, value });
        } catch (error) {
          if (!vanished(error)) throw error;
          log.append({ event: 'vanished-before-role', ...clock(), pid: row.pid, startedTicks: row.startedTicks });
        }
      }
    })().catch(error => { errors.push(normalized(error)); }).finally(() => { pending = undefined; });
    return pending;
  }
  log.append({ event: 'started-after-page-readiness', ...clock(), diagnosticOnly: true });
  timer = setInterval(() => { void sample(); }, 500); timer.unref();
  return { sample, mark(name) { log.append({ event: 'phase', name, ...clock() }); },
    async stop() {
      clearInterval(timer); await pending; await sample(); const proportional = [];
      for (const row of latest) {
        if (!row.complete) continue;
        try {
          const before = await identity(row.pid);
          if (before.startedTicks !== row.startedTicks || before.parentPid !== row.parentPid) continue;
          const raw = await readFile('/proc/' + row.pid + '/smaps_rollup', 'utf8'), after = await identity(row.pid);
          if (JSON.stringify(before) !== JSON.stringify(after)) continue;
          const value = { pid: row.pid, ...before, rssBytes: Number(raw.match(/^Rss:\s+(\d+) kB$/m)?.[1]) * 1024,
            pssBytes: Number(raw.match(/^Pss:\s+(\d+) kB$/m)?.[1]) * 1024 };
          assert(Number.isFinite(value.rssBytes) && Number.isFinite(value.pssBytes));
          await writeFile(path.join(directory, 'smaps-' + row.pid + '-' + row.startedTicks + '.txt'), raw, { flag: 'wx' });
          proportional.push(value);
        } catch (error) {
          if (!vanished(error)) errors.push(normalized(error));
          log.append({ event: 'terminal-proportional-observation-unavailable', ...clock(), pid: row.pid, error: normalized(error) });
        }
      }
      const result = { roles: [...known.values()], proportional, errors, resourceQualification: false };
      await save(path.join(directory, 'roles-result.json'), result); log.append({ event: 'finished', ...clock() }); log.close(); return result;
    } };
}
