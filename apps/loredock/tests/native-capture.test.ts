import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { SourceGit } from '../src/git.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { CodePaths } from '../src/code-paths.js';
import { CodePathsV2 } from '../src/code-paths-v2.js';
import { NativeCaptures } from '../src/native-capture.js';
import { OperationBudget } from '../src/operation-budget.js';
import type { CaptureStage } from '../src/native-capture-work.js';
import type { NativeStorageOptions } from '../src/native-receipt-files.js';
import { corpusFactory } from './fixtures/memory-runner-config.js';
// @ts-expect-error Fresh owned tiny sources and lifecycle, without a frozen-family replay.
import { receiptFixture } from '../../../scripts/loredock-capture-scale/fixture.mjs';

type Options = NonNullable<ConstructorParameters<typeof NativeCaptures>[1]>;
interface State {
  root: string; buildId: string; store: CatalogStore; catalog: Catalog; analysis: CodeAnalysis; paths: CodePathsV2;
  counters(): { gitCalls: number; writeCalls: number; changedRows: number; factReads: number; snapshots: number; pathReads: number };
  analyze(key?: string): Promise<string>; restart(): Promise<void>; addSource(name?: string): Promise<void>; close(): Promise<void>;
}
async function setup(t: TestContext, storage: NativeStorageOptions = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'native-capture-')), corpus = corpusFactory();
  corpus['z-unshown-notes'] = { 'README.md': '# Separate owned context\nThis dependency has no displayed code node.\n' };
  class Store extends CatalogStore { constructor(directory: string) { super(directory, storage); } }
  const state = await receiptFixture(root, corpus, { Catalog, CatalogStore: Store, SourceGit, CodeAnalysis, CodePaths: CodePathsV2 }) as State;
  const owners: NativeCaptures[] = [];
  t.after(async () => { for (const owner of owners) await owner.stop(); await state.close(); await rm(root, { recursive: true, force: true }); });
  await state.analyze();
  return { state, service(options: Options = {}) { const owner = new NativeCaptures(state.analysis, { paths: state.paths, ...options }); owners.push(owner); return owner; },
    get folder() { return path.join(state.store.directory, 'path-receipts', state.store.receipts.catalogId); } };
}
function files(folder: string) { return existsSync(folder) ? readdirSync(folder).sort() : []; }
function barrier() { let release!: () => void; return { promise: new Promise<void>(resolve => { release = resolve; }), release: () => release() }; }
const stages: CaptureStage[] = ['start', 'projection', 'originals', 'prepared', 'handoff'];

