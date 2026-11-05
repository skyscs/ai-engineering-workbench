import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hash } from '../loredock-native-assessment/schema.mjs';
import { directCompilerDependency } from '../loredock-cold-start/compiler-import.mjs';

// Record the actual compiled application closure and TypeScript payload. This is
// runtime identity, not a source-file substitute or a complete OS provenance claim.
export async function runtimeIdentity() {
  const directory = fileURLToPath(new URL('../../apps/loredock/dist/', import.meta.url));
  const pending = ['catalog.js', 'store.js', 'git.js', 'code-analysis.js', 'code-paths-v2.js', 'native-capture.js', 'operation-budget.js'];
  const modules = {}, external = new Set();
  while (pending.length) {
    const file = pending.pop(); if (Object.hasOwn(modules, file)) continue;
    assert.ok(/^[a-z0-9-]+\.js$/.test(file)); const raw = await readFile(path.join(directory, file)); modules[file] = hash(raw);
    const code = raw.toString('utf8');
    for (const match of code.matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
      const name = match[1];
      if (name.startsWith('./')) { assert.ok(name.endsWith('.js')); pending.push(name.slice(2)); }
      else if (!name.startsWith('node:')) external.add(name);
    }
    if (file === 'code-typescript.js' && !external.has('typescript')) external.add(directCompilerDependency(code));
  }
  // The closure's only external runtime code is TypeScript, also read by the
  // production analysis fingerprint. Fail if a future integration adds another.
  assert.deepEqual([...external].sort(), ['typescript']);
  const require = createRequire(path.join(directory, 'code-analysis-facts.js')), parser = await readFile(require.resolve('typescript'));
  return { node: process.version, v8: process.versions.v8, modules: Object.fromEntries(Object.entries(modules).sort()), typescript: hash(parser) };
}
