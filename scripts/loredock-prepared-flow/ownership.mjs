// Linux process identity prevents a stale PID from becoming termination authority.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

export async function identity(pid) {
  assert(Number.isSafeInteger(pid) && pid > 1);
  try {
    const text = await readFile(`/proc/${pid}/stat`, 'utf8'), fields = text.slice(text.lastIndexOf(')') + 2).trim().split(/\s+/);
    return { pid, state: fields[0], parent: Number(fields[1]), group: Number(fields[2]), started: fields[19] };
  } catch (error) { if (['ENOENT', 'ESRCH'].includes(error.code)) return null; throw error; }
}
export const sameProcess = (expected, actual) => Boolean(expected && actual && expected.pid === actual.pid && expected.started === actual.started && expected.group === actual.group);

export async function groupMembers(group) {
  const found = [], names = (await readdir('/proc')).filter(name => /^[1-9][0-9]+$/.test(name));
  // Bound simultaneous proc reads even on a host with many unrelated processes.
  for (let offset = 0; offset < names.length; offset += 32) {
    for (const row of await Promise.all(names.slice(offset, offset + 32).map(name => identity(Number(name)))))
      if (row?.group === group && !['Z', 'X'].includes(row.state)) found.push(row);
  }
  return found;
}

export async function registerOwnedProcess(child, directory, kind) {
  if (process.env.AEW_FLOW_SUPERVISED !== '1') return;
  assert(process.send && process.connected, 'A supervised driver requires its owner IPC channel.');
  const current = await identity(child.pid); assert(current && current.parent === process.pid && current.group === child.pid);
  const id = randomUUID();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error('Owned process registration timed out.')), 5000);
    const onMessage = message => {
      if (message.type !== 'owned-registration' || message.id !== id) return;
      done(message.error ? new Error(message.error) : null);
    };
    function done(error) { clearTimeout(timer); process.off('message', onMessage); error ? reject(error) : resolve(); }
    process.on('message', onMessage);
    process.send({ type: 'owned-register', id, identity: current, directory, kind }, error => { if (error) done(error); });
  });
}
