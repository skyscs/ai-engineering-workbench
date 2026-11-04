// @ts-expect-error Test-only exact delta proof; historical source pins remain unchanged.
import { assertHistoricalSource } from './fixtures/question-read-reference/verify.mjs';
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import type { Catalog } from '../src/catalog.js';
import type { CatalogStore } from '../src/store.js';
import { CodeAnalysis, referenceSource } from './fixtures/integration-reference/index.js';
import type { AnalysisLimits, AnalysisUnit } from '../src/code-analysis-types.js';
import { sha256 } from '../src/extract.js';
import { configuration } from './fixtures/prepared-qualification-config.js';
// @ts-expect-error Offline factory, independent tiny inputs only.
import { createWorkerReads } from '../../../scripts/loredock-worker-reads/analysis.mjs';
// @ts-expect-error Owned stopped fixture helpers, no resource execution.
import { openState, prepareSources, copyStoppedData } from '../../../scripts/loredock-capture-memory/fixture.mjs';
// @ts-expect-error Unchanged receipt implementation.
import { captureReceipt, readReceipt } from '../../../scripts/loredock-capture-memory/receipt.mjs';

interface State {
  store: CatalogStore & { withPreparedReads<T>(fn: () => T | Promise<T>): Promise<T> };
  catalog: Catalog; analysis: CodeAnalysis;
  paths: { read(input: object): Promise<unknown>; stop(): Promise<void> };
  services: Record<string, unknown>; counters(): Record<string, number>; close(): Promise<void>;
}
function observe(store: CatalogStore) {
  const prepare = store.db.prepare.bind(store.db);
  const preparations: string[] = [], executions: { sql: string; method: string; args: unknown[] }[] = [];
  store.db.prepare = sql => {
    preparations.push(sql); const statement = prepare(sql);
    for (const method of ['get', 'all', 'run', 'iterate'] as const) {
      const native = statement[method];
      Object.defineProperty(statement, method, { value(...args: unknown[]) {
        const normalized = [...args];
        // Only elapsed durations differ between executions of the same stopped copy.
        if (sql.startsWith('UPDATE code_analyses SET elapsedMs=') || sql.includes('elapsedMs=elapsedMs+?')) normalized[0] = '<elapsed>';
        if (sql.startsWith('UPDATE code_analyses SET status=?,published=1,elapsedMs=')) normalized[1] = '<elapsed>';
        executions.push({ sql, method, args: normalized }); return Reflect.apply(native, statement, args);
      } });
    }
    return statement;
  };
  return { preparations, executions, reset() { preparations.length = 0; executions.length = 0; } };
}
function inventory(s: State, id: string) {
  const row = s.store.one<Record<string, unknown>>('SELECT * FROM code_analyses WHERE id=?', id)!;
  const { elapsedMs, ...stable } = row; assert.ok(typeof elapsedMs === 'number' && elapsedMs >= 0);
  return { row: stable, units: s.store.all('SELECT * FROM code_analysis_files WHERE runId=? ORDER BY ordinal', id),
    sources: s.store.all('SELECT * FROM code_analysis_sources WHERE runId=? ORDER BY sourceId', id) };
}
async function setup(t: TestContext, limits: Partial<AnalysisLimits> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'worker-reads-')), config = await configuration(0);
  const Base = config.services.CodeAnalysis, Candidate = createWorkerReads(config.services);
  const services = (Factory: typeof CodeAnalysis) => ({ ...config.services, CodeAnalysis: class extends Factory {
    constructor(catalog: Catalog) { super(catalog, limits); }
  } });
  const states: State[] = []; let passed = false;
  t.after(async () => {
    for (const state of states) await state.close();
    if (passed) await rm(root, { recursive: true, force: true }); else t.diagnostic(`Retained worker-read regression: ${root}`);
  });
  const seedDir = path.join(root, 'seed'), seedReceipts = path.join(root, 'seed-receipts'); await mkdir(seedReceipts);
  const seed = openState(seedDir, seedReceipts, services(Base)) as State; states.push(seed);
  const corpus = config.corpusFactory(); corpus['a-locker-client']!['ui/worker-marker.ts'] = 'export const marker = "independent worker read fixture";\n';
  await prepareSources(root, corpus, seed);
  const project = seed.catalog.state(), build = seed.catalog.start('worker-index', project.sourceSetVersion, project.policyVersion);
  await seed.catalog.idle(); const initial = seed.analysis.start('worker-initial', build.id); await seed.analysis.idle();
  const pending = seed.analysis.start('worker-pending', build.id); seed.analysis.control(pending.id, 'pause'); await seed.analysis.idle();
  await seed.close();
  const arms: (State & { folder: string; directory: string; trace: ReturnType<typeof observe>; Factory: typeof CodeAnalysis })[] = [];
  for (const [name, Factory] of [['baseline', Base], ['candidate', Candidate]] as const) {
    const directory = path.join(root, name), folder = path.join(root, `${name}-receipts`); await mkdir(folder);
    await copyStoppedData(seedDir, directory); const state = openState(directory, folder, services(Factory)) as State; states.push(state);
    arms.push({ ...state, directory, folder, trace: observe(state.store), Factory });
  }
  assert.deepEqual(inventory(arms[0]!, pending.id), inventory(arms[1]!, pending.id));
  return { arms, Base, Candidate, services, states, buildId: build.id, id: pending.id, initialId: initial.id, pass() { passed = true; } };
}

