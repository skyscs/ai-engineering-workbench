import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const modulePath = fileURLToPath(new URL('../loredock-prepared-flow/kernel-owner.py', import.meta.url));
const cwd = fileURLToPath(new URL('../../', import.meta.url));
async function until(fn, message) {
  const deadline = performance.now() + 15000;
  while (performance.now() < deadline) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 25)); }
  throw new Error(message);
}
async function exists(file) { try { await readFile(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
function processToFiles(command, args, root) {
  const descriptors = ['stdout', 'stderr'].map(name => openSync(path.join(root, name + '.log'), 'wx', 0o600));
  const child = spawn(command, args, { stdio: ['ignore', ...descriptors], env: { PATH: process.env.PATH, LC_ALL: 'C' } });
  descriptors.forEach(closeSync);
  const exit = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); });
  return { child, exit };
}
function assertEmpty(result) { assert.equal(result.subreaper, true); assert.deepEqual(result.errors, []); assert.deepEqual(result.survivors, []); }

test('kernel adoption finds a detached orphan first observed after its parent exit', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-kernel-adoption-')); t.diagnostic('Retained kernel-owner test: ' + root);
  const probe = path.join(root, 'probe.py');
  const childCode = "const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});child.unref();console.log(child.pid);";
  await writeFile(probe, `import importlib.util,json,os,subprocess,types
from pathlib import Path
spec=importlib.util.spec_from_file_location('owned_module',${JSON.stringify(modulePath)})
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
root=Path(${JSON.stringify(root)});output=root/'output';output.mkdir()
owner=module.Owner(types.SimpleNamespace(output=output,wall_ms=10000,storage_bytes=2147483648,grace_ms=200))
try:
 owner.bootstrap()
 parent=subprocess.Popen([${JSON.stringify(process.execPath)},'-e',${JSON.stringify(childCode)}],stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
 stdout,stderr=parent.communicate(timeout=5);(root/'intermediate-stdout.log').write_bytes(stdout);(root/'intermediate-stderr.log').write_bytes(stderr)
 assert parent.returncode==0
 orphan=int(stdout);rows=owner.descendants();row=next(row for row in rows if row['pid']==orphan)
 assert row['parent']==os.getpid() and row['group']==orphan
 owner.cleanup();owner.reap();assert owner.descendants()==[]
 assert any(row['pid']==orphan and row['exit']==-15 for row in owner.report['reaped'])
 module.save(output/'result.json',owner.report)
finally:
 owner.cleanup();owner.log.close();owner.samples.close()
`);
  const { exit } = processToFiles('python3', ['-I', '-S', '-B', probe], root);
  assert.deepEqual(await exit, { code: 0, signal: null });
});

