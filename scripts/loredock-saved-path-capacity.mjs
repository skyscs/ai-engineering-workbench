import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { SourceGit } from '../apps/loredock/dist/git.js';
import { CodeAnalysis } from '../apps/loredock/dist/code-analysis.js';
import { CodePathsV2 } from '../apps/loredock/dist/code-paths-v2.js';
import { NativeCaptures } from '../apps/loredock/dist/native-capture.js';
import { OperationBudget } from '../apps/loredock/dist/operation-budget.js';
import { receiptFixture } from './loredock-capture-scale/fixture.mjs';
import { corpusFactory } from './loredock-native-assessment/fixture.mjs';
import { runtimeIdentity } from './loredock-native-qualification/runtime.mjs';

// Ordinary full-storage functional check, never a reserved resource qualification.
const root = fileURLToPath(new URL('../', import.meta.url)), output = process.env.LOREDOCK_SAVED_CAPACITY_OUTPUT;
assert.ok(output && path.isAbsolute(output) && path.resolve(output) === output); await mkdir(output);
const raw = (name, value) => writeFile(path.join(output, name), typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2), { flag: 'wx' });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { schemaVersion: 'loredock-saved-path-capacity/1', head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  resourceQualification: false, modelRequests: 0, checks: [], reads: [], records: [], errors: [], failed: true };
let fixture, captures, originalReads = 0;
try {
  report.runtime = await runtimeIdentity();
  const baseline = JSON.parse(await readFile(path.join(root, 'fixtures/loredock-saved-path-discovery/baseline.json'), 'utf8'));
  const changed = Object.keys(baseline.qualifiedRuntimeModules).filter(name => report.runtime.modules[name] !== baseline.qualifiedRuntimeModules[name]);
  assert.deepEqual(changed.sort(), ['native-capture.js', 'native-receipt-store.js']);
  assert.equal(Object.keys(report.runtime.modules).length, 39);
  const require = createRequire(path.join(root, 'apps/loredock/package.json')), ts = require('typescript');
  for (const [file, classes] of Object.entries(baseline.emittedMembers)) {
    const text = await readFile(path.join(root, file), 'utf8'), source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    for (const [name, members] of Object.entries(classes)) {
      const declaration = source.statements.find(row => ts.isClassDeclaration(row) && row.name?.text === name); assert.ok(declaration);
      for (const [member, expected] of Object.entries(members)) {
        const node = declaration.members.find(row => (ts.isConstructorDeclaration(row) ? 'constructor' : row.name?.getText(source)) === member);
        assert.ok(node); assert.equal(hash(node.getText(source)), expected, file + ':' + member);
      }
    }
  }
  report.checks.push('All existing emitted native members and 36 core modules match the accepted baseline; two modules add methods and one new module extends the closure to 39.');
  fixture = await receiptFixture(output, corpusFactory(), { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths: CodePathsV2 });
  const attach = () => { const original = fixture.catalog.evidence.bind(fixture.catalog); fixture.catalog.evidence = id => { originalReads++; return original(id); };
    captures = new NativeCaptures(fixture.analysis, { paths: fixture.paths }); };
  attach(); report.catalogId = fixture.store.receipts.catalogId; report.revisions = fixture.revisions;
  const folder = path.join(fixture.store.directory, 'path-receipts', report.catalogId);
  for (let index = 0; index < 32; index++) {
    await fixture.analyze('capacity-' + index); const first = await captures.capture({ buildId: fixture.buildId });
    const projection = JSON.parse(JSON.parse(await readFile(path.join(folder, first.receiptId + '.json'), 'utf8')).projectionJson);
    const second = await captures.capture({ buildId: fixture.buildId, inventoryId: projection.identity.inventoryId,
      generationId: projection.generationId, rootId: projection.roots.items[0].id });
    report.records.push(first.receiptId, second.receiptId);
  }
  const ids = (await readdir(folder)).map(name => name.slice(0, -5)).sort(); assert.equal(ids.length, 64);
  assert.deepEqual(ids, report.records.sort()); assert.equal(new Set(ids).size, 64);
  const hashes = {};
  for (const id of ids) { const bytes = await readFile(path.join(folder, id + '.json')); hashes[id] = hash(bytes); await raw('stored-' + id + '.json', bytes); }
  await raw('record-hashes.json', hashes);
  report.checks.push('32 explicit inventories produce exactly 64 distinct default/selected records at the unchanged storage limit.');
  const read = async (name, request = {}, budget) => {
    const before = fixture.counters(), originals = originalReads, memory = process.memoryUsage(), start = performance.now();
    const value = await captures.list(request, undefined, budget); const elapsed = performance.now() - start, after = fixture.counters();
    await raw(name + '.json', value); report.reads.push({ name, before, after, originals: originalReads - originals,
      elapsed, beforeMemory: memory, afterMemory: process.memoryUsage(), metrics: value.metrics, encodedBytes: Buffer.byteLength(JSON.stringify(value)) });
    assert.deepEqual(after, before); assert.equal(originalReads - originals, value.items.reduce((sum, row) => sum + row.originalCount, 0));
    assert.equal(value.metrics.pathWork, 0); assert.equal(value.metrics.publicationLocks, 0); assert.ok(value.metrics.work <= 1000000);
    assert.ok(value.metrics.wallMs <= 5000); assert.ok(Buffer.byteLength(JSON.stringify(value)) <= 65536);
    for (const item of value.items) {
      const record = JSON.parse(await readFile(path.join(folder, item.receiptId + '.json'), 'utf8')), projection = JSON.parse(record.projectionJson);
      assert.deepEqual(item, { receiptId: item.receiptId, buildId: projection.identity.buildId, rootId: projection.selection.rootId,
        titles: projection.graph.flows.map(flow => flow.title), originalCount: record.originals.length, dependencies: record.dependencies,
        stale: false, currentApplicability: 'not-checked' });
    }
    return value;
  };
  const traverse = async label => {
    const seen = []; let request = {}, generation;
    for (let index = 0; index < 16; index++) {
      const value = await read(label + '-' + index, request); generation ??= value.generationId;
      assert.equal(value.generationId, generation); assert.equal(value.totalStored, 64); assert.equal(value.scanned, 4);
      assert.equal(value.offset, index * 4); assert.equal(value.unavailableCount, 0); assert.equal(value.items.length, 4);
      assert.equal(value.previousOffset, index ? (index - 1) * 4 : null); assert.equal(value.nextOffset, index < 15 ? (index + 1) * 4 : null);
      seen.push(...value.items.map(row => row.receiptId)); request = { generationId: generation, offset: value.nextOffset };
    }
    assert.deepEqual(seen, ids); return generation;
  };
  const generation = await traverse('initial');
  assert.equal((await captures.capture({ buildId: fixture.buildId })).duplicate, true);
  assert.equal((await read('after-duplicate')).generationId, generation);
  await fixture.analyze('capacity-overflow'); await assert.rejects(captures.capture({ buildId: fixture.buildId }), { code: 'CAPTURE_STORAGE_FULL' });
  assert.equal((await read('after-full')).generationId, generation);
  report.checks.push('All 64 authorized summaries match actual files exactly once, including evicted inventories; duplicate/full refusal preserve the generation.');
  const single = await read('single', { pageSize: 1 }), limit = single.metrics.work + 500;
  const reduced = new OperationBudget({ limits: { work: limit } });
  try { await assert.rejects(captures.list({}, undefined, reduced), { code: 'CAPTURE_WORK_LIMIT' }); await raw('reduced-refusal.json', { limit, stats: reduced.stats() }); }
  finally { reduced.close(); }
  const retry = new OperationBudget({ limits: { work: limit } });
  try { assert.equal((await read('reduced-single', { pageSize: 1 }, retry)).items.length, 1); } finally { retry.close(); }
  report.checks.push('One reduced internal complete-operation budget rejects four candidates and admits the explicit one-candidate retry, with no HTTP override.');
  await captures.stop(); await fixture.restart(); attach(); assert.equal(fixture.store.receipts.catalogId, report.catalogId);
  assert.equal(await traverse('reopened'), generation);
  for (const id of ids) assert.equal(hash(await readFile(path.join(folder, id + '.json'))), hashes[id]);
  for (const [name, revision] of Object.entries(fixture.revisions)) { assert.equal(fixture.git(name, ['rev-parse', 'HEAD']), revision); assert.equal(fixture.git(name, ['status', '--porcelain']), ''); }
  report.checks.push('Reopened owned storage returns the same complete generation; every saved byte and source working tree remains unchanged.');
  report.failed = false;
} catch (error) { report.errors.push({ phase: 'scenario', message: error.stack }); }
finally {
  for (const [phase, close] of [['captures', () => captures?.stop()], ['fixture', () => fixture?.close()]]) {
    try { await close(); } catch (error) { report.errors.push({ phase, message: error.stack }); }
  }
  if (report.errors.length) report.failed = true;
  await raw('result.json', report);
}
console.log(JSON.stringify({ output, failed: report.failed, checks: report.checks.length, reads: report.reads.length, errors: report.errors }));
process.exitCode = report.failed ? 1 : 0;
