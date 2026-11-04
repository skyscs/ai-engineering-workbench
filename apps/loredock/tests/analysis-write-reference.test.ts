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
  assert.deepEqual(Object.keys(dependencies).sort(), Object.keys(manifest.dependencies).sort());
  for (const [file, originalHash] of Object.entries(manifest.dependencies)) {
    if (file !== 'apps/loredock/src/native-receipt-store.ts') { assert.equal(dependencies[file], originalHash, file); continue; }
    // Task 118 adds only ids(); the old reference never calls it. Preserve the
    // archived pin and prove every other source byte, including imports, unchanged.
    const text = await readFile(new URL(file, root), 'utf8'), source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const declaration = source.statements.find(row => ts.isClassDeclaration(row) && row.name?.text === 'NativeReceiptStore');
    assert.ok(declaration && ts.isClassDeclaration(declaration));
    const additions = declaration.members.filter(row => row.name?.getText(source) === 'ids'); assert.equal(additions.length, 1);
    const addition = additions[0]!; assert.ok(ts.isMethodDeclaration(addition));
    assert.equal(sha256(text.slice(0, addition.getFullStart()) + text.slice(addition.end)), originalHash);
    assert.notEqual(dependencies[file], originalHash);
  }
  assert.deepEqual([...external].sort(), manifest.externalImports);
  assert.equal(Object.keys(manifest.sources).length, 2); assert.equal(Object.keys(dependencies).length, 22);
  assert.match(manifest.fingerprintContext, /current production implementation bytes/);
});