test('native service records exact selections, shared work and scope; authorized history survives eviction and restart without fact reads', async t => {
  const s = await setup(t), state = s.state, charges: { phase: string; units: number }[] = [];
  const service = s.service({ budget: { observe: charge => { charges.push(charge); } } }), before = state.counters();
  const first = await service.capture({ buildId: state.buildId });
  assert.equal(first.status, 'captured'); assert.equal(first.created, true); assert.equal(first.metrics.publicationLocks, 1);
  assert.equal(first.metrics.totalWork, charges.reduce((sum, charge) => sum + charge.units, 0));
  assert.equal(first.metrics.pathWork, charges.filter(row => row.phase === 'path').reduce((sum, row) => sum + row.units, 0));
  const nativeBytes = readFileSync(path.join(s.folder, first.receiptId + '.json')), stored = JSON.parse(nativeBytes.toString());
  const beforeHistory = state.counters(), history = await service.history(first.receiptId);
  assert.equal(history.status, 'recorded'); assert.equal(history.currentApplicability, 'not-checked'); assert.equal(history.stale, false);
  assert.equal(history.metrics.pathWork, 0); assert.equal(history.metrics.publicationLocks, 0);
  assert.equal(JSON.stringify(history.projection), stored.projectionJson); assert.deepEqual(history.originals, stored.originals); assert.deepEqual(history.dependencies, stored.dependencies);
  for (const key of ['factReads', 'snapshots', 'pathReads'] as const) assert.equal(state.counters()[key], beforeHistory[key]);
  assert.equal(history.dependencies.length, 4); assert.ok(history.dependencies.some(dep => !history.originals.some(row => row.sourceId === dep.sourceId)));
  const repeat = await service.capture({ buildId: state.buildId }); assert.equal(repeat.receiptId, first.receiptId); assert.equal(repeat.created, false);
  const pins = { buildId: state.buildId, inventoryId: history.projection.identity.inventoryId, generationId: history.projection.generationId };
  const selected = await service.capture({ ...pins, rootId: history.projection.roots.items[0]!.id });
  assert.equal((await service.history(selected.receiptId)).projection.graph.flows.length, 1);
  const page = await state.paths.read({ ...pins, offset: 4 }, 'roots'); assert.ok(page.status === 'available');
  const isolated = await service.capture({ ...pins, rootId: page.roots.items[0]!.id });
  assert.equal((await service.history(isolated.receiptId)).projection.graph.nodes.length, 1);
  for (const key of ['gitCalls', 'writeCalls', 'changedRows'] as const) assert.equal(state.counters()[key], before[key]);
  await state.analyze('replace-one'); await state.analyze('replace-two');
  assert.equal((await service.history(first.receiptId)).projection.projectionId, history.projection.projectionId);
  await service.stop(); await state.restart(); const reopened = s.service(), historyAgain = await reopened.history(first.receiptId);
  assert.deepEqual(historyAgain.projection, history.projection); assert.deepEqual(historyAgain.originals, history.originals);
  assert.deepEqual(readFileSync(path.join(s.folder, first.receiptId + '.json')), nativeBytes);
  await state.addSource('new-context'); const stale = await reopened.history(first.receiptId);
  assert.equal(stale.stale, true); assert.deepEqual(stale.dependencies, history.dependencies); assert.equal(stale.dependencies.length, 4);
});

test('history denies policy-fenced originals and revocation of an undisplayed source purges native records', async t => {
  await t.test('policy', async sub => {
    const s = await setup(sub), service = s.service(), saved = await service.capture({ buildId: s.state.buildId });
    const file = path.join(s.folder, saved.receiptId + '.json'), before = readFileSync(file);
    s.state.catalog.updatePolicy(['private']); await assert.rejects(service.history(saved.receiptId), { code: 'POLICY_CHANGED' });
    assert.deepEqual(readFileSync(file), before);
  });
  await t.test('undisplayed scope', async sub => {
    const s = await setup(sub), service = s.service(), saved = await service.capture({ buildId: s.state.buildId }), history = await service.history(saved.receiptId);
    const hidden = history.dependencies.find(dep => !history.originals.some(row => row.sourceId === dep.sourceId))!;
    s.state.catalog.revoke(hidden.sourceId); assert.equal(s.state.store.source(hidden.sourceId).purge, 'completed');
    assert.equal(files(s.folder).length, 0); await assert.rejects(service.history(saved.receiptId), { code: 'RECEIPT_NOT_FOUND' });
  });
});

test('capture cancellation at every cooperative phase leaves no file and releases ownership', async t => {
  const s = await setup(t);
  for (const stage of stages) await t.test(stage, async () => {
    const controller = new AbortController(), service = s.service({ checkpoint(info) { if (info.stage === stage) controller.abort(); } });
    await assert.rejects(service.capture({ buildId: s.state.buildId }, controller.signal), { code: 'CANCELLED' });
    assert.deepEqual(files(s.folder), []); await service.stop();
  });
  assert.equal((await s.service().capture({ buildId: s.state.buildId })).created, true);
});

test('source and policy changes at every capture phase fence output before publication', async t => {
  for (const kind of ['policy', 'source'] as const) for (const stage of stages) await t.test(kind + ' at ' + stage, async sub => {
    const s = await setup(sub); let changed = false;
    const service = s.service({ checkpoint(info) { if (info.stage === stage && !changed) {
      changed = true;
      if (kind === 'policy') s.state.catalog.updatePolicy(['private']); else s.state.catalog.revoke(s.state.store.sources().find(row => row.name === 'z-unshown-notes')!.id);
    } } });
    await assert.rejects(service.capture({ buildId: s.state.buildId }), { code: 'RECEIPT_FENCED' }); assert.deepEqual(files(s.folder), []);
  });
});

