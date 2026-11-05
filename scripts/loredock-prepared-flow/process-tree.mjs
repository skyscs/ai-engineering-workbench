// Linux passive observation only. Process termination belongs to the external owner.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

async function identity(pid) {
  const raw = await readFile(`/proc/${pid}/stat`, 'utf8');
  const fields = raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/);
  assert(fields.length >= 22, 'Incomplete process stat.');
  return { state: fields[0], parentPid: Number(fields[1]), startedTicks: fields[19],
    userTicks: fields[11], systemTicks: fields[12] };
}
const vanished = error => error.code === 'ENOENT' || error.code === 'ESRCH';

export async function sampleProcessTree(pid, expectedRootStartedTicks) {
  assert(Number.isSafeInteger(pid) && pid > 0);
  const began = performance.now(), rows = [], pending = [{ pid }], seen = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (seen.has(current.pid)) continue;
    seen.add(current.pid);
    const row = { ...current, complete: false, issues: [] };
    rows.push(row);
    try {
      const before = await identity(current.pid);
      Object.assign(row, before);
      if (current.pid === pid && expectedRootStartedTicks !== undefined && before.startedTicks !== expectedRootStartedTicks) {
        row.issues.push({ kind: 'root-identity-changed' }); continue;
      }
      if (current.discoveredFrom) {
        const parent = await identity(current.discoveredFrom.pid);
        if (before.parentPid !== current.discoveredFrom.pid || parent.startedTicks !== current.discoveredFrom.startedTicks) {
          row.issues.push({ kind: 'ancestry-changed' }); continue;
        }
      }
      const status = await readFile(`/proc/${current.pid}/status`, 'utf8');
      const rss = status.match(/^VmRSS:\s+(\d+)/m), highWater = status.match(/^VmHWM:\s+(\d+)/m);
      if ((!rss || !highWater) && !['Z', 'X'].includes(before.state)) row.issues.push({ kind: 'resident-memory-unavailable' });
      const threads = (await readdir(`/proc/${current.pid}/task`)).map(Number).sort((a, b) => a - b);
      row.threadChildren = [];
      for (const tid of threads) {
        try {
          const raw = await readFile(`/proc/${current.pid}/task/${tid}/children`, 'utf8');
          const children = raw.trim().split(/\s+/).filter(Boolean).map(Number);
          assert(children.every(child => Number.isSafeInteger(child) && child > 0));
          row.threadChildren.push({ tid, children });
        } catch (error) {
          if (!vanished(error)) throw error;
          row.issues.push({ kind: 'thread-exited-during-sample', tid });
        }
      }
      const after = await identity(current.pid);
      if (before.startedTicks !== after.startedTicks || before.parentPid !== after.parentPid) {
        row.issues.push({ kind: 'identity-or-parent-changed' }); continue;
      }
      row.rssBytes = Number(rss?.[1] ?? 0) * 1024;
      row.highWaterRssBytes = Number(highWater?.[1] ?? 0) * 1024;
      row.complete = row.issues.length === 0;
      for (const thread of row.threadChildren) for (const child of thread.children) pending.push({ pid: child,
        discoveredFrom: { pid: current.pid, startedTicks: before.startedTicks, tid: thread.tid } });
    } catch (error) {
      if (!vanished(error)) throw error;
      row.issues.push({ kind: 'process-exited-during-sample' });
    }
  }
  return { began, at: performance.now(), rows, complete: rows.every(row => row.complete),
    rssBytes: rows.reduce((sum, row) => sum + (row.rssBytes ?? 0), 0),
    cpuUnits: 'Raw process clock ticks; retain CLK_TCK in the execution environment seal.',
    limitations: 'Sequential sampled live ancestry, not an atomic census or a continuous bound. Exited or reparented descendants can escape a sample.' };
}
