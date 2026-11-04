import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runtimeIdentity } from '../loredock-native-qualification/runtime.mjs';
export const repository = fileURLToPath(new URL('../../', import.meta.url));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const jsonFile = async relative => JSON.parse(await readFile(path.join(repository, relative), 'utf8'));
export const sealPath = 'fixtures/loredock-native-question-context-run/final-freeze.json';
export async function identity() {
  const core = await runtimeIdentity(), pending = ['answer-context.js', 'answer-prompt.js', 'answer-review.js', 'corrections.js', ...Object.keys(core.modules)];
  const modules = {}, external = new Set(), directory = path.join(repository, 'apps/loredock/dist');
  while (pending.length) {
    const name = pending.pop(); if (modules[name]) continue; assert(/^[a-z0-9-]+\.js$/.test(name));
    const raw = await readFile(path.join(directory, name)); modules[name] = sha256(raw);
    for (const match of raw.toString('utf8').matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
      if (match[1].startsWith('./')) pending.push(match[1].slice(2)); else if (!match[1].startsWith('node:')) external.add(match[1]);
    }
  }
  assert.deepEqual([...external].sort(), ['typescript']);
  const require = createRequire(path.join(directory, 'code-analysis-facts.js'));
  assert.equal(sha256(await readFile(require.resolve('typescript'))), core.typescript);
  return { core, composed: { ...core, modules: Object.fromEntries(Object.entries(modules).sort()) } };
}
export async function verifyFreeze() {
  const frozen = await jsonFile(sealPath), normative = await jsonFile('fixtures/loredock-native-question-context/freeze.json');
  for (const [file, expected] of Object.entries({ ...normative.sourceAudit, ...normative.frozenFiles, ...frozen.files }))
    assert.equal(sha256(await readFile(path.join(repository, file))), expected, 'Changed frozen input: ' + file);
  const runtime = await identity(); assert.deepEqual(runtime, frozen.runtime);
  const control = await jsonFile('fixtures/loredock-native-question-context-run/control/manifest.json');
  assert.deepEqual(runtime.core, control.runtime); assert.equal(frozen.operations, 44); assert.equal(frozen.modelAttempts, 0);
  return { frozen, normative, runtime, sealHash: sha256(await readFile(path.join(repository, sealPath))) };
}
export function vector(corpus) {
  return Object.entries(corpus).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).flatMap(([source, files]) =>
    Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([file, text]) => ({ source, path: file, bytes: Buffer.byteLength(text), sha256: sha256(text) })));
}