test('worker seam remains bound to unchanged source dependencies and rejects incompatible services', async () => {
  const root = new URL('../../../', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('scripts/loredock-worker-reads/baseline.json', root), 'utf8')) as { files: Record<string, string> };
  for (const [file, expected] of Object.entries(manifest.files)) await assertHistoricalSource(file, await referenceSource(file), expected);
  assert.throws(() => createWorkerReads({ CodeAnalysis: class {} }), /Unsupported inventory worker seam/);
  const Candidate = createWorkerReads({ CodeAnalysis });
  assert.throws(() => new Candidate({ store: {} }), /require the scoped store/);
});

test('worker reads preserve every SQL execution, inventory identity, receipt and evicted history', async t => {
  const s = await setup(t);
  for (const arm of s.arms) {
    assert.equal(arm.analysis.start('worker-pending', s.buildId).id, s.id);
    assert.throws(() => arm.analysis.start('invalid/request', s.buildId), { code: 'INVALID_REQUEST' });
    arm.trace.reset(); const resumed = arm.analysis.control(s.id, 'resume'); assert.equal(resumed.status, 'running');
  }
  // Both workers have only been queued; admission remains synchronous and outside the scope.
  assert.deepEqual(s.arms[0]!.trace.preparations, s.arms[1]!.trace.preparations);
  assert.deepEqual(s.arms[0]!.trace.executions, s.arms[1]!.trace.executions);
  const before = s.arms.map(arm => arm.counters());
  for (const arm of s.arms) arm.trace.reset();
  await Promise.all(s.arms.map(arm => arm.analysis.idle()));
  const [baseline, candidate] = s.arms as [typeof s.arms[number], typeof s.arms[number]];
  assert.deepEqual(candidate.trace.executions, baseline.trace.executions);
  assert.ok(candidate.trace.preparations.length < baseline.trace.preparations.length);
  const writes = (arm: typeof candidate) => arm.trace.preparations.filter(sql => /^(INSERT|UPDATE|DELETE)/.test(sql));
  assert.deepEqual(writes(candidate), writes(baseline));
  t.diagnostic(`Worker preparations: ${baseline.trace.preparations.length} baseline, ${candidate.trace.preparations.length} candidate; executions: ${baseline.trace.executions.length}.`);
  const changes = s.arms.map((arm, index) => Object.fromEntries(Object.entries(arm.counters()).map(([key, value]) => [key, value - before[index]![key]!])));
  assert.deepEqual(changes[1], changes[0]); assert.equal(changes[0]!.originalReads, 9); assert.equal(changes[0]!.gitCalls, 0);
  assert.deepEqual(inventory(candidate, s.id), inventory(baseline, s.id));
  assert.ok(candidate.analysis.get(s.id).published); assert.equal(candidate.analysis.get(s.id).counts.parsed, 9);
  const receipts = [];
  for (const arm of s.arms) {
    assert.throws(() => new CodeAnalysis(arm.catalog), { code: 'BUSY' });
    assert.throws(() => new s.Candidate(arm.catalog), { code: 'BUSY' });
    const receipt = await captureReceipt(arm.services, arm.folder, { buildId: s.buildId });
    const raw = await readFile(receipt.file, 'utf8'); assert.equal(JSON.parse(raw).originals.length, 10); receipts.push(raw);
    for (const name of ['replace', 'evict']) { arm.analysis.start(name, s.buildId); await arm.analysis.idle(); }
    assert.throws(() => arm.analysis.get(s.id), { code: 'NOT_FOUND' }); const before = arm.counters();
    const history = await readReceipt(arm.catalog, arm.folder, receipt.receiptId);
    assert.deepEqual(history.projection, JSON.parse(JSON.parse(raw).projectionJson)); assert.equal(history.metrics.pathWork, 0);
    for (const key of ['factReads', 'snapshots', 'pathReads', 'gitCalls', 'writeCalls', 'changedRows']) assert.equal(arm.counters()[key], before[key]);
  }
  assert.equal(receipts[1], receipts[0]); s.pass();
});

