import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { SourceGit } from '../src/git.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { codePathLimits, PathWork } from '../src/code-paths-work.js';
import { bindingMetadata, bindingDomains, assertBindingMetadata } from '../src/code-paths-metadata.js';
import { declarationMap } from '../src/system-map.js';
import { compareHeaders } from '../src/http-headers.js';
import { sha256 } from '../src/extract.js';
import { CatalogError } from '../src/types.js';
// @ts-expect-error Offline factory with injected source services; no prebuilt output needed.
import { createCapturePaths } from '../../../scripts/loredock-capture-memory/paths.mjs';
// @ts-expect-error Unchanged baseline on a separate tiny regression, never the frozen matrix.
import { createCapturePaths as baselinePaths } from '../../../scripts/loredock-capture-scale/paths.mjs';
// @ts-expect-error Offline capture and history helpers.
import { captureReceipt, readReceipt } from '../../../scripts/loredock-capture-memory/receipt.mjs';
// @ts-expect-error Independent owned fixture helpers.
import { openState, prepareSources, copyStoppedData, dataHashes } from '../../../scripts/loredock-capture-memory/fixture.mjs';
// @ts-expect-error Bounded internal observation.
import { MemoryObserver } from '../../../scripts/loredock-capture-memory/observer.mjs';
const dependencies = { codePathLimits, PathWork, bindingMetadata, bindingDomains, assertBindingMetadata, declarationMap, compareHeaders, sha256, CatalogError };
const services = { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths: createCapturePaths(dependencies) };

test('stopped copies preserve capture bytes across observers and baseline, then read history without facts', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'memory-regression-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const receipts = path.join(root, 'receipts'), copiedReceipts = path.join(root, 'copied-receipts');
  await mkdir(receipts); await mkdir(copiedReceipts);
  const observer = new MemoryObserver(true), state = openState(path.join(root, 'data'), receipts, services, observer);
  t.after(() => state.close());
  await prepareSources(root, { 'status-client': { 'README.md': '# Independent health check\n', 'health.ts': 'export function checkHealth() { return fetch("/health", { method: "GET" }); }\n' } }, state);
  const project = state.catalog.state(), build = state.catalog.start('health-index', project.sourceSetVersion, project.policyVersion); await state.catalog.idle();
  const inventory = state.analysis.start('health-facts', build.id); await state.analysis.idle();
  observer.begin(); const first = await captureReceipt(state.services, receipts, { buildId: build.id }, { diagnostic: observer.phase }); const observed = observer.end();
  const text = await readFile(first.file, 'utf8'), projection = JSON.parse(JSON.parse(text).projectionJson);
  assert.ok(projection.graph.nodes.some((node: { kind: string }) => node.kind === 'http-request'));
  assert.ok(observed.prepareCalls > 0); assert.ok(observed.phases.some((row: { stage: string }) => row.stage === 'receipt-publication-after'));
  await assert.rejects(copyStoppedData(path.join(root, 'data'), path.join(root, 'live-copy')), /WAL/);
  const copiedData = path.join(root, 'nested', 'reopened', 'data');
  await state.close(); const hashes = await copyStoppedData(path.join(root, 'data'), copiedData);
  assert.deepEqual(hashes, await dataHashes(path.join(root, 'data')));
  const copy = openState(copiedData, copiedReceipts, services, new MemoryObserver(false)); t.after(() => copy.close());
  const repeated = await captureReceipt(copy.services, copiedReceipts, { buildId: build.id }); assert.equal(await readFile(repeated.file, 'utf8'), text);
  const baseline = new (baselinePaths(dependencies))(copy.analysis); t.after(() => baseline.stop());
  const control = await captureReceipt({ ...copy.services, paths: baseline }, copiedReceipts, { buildId: build.id });
  assert.equal(await readFile(control.file, 'utf8'), text);
  for (const key of ['health-replacement', 'health-eviction']) { copy.analysis.start(key, build.id); await copy.analysis.idle(); }
  assert.throws(() => copy.analysis.get(inventory.id)); const before = copy.counters();
  const history = await readReceipt(copy.catalog, copiedReceipts, first.receiptId);
  assert.equal(history.metrics.pathWork, 0); assert.deepEqual(copy.counters(), { ...before, originalReads: before.originalReads + 1 });
  assert.deepEqual(history.projection, projection);
});
