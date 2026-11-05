import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { emitSource } from '../integration-reference/compile.mjs';
const directory = new URL('./', import.meta.url), root = new URL('../../../../../', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
export async function verifyQuestionApiDelta(name, compiled = true) {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  const delta = JSON.parse(await readFile(new URL('deltas.json', directory), 'utf8')).modules[name];
  const browser = name === 'AnswerPanel', source = await readFile(new URL(name + (browser ? '.tsx.txt' : '.ts.txt'), directory), 'utf8');
  assert.equal(hash(source), delta.beforeSha256); assert.equal(hash(source), manifest.existingFiles[delta.file].sha256);
  const lines = source.match(/.*\n|.+$/g) ?? [];
  for (const edit of [...delta.edits].reverse()) lines.splice(edit.start, edit.delete, ...edit.insert);
  const expected = lines.join(''); assert.equal(hash(expected), delta.afterSha256);
  assert.equal(await readFile(new URL(delta.file, root), 'utf8'), expected);
  if (browser) return { source };
  const emitted = await readFile(new URL(name + '.js.txt', directory), 'utf8');
  assert.equal(hash(emitted), manifest.modules[name].emittedSha256); assert.equal(emitSource(source, name + '.ts'), emitted);
  if (compiled) assert.equal(await readFile(new URL('apps/loredock/dist/' + name + '.js', root), 'utf8'), emitSource(expected, name + '.ts'));
  return { source, emitted };
}
export async function beforeQuestionApi(file, raw, compiled = true) {
  const match = /^apps\/loredock\/(src|dist)\/(app|index)\.(ts|js)$/.exec(file);
  const browser = file === 'apps/loredock-web/src/AnswerPanel.tsx';
  if (!match && !browser) return raw;
  const value = await verifyQuestionApiDelta(browser ? 'AnswerPanel' : match[2], compiled);
  assert.equal(raw.toString(), await readFile(new URL(file, root), 'utf8'));
  return Buffer.from(browser || match[1] === 'src' ? value.source : value.emitted);
}