test('pause, resume, cancel and stop preserve synchronous controls and release worker scopes', async t => {
  const s = await setup(t);
  for (const arm of s.arms) {
    assert.equal(arm.analysis.control(s.id, 'resume').status, 'running'); await yieldTurn();
    // A cooperative yield does not hold the worker's per-file transaction open.
    arm.store.transaction(() => arm.store.project());
    assert.equal(arm.analysis.control(s.id, 'pause').status, 'paused'); await arm.analysis.idle();
    assert.equal(arm.analysis.get(s.id).counts.parsed, 1);
    const first = arm.store.one<AnalysisUnit>("SELECT * FROM code_analysis_files WHERE runId=? AND status='parsed'", s.id)!;
    arm.trace.reset(); arm.store.project(); arm.store.project(); assert.equal(arm.trace.preparations.length, 2);
    arm.analysis.control(s.id, 'resume'); arm.trace.reset(); await arm.analysis.idle();
    assert.ok(arm.trace.preparations.includes('SELECT * FROM project WHERE id=1'));
    assert.deepEqual(arm.store.one('SELECT * FROM code_analysis_files WHERE runId=? AND fileId=?', s.id, first.fileId), first);
    const cancelled = arm.analysis.start('cancel', s.buildId); await yieldTurn(); arm.analysis.control(cancelled.id, 'cancel'); await arm.analysis.idle();
    assert.equal(arm.analysis.get(cancelled.id).counts.parsed, 1); assert.equal(arm.analysis.get(cancelled.id).status, 'cancelled');
    assert.throws(() => arm.analysis.control(cancelled.id, 'resume'), { code: 'CONFLICT' });
    const stopped = arm.analysis.start('stop', s.buildId); await yieldTurn(); await arm.analysis.stop(); await arm.analysis.stop();
    assert.equal(arm.analysis.get(stopped.id).status, 'interrupted'); assert.equal(arm.analysis.get(stopped.id).counts.parsed, 1);
    assert.throws(() => arm.analysis.start('after-stop', s.buildId), { code: 'STOPPING' });
    assert.throws(() => arm.analysis.control(stopped.id, 'resume'), { code: 'STOPPING' });
    await arm.close(); const reopened = openState(arm.directory, arm.folder, s.services(arm.Factory)) as State; s.states.push(reopened);
    assert.equal(reopened.analysis.get(stopped.id).status, 'interrupted'); reopened.analysis.control(stopped.id, 'resume'); await reopened.analysis.idle();
    assert.equal(reopened.analysis.get(stopped.id).counts.parsed, 9);
  }
  s.pass();
});

