import assert from 'node:assert/strict';
import { beforePreparedAnswer } from '../prepared-answer-reference/verify.mjs';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { runtimeImports, emitSource, relocateSource } from '../integration-reference/compile.mjs';
const directory = new URL('./', import.meta.url), root = new URL('../../../', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');

export async function verifyAnswerStorageDelta(name, compiled = true) {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8')), entry = manifest.modules[name];
  const source = await readFile(new URL(name + '.ts.txt', directory), 'utf8'), emitted = await readFile(new URL(name + '.js.txt', directory), 'utf8');
  assert.equal(hash(source), entry.sourceSha256); assert.equal(hash(emitted), entry.emittedSha256);
  assert.equal(emitSource(source, name + '.ts'), emitted);
  let expected = source;
  for (const { before, after } of entry.edits) { assert.equal(expected.split(before).length, 2); expected = expected.replace(before, after); }
  const currentSource = await readFile(new URL('src/' + name + '.ts', root));
  assert.equal((await beforePreparedAnswer('apps/loredock/src/' + name + '.ts', currentSource, compiled)).toString(), expected);
  if (compiled) {
    const currentEmitted = await readFile(new URL('dist/' + name + '.js', root));
    assert.equal((await beforePreparedAnswer('apps/loredock/dist/' + name + '.js', currentEmitted)).toString(), emitSource(expected, name + '.ts'));
  }
  return { source, emitted };
}

/** Prove only the explicit new deltas, then compare untouched historical pins. */
export async function beforeAnswerStorage(file, raw, compiled = true) {
  const match = /^apps\/loredock\/(src|dist)\/(store|answers)\.(ts|js)$/.exec(file);
  if (!match) return beforePreparedAnswer(file, raw, compiled);
  const value = await verifyAnswerStorageDelta(match[2], compiled);
  assert.equal(raw.toString(), await readFile(new URL((match[1] === 'src' ? 'src/' : 'dist/') + match[2] + '.' + match[3], root), 'utf8'));
  return Buffer.from(match[1] === 'src' ? value.source : value.emitted);
}

export async function loadAnswerStorageControl(name, temporaryDirectory) {
  const { emitted } = await verifyAnswerStorageDelta(name);
  const relocations = Object.fromEntries(runtimeImports(emitted).filter(row => row.name.startsWith('.'))
    .map(row => [row.name, new URL('dist/' + row.name.slice(2), root).href]));
  const target = new URL(name + '.mjs', temporaryDirectory);
  await writeFile(target, relocateSource(emitted, relocations), { flag: 'wx' });
  return import(target.href);
}