test('history rechecks revocation after every yield without returning copied text', async t => {
  for (const stage of ['start', 'projection', 'originals', 'handoff'] as const) await t.test(stage, async sub => {
    const s = await setup(sub), initial = s.service(), saved = await initial.capture({ buildId: s.state.buildId });
    const service = s.service({ checkpoint(info) { if (info.stage === stage) s.state.catalog.revoke(s.state.store.sources().find(row => row.name === 'z-unshown-notes')!.id); } });
    await assert.rejects(service.history(saved.receiptId), { code: 'RECEIPT_FENCED' }); assert.deepEqual(files(s.folder), []);
  });
});

test('history cancellation at every cooperative phase preserves the record and releases ownership', async t => {
  const s = await setup(t), original = s.service(), saved = await original.capture({ buildId: s.state.buildId });
  const recorded = readFileSync(path.join(s.folder, saved.receiptId + '.json'));
  for (const stage of ['start', 'projection', 'originals', 'handoff'] as const) await t.test(stage, async () => {
    const controller = new AbortController();
    const interrupted = s.service({ checkpoint(info) { if (info.stage === stage) controller.abort(); } });
    await assert.rejects(interrupted.history(saved.receiptId, controller.signal), { code: 'CANCELLED' });
    assert.deepEqual(readFileSync(path.join(s.folder, saved.receiptId + '.json')), recorded);
    assert.equal((await original.history(saved.receiptId)).receiptId, saved.receiptId);
  });
});

test('complete-operation ownership, stop and v1 path ownership preserve externally supplied services', async t => {
  const s = await setup(t), arrived = barrier(), held = barrier();
  const first = s.service({ async checkpoint(info) { if (info.stage === 'start') { arrived.release(); await held.promise; } } }), second = s.service();
  const running = first.capture({ buildId: s.state.buildId }); const cancelled = assert.rejects(running, { code: 'CANCELLED' }); await arrived.promise;
  await assert.rejects(second.capture({ buildId: s.state.buildId }), { code: 'CAPTURE_BUSY' });
  await assert.rejects(second.history('a'.repeat(64)), { code: 'CAPTURE_BUSY' });
  const stopped = first.stop(); held.release(); await cancelled; await stopped; await first.stop();
  await assert.rejects(first.capture({ buildId: s.state.buildId }), { code: 'SERVICE_STOPPED' });
  assert.equal((await s.state.paths.read({ buildId: s.state.buildId })).status, 'available');
  const saved = await second.capture({ buildId: s.state.buildId }); assert.equal(saved.created, true);
  const v1Arrived = barrier(), v1Held = barrier(), v1 = new CodePaths(s.state.analysis, { async checkpoint() { v1Arrived.release(); await v1Held.promise; } });
  const pathRead = v1.read({ buildId: s.state.buildId }); await v1Arrived.promise;
  await assert.rejects(second.capture({ buildId: s.state.buildId }), { code: 'PATHS_BUSY' }); v1Held.release(); await pathRead; await v1.stop();
  assert.equal((await second.capture({ buildId: s.state.buildId })).created, false);
});

test('actual caller budget is shared without reset or close, and history honors every reduced codec bound', async t => {
  const s = await setup(t), service = s.service(), budget = new OperationBudget(); budget.charge('receipt', 7);
  const saved = await service.capture({ buildId: s.state.buildId }, undefined, budget);
  assert.equal(saved.metrics.totalWork, budget.stats().totalWork); assert.ok(budget.stats().receiptWork > 7); budget.check(); budget.close();
  await assert.rejects(service.capture({ buildId: s.state.buildId }, undefined, budget), { code: 'CLOSED_CAPTURE_BUDGET' });
  const limited = new OperationBudget({ limits: { work: 1 } });
  await assert.rejects(service.capture({ buildId: s.state.buildId }, undefined, limited), { code: 'CAPTURE_WORK_LIMIT' }); limited.close();
  const expired = new OperationBudget({ limits: { wallMs: 50 } }); await delay(60);
  await assert.rejects(service.history(saved.receiptId, undefined, expired), { code: 'CAPTURE_TIME_LIMIT' }); expired.close();
  for (const key of ['receiptBytes', 'projectionBytes', 'spans', 'textBytes', 'sources', 'depth'] as const)
    await assert.rejects(s.service({ limits: { [key]: 0 } }).history(saved.receiptId));
  assert.equal((await service.history(saved.receiptId)).receiptId, saved.receiptId);
});

