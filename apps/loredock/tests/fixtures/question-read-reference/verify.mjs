import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { runtimeImports, emitSource, relocateSource } from '../integration-reference/compile.mjs';
const directory = new URL('./', import.meta.url), root = new URL('../../../', import.meta.url);
const hash = text => createHash('sha256').update(text).digest('hex');

export async function verifyQuestionReadDelta(name, compiled = true) {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  const entry = manifest.modules[name], control = await readFile(new URL(name + '.ts.txt', directory), 'utf8');
  assert.equal(hash(control), entry.sourceSha256);
  const emitted = await readFile(new URL(name + '.js.txt', directory), 'utf8');
  assert.equal(hash(emitted), entry.emittedSha256);
  assert.equal(emitSource(control, name + '.ts'), emitted);
  let expected = control;
  for (const { before, after } of entry.edits) {
    assert.equal(expected.split(before).length, 2, name + ': unique permitted delta'); expected = expected.replace(before, after);
  }
  assert.equal(await readFile(new URL('src/' + name + '.ts', root), 'utf8'), expected);
  if (compiled) assert.equal(await readFile(new URL('dist/' + name + '.js', root), 'utf8'), emitSource(expected, name + '.ts'));
  return emitted;
}

export async function loadQuestionReadControl(name, temporaryDirectory) {
  const emitted = await verifyQuestionReadDelta(name);
  const relocations = Object.fromEntries(runtimeImports(emitted).filter(row => row.name.startsWith('.'))
    .map(row => [row.name, new URL('dist/' + row.name.slice(2), root).href]));
  const target = new URL(name + '.mjs', temporaryDirectory);
  await writeFile(target, relocateSource(emitted, relocations), { flag: 'wx' });
  return import(target.href);
}
