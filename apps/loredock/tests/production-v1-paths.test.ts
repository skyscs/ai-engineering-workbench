import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { SourceGit } from '../src/git.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { CodePaths } from '../src/code-paths.js';
import { codeAnalysisFingerprint } from '../src/code-analysis-facts.js';
import { declarationMap } from '../src/system-map.js';
import { compareHeaders } from '../src/http-headers.js';
import { sha256 } from '../src/extract.js';
import { CatalogError } from '../src/types.js';
import type { CodePathRequest, CodePathsResponse, CodePathsAvailable } from '../src/code-paths-types.js';
import { CodePaths as ReferencePaths } from './fixtures/v1-path-reference/index.js';
import { CodeAnalysis as ReferenceAnalysis, referenceSource } from './fixtures/integration-reference/index.js';
import { config } from './fixtures/memory-runner-config.js';
// @ts-expect-error Test-only deterministic compilation and explicit import relocation.
import { emitSource, runtimeImports, relocateSource } from './fixtures/integration-reference/compile.mjs';
// @ts-expect-error Owned functional fixture; no frozen resource execution.
import { prepareConnectedCase, connectedGit } from '../../../scripts/loredock-connected-fixture.mjs';
// @ts-expect-error Owned stopped-state setup; no frozen corpus.
import { openState, prepareSources } from '../../../scripts/loredock-capture-memory/fixture.mjs';
// @ts-expect-error Unchanged offline receipt control; not a production storage API.
import { captureReceipt, readReceipt } from '../../../scripts/loredock-capture-memory/receipt.mjs';

const directory = new URL('./fixtures/v1-path-reference/', import.meta.url);
const root = new URL('../../../', import.meta.url);
interface Manifest {
  source: string; sourceSha256: string; emittedSha256: string; moduleSha256: string;
  relocations: Record<string, string>; dependencies: Record<string, { sourceSha256: string; emittedSha256: string }>;
  sourceFingerprint: { node: string; inputs: [string, string][]; value: string };
}
async function manifest(): Promise<Manifest> { return JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8')); }
function available(value: CodePathsResponse): CodePathsAvailable { assert.ok(value.status === 'available'); return value; }
const pinned = (value: CodePathsAvailable) => ({ buildId: value.identity.buildId, inventoryId: value.identity.inventoryId, generationId: value.generationId });

test('v1 control preserves exact pre-change source, emitted runtime closure and source fingerprint', async () => {
  const m = await manifest(), raw = await readFile(new URL('code-paths.ts.txt', directory)), module = await readFile(new URL('code-paths.mjs', directory), 'utf8');
  const emitted = emitSource(raw.toString(), m.source) as string;
  assert.equal(sha256(raw), m.sourceSha256); assert.equal(sha256(emitted), m.emittedSha256);
  assert.equal(sha256(module), m.moduleSha256); assert.equal(relocateSource(emitted, m.relocations), module);
  const visited = new Set<string>();
  async function visit(file: string, source: string) {
    for (const { name } of runtimeImports(emitSource(source, file)) as { name: string }[]) {
      if (!name.startsWith('.')) continue;
      const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(file), name.replace(/\.js$/, '.ts')));
      if (visited.has(dependency)) continue; visited.add(dependency);
      const expected = m.dependencies[dependency]; assert.ok(expected, dependency);
      const bytes = await readFile(new URL(dependency, root));
      // This file only narrows erased internal types; its runtime remains byte-identical.
      if (dependency !== 'apps/loredock/src/code-paths-resolve.ts') assert.equal(sha256(bytes), expected.sourceSha256, dependency);
      assert.equal(sha256(emitSource(bytes.toString(), dependency)), expected.emittedSha256, dependency);
      await visit(dependency, bytes.toString());
    }
  }
  await visit(m.source, raw.toString()); assert.deepEqual([...visited].sort(), Object.keys(m.dependencies).sort());
  for (const [name, expected] of m.sourceFingerprint.inputs) {
    const bytes = name === 'typescript' ? await readFile(new URL('../node_modules/typescript/lib/typescript.js', import.meta.url))
      : await referenceSource(`apps/loredock/src/${name}.ts`);
    assert.equal(sha256(bytes), expected, name);
  }
  assert.equal(sha256(JSON.stringify({ version: 'loredock-file-facts/1', node: m.sourceFingerprint.node, hashes: m.sourceFingerprint.inputs })), m.sourceFingerprint.value);
  assert.notEqual(codeAnalysisFingerprint(), m.sourceFingerprint.value);
});

