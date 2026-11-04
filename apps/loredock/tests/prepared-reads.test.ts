import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { Catalog } from '../src/catalog.js';
import type { CatalogStore } from '../src/store.js';
import type { CodeAnalysis } from '../src/code-analysis.js';
import { codePathLimits, PathWork } from '../src/code-paths-work.js';
import { bindingMetadata, bindingDomains, assertBindingMetadata } from '../src/code-paths-metadata.js';
import { declarationMap } from '../src/system-map.js';
import { compareHeaders } from '../src/http-headers.js';
import { sha256 } from '../src/extract.js';
import { CatalogError } from '../src/types.js';
import { config } from './fixtures/streaming-snapshot-config.js';
// @ts-expect-error Opt-in request-local candidate, no frozen corpus or executable probe.
import { createCompactPaths } from '../../../scripts/loredock-compact-payloads/paths.mjs';
// @ts-expect-error Opt-in request scope, no frozen execution.
import { createPreparedReads } from '../../../scripts/loredock-prepared-reads/reuse.mjs';
// @ts-expect-error Independent owned fixture setup, not a frozen execution.
import { openState, prepareSources } from '../../../scripts/loredock-capture-memory/fixture.mjs';
// @ts-expect-error Unchanged receipt/history implementation shared by both readers.
import { captureReceipt, readReceipt } from '../../../scripts/loredock-capture-memory/receipt.mjs';

const dependencies = { codePathLimits, PathWork, bindingMetadata, bindingDomains, assertBindingMetadata, declarationMap, compareHeaders, sha256, CatalogError };
const Baseline = createCompactPaths(dependencies);
const prepared = createPreparedReads({ CatalogStore: config.services.CatalogStore, CodePaths: Baseline });
const Prepared = prepared.CodePaths;
interface State {
  store: CatalogStore; catalog: Catalog; analysis: CodeAnalysis;
  paths: { read(input: object, kind?: string): Promise<unknown>; stop(): Promise<void> };
  services: Record<string, unknown>; counters(): Record<string, number>; legacy(): string; close(): Promise<void>;
}
type Inputs = Record<string, Record<string, string>>;
async function setup(t: TestContext, mutate?: (inputs: Inputs) => void) {
  const root = await mkdtemp(path.join(tmpdir(), 'prepared-reads-')), receipts = path.join(root, 'receipts'); await mkdir(receipts);
  let passed = false, preparations = 0;
  const state = openState(path.join(root, 'data'), receipts, { ...config.services, ...prepared }) as State;
  const prepare = state.store.db.prepare.bind(state.store.db);
  state.store.db.prepare = sql => { preparations++; return prepare(sql); };
  const baseline = new Baseline(state.analysis);
  t.after(async () => { await baseline.stop(); await state.close(); if (passed) await rm(root, { recursive: true, force: true }); else t.diagnostic(`Retained prepared-read regression: ${root}`); });
  const corpus = config.corpusFactory(); corpus['a-locker-client']!['ui/empty.ts'] = 'export const marker = "independent prepared-read regression";\n'; mutate?.(corpus);
  await prepareSources(root, corpus, state);
  const project = state.catalog.state(), build = state.catalog.start('prepared-index', project.sourceSetVersion, project.policyVersion); await state.catalog.idle();
  const inventory = state.analysis.start('prepared-facts', build.id); await state.analysis.idle(); assert.ok(state.analysis.get(inventory.id).published);
  const input = { buildId: build.id };
  async function capture(paths: unknown, selection = {}) {
    const before = state.counters(), legacy = state.legacy(), preparedBefore = preparations;
    const result = await captureReceipt({ ...state.services, paths }, receipts, { ...input, ...selection });
    const preparedCount = preparations - preparedBefore, after = state.counters();
    for (const key of ['gitCalls', 'writeCalls', 'changedRows']) assert.equal(after[key], before[key]);
    assert.equal(state.legacy(), legacy);
    const raw = await readFile(result.file, 'utf8'), { wallMs: _wall, ...metrics } = result.metrics;
    return { result, raw, metrics, preparedCount, projection: JSON.parse(JSON.parse(raw).projectionJson),
      reads: Object.fromEntries(['factReads', 'snapshots', 'originalReads'].map(key => [key, after[key]! - before[key]!])) };
  }
  async function pair(selection = {}) {
    const expected = await capture(baseline, selection), actual = await capture(state.paths, selection);
    assert.equal(actual.raw, expected.raw); assert.deepEqual(actual.metrics, expected.metrics); assert.deepEqual(actual.reads, expected.reads);
    assert.equal(actual.reads.factReads, 9); assert.ok(actual.preparedCount < expected.preparedCount, `Expected fewer preparations: ${actual.preparedCount} < ${expected.preparedCount}`); return actual;
  }
  return { ...state, root, receipts, baseline, build, inventory, input, pair, capture,
    pass: () => { passed = true; } };
}

