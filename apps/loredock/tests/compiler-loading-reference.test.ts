import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createRequire } from 'node:module';
// @ts-expect-error Test-only historical source and exact permitted delta.
import { beforeCompilerLoading, compilerSourcePath, originalCompilerSourceHash } from './fixtures/compiler-loading-reference/verify.mjs';
// @ts-expect-error Existing deterministic test-only emitter.
import { emitSource } from './fixtures/integration-reference/compile.mjs';
import { sha256 } from '../src/extract.js';

test('direct compiler loading preserves the exact historical source pin and complete emitted parser body', async () => {
  const current = await readFile(new URL('../src/code-typescript.ts', import.meta.url));
  const original = await beforeCompilerLoading(compilerSourcePath, current) as Buffer;
  assert.equal(sha256(original), originalCompilerSourceHash); assert.notEqual(sha256(current), originalCompilerSourceHash);
  const oldEmitted = emitSource(original.toString(), compilerSourcePath) as string;
  const newEmitted = emitSource(current.toString(), compilerSourcePath) as string;
  assert.ok(oldEmitted.includes('const identifier =') && newEmitted.includes('const identifier ='));
  assert.equal(newEmitted.slice(newEmitted.indexOf('const identifier =')), oldEmitted.slice(oldEmitted.indexOf('const identifier =')));
  const compiler = createRequire(new URL('../src/code-typescript.ts', import.meta.url)).resolve('typescript');
  assert.equal(sha256(await readFile(compiler)), sha256(await readFile(new URL('../node_modules/typescript/lib/typescript.js', import.meta.url))));
});

test('historical compiler resolution rejects parser or loading changes beyond the exact admitted delta', async () => {
  const current = await readFile(new URL('../src/code-typescript.ts', import.meta.url), 'utf8');
  for (const changed of [current.replace("('typescript')", "('different-compiler')"),
    current.replace('all.length >= 12000', 'all.length >= 24000'),
    current.replace('ts.ScriptTarget.Latest', 'ts.ScriptTarget.ES5')]) {
    assert.notEqual(changed, current);
    await assert.rejects(beforeCompilerLoading(compilerSourcePath, Buffer.from(changed)), /Only the explicit compiler loading\/type delta/);
  }
});