test('worker scopes keep original corruption, checkpoint validation and authorization failures visible', async t => {
  const s = await setup(t);
  for (const arm of s.arms) {
    arm.analysis.control(s.id, 'resume'); await yieldTurn(); arm.analysis.control(s.id, 'pause'); await arm.analysis.idle();
    const unit = arm.store.one<AnalysisUnit>("SELECT * FROM code_analysis_files WHERE runId=? AND status='parsed'", s.id)!;
    for (const [sql, args, code] of [
      ["UPDATE code_analysis_files SET payloadHash='broken' WHERE runId=?", [s.id], 'CORRUPT_CODE_CHECKPOINT'],
      ["UPDATE code_analyses SET manifestHash='broken' WHERE id=?", [s.id], 'CORRUPT_CODE_CHECKPOINT'],
      ["UPDATE code_analyses SET fingerprint='broken' WHERE id=?", [s.id], 'PARSER_CHANGED'],
      ['UPDATE files SET raw=? WHERE id=?', [Buffer.from('broken'), unit.fileId], 'CORRUPT_CODE_CHECKPOINT'],
      ["UPDATE spans SET hash='broken' WHERE fileId=?", [unit.fileId], 'CORRUPT_EVIDENCE'],
      // Both project changes trigger inventory fencing before resume admission.
      ['UPDATE project SET policyVersion=policyVersion+1', [], 'CONFLICT'],
      ['UPDATE project SET sourceSetVersion=sourceSetVersion+1', [], 'CONFLICT'],
    ] as const) {
      arm.store.db.exec('SAVEPOINT worker_corruption');
      try { arm.store.run(sql, ...args); assert.throws(() => arm.analysis.control(s.id, 'resume'), { code }); }
      finally { arm.store.db.exec('ROLLBACK TO worker_corruption; RELEASE worker_corruption'); }
    }
    // A later pending original is still re-read by the worker, despite statement reuse.
    const pending = arm.store.one<AnalysisUnit>("SELECT * FROM code_analysis_files WHERE runId=? AND status='pending' ORDER BY ordinal LIMIT 1", s.id)!;
    const raw = arm.store.one<{ raw: Uint8Array }>('SELECT raw FROM files WHERE id=?', pending.fileId)!.raw;
    arm.store.run('UPDATE files SET raw=? WHERE id=?', Buffer.alloc(raw.length, 120), pending.fileId);
    arm.analysis.control(s.id, 'resume'); await arm.analysis.idle();
    assert.equal(arm.analysis.get(s.id).counts.failed, 1);
    assert.equal(arm.store.one<AnalysisUnit>('SELECT * FROM code_analysis_files WHERE runId=? AND fileId=?', s.id, pending.fileId)!.reason, 'CORRUPT_EVIDENCE');
    arm.store.run('UPDATE files SET raw=? WHERE id=?', raw, pending.fileId);
  }
  assert.deepEqual(inventory(s.arms[1]!, s.id), inventory(s.arms[0]!, s.id)); s.pass();
});

test('worker prepared reads preserve bounded partial publication', async t => {
  const s = await setup(t, { documents: 2 });
  for (const arm of s.arms) { arm.analysis.control(s.id, 'resume'); await arm.analysis.idle();
    const result = arm.analysis.get(s.id); assert.equal(result.status, 'partial'); assert.ok(result.published);
    assert.equal(result.counts.parsed, 2); assert.equal(result.counts.unattempted, 7); }
  assert.deepEqual(inventory(s.arms[1]!, s.id), inventory(s.arms[0]!, s.id)); s.pass();
});

test('worker failures and live authorization changes retain scheduler cleanup and allow a fresh owner', async t => {
  for (const change of ['failure', 'policy', 'registry']) await t.test(change, async t => {
    const s = await setup(t);
    for (const arm of s.arms) {
      arm.analysis.control(s.id, 'resume'); await yieldTurn();
      const readBuildHeader = arm.catalog.readBuildHeader.bind(arm.catalog);
      if (change === 'failure') arm.catalog.readBuildHeader = () => { throw new Error('Deliberate worker read failure.'); };
      else arm.store.run(`UPDATE project SET ${change === 'policy' ? 'policyVersion=policyVersion+1' : 'sourceSetVersion=sourceSetVersion+1'}`);
      await arm.analysis.idle(); arm.catalog.readBuildHeader = readBuildHeader;
      assert.equal(arm.analysis.get(s.id).status, change === 'failure' ? 'failed' : 'fenced');
      if (change === 'failure') assert.equal(arm.analysis.get(s.id).reason, 'Code analysis failed: Deliberate worker read failure.');
      arm.trace.reset(); arm.store.project(); arm.store.project(); assert.equal(arm.trace.preparations.length, 2);
      await arm.analysis.stop(); const next = new arm.Factory(arm.catalog); await next.stop();
    }
    assert.deepEqual(inventory(s.arms[1]!, s.id), inventory(s.arms[0]!, s.id)); s.pass();
  });
});