test('prepared reads preserve exact complete captures, selected/page/isolated behavior, work and evicted history', async t => {
  const s = await setup(t), first = await s.pair();
  for (let index = 0; index < 3; index++) assert.equal((await s.pair()).raw, first.raw);
  const pin = { inventoryId: first.projection.identity.inventoryId, generationId: first.projection.generationId };
  assert.equal(JSON.parse(first.raw).originals.length, 10);
  assert.equal(first.projection.coverage.scannedFiles, 9); assert.equal(first.projection.coverage.factEntries, 21);
  await s.pair({ ...pin, rootId: first.projection.roots.items[0].id });
  const page = await s.baseline.read({ ...s.input, ...pin, offset: 4 }, 'roots');
  assert.deepEqual(await s.paths.read({ ...s.input, ...pin, offset: 4 }, 'roots'), page);
  const isolated = await s.pair({ ...pin, rootId: page.roots.items[0].id }); assert.equal(JSON.parse(isolated.raw).originals.length, 5);
  for (const key of ['prepared-replacement', 'prepared-eviction']) { s.analysis.start(key, s.build.id); await s.analysis.idle(); }
  assert.throws(() => s.analysis.get(s.inventory.id)); const before = s.counters();
  const history = await readReceipt(s.catalog, s.receipts, first.result.receiptId);
  assert.deepEqual(history.projection, first.projection); assert.equal(history.metrics.pathWork, 0);
  for (const key of ['factReads', 'snapshots', 'pathReads', 'gitCalls', 'writeCalls', 'changedRows']) assert.equal(s.counters()[key], before[key]);
  s.pass();
});

test('prepared reads retain incomplete import domains, ambiguous handlers and unsupported consumers', async t => {
  const scenarios: [string, (inputs: Inputs) => void, string][] = [
    ['fact-free import target', inputs => { inputs['a-locker-client']!['ui/AABook.vue'] = inputs['a-locker-client']!['ui/AABook.vue']!.replace('./reserve', './empty'); }, 'incomplete-import-source'],
    ['ambiguous Java handler', inputs => { inputs['b-locker-api']!['OtherReservations.java'] = inputs['b-locker-api']!['Reservations.java']!; }, 'ambiguous-handler'],
    ['unsupported consumer', inputs => { inputs['c-locker-store']!['LockerWriter.java'] = inputs['c-locker-store']!['LockerWriter.java']!.replace('onMessage(', 'onReserved('); }, 'unresolved-consumer-method'],
  ];
  for (const [name, mutate, omission] of scenarios) await t.test(name, async t => {
    const s = await setup(t, mutate), expected = await s.capture(s.baseline), actual = await s.capture(s.paths);
    assert.equal(actual.raw, expected.raw); assert.deepEqual(actual.metrics, expected.metrics); assert.deepEqual(actual.reads, expected.reads);
    assert.ok(actual.projection.coverage.omissions[omission] > 0, omission); s.pass();
  });
});

