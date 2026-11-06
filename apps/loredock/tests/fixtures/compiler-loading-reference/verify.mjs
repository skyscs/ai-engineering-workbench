import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { emitSource } from '../integration-reference/compile.mjs';
import { beforeAsyncLegacy } from '../async-legacy-reference/verify.mjs';

export const compilerSourcePath = 'apps/loredock/src/code-typescript.ts';
export const originalCompilerSourceHash = '773a8ced3b8e304c7d306fa9a91e060ce7da7194ebcde5a4ccb5aa12f9c1a5ad';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

/** Historical test inputs keep their original bytes; only this exact loading/type delta is permitted. */
export async function beforeCompilerLoading(file, bytes) {
  return beforeCompilerLoadingDelta(file, await beforeAsyncLegacy(file, bytes));
}

/** Compose after newer deltas have already been independently verified and unwound. */
export async function beforeCompilerLoadingDelta(file, bytes) {
  if (file === 'apps/loredock/dist/code-typescript.js') {
    const source = await readFile(new URL('../../../src/code-typescript.ts', import.meta.url));
    const originalSource = await beforeCompilerLoading(compilerSourcePath, source);
    const original = await readFile(new URL('./code-typescript.js.txt', import.meta.url));
    assert.equal(hash(original), 'bed4a32a30f629aec58f02ae4e0284cde053d318b39046fcde54d6640a6772b9');
    assert.equal(emitSource(originalSource.toString(), compilerSourcePath), original.toString());
    assert.equal(emitSource(source.toString(), compilerSourcePath), bytes.toString());
    return original;
  }
  if (file !== compilerSourcePath) return bytes;
  const original = await readFile(new URL('./code-typescript.ts.txt', import.meta.url));
  assert.equal(hash(original), originalCompilerSourceHash);
  let expected = original.toString().replace("import ts from 'typescript';",
    "// Load the CommonJS compiler directly; ESM namespace discovery adds cold-start work.\nimport { createRequire } from 'node:module';\nimport type * as TypeScript from 'typescript';");
  expected = expected.replace('const identifier =', "const ts: typeof TypeScript = createRequire(import.meta.url)('typescript');\nconst identifier =");
  for (const name of ['BindingName', 'Block', 'ConciseBody', 'Diagnostic', 'Expression', 'Node', 'PropertyName', 'SourceFile'])
    expected = expected.replaceAll('ts.' + name, 'TypeScript.' + name);
  assert.equal(bytes.toString(), expected, 'Only the explicit compiler loading/type delta is permitted.');
  return original;
}