test('external SQLite commits and worker publication fence prepared capture; the final source guard rejects competing writes', async t => {
  const s = await setup(t); let changed = false;
  const external = new DatabaseSync(path.join(s.state.store.directory, 'loredock.db')); t.after(() => external.close());
  const service = s.service({ checkpoint(info) { if (info.stage === 'prepared' && !changed) { changed = true;
    external.prepare('UPDATE builds SET reason=? WHERE id=?').run('Owned external change.', s.state.buildId);
  } } });
  await assert.rejects(service.capture({ buildId: s.state.buildId }), { code: 'RECEIPT_FENCED' }); assert.deepEqual(files(s.folder), []);
  const worker = s.service({ async checkpoint(info) { if (info.stage === 'projection') await s.state.analyze('overlapping-worker'); } });
  await assert.rejects(worker.capture({ buildId: s.state.buildId }), { code: 'RECEIPT_FENCED' }); assert.deepEqual(files(s.folder), []);
  const guarded = s.service({ insideFence() { assert.throws(() => external.prepare('UPDATE builds SET reason=? WHERE id=?').run('Blocked writer.', s.state.buildId), /locked/); } });
  assert.equal((await guarded.capture({ buildId: s.state.buildId })).created, true);
});

test('source guard release failure removes a newly linked result, preserves a duplicate and reports failed cleanup', async t => {
  const s = await setup(t), service = s.service(), original = s.state.store.db.exec.bind(s.state.store.db);
  let failures = 0;
  s.state.store.db.exec = sql => { if (sql === 'ROLLBACK' && failures > 0) { failures--; throw new Error('Injected source guard release failure.'); } return original(sql); };
  t.after(() => { s.state.store.db.exec = original; });
  failures = 1; await assert.rejects(service.capture({ buildId: s.state.buildId }), /Injected source guard release failure/); assert.deepEqual(files(s.folder), []);
  const saved = await service.capture({ buildId: s.state.buildId }), bytes = readFileSync(path.join(s.folder, saved.receiptId + '.json'));
  failures = 1; await assert.rejects(service.capture({ buildId: s.state.buildId }), /Injected source guard release failure/);
  assert.deepEqual(readFileSync(path.join(s.folder, saved.receiptId + '.json')), bytes);
  failures = 2; await assert.rejects(service.capture({ buildId: s.state.buildId }), { code: 'CAPTURE_GUARD_RELEASE_FAILED' });
  original('ROLLBACK'); await assert.rejects(service.history(saved.receiptId), { code: 'SERVICE_STOPPED' });
  await assert.rejects(s.service().history(saved.receiptId), { code: 'CLOSED_RECEIPT_STORAGE' });
});

test('history reopens original support outside the displayed path and refuses corrupt current source bytes', async t => {
  const s = await setup(t), service = s.service(), first = await service.capture({ buildId: s.state.buildId });
  const history = await service.history(first.receiptId), pins = { buildId: s.state.buildId,
    inventoryId: history.projection.identity.inventoryId, generationId: history.projection.generationId };
  const page = await s.state.paths.read({ ...pins, offset: 4 }, 'roots'); assert.ok(page.status === 'available');
  const isolated = await service.capture({ ...pins, rootId: page.roots.items[0]!.id }), saved = await service.history(isolated.receiptId);
  const hidden = saved.originals.find(row => !Object.hasOwn(saved.projection.graph.evidence, row.id)); assert.ok(hidden);
  const file = s.state.store.one<{ id: string; raw: Uint8Array }>('SELECT f.id,f.raw FROM files f JOIN spans s ON s.fileId=f.id WHERE s.id=?', hidden.id)!;
  const changed = Buffer.from(file.raw); changed[0] = changed[0]! ^ 1;
  s.state.store.run('UPDATE files SET raw=? WHERE id=?', changed, file.id);
  await assert.rejects(service.history(isolated.receiptId), { code: 'CORRUPT_EVIDENCE' });
  s.state.store.run('UPDATE files SET raw=? WHERE id=?', file.raw, file.id);
  assert.deepEqual((await service.history(isolated.receiptId)).originals, saved.originals);
});