test('prepared reads never skip invalid unreferenced payloads, originals, ranges or changed authorization', async t => {
  const s = await setup(t);
  const file = s.store.one<{ id: string }>("SELECT id FROM files WHERE buildId=? AND path='ui/empty.ts'", s.build.id)!;
  const mutations = [
    () => s.store.run("UPDATE code_analysis_files SET payloadHash='broken' WHERE runId=? AND fileId=?", s.inventory.id, file.id),
    () => s.store.run("UPDATE files SET raw=? WHERE id=?", Buffer.from('changed original'), file.id),
    () => {
      const unit = s.store.one<{ payload: string }>('SELECT payload FROM code_analysis_files WHERE runId=? AND fileId=?', s.inventory.id, file.id)!;
      const payload = JSON.parse(unit.payload); payload.ranges.symbols.push({ key: 'absent', startLine: 1, endLine: 1 });
      const bytes = JSON.stringify(payload), digest = sha256(bytes);
      s.store.run('UPDATE code_analysis_files SET payload=?,payloadBytes=?,payloadHash=? WHERE runId=? AND fileId=?', bytes, Buffer.byteLength(bytes), digest, s.inventory.id, file.id);
      const row = s.store.one<Record<string, string | number>>('SELECT * FROM code_analysis_files WHERE runId=? AND fileId=?', s.inventory.id, file.id)!;
      s.store.run('UPDATE code_analysis_files SET checkpointHash=? WHERE runId=? AND fileId=?', sha256(JSON.stringify([row.runId,row.fileId,row.ordinal,row.inputHash,row.status,row.reason,row.inputBytes,row.payloadBytes,row.gapCount,row.payloadHash])), s.inventory.id, file.id);
      s.store.run('UPDATE code_analyses SET payloadBytes=(SELECT sum(payloadBytes) FROM code_analysis_files WHERE runId=?) WHERE id=?', s.inventory.id, s.inventory.id);
    },
    () => s.store.run('UPDATE project SET policyVersion=policyVersion+1'),
    () => s.store.run('UPDATE project SET sourceSetVersion=sourceSetVersion+1'),
  ];
  for (const [index, mutate] of mutations.entries()) {
    s.store.db.exec('SAVEPOINT prepared_corruption');
    try {
      mutate(); let baselineCode: string | undefined;
      if (index === 4) {
        // The registry trigger unpublishes inventory before default selection.
        const before = s.counters(), expected = await s.baseline.read(s.input);
        assert.equal(expected.status, 'unavailable'); assert.equal(expected.reason.code, 'INVENTORY_UNAVAILABLE');
        assert.deepEqual(await s.paths.read(s.input), expected); assert.equal(s.counters().factReads, before.factReads);
      } else {
        await assert.rejects(s.baseline.read(s.input), (error: unknown) => { baselineCode = (error as { code: string }).code; return Boolean(baselineCode); }, `Baseline mutation ${index} must refuse.`);
        await assert.rejects(s.paths.read(s.input), (error: unknown) => (error as { code: string }).code === baselineCode);
      }
    } finally { s.store.db.exec('ROLLBACK TO prepared_corruption; RELEASE prepared_corruption'); }
    await s.pair();
  }
  s.pass();
});

test('prepared read overlap preserves PATHS_BUSY and stop cancels the owning read', async t => {
  const s = await setup(t);
  for (const stop of [false, true]) {
    let entered!: () => void, release!: () => void, reached = false;
    const started = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
    const paths = new Prepared(s.analysis, { async checkpoint({ stage }: { stage: string }) {
      if (stage !== 'resolve' || reached) return; reached = true; entered(); await gate;
    } });
    const running = paths.read(s.input); await started;
    try {
      await assert.rejects(paths.read(s.input), { code: 'PATHS_BUSY' });
      if (stop) {
        const rejected = assert.rejects(running, { code: 'CANCELLED' }), stopped = paths.stop();
        release(); await rejected; await stopped;
        await assert.rejects(paths.read(s.input), { code: 'SERVICE_STOPPED' });
      } else { release(); assert.deepEqual(await running, await s.baseline.read(s.input)); }
    } finally { release(); await paths.stop(); }
    await s.pair();
  }
  s.pass();
});

test('prepared reads leave the final receipt publication fence effective', async t => {
  const s = await setup(t); let expected: string | undefined;
  for (const paths of [s.baseline, s.paths]) {
    let reached = false;
    await assert.rejects(captureReceipt({ ...s.services, paths }, s.receipts, s.input, { insideFence() {
      reached = true; s.store.run('UPDATE project SET policyVersion=policyVersion+1');
    } }), (error: unknown) => {
      const code = (error as { code: string }).code; expected ??= code; return code === expected && code === 'RECEIPT_FENCED';
    });
    assert.ok(reached); await s.pair();
  }
  s.pass();
});

test('prepared reads retain cancellation and mutation fences after facts have been read', async t => {
  const s = await setup(t);
  for (const Factory of [Baseline, Prepared]) for (const scenario of ['cancel', 'metadata', 'policy']) {
    s.store.db.exec('SAVEPOINT prepared_fence'); let reached = false;
    const controller = new AbortController(), paths = new Factory(s.analysis, {
      checkpoint({ stage }: { stage: string }) {
        if (stage !== 'resolve' || reached) return; reached = true;
        if (scenario === 'cancel') controller.abort();
        if (scenario === 'metadata') s.store.run("UPDATE files SET reason='changed' WHERE buildId=?", s.build.id);
        if (scenario === 'policy') s.store.run('UPDATE project SET policyVersion=policyVersion+1');
      },
    });
    try {
      await assert.rejects(paths.read(s.input, 'paths', controller.signal), { code: scenario === 'cancel' ? 'CANCELLED' : scenario === 'metadata' ? 'METADATA_CHANGED' : 'ANALYSIS_FENCED' });
      assert.ok(reached);
    } finally { await paths.stop(); s.store.db.exec('ROLLBACK TO prepared_fence; RELEASE prepared_fence'); }
    await s.pair();
  }
  s.pass();
});
