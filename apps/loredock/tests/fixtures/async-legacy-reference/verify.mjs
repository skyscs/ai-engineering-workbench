import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { emitSource, runtimeImports, relocateSource } from '../integration-reference/compile.mjs';

const directory = new URL('./', import.meta.url), root = new URL('../../../../../', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
async function original(manifest, file) {
  const entry = manifest.files[file]; if (!entry) return null;
  const raw = await readFile(new URL(entry.fixture, directory));
  assert.equal(raw.length, entry.bytes); assert.equal(hash(raw), entry.sha256); return raw;
}

/** Unwind only the reviewed await/authority delta; historical manifests and observations stay exact. */
export async function beforeAsyncLegacy(file, raw, compiled = file.includes('/dist/')) {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  const old = await original(manifest, file); if (!old) return raw;
  const sourceFile = file.replace('/dist/', '/src/').replace(/\.js$/, '.ts');
  const source = await original(manifest, sourceFile);
  const delta = JSON.parse(await readFile(new URL('deltas.json', directory), 'utf8')).files[sourceFile];
  assert.equal(hash(source), delta.beforeSha256);
  const lines = source.toString().match(/.*\n|.+$/g) ?? [];
  for (const edit of [...delta.edits].reverse()) lines.splice(edit.start, edit.delete, ...edit.insert);
  const expected = lines.join(''); assert.equal(hash(expected), delta.afterSha256);
  assert.equal(await readFile(new URL(sourceFile, root), 'utf8'), expected, 'Undeclared legacy async change: ' + sourceFile);
  let current = expected;
  if (file !== sourceFile) {
    assert.equal(emitSource(source.toString(), sourceFile), old.toString());
    current = emitSource(expected, sourceFile);
  }
  // Older normalizers can encounter the already-unwound bytes. Always verify
  // the actual current implementation first; accepting old bytes is not a bypass.
  assert(raw.toString() === current || raw.toString() === old.toString(), 'Unexpected comparison input: ' + file);
  for (const [added, entry] of Object.entries(manifest.added)) {
    const implementation = await readFile(new URL(added, root), 'utf8'); assert.equal(hash(implementation), entry.sha256, added);
    if (compiled) assert.equal(await readFile(new URL(added.replace('/src/', '/dist/').replace(/\.ts$/, '.js'), root), 'utf8'), emitSource(implementation, added));
  }
  if (compiled && file.startsWith('apps/loredock/')) {
    const emitted = sourceFile.replace('/src/', '/dist/').replace(/\.ts$/, '.js');
    assert.equal(await readFile(new URL(emitted, root), 'utf8'), emitSource(expected, sourceFile));
  }
  return old;
}

/** Independent synchronous controls need their synchronous transitive consumers too. */
export async function legacyControlImports(folder, emitted) {
  const target = await mkdtemp(path.join(folder, 'async-legacy-control-'));
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  const files = Object.keys(manifest.files).filter(file => file.startsWith('apps/loredock/dist/'));
  const urls = new Map(files.map(file => [path.basename(file), pathToFileURL(path.join(target, path.basename(file).replace(/\.js$/, '.mjs')))]));
  const relocations = value => Object.fromEntries(runtimeImports(value).filter(row => row.name.startsWith('.'))
    .map(row => [row.name, (urls.get(row.name.slice(2)) ?? new URL('apps/loredock/dist/' + row.name.slice(2), root)).href]));
  for (const file of files) {
    const raw = await beforeAsyncLegacy(file, await readFile(new URL(file, root)));
    let value = relocateSource(raw.toString(), relocations(raw.toString()));
    for (const item of runtimeImports(value).filter(row => !row.name.startsWith('.') && !row.name.includes(':')).reverse())
      value = value.slice(0, item.start) + JSON.stringify(import.meta.resolve(item.name)) + value.slice(item.end);
    await writeFile(urls.get(path.basename(file)), value, { flag: 'wx' });
  }
  return { relocations: relocations(emitted), contextUrl: urls.get('answer-context.js').href,
    modules: Object.fromEntries([...urls].map(([name, url]) => [name, url.href])) };
}

/** Keep consumed prototype sources exact; ordinary unit controls retain synchronous dependencies. */
export async function loadLegacyQuestionPrototype(entry, folder) {
  const manifest = JSON.parse(await readFile(new URL('prototype.json', directory), 'utf8'));
  assert(manifest.entries.includes(entry), 'Only ordinary prototype test entries are admitted.');
  const controls = await legacyControlImports(folder, '');
  const source = new URL('scripts/loredock-native-question-context/', root);
  const target = pathToFileURL((await mkdtemp(path.join(folder, 'question-prototype-'))) + '/');
  const records = [];
  for (const [name, expected] of Object.entries(manifest.files)) {
    const originalUrl = new URL(name, source), raw = await readFile(originalUrl);
    assert.equal(raw.length, expected.bytes); assert.equal(hash(raw), expected.sha256);
    const imports = Object.fromEntries(runtimeImports(raw.toString()).filter(row => row.name.startsWith('.')).map(row => {
      const url = new URL(row.name, originalUrl);
      if (url.href.startsWith(source.href)) { const child = url.href.slice(source.href.length); assert(manifest.files[child]); return [row.name, new URL(child, target).href]; }
      if (url.href.startsWith(new URL('apps/loredock/dist/', root).href) && controls.modules[path.basename(url.pathname)])
        return [row.name, controls.modules[path.basename(url.pathname)]];
      return [row.name, url.href];
    }));
    let emitted = relocateSource(raw.toString(), imports);
    // Relative resource reads and the CLI entry guard retain their original location.
    assert.equal(emitted.split('import.meta.url').length - 1, expected.resourceBindings);
    emitted = emitted.replaceAll('import.meta.url', JSON.stringify(originalUrl.href));
    await writeFile(new URL(name, target), emitted, { flag: 'wx' });
    records.push({ name, sourceSha256: expected.sha256, emittedSha256: hash(emitted), imports, resourceBindings: expected.resourceBindings });
  }
  await writeFile(new URL('control.json', target), JSON.stringify({ entry, scope: 'Ordinary compatibility unit control; no resource qualification or reserved replay.',
    modules: controls.modules, records }, null, 2) + '\n', { flag: 'wx' });
  return import(new URL(entry, target).href);
}