interface Connected {
  root: string; buildId: string; catalog: Catalog; store: CatalogStore; analysis: CodeAnalysis;
  index(key: string): Promise<string>; analyze(key: string, buildId?: string): Promise<string>;
  counters(): unknown; close(): Promise<void>;
}
test('production v1 paths preserve exact output, work, SQL executions and full fact validation across selections', async t => {
  const s = await prepareConnectedCase({ Catalog, CatalogStore, SourceGit, CodeAnalysis, declarationMap, compareHeaders, sha256, CatalogError }, 'roots') as Connected;
  t.after(() => s.close());
  const marker = 'export const marker = "retained fact-free source";\n';
  for (const name of ['MarkerA.ts', 'MarkerB.ts']) await writeFile(path.join(s.root, 'sources/console/src', name), marker);
  await writeFile(path.join(s.root, 'sources/console/src/ZIsolated.vue'), '<script setup lang="ts">\nimport { absent } from "./missing";\nconst isolated = () => absent();\n</script>\n<template><button @click="isolated">Inspect</button></template>\n');
  connectedGit(s.root, 'console', ['add', '--all']); connectedGit(s.root, 'console', ['commit', '-qm', 'Add independent production v1 regression inputs']);
  s.buildId = await s.index('v1'); const inventoryId = await s.analyze('v1', s.buildId), snapshot = s.analysis.snapshot(inventoryId);
  const originalFile = s.analysis.file.bind(s.analysis), originalEvidence = s.catalog.evidence.bind(s.catalog), prepare = s.store.db.prepare.bind(s.store.db);
  let files: string[] = [], evidence: string[] = [], preparations = 0, executions: { sql: string; method: string; args: unknown[] }[] = [];
  s.analysis.file = (id, fileId) => { files.push(fileId); return originalFile(id, fileId); };
  s.catalog.evidence = id => { evidence.push(id); return originalEvidence(id); };
  s.store.db.prepare = sql => {
    preparations++; const statement = prepare(sql);
    for (const method of ['get', 'all', 'run', 'iterate'] as const) {
      const native = statement[method]; Object.defineProperty(statement, method, { value(...args: unknown[]) {
        executions.push({ sql, method, args }); return Reflect.apply(native, statement, args);
      } });
    }
    return statement;
  };
  const compare = async (input: CodePathRequest, kind: 'paths' | 'roots' = 'paths') => {
    const results = [], before = s.counters();
    for (const Factory of [ReferencePaths, CodePaths]) {
      files = []; evidence = []; executions = []; preparations = 0;
      const work: unknown[] = [], service = new Factory(s.analysis, { checkpoint: info => { work.push(info); } });
      const value = available(await service.read(input, kind)); await service.stop();
      results.push({ json: JSON.stringify(value), files, evidence, executions, work, preparations });
      assert.deepEqual(files, snapshot.fileIds); assert.equal(value.identity.adapter, 'connected-paths-v1');
    }
    const [baseline, candidate] = results; assert.ok(baseline && candidate);
    const { preparations: bp, ...a } = baseline, { preparations: cp, ...b } = candidate;
    assert.deepEqual(b, a); assert.ok(cp < bp); assert.deepEqual(s.counters(), before);
    return JSON.parse(candidate.json) as CodePathsAvailable;
  };
  const first = await compare({ buildId: s.buildId });
  assert.equal(first.roots.next, 4); const page = await compare({ ...pinned(first), offset: 4 }, 'roots');
  await compare({ ...pinned(first), rootId: first.roots.items[0]!.id });
  const isolated = [...first.roots.items, ...page.roots.items].find(item => item.status === 'available' && item.label === 'isolated'); assert.ok(isolated);
  const selected = await compare({ ...pinned(first), rootId: isolated.id }); assert.equal(selected.graph!.nodes.length, 1);
  assert.ok(first.coverage.sources.some(source => source.filesWithGaps > 0));
  const file = s.store.one<{ id: string; raw: Uint8Array }>("SELECT id,raw FROM files WHERE buildId=? AND path='src/MarkerB.ts'", s.buildId)!;
  s.store.db.exec('SAVEPOINT fact_free_corruption');
  try {
    s.store.run('UPDATE files SET raw=? WHERE id=?', Buffer.alloc(file.raw.length, 120), file.id);
    // Selecting an isolated root still validates every retained original, including fact-free files.
    for (const Factory of [ReferencePaths, CodePaths]) await assert.rejects(new Factory(s.analysis).read({ ...pinned(first), rootId: isolated.id }), { code: 'CORRUPT_EVIDENCE' });
  } finally { s.store.db.exec('ROLLBACK TO fact_free_corruption; RELEASE fact_free_corruption'); }
  assert.deepEqual(await compare({ buildId: s.buildId }), first);
});