test('resume between worker return and scheduler cleanup starts a fresh invocation', async t => {
  const s = await setup(t);
  for (const arm of s.arms) {
    // Deliberately drive the documented emitted-method seam at its return boundary.
    const run = Reflect.get(arm.analysis, 'run').bind(arm.analysis) as (id: string) => Promise<void>;
    let invocations = 0;
    Reflect.set(arm.analysis, 'run', async (id: string) => {
      invocations++; await run(id);
      if (invocations === 1) {
        assert.equal(arm.analysis.get(id).status, 'paused');
        assert.equal(arm.analysis.control(id, 'resume').status, 'running');
      }
    });
    arm.analysis.control(s.id, 'resume'); arm.analysis.control(s.id, 'pause'); await arm.analysis.idle();
    assert.equal(invocations, 2); assert.equal(arm.analysis.get(s.id).counts.parsed, 9);
    assert.ok(arm.analysis.get(s.id).published);
    arm.trace.reset(); arm.store.project(); arm.store.project(); assert.equal(arm.trace.preparations.length, 2);
  }
  assert.deepEqual(inventory(s.arms[1]!, s.id), inventory(s.arms[0]!, s.id)); s.pass();
});

test('a held worker scope isolates unrelated reads and lets concurrent paths retain fresh reads and fences', { timeout: 30000 }, async t => {
  let release: (() => void) | undefined;
  t.after(() => release?.());
  const s = await setup(t), arm = s.arms[1]!;
  const expected = await arm.paths.read({ buildId: s.buildId });
  let entered!: () => void, held = false;
  const started = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  const withReads = arm.store.withPreparedReads.bind(arm.store);
  arm.store.withPreparedReads = fn => withReads(async () => {
    if (!held) { held = true; entered(); await gate; }
    return fn();
  });
  arm.analysis.control(s.id, 'resume'); await started;
  try {
    arm.trace.reset(); arm.store.project(); arm.store.project(); assert.equal(arm.trace.preparations.length, 2);
    assert.deepEqual(await arm.paths.read({ buildId: s.buildId }), expected);
    const projectReads = arm.trace.preparations.filter(sql => sql === 'SELECT * FROM project WHERE id=1');
    assert.ok(projectReads.length > 2, 'The overlapping path falls back to fresh prepares.');
    arm.store.run('UPDATE project SET policyVersion=policyVersion+1');
    await assert.rejects(arm.paths.read({ buildId: s.buildId }), { code: 'POLICY_CHANGED' });
  } finally { release?.(); }
  await arm.analysis.idle(); assert.equal(arm.analysis.get(s.id).status, 'fenced');
  arm.trace.reset(); arm.store.project(); arm.store.project(); assert.equal(arm.trace.preparations.length, 2); s.pass();
});

test('a worker overlapping an existing read scope uses fresh preparations and releases ownership', { timeout: 30000 }, async t => {
  let release: (() => void) | undefined; t.after(() => release?.());
  const s = await setup(t), arm = s.arms[1]!;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const active = arm.store.withPreparedReads(async () => { arm.store.project(); await gate; arm.store.project(); });
  try {
    arm.analysis.control(s.id, 'resume'); arm.trace.reset(); await arm.analysis.idle();
    assert.ok(arm.analysis.get(s.id).published);
    assert.ok(arm.trace.preparations.filter(sql => sql === 'SELECT * FROM project WHERE id=1').length > 1);
  } finally { release?.(); await active; }
  await arm.analysis.stop();
  const withReads = arm.store.withPreparedReads;
  Reflect.set(arm.store, 'withPreparedReads', undefined);
  assert.throws(() => new s.Candidate(arm.catalog), /require the scoped store/);
  Reflect.set(arm.store, 'withPreparedReads', withReads);
  const next = new s.Candidate(arm.catalog); await next.stop(); s.pass();
});
