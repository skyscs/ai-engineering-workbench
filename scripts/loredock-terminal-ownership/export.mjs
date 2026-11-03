import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { writeHeapSnapshot } from 'node:v8';
import { limitsFor, pinnedRuntime } from './limits.mjs';

// Invoke only in a supervised owned worker, after ordinary application operations.
export async function createTerminalExporter(root, reduced) {
  pinnedRuntime(); const limits = limitsFor(reduced);
  assert.ok(path.isAbsolute(root) && await realpath(root) === root && (await lstat(root)).isDirectory());
  // The launcher installs a hard per-file limit before exec, including native V8 writes.
  const processLimits = await import('node:fs/promises').then(fs => fs.readFile('/proc/self/limits', 'utf8'));
  const fileLimit = /^Max file size\s+(\d+)\s+(\d+)\s+bytes[ \t]*$/m.exec(processLimits);
  assert.ok(fileLimit && Number(fileLimit[1]) <= limits.fileBytes && Number(fileLimit[2]) <= limits.fileBytes,
    'A finite hard file-size limit must be installed by the parent.');
  const stages = ['after-history', 'after-release']; let next = 0;
  return async stage => {
    assert.ok(next < stages.length && typeof stage === 'string', 'Only two named terminal exports are allowed.');
    assert.equal(stage, stages[next], 'Export each terminal stage exactly once in order.'); next++;
    const file = stage + '.heapsnapshot', target = path.join(root, file);
    try { await lstat(target); assert.fail('Never overwrite an existing snapshot.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const before = process.memoryUsage(), began = performance.now();
    writeHeapSnapshot(target);
    const after = process.memoryUsage(), wallMs = performance.now() - began, info = await lstat(target);
    assert.ok(info.isFile() && !info.isSymbolicLink() && info.size > 0 && info.size <= limits.fileBytes);
    const digest = createHash('sha256'); for await (const chunk of createReadStream(target)) digest.update(chunk);
    const observation = { stage, file, bytes: info.size, sha256: digest.digest('hex'), before, after, wallMs,
      backendCollection: true, resourceAcceptance: false };
    await writeFile(path.join(root, stage + '.json'), JSON.stringify(observation, null, 2) + '\n', { flag: 'wx' });
    return observation;
  };
}
