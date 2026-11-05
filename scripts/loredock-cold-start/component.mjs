import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { components } from './plan.mjs';

const id = process.argv[2], output = process.env.AEW_FLOW_OUTPUT;
assert.equal(process.argv.length, 3); assert(components.includes(id)); assert(path.isAbsolute(output ?? ''));
const compiler = new URL('../../apps/loredock/node_modules/typescript/lib/typescript.js', import.meta.url);
const began = performance.now();
let loaded, target = null;
if (id === 'typescript-esm') { target = compiler.href; loaded = (await import(compiler.href)).default; }
if (id === 'typescript-require') { target = compiler.href; loaded = createRequire(import.meta.url)(fileURLToPath(compiler)); }
if (id === 'code-adapter') {
  target = new URL('../../apps/loredock/dist/code-typescript.js', import.meta.url).href;
  loaded = await import(target); assert.equal(typeof loaded.typescriptFacts, 'function');
}
if (id === 'http-app') {
  target = new URL('../../apps/loredock/dist/app.js', import.meta.url).href;
  loaded = await import(target); assert.equal(typeof loaded.createApp, 'function');
}
const ended = performance.now();
if (id.startsWith('typescript-')) {
  assert.equal(loaded.version, '5.9.3'); assert.equal(typeof loaded.createSourceFile, 'function');
}
// Let the unchanged passive timer record the import interval before normal process exit.
await delay(100);
await writeFile(path.join(output, 'import.json'), JSON.stringify({ id, target, began, ended, importMs: ended - began,
  compilerVersion: id.startsWith('typescript-') ? loaded.version : null,
  node: process.version, execArgv: process.execArgv, resourceQualification: false }, null, 2) + '\n', { flag: 'wx' });