async function exercise(t, mode, options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-kernel-owner-')); t.diagnostic('Retained kernel-owner test: ' + root);
  const script = path.join(root, 'driver.mjs'), output = path.join(root, 'output');
  if (mode === 'normal') { await mkdir(path.join(root, 'outside')); await writeFile(path.join(root, 'outside/retained.bin'), Buffer.alloc(65536, 79)); }
  const leaf = `const fs=require('node:fs');process.on('SIGTERM',()=>{});fs.writeFileSync(${JSON.stringify(path.join(output, 'run/leaf-ready.json'))},JSON.stringify({pid:process.pid}));setInterval(()=>{},1000);`;
  const intermediate = `const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e',${JSON.stringify(leaf)}],{stdio:'ignore',detached:true});child.unref();`;
  await writeFile(script, `import {mkdir,writeFile,readFile,symlink} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const root=process.argv[2];await mkdir(root);await writeFile(root+'/retained-original.txt','Owned source bytes survive.');
await writeFile(root+'/forged-process.json',JSON.stringify({pid:${options.unrelatedPid ?? 1}}));
${mode === 'normal' ? `await symlink(${JSON.stringify(path.join(root, 'outside'))},root+'/outside-link');` : `const child=spawn(process.execPath,['-e',${JSON.stringify(intermediate)}],{stdio:'ignore',detached:true});child.unref();
while(true){try{await readFile(root+'/leaf-ready.json');break;}catch(error){if(error.code!=='ENOENT')throw error;await new Promise(r=>setTimeout(r,10));}}`}
await writeFile(root+'/ready','ready');
${mode === 'failure' ? 'process.exit(7);' : mode === 'normal' ? '' : `${mode === 'storage' ? "await writeFile(root+'/retained-large.bin',Buffer.alloc(65536,65));" : mode === 'catalog-storage' ? "await mkdir(root+'/catalog');await writeFile(root+'/catalog/loredock.db',Buffer.alloc(65536,65));" : ''}setInterval(()=>{},1000);`}
`);
  const args = ['-I', '-S', modulePath, '--node', process.execPath, '--script', script, '--output', output, '--cwd', cwd,
    '--grace-ms', '200', '--wall-ms', String(mode === 'hang' ? 5000 : 15000), '--storage-bytes', String(['normal', 'storage'].includes(mode) ? 32768 : 2147483648)];
  if (mode === 'catalog-storage') args.push('--catalog-root', 'run/catalog', '--catalog-bytes', '32768');
  const owned = processToFiles('python3', args, root);
  let ended = false; owned.exit.then(() => { ended = true; }, () => { ended = true; });
  t.after(async () => { if (!ended) { owned.child.kill('SIGTERM'); await owned.exit; } });
  if (mode === 'interrupt') { await until(() => exists(path.join(output, 'run/ready')), 'Owned child did not become ready.'); owned.child.kill('SIGTERM'); }
  const exit = await owned.exit, result = JSON.parse(await readFile(path.join(output, 'result.json'), 'utf8'));
  assert.equal(await readFile(path.join(output, 'run/retained-original.txt'), 'utf8'), 'Owned source bytes survive.');
  assertEmpty(result); assert.equal(exit.code, mode === 'normal' ? 0 : 1); assert.equal(exit.signal, null);
  if (mode === 'normal') {
    assert(result.peakSampledStorageBytes < 32768, 'Storage sampling must not follow the external directory symlink.');
    assert.equal((await readFile(path.join(root, 'outside/retained.bin'))).length, 65536);
  }
  if (mode !== 'normal') {
    const leaf = JSON.parse(await readFile(path.join(output, 'run/leaf-ready.json'), 'utf8'));
    assert(result.reaped.some(row => row.pid === leaf.pid && row.exit === -9), 'The TERM-resistant orphan must be killed and reaped.');
    const events = (await readFile(path.join(output, 'owner.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert(events.some(row => row.event === 'signal' && row.identity.pid === leaf.pid && row.via === 'pidfd'));
    if (options.unrelatedPid) assert(!events.some(row => row.event === 'signal' && row.identity.pid === options.unrelatedPid));
  }
  return { result, output };
}

test('normal owner completion retains output and reaps its actual driver', async t => {
  const { result } = await exercise(t, 'normal'); assert.equal(result.reason, 'completed'); assert.equal(result.driverExit.exit, 0);
});
test('failed driver cannot abandon a new-session child or authorize an unrelated PID', async t => {
  const sentinel = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
  const exit = new Promise(resolve => sentinel.once('close', resolve)); t.after(async () => { sentinel.kill('SIGTERM'); await exit; });
  const { result } = await exercise(t, 'failure', { unrelatedPid: sentinel.pid });
  assert.equal(result.reason, 'driver-left-owned-process'); assert.equal(result.driverExit.exit, 7);
  assert.equal(sentinel.exitCode, null); process.kill(sentinel.pid, 0);
});
test('wall ceiling drains a stuck driver and TERM-resistant orphan', async t => {
  const { result } = await exercise(t, 'hang'); assert.equal(result.reason, 'wall-ceiling'); assert(result.elapsedMs >= 5000);
});
test('storage ceiling preserves the oversized file while stopping descendants', async t => {
  const { result, output } = await exercise(t, 'storage'); assert.equal(result.reason, 'storage-ceiling');
  assert.equal((await readFile(path.join(output, 'run/retained-large.bin'))).length, 65536); assert(result.peakSampledStorageBytes >= 65536);
});
test('external interruption drains and reaps the kernel-owned process tree', async t => {
  const { result } = await exercise(t, 'interrupt'); assert.equal(result.reason, 'owner-SIGTERM');
});

test('declared catalog ceiling stops descendants without treating the whole output as a catalog', async t => {
  const { result, output } = await exercise(t, 'catalog-storage');
  assert.equal(result.reason, 'catalog-storage-ceiling');
  assert.deepEqual(result.catalogRoots, ['run/catalog']); assert.deepEqual(result.observedCatalogRoots, ['run/catalog']);
  assert.equal(result.peakSampledCatalogBytes['run/catalog'], 65536);
  assert(result.peakSampledStorageBytes < result.limits.storageBytes);
  assert.equal((await readFile(path.join(output, 'run/catalog/loredock.db'))).length, 65536);
});

test('catalog declarations reject escape, duplicate and overlapping roots before creating output', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-kernel-catalog-declarations-'));
  t.diagnostic('Retained catalog-declaration test: ' + root);
  const script = path.join(root, 'driver.mjs'); await writeFile(script, 'throw new Error("Must not execute.");');
  for (const [index, roots] of [['../outside'], ['/outside'], ['run/one', 'run/one'], ['run/one', 'run/one/nested']].entries()) {
    const directory = path.join(root, 'case-' + index), output = path.join(directory, 'output'); await mkdir(directory);
    const run = processToFiles('python3', ['-I', '-S', modulePath, '--node', process.execPath, '--script', script,
      '--output', output, '--cwd', cwd, ...roots.flatMap(value => ['--catalog-root', value])], directory);
    assert.deepEqual(await run.exit, { code: 2, signal: null });
    assert.equal(await exists(path.join(output, 'command.json')), false);
  }
});
