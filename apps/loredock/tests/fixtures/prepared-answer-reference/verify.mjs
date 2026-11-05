import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { emitSource, runtimeImports, relocateSource } from '../integration-reference/compile.mjs';
const directory = new URL('./', import.meta.url), root = new URL('../../../', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');

export async function verifyPreparedAnswerDelta(name, compiled = true) {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  const delta = JSON.parse(await readFile(new URL('deltas.json', directory), 'utf8')).modules[name], entry = manifest.modules[name];
  const source = await readFile(new URL(name + '.ts.txt', directory), 'utf8'), emitted = await readFile(new URL(name + '.js.txt', directory), 'utf8');
  assert.equal(hash(source), entry.sourceSha256); assert.equal(hash(source), delta.beforeSha256);
  assert.equal(hash(emitted), entry.emittedSha256); assert.equal(emitSource(source, name + '.ts'), emitted);
  const lines = source.match(/.*\n|.+$/g) ?? [];
  for (const edit of [...delta.edits].reverse()) lines.splice(edit.start, edit.delete, ...edit.insert);
  const expected = lines.join(''); assert.equal(hash(expected), delta.afterSha256);
  assert.equal(await readFile(new URL('src/' + name + '.ts', root), 'utf8'), expected);
  if (compiled) assert.equal(await readFile(new URL('dist/' + name + '.js', root), 'utf8'), emitSource(expected, name + '.ts'));
  return { source, emitted };
}
export async function beforePreparedAnswer(file, raw, compiled = true) {
  const match = /^apps\/loredock\/(src|dist)\/(answers|question-preparation|question-witness|answer-witness-store|index)\.(ts|js)$/.exec(file);
  if (!match) return raw;
  const value = await verifyPreparedAnswerDelta(match[2], compiled);
  assert.equal(raw.toString(), await readFile(new URL(match[1] + '/' + match[2] + '.' + match[3], root), 'utf8'));
  return Buffer.from(match[1] === 'src' ? value.source : value.emitted);
}
/** Actual accepted old Answers behavior; relocation does not alter its implementation. */
export async function loadPreparedAnswerControl(folder) {
  const { emitted } = await verifyPreparedAnswerDelta('answers');
  const relocations = Object.fromEntries(runtimeImports(emitted).filter(row => row.name.startsWith('.'))
    .map(row => [row.name, new URL('dist/' + row.name.slice(2), root).href]));
  let value = relocateSource(emitted, relocations);
  assert.equal(value.split("'@aew/ai'").length, 2);
  value = value.replace("'@aew/ai'", JSON.stringify(import.meta.resolve('@aew/ai')));
  const target = pathToFileURL(folder + '/accepted-answers.mjs'); await writeFile(target, value, { flag: 'wx' });
  return import(target.href);
}