test('complete capture preserves exact aggregate limits and its deadline across preparation', async t => {
  const s = await setup(t), service = s.service(), first = await service.capture({ buildId: s.state.buildId });
  // Reset only this owned test output; source rows, pins and bytes remain identical.
  unlinkSync(path.join(s.folder, first.receiptId + '.json'));
  const short = new OperationBudget({ limits: { work: first.metrics.totalWork } }); short.charge('receipt');
  await assert.rejects(service.capture({ buildId: s.state.buildId }, undefined, short), { code: 'CAPTURE_WORK_LIMIT' }); short.close();
  assert.deepEqual(files(s.folder), []);
  const exact = new OperationBudget({ limits: { work: first.metrics.totalWork } });
  const saved = await service.capture({ buildId: s.state.buildId }, undefined, exact);
  assert.equal(saved.receiptId, first.receiptId); assert.equal(saved.metrics.totalWork, first.metrics.totalWork); exact.check(); exact.close();
  const before = s.state.counters(), slow = s.service({ budget: { limits: { wallMs: 50 } }, async checkpoint(info) { if (info.stage === 'start') await delay(60); } });
  await assert.rejects(slow.capture({ buildId: s.state.buildId }), { code: 'CAPTURE_TIME_LIMIT' });
  assert.equal(s.state.counters().pathReads, before.pathReads); assert.deepEqual(files(s.folder), [saved.receiptId + '.json']);
});

test('capacity and publication failures preserve accepted records; failed cleanup recovers exact authorized history', async t => {
  await t.test('capacity', async sub => {
    const s = await setup(sub, { limits: { records: 1 } }), service = s.service(), first = await service.capture({ buildId: s.state.buildId });
    const history = await service.history(first.receiptId), pins = { buildId: s.state.buildId,
      inventoryId: history.projection.identity.inventoryId, generationId: history.projection.generationId };
    await assert.rejects(service.capture({ ...pins, rootId: history.projection.roots.items[0]!.id }), { code: 'CAPTURE_STORAGE_FULL' });
    assert.deepEqual(files(s.folder), [first.receiptId + '.json']); assert.equal((await service.capture({ buildId: s.state.buildId })).created, false);
  });
  await t.test('publication and recovery', async sub => {
    let failure: 'publish' | 'cleanup' | undefined;
    const s = await setup(sub, { observe(stage) {
      if (failure && stage === 'linked') { if (failure === 'publish') failure = undefined; throw new Error('Injected publication failure.'); }
      if (failure === 'cleanup' && stage === 'before-unlink') throw new Error('Injected cleanup failure.');
    } }), service = s.service();
    failure = 'publish'; await assert.rejects(service.capture({ buildId: s.state.buildId }), /Injected publication failure/); assert.deepEqual(files(s.folder), []);
    failure = 'cleanup'; await assert.rejects(service.capture({ buildId: s.state.buildId }), { code: 'RECEIPT_CLEANUP_FAILED' });
    const name = files(s.folder).find(name => name.endsWith('.json'))!; assert.ok(name); assert.ok(files(s.folder).includes('.pending'));
    await assert.rejects(service.history(name.slice(0, -5)), { code: 'DISABLED_RECEIPT_STORAGE' });
    const before = readFileSync(path.join(s.folder, name)); failure = undefined; await service.stop(); await s.state.restart();
    const recovered = await s.service().history(name.slice(0, -5)); assert.equal(recovered.status, 'recorded');
    assert.deepEqual(files(s.folder), [name]); assert.deepEqual(readFileSync(path.join(s.folder, name)), before);
  });
});
