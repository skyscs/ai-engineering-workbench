import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { emitSource, runtimeImports, relocateSource } from '../integration-reference/compile.mjs';

const directory = new URL('./', import.meta.url), root = new URL('../../../../../', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
async function original(file) {
  const manifest = JSON.parse(await readFile(new URL('./manifest.json', directory), 'utf8'));
  const entry = manifest.files[file]; if (!entry) return null;
  const raw = await readFile(new URL(entry.fixture, directory));
  assert.equal(raw.length, entry.bytes); assert.equal(hash(raw), entry.sha256); return raw;
}
export async function beforeNativeFormat(file, raw) {
  const old = await original(file); if (!old) return raw;
  const sourceFile = file.replace('/dist/', '/src/').replace(/\.js$/, '.ts');
  const source = await original(sourceFile), delta = JSON.parse(await readFile(new URL('./deltas.json', directory), 'utf8')).files[sourceFile];
  assert.equal(hash(source), delta.beforeSha256);
  const lines = source.toString().match(/.*\n|.+$/g) ?? [];
  for (const edit of [...delta.edits].reverse()) lines.splice(edit.start, edit.delete, ...edit.insert);
  const expected = lines.join(''); assert.equal(hash(expected), delta.afterSha256);
  assert.equal(await readFile(new URL(sourceFile, root), 'utf8'), expected, 'Only the declared versioned-format delta is permitted: ' + sourceFile);
  if (sourceFile === file) assert.equal(raw.toString(), expected);
  else {
    assert.equal(emitSource(source.toString(), sourceFile), old.toString());
    assert.equal(emitSource(expected, sourceFile), raw.toString());
  }
  return old;
}

/** Execute the exact accepted v1 serializer with its exact v1 version constants. */
export async function loadNativeV1Control(folder) {
  const file = 'apps/loredock/dist/question-context.js';
  const emitted = await beforeNativeFormat(file, await readFile(new URL(file, root)));
  const versions = pathToFileURL(folder + '/v1-types.mjs');
  await writeFile(versions, await original('apps/loredock/dist/question-preparation-types.js'), { flag: 'wx' });
  const relocations = Object.fromEntries(runtimeImports(emitted.toString()).map(row => {
    assert(row.name.startsWith('.'));
    return [row.name, row.name === './question-preparation-types.js' ? versions.href : new URL('apps/loredock/dist/' + row.name.slice(2), root).href];
  }));
  const target = pathToFileURL(folder + '/v1-context.mjs');
  await writeFile(target, relocateSource(emitted.toString(), relocations), { flag: 'wx' });
  return import(target.href);
}
