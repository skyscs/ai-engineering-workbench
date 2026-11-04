import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { sha256 } from '../src/extract.js';
// @ts-expect-error Existing deterministic test-only compiler/import relocation helper.
import { compilerOptions, emitSource, runtimeImports, relocateSource } from './fixtures/integration-reference/compile.mjs';

const directory = new URL('./fixtures/analysis-write-reference/', import.meta.url), root = new URL('../../../', import.meta.url);
interface Entry {
  source: string; module: string; compiledModule: string; bytes: number; sha256: string; emittedSha256: string;
  moduleSha256: string; compiledModuleSha256: string; relocations: Record<string, string>; compiledRelocations: Record<string, string>;
}
test('analysis write reference preserves independent source, both import variants and dependency closure', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8')) as {
    compiler: { version: string; options: unknown; moduleSha256: string }; sources: Record<string, Entry>;
    dependencies: Record<string, string>; externalImports: string[]; fingerprintContext: string;
  };
  assert.equal(ts.version, manifest.compiler.version); assert.deepEqual(compilerOptions, manifest.compiler.options);
  assert.equal(sha256(await readFile(new URL('../node_modules/typescript/lib/typescript.js', import.meta.url))), manifest.compiler.moduleSha256);
  const visited = new Set<string>(), external = new Set<string>(), dependencies: Record<string, string> = {};
  async function visit(file: string) {
    if (visited.has(file)) return; visited.add(file);
    const record = manifest.sources[file], raw = await readFile(record ? new URL(record.source, directory) : new URL(file, root));
    if (!record) dependencies[file] = sha256(raw);
    for (const { name } of runtimeImports(emitSource(raw.toString(), file)) as { name: string }[]) {
      if (name.startsWith('.')) await visit(path.posix.normalize(path.posix.join(path.posix.dirname(file), name.replace(/\.js$/, '.ts'))));
      else external.add(name);
    }
  }
  for (const [file, entry] of Object.entries(manifest.sources)) {
    const raw = await readFile(new URL(entry.source, directory)), emitted = emitSource(raw.toString(), file) as string;
    assert.equal(raw.length, entry.bytes); assert.equal(sha256(raw), entry.sha256); assert.equal(sha256(emitted), entry.emittedSha256);
    for (const [name, relocations, expected] of [[entry.module, entry.relocations, entry.moduleSha256],
      [entry.compiledModule, entry.compiledRelocations, entry.compiledModuleSha256]] as const) {
      const executable = await readFile(new URL(name, directory), 'utf8');
      assert.equal(sha256(executable), expected); assert.equal(relocateSource(emitted, relocations), executable);
    }
    await visit(file);
  }
  assert.deepEqual(dependencies, manifest.dependencies); assert.deepEqual([...external].sort(), manifest.externalImports);
  assert.equal(Object.keys(manifest.sources).length, 2); assert.equal(Object.keys(dependencies).length, 22);
  assert.match(manifest.fingerprintContext, /current production implementation bytes/);
});
