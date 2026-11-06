import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdtemp, readFile, writeFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { emitSource, runtimeImports, relocateSource } from '../integration-reference/compile.mjs';

const directory = new URL('./', import.meta.url), root = new URL('../../../../../', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
let originals, materialized;
async function before() {
  if (!originals) originals = (async () => {
    const manifest = JSON.parse(await readFile(new URL('before.json', directory), 'utf8'));
    const compressed = await readFile(new URL('before.json.gz', directory)); assert.equal(hash(compressed), manifest.archiveSha256);
    const raw = gunzipSync(compressed); assert.equal(hash(raw), manifest.rawSha256);
    const files = JSON.parse(raw); assert.deepEqual(Object.keys(files), Object.keys(manifest.files));
    for (const [file, text] of Object.entries(files)) assert.equal(hash(text), manifest.files[file], file);
    return { manifest, files };
  })();
  return originals;
}

/** Verify actual current bytes before returning the immutable pre-adoption implementation. */
export async function beforeOwnedParser(file, raw) {
  const delta = JSON.parse(await readFile(new URL('delta.json', directory), 'utf8'));
  const source = file.replace('/dist/', '/src/').replace(/\.js$/, '.ts'), entry = delta.files[source];
  if (!entry) return raw;
  const current = await readFile(new URL(source, root), 'utf8'); assert.equal(hash(current), entry.afterSha256, source);
  const old = entry.before ?? (await before()).files[source]; assert.equal(hash(old), entry.beforeSha256, source);
  const expected = source === file ? current : emitSource(current, source);
  const original = source === file ? old : emitSource(old, source);
  let archived = false;
  const legacy = JSON.parse(await readFile(new URL('../async-legacy-reference/manifest.json', directory), 'utf8')).files[file];
  if (legacy) {
    const bytes = await readFile(new URL('../async-legacy-reference/' + legacy.fixture, directory));
    assert.equal(hash(bytes), legacy.sha256); assert.equal(bytes.length, legacy.bytes);
    archived = raw.equals(bytes);
  }
  if (['apps/loredock/src/code-analysis.ts', 'apps/loredock/src/store.ts'].includes(file)) {
    const name = path.basename(file) + '.txt', pinned = JSON.parse(await readFile(new URL('../integration-reference/manifest.json', directory), 'utf8'));
    const bytes = await readFile(new URL('../integration-reference/' + name, directory));
    // The older normalizer can already have selected this independently pinned control.
    assert.equal(hash(bytes), pinned.sources[file].sha256, 'The historical source changed: ' + file);
    archived ||= raw.equals(bytes);
  }
  assert(archived || raw.toString() === expected || raw.toString() === original, 'Undeclared owned-parser input: ' + file);
  if (source !== file) assert.equal(await readFile(new URL(file, root), 'utf8'), expected);
  for (const [name, sha256] of Object.entries(delta.added)) assert.equal(hash(await readFile(new URL(name, root))), sha256, name);
  return archived ? raw : Buffer.from(original);
}

/** Materialize exact historical modules; their own fingerprint reads see their own bytes. */
export async function historicalParserRoot() {
  if (!materialized) materialized = (async () => {
    const { files } = await before(), folder = await mkdtemp(path.join(tmpdir(), 'loredock-before-owned-'));
    await writeFile(path.join(folder, 'package.json'), '{"type":"module"}\n', { flag: 'wx' });
    await symlink(new URL('apps/loredock/node_modules', root), path.join(folder, 'node_modules'));
    for (const [name, content] of Object.entries(files)) {
      if (!name.startsWith('apps/loredock/src/')) continue;
      const file = path.join(folder, name); await mkdir(path.dirname(file), { recursive: true });
      if (name === 'apps/loredock/src/types.ts') {
        // Shared error identity is part of the original mixed control's behavior.
        assert.equal(await readFile(new URL(name, root), 'utf8'), content);
        await symlink(new URL(name, root), file);
      } else await writeFile(file, content, { flag: 'wx' });
      const emitted = file.replace('/src/', '/dist/').replace(/\.ts$/, '.js');
      await mkdir(path.dirname(emitted), { recursive: true });
      if (name === 'apps/loredock/src/types.ts') {
        const current = new URL('apps/loredock/dist/types.js', root);
        assert.equal(await readFile(current, 'utf8'), emitSource(content, name)); await symlink(current, emitted);
      } else await writeFile(emitted, emitSource(content, name), { flag: 'wx' });
    }
    return pathToFileURL(folder + '/');
  })();
  return materialized;
}

/** Only these unchanged ordinary unit controls may execute this historical implementation. */
export async function loadHistoricalParserTest(name) {
  const { manifest, files } = await before(); assert(manifest.tests.includes(name));
  const file = 'apps/loredock/tests/' + name, origin = new URL(file, root), target = await historicalParserRoot();
  const emitted = emitSource(files[file], file);
  const relocations = Object.fromEntries(runtimeImports(emitted).filter(row => row.name.startsWith('.')).map(row => {
    const url = new URL(row.name, origin);
    if (url.href.startsWith(new URL('apps/loredock/src/', root).href))
      return [row.name, new URL('apps/loredock/src/' + path.basename(url.pathname).replace(/\.js$/, '.ts'), target).href];
    return [row.name, url.href];
  }));
  let code = relocateSource(emitted, relocations).replaceAll('import.meta.url', JSON.stringify(origin.href));
  for (const row of runtimeImports(code).filter(row => !row.name.startsWith('.') && !row.name.includes(':')).reverse())
    code = code.slice(0, row.start) + JSON.stringify(import.meta.resolve(row.name)) + code.slice(row.end);
  const output = new URL(name + '.mjs', target); await writeFile(output, code, { flag: 'wx' });
  return import(output.href);
}

export async function loadHistoricalIntegrationAnalysis() {
  const source = new URL('../integration-reference/code-analysis.mjs', directory), raw = await readFile(source, 'utf8');
  const manifest = JSON.parse(await readFile(new URL('../integration-reference/manifest.json', directory), 'utf8'));
  assert.equal(hash(raw), manifest.sources['apps/loredock/src/code-analysis.ts'].moduleSha256, 'The historical inventory module changed.');
  const target = await historicalParserRoot();
  const relocations = Object.fromEntries(runtimeImports(raw).filter(row => row.name.startsWith('.')).map(row =>
    [row.name, new URL('apps/loredock/src/' + path.basename(row.name).replace(/\.js$/, '.ts'), target).href]));
  const output = new URL('integration-code-analysis.mjs', target);
  await writeFile(output, relocateSource(raw, relocations), { flag: 'wx' });
  return import(output.href);
}