interface State { store: CatalogStore; catalog: Catalog; analysis: CodeAnalysis; services: Record<string, unknown>; close(): Promise<void> }
test('source fingerprint changes require explicit reanalysis and preserve originals and offline history across backward reopen', async t => {
  const m = await manifest(), folder = await mkdtemp(path.join(tmpdir(), 'production-fingerprint-')), states: State[] = []; let passed = false;
  t.after(async () => { for (const state of states) await state.close(); if (passed) await rm(folder, { recursive: true, force: true }); else t.diagnostic(`Retained fingerprint regression: ${folder}`); });
  // Explicit historical source-runtime identity. The reference otherwise uses the current identity provider.
  class OldSourceAnalysis extends ReferenceAnalysis { override readonly fingerprint = m.sourceFingerprint.value; }
  const data = path.join(folder, 'data'), receipts = path.join(folder, 'receipts');
  await mkdir(receipts);
  const open = (Factory: typeof CodeAnalysis) => { const s = openState(data, receipts, { ...config.services, CatalogStore, CodeAnalysis: Factory }) as State; states.push(s); return s; };
  const old = open(OldSourceAnalysis); await prepareSources(folder, config.corpusFactory(), old);
  const project = old.catalog.state(), build = old.catalog.start('fingerprint', project.sourceSetVersion, project.policyVersion); await old.catalog.idle();
  const first = old.analysis.start('old-source', build.id); await old.analysis.idle();
  const oldPaths = available(await new ReferencePaths(old.analysis).read({ buildId: build.id }));
  const receipt = await captureReceipt(old.services, receipts, { buildId: build.id });
  const before = await readReceipt(old.catalog, receipts, receipt.receiptId);
  const evidenceId = Object.keys(oldPaths.roots.evidence)[0]!; assert.ok(evidenceId); const original = old.catalog.evidence(evidenceId);
  await old.close();
  const current = open(CodeAnalysis);
  assert.equal(current.analysis.get(first.id).currentParser, false);
  assert.throws(() => current.analysis.snapshot(first.id), { code: 'PARSER_CHANGED' });
  assert.equal((await new CodePaths(current.analysis).read({ buildId: build.id })).status, 'unavailable');
  assert.deepEqual(current.catalog.evidence(evidenceId), original);
  assert.deepEqual((await readReceipt(current.catalog, receipts, receipt.receiptId)).projection, before.projection);
  const next = current.analysis.start('new-source', build.id); await current.analysis.idle();
  assert.equal(current.analysis.get(next.id).currentParser, true); assert.notEqual(next.fingerprint, first.fingerprint);
  const newPaths = available(await new CodePaths(current.analysis).read({ buildId: build.id }));
  assert.notEqual(newPaths.generationId, oldPaths.generationId); assert.deepEqual(current.catalog.evidence(evidenceId), original);
  await current.close();
  const backward = open(OldSourceAnalysis);
  assert.throws(() => backward.analysis.snapshot(next.id), { code: 'PARSER_CHANGED' });
  assert.deepEqual(available(await new ReferencePaths(backward.analysis).read({ buildId: build.id })), oldPaths);
  assert.deepEqual((await readReceipt(backward.catalog, receipts, receipt.receiptId)).projection, before.projection);
  assert.deepEqual(backward.catalog.evidence(evidenceId), original); passed = true;
});
