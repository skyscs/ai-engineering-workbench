import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const origin = new URL('../../../../../docs/fixtures/loredock-native-worker-ownership/raw/report.json.gz', import.meta.url);
export const priorDirectory = new URL('./', import.meta.url);

export async function verifyPriorRuntime(directory = priorDirectory) {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  assert.equal(manifest.schemaVersion, 'native-compiled-before-analysis-writes/1');
  assert.equal(manifest.rewrittenImports, false); assert.equal(manifest.fingerprintOverride, false);
  const archive = await readFile(origin), reportBytes = gunzipSync(archive), report = JSON.parse(reportBytes);
  assert.equal(hash(archive), manifest.origin.archiveSha256); assert.equal(hash(reportBytes), manifest.origin.reportSha256);
  assert.deepEqual(manifest.runtime, report.runtime); assert.equal(manifest.fingerprint, report.observations[0].summary.fingerprint);
  assert.equal(process.version, manifest.runtime.node); assert.equal(process.versions.v8, manifest.runtime.v8);
  assert.equal(Object.keys(manifest.runtime.modules).length, 37);
  const external = new Set();
  for (const [name, expected] of Object.entries(manifest.runtime.modules)) {
    assert.match(name, /^[a-z0-9-]+\.js$/); const raw = await readFile(new URL('runtime/' + name, directory));
    assert.equal(hash(raw), expected, 'Preserved runtime bytes changed: ' + name);
    for (const item of raw.toString('utf8').matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
      const specifier = item[1];
      if (specifier.startsWith('./')) assert.ok(Object.hasOwn(manifest.runtime.modules, specifier.slice(2)), 'Missing preserved dependency.');
      else if (!specifier.startsWith('node:')) external.add(specifier);
    }
  }
  assert.deepEqual([...external].sort(), ['typescript']);
  const require = createRequire(new URL('runtime/code-analysis-facts.js', directory));
  assert.equal(hash(await readFile(require.resolve('typescript'))), manifest.runtime.typescript);
  return manifest;
}

export async function loadPriorRuntime() {
  const manifest = await verifyPriorRuntime();
  const [{ Catalog }, { CatalogStore }, { SourceGit }, { CodeAnalysis }, { CodePathsV2 }, { NativeCaptures }, { OperationBudget }, { codeAnalysisFingerprint }] =
    await Promise.all(['catalog', 'store', 'git', 'code-analysis', 'code-paths-v2', 'native-capture', 'operation-budget', 'code-analysis-facts']
      .map(name => import(new URL('runtime/' + name + '.js', priorDirectory))));
  assert.equal(codeAnalysisFingerprint(), manifest.fingerprint, 'The actual preserved fingerprint must match without an override.');
  return { manifest, services: { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths: CodePathsV2, NativeCaptures, OperationBudget } };
}
