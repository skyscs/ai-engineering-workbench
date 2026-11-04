// @ts-expect-error Test-only exact delta proof; historical source pins remain unchanged.
import { assertHistoricalSource } from './fixtures/question-read-reference/verify.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { sha256 } from '../src/extract.js';
import { CatalogStore } from '../src/store.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import type { Catalog } from '../src/catalog.js';
import { codeAnalysisFingerprint } from '../src/code-analysis-facts.js';
import { CodeAnalysis as ReferenceAnalysis, CatalogStore as ReferenceStore, referenceSource } from './fixtures/integration-reference/index.js';
import { config } from './fixtures/memory-runner-config.js';
// @ts-expect-error Test-only deterministic compilation and explicit import relocation.
import { compilerOptions, emitSource, runtimeImports, relocateSource } from './fixtures/integration-reference/compile.mjs';
// @ts-expect-error Owned independent setup; no frozen corpus or resource entry point.
import { openState, prepareSources, copyStoppedData } from '../../../scripts/loredock-capture-memory/fixture.mjs';

const directory = new URL('./fixtures/integration-reference/', import.meta.url), root = new URL('../../../', import.meta.url);
interface Manifest {
  compiler: { version: string; options: unknown; moduleSha256: string };
  sources: Record<string, { source: string; module: string; bytes: number; sha256: string; emittedSha256: string; moduleSha256: string; relocations: Record<string, string> }>;
  dependencies: Record<string, string>; externalImports: string[]; fingerprintContext: string;
}

test('portable reference preserves original sources, deterministic imports and runtime dependency closure', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8')) as Manifest;
  assert.equal(ts.version, manifest.compiler.version); assert.deepEqual(compilerOptions, manifest.compiler.options);
  assert.equal(sha256(await readFile(new URL('../node_modules/typescript/lib/typescript.js', import.meta.url))), manifest.compiler.moduleSha256);
  const visited = new Set<string>(), dependencies: Record<string, string> = {}, external = new Set<string>();
  async function visit(file: string) {
    if (visited.has(file)) return; visited.add(file);
    const raw = await referenceSource(file), emitted = emitSource(raw.toString(), file) as string;
    if (!Object.hasOwn(manifest.sources, file)) dependencies[file] = sha256(raw);
    for (const { name } of runtimeImports(emitted) as { name: string }[]) {
      if (name.startsWith('.')) {
        assert.ok(name.endsWith('.js'));
        await visit(path.posix.normalize(path.posix.join(path.posix.dirname(file), name.replace(/\.js$/, '.ts'))));
      } else external.add(name);
    }
  }
  for (const [file, record] of Object.entries(manifest.sources)) {
    const original = await readFile(new URL(record.source, directory)), module = await readFile(new URL(record.module, directory), 'utf8');
    assert.equal(original.length, record.bytes); assert.equal(sha256(original), record.sha256);
    const emitted = emitSource(original.toString(), file) as string;
    assert.equal(sha256(emitted), record.emittedSha256); assert.equal(sha256(module), record.moduleSha256);
    assert.equal(relocateSource(emitted, record.relocations), module);
    await visit(file);
  }
  assert.deepEqual(dependencies, manifest.dependencies); assert.deepEqual([...external].sort(), manifest.externalImports);
  assert.equal(Object.keys(manifest.sources).length, 2); assert.equal(Object.keys(dependencies).length, 13);
  assert.match(manifest.fingerprintContext, /current production implementation bytes/);
  for (const name of ['loredock-worker-reads', 'loredock-canonical-facts']) {
    const baseline = JSON.parse(await readFile(new URL(`scripts/${name}/baseline.json`, root), 'utf8')) as { files: Record<string, string> };
    for (const [file, expected] of Object.entries(baseline.files)) await assertHistoricalSource(file, await referenceSource(file), expected);
  }
});

interface State { store: CatalogStore; catalog: Catalog; analysis: CodeAnalysis; close(): Promise<void> }
test('preserved and production services agree on an identical stopped tiny catalog', async t => {
  assert.notEqual(ReferenceStore, CatalogStore); assert.notEqual(ReferenceAnalysis, CodeAnalysis);
  const folder = await mkdtemp(path.join(tmpdir(), 'integration-reference-')), states: State[] = []; let passed = false;
  t.after(async () => { for (const s of states) await s.close(); if (passed) await rm(folder, { recursive: true, force: true }); else t.diagnostic(`Retained reference comparison: ${folder}`); });
  const seedDir = path.join(folder, 'seed'), receipts = path.join(folder, 'seed-receipts'); await mkdir(receipts);
  const seed = openState(seedDir, receipts, config.services) as State; states.push(seed);
  await prepareSources(folder, config.corpusFactory(), seed);
  const project = seed.catalog.state(), build = seed.catalog.start('reference-build', project.sourceSetVersion, project.policyVersion); await seed.catalog.idle();
  const inventory = seed.analysis.start('reference-facts', build.id); await seed.analysis.idle();
  assert.equal(seed.analysis.fingerprint, codeAnalysisFingerprint()); await seed.close();
  const captures = [];
  for (const [name, services] of [['reference', config.services], ['production', { ...config.services, CatalogStore, CodeAnalysis }]] as const) {
    const data = path.join(folder, name), receiptDir = path.join(folder, name + '-receipts'); await mkdir(receiptDir);
    await copyStoppedData(seedDir, data); const state = openState(data, receiptDir, services) as State; states.push(state);
    assert.equal(state.analysis.fingerprint, codeAnalysisFingerprint());
    const snapshot = state.analysis.snapshot(inventory.id), files = snapshot.fileIds.map(id => state.analysis.file(inventory.id, id));
    const changes = state.store.one<{ n: number }>('SELECT total_changes() n')!.n;
    assert.deepEqual(state.analysis.snapshot(inventory.id), snapshot); assert.equal(state.store.one<{ n: number }>('SELECT total_changes() n')!.n, changes);
    const last = snapshot.fileIds.at(-1)!;
    state.store.run("UPDATE code_analysis_files SET checkpointHash='invalid' WHERE runId=? AND fileId=?", inventory.id, last);
    assert.throws(() => state.analysis.snapshot(inventory.id), { code: 'CORRUPT_CODE_CHECKPOINT' });
    captures.push({ snapshot, files });
  }
  assert.deepEqual(captures[1], captures[0]); passed = true;
});

test('reference loads from a separate process without Git lookup or generated daemon output', async t => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'reference-process-')); t.after(() => rm(cwd, { recursive: true, force: true }));
  const script = `import { CodeAnalysis, CatalogStore } from ${JSON.stringify(new URL('index.ts', directory).href)};
    if (typeof CodeAnalysis !== 'function' || typeof CatalogStore !== 'function') throw new Error('Reference exports missing.');
    console.log('Portable source reference loaded.');`;
  const loader = fileURLToPath(new URL('../node_modules/tsx/dist/loader.mjs', import.meta.url));
  const result = await promisify(execFile)(process.execPath, ['--import', loader, '--input-type=module', '-e', script],
    { cwd, env: { PATH: '/nonexistent', LC_ALL: 'C' }, timeout: 30000 });
  assert.equal(result.stdout.trim(), 'Portable source reference loaded.');
});
