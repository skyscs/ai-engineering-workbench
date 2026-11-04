import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadPriorRuntime, verifyPriorRuntime, priorDirectory } from '../../apps/loredock/tests/fixtures/native-before-analysis-writes/load.mjs';

test('actual archived compiled services reproduce their prior fingerprint without current source or build output', async () => {
  const { manifest, services } = await loadPriorRuntime();
  assert.equal(manifest.fingerprint, '582e7b79b510b091ed2b73494b485f495aa8eecd7c6033c7c5588adf0622acdc');
  assert.equal(Object.keys(services).length, 7); assert.ok(Object.values(services).every(value => typeof value === 'function'));
});

test('archive integrity rejects changed emitted bytes and changed identity before loading code', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'native-old-integrity-')); t.after(() => rm(root, { recursive: true, force: true }));
  await cp(priorDirectory, root, { recursive: true }); const directory = pathToFileURL(root + path.sep);
  const file = path.join(root, 'runtime', 'code-analysis.js'), original = await readFile(file);
  await writeFile(file, Buffer.concat([original, Buffer.from('\n// changed copy\n')]));
  await assert.rejects(verifyPriorRuntime(directory), /Preserved runtime bytes changed/); await writeFile(file, original);
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'))); manifest.fingerprint = '0'.repeat(64);
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest)); await assert.rejects(verifyPriorRuntime(directory));
});

test('prior compiled runtime loads in a plain process with unrelated cwd and no Git executable', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'native-old-process-')); t.after(() => rm(root, { recursive: true, force: true }));
  const script = `import {loadPriorRuntime} from ${JSON.stringify(new URL('load.mjs', priorDirectory).href)};
    const {manifest}=await loadPriorRuntime(); console.log(manifest.fingerprint);`;
  const result = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', script], { cwd: root, env: { PATH: '/nonexistent', LC_ALL: 'C' }, timeout: 30000 });
  assert.equal(result.stdout.trim(), '582e7b79b510b091ed2b73494b485f495aa8eecd7c6033c7c5588adf0622acdc');
});
