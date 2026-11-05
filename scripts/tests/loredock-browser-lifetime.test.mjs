import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const collector = fileURLToPath(new URL('../loredock-prepared-flow/browser-lifetime.py', import.meta.url));
const ownerModule = fileURLToPath(new URL('../loredock-prepared-flow/kernel-owner.py', import.meta.url));
function start(args, root) {
  const descriptors = ['stdout', 'stderr'].map(name => openSync(path.join(root, name + '.log'), 'wx', 0o600));
  const child = spawn('python3', args, { stdio: ['ignore', ...descriptors], env: { PATH: process.env.PATH, LC_ALL: 'C' } });
  descriptors.forEach(closeSync);
  const exit = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); });
  return { child, exit };
}

for (const failed of [false, true]) test(`browser collector retains an adopted child after ${failed ? 'failed' : 'normal'} browser exit`, { timeout: 25000 }, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-browser-lifetime-'));
  t.diagnostic('Retained browser-lifetime test: ' + root);
  const output = path.join(root, 'lifetime'), ready = path.join(root, 'leaf.json');
  const leaf = `const fs=require('node:fs');const retained=Buffer.alloc(24*1024*1024,67);
    ${failed ? "process.on('SIGTERM',()=>{});" : ''}
    fs.writeFileSync(${JSON.stringify(ready)},JSON.stringify({pid:process.pid}));setInterval(()=>{if(retained[0]!==67)throw Error('Lost memory');},1000);`;
  const driver = `const {spawn}=require('node:child_process');const fs=require('node:fs');
    const child=spawn(process.execPath,['-e',${JSON.stringify(leaf)}],{detached:true,stdio:'ignore'});child.unref();
    const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(ready)})){clearInterval(timer);process.exit(${failed ? 7 : 0});}},10);`;
  const run = start(['-I', '-S', '-B', collector, '--executable', process.execPath, '--output', output, '--parent-pid', String(process.pid), '--grace-ms', '200', '--', '-e', driver], root);
  t.after(async () => { if (run.child.exitCode === null && run.child.signalCode === null) { run.child.kill('SIGTERM'); await run.exit; } });
  assert.deepEqual(await run.exit, { code: failed ? 1 : 0, signal: null });
  const report = JSON.parse(await readFile(path.join(output, 'result.json'), 'utf8'));
  const pid = JSON.parse(await readFile(ready, 'utf8')).pid;
  assert.equal(report.role, 'browser-lifetime-collector'); assert.equal(report.subreaper, true);
  assert.equal(report.globalLimitsOwner, 'external-evaluation-watchdog');
  assert.equal(report.reason, failed ? 'browser-failure' : 'completed');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.survivors, []);
  assert.equal(report.driverExit.exit, failed ? 7 : 0);
  assert(report.remainingAtBrowserExit.some(row => row.pid === pid && row.parent === run.child.pid));
  const reaped = report.reaped.find(row => row.pid === pid);
  assert(reaped); assert.equal(reaped.exit, failed ? -9 : -15);
  assert(reaped.maxRssBytes >= 24 * 1024 * 1024);
});

test('browser collector notices its launcher death and drains descendants before outer cleanup', { timeout: 25000 }, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-browser-lifetime-'));
  t.diagnostic('Retained browser-lifetime test: ' + root);
  const output = path.join(root, 'lifetime'), probe = path.join(root, 'probe.py');
  const browser = `require('node:fs').writeFileSync(${JSON.stringify(path.join(root, 'browser-ready'))},'ready');setInterval(()=>{},1000);`;
  const args = ['-I', '-S', '-B', collector, '--executable', process.execPath, '--output', output, '--grace-ms', '200'];
  const launcher = `const{spawn}=require('node:child_process');const fs=require('node:fs');
    const child=spawn('python3',[...${JSON.stringify(args)},'--parent-pid',String(process.pid),'--','-e',${JSON.stringify(browser)}],{detached:true,stdio:'ignore'});child.unref();
    const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(path.join(root, 'browser-ready'))})){clearInterval(timer);process.exit(0);}},10);`;
  await writeFile(probe, `import importlib.util,json,subprocess,time,types
from pathlib import Path
spec=importlib.util.spec_from_file_location('kernel',${JSON.stringify(ownerModule)})
kernel=importlib.util.module_from_spec(spec);spec.loader.exec_module(kernel)
root=Path(${JSON.stringify(root)});outer=root/'outer';outer.mkdir()
owner=kernel.Owner(types.SimpleNamespace(output=outer,wall_ms=15000,storage_bytes=2147483648,grace_ms=200))
try:
 owner.bootstrap()
 parent=subprocess.Popen([${JSON.stringify(process.execPath)},'-e',${JSON.stringify(launcher)}],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 stdout,stderr=parent.communicate(timeout=5)
 (root/'launcher-stdout.log').write_bytes(stdout);(root/'launcher-stderr.log').write_bytes(stderr)
 assert parent.returncode==0
 result=Path(${JSON.stringify(path.join(output, 'result.json'))})
 deadline=time.monotonic()+10
 while not result.exists():
  assert time.monotonic()<deadline
  time.sleep(0.025)
 report=json.loads(result.read_text())
 assert report['reason']=='parent-exited' and not report['errors'] and not report['survivors']
 assert report['driverExit']['exit']==-15
 deadline=time.monotonic()+5
 while owner.descendants():
  owner.reap();assert time.monotonic()<deadline;time.sleep(0.025)
 owner.reap();assert len(owner.report['reaped'])==1 and owner.report['reaped'][0]['exit']==1
 kernel.save(outer/'result.json',owner.report)
finally:
 owner.cleanup();owner.log.close();owner.samples.close()
`);
  const run = start(['-I', '-S', '-B', probe], root);
  t.after(async () => { if (run.child.exitCode === null && run.child.signalCode === null) { run.child.kill('SIGTERM'); await run.exit; } });
  assert.deepEqual(await run.exit, { code: 0, signal: null });
});

test('browser collector refuses to launch after its declared parent has already disappeared', { timeout: 15000 }, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'loredock-browser-lifetime-'));
  t.diagnostic('Retained browser-lifetime test: ' + root);
  const output = path.join(root, 'lifetime');
  const run = start(['-I', '-S', '-B', collector, '--executable', process.execPath, '--output', output,
    '--parent-pid', '1', '--grace-ms', '200', '--', '-e', "throw Error('This browser must not launch');"], root);
  assert.deepEqual(await run.exit, { code: 1, signal: null });
  const report = JSON.parse(await readFile(path.join(output, 'result.json'), 'utf8'));
  assert.equal(report.reason, 'parent-exited-before-launch');
  assert.equal(report.driverExit, null); assert.deepEqual(report.reaped, []);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.survivors, []);
  assert.deepEqual(report.owned, []);
});
