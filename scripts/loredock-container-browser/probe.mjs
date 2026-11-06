// Non-browser ownership probes use only freshly created synthetic processes and files.
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const [output, mode] = process.argv.slice(2);
assert.equal(output, '/evidence/owner/run');
assert(['normal', 'orphan', 'interrupt'].includes(mode));
assert.equal(process.versions.node, '22.23.2');
await mkdir(output);
await mkdir(output + '/home'); await mkdir(output + '/tmp');
await writeFile(output + '/runtime.json', JSON.stringify({ node: process.versions, pid: process.pid,
  uid: process.getuid(), gid: process.getgid(), mode }), { flag: 'wx' });
if (mode !== 'normal') {
  const leaf = `const fs=require('node:fs');process.on('SIGTERM',()=>{});fs.writeFileSync(${JSON.stringify(output + '/leaf.json')},JSON.stringify({pid:process.pid}));setInterval(()=>{},1000);`;
  const intermediate = `const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e',${JSON.stringify(leaf)}],{detached:true,stdio:'ignore'});child.unref();`;
  const child = spawn(process.execPath, ['-e', intermediate], { detached: true, stdio: 'ignore' }); child.unref();
  const deadline = performance.now() + 5000;
  while (true) {
    try { await readFile(output + '/leaf.json'); break; }
    catch (error) { if (error.code !== 'ENOENT' || performance.now() >= deadline) throw error; }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  await writeFile(output + '/ready', 'ready', { flag: 'wx' });
  if (mode === 'orphan') process.exit(7);
  else setInterval(() => {}, 1000);
}
