import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertSourceRowsEqual } from '../loredock-memory-runner/source-rows.mjs';
import { openState, prepareSources, copyStoppedData, dataHashes, hash } from '../loredock-capture-memory/fixture.mjs';
import { memoryPoint } from '../loredock-capture-memory/observer.mjs';
import { captureReceipt, readReceipt } from '../loredock-capture-memory/receipt.mjs';
import { CaptureBudget } from '../loredock-capture-scale/budget.mjs';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createTerminalExporter } from '../loredock-terminal-ownership/export.mjs';

// Task 087 fork: one long-lived sequence, followed by intrusive terminal exports only.
// Generic injected inputs; no frozen corpus or production integration.
export async function runTerminalMemoryWorker({ sizeRoot, size, oracle, corpusFactory, expectedCorpusHash, services, terminalLimits }) {
  assert.ok(typeof sizeRoot === 'string' && path.isAbsolute(sizeRoot), 'Use an absolute owned output directory.');
  const arm = 'same-process';
  assert.deepEqual(oracle.arms, [arm]);
  assert.ok(Number.isSafeInteger(oracle.sourceCount) && oracle.sourceCount > 0 && oracle.sourceCount <= 20);
  for (const key of ['files', 'codeFiles']) assert.ok(Number.isSafeInteger(size[key]) && size[key] > 0);
  assert.match(expectedCorpusHash, /^[a-f0-9]{64}$/);
  assert.equal(typeof corpusFactory, 'function');
  assert.equal(oracle.resources.sampleIntervalMs, 5);
  assert.deepEqual(oracle.instrumentation, { profiler: false, phaseHooks: false, queryHooks: false, ownerHooks: false,
    ordinaryCounters: true, aggregateCharges: true, outerResourceSampler: true });
  const folder = path.join(sizeRoot, arm), dataDir = path.join(folder, 'data'), receipts = path.join(folder, 'receipts');
  await mkdir(folder, { recursive: true }); await mkdir(receipts); await mkdir(path.join(folder, 'raw'));
  const report = { arm, size, pid: process.pid, node: process.version, execArgv: process.execArgv, lifecycle: [], operations: [], errors: [], terminal: [] };
  const normalized = error => ({ name: error.name, code: error.code ?? null, message: error.message, stack: error.stack });
  const save = () => writeFile(path.join(folder, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  const point = (stage, detail = {}) => { report.lifecycle.push({ stage, ...memoryPoint(), ...detail }); };
  const exportStage = await createTerminalExporter(sizeRoot, terminalLimits);
  async function ownRuntime() {
    let state, serial = 0, metadata;
    async function archive(name, content) {
      const file = `raw/${String(++serial).padStart(3, '0')}-${name}.json`, bytes = typeof content === 'string' ? content : JSON.stringify(content);
      await writeFile(path.join(folder, file), bytes); return { file, bytes: Buffer.byteLength(bytes), sha256: hash(bytes) };
    }
    async function analyze(key) {
      const began = performance.now(); point(key + '-before');
      const run = state.analysis.start(key, metadata.buildId); await state.analysis.idle();
      for (let i = 0; i < 3 && ['paused', 'interrupted'].includes(state.analysis.get(run.id).status); i++) {
        point(key + '-resume', { attempt: i + 1 }); state.analysis.control(run.id, 'resume'); await state.analysis.idle();
      }
      const summary = state.analysis.get(run.id); point(key + '-after', { wallMs: performance.now() - began, summary }); await save();
      assert.ok(summary.published, 'Analysis must publish without increased bounds.'); return summary;
    }
    async function prepare() {
      point('preparation-before'); const began = performance.now(), corpus = corpusFactory(size);
      assert.equal(hash(JSON.stringify(corpus)), expectedCorpusHash);
      assert.equal(Object.keys(corpus).length, oracle.sourceCount);
      state = openState(dataDir, receipts, services);
      const revisions = await prepareSources(sizeRoot, corpus, state), project = state.catalog.state();
      const build = state.catalog.start('memory-initial', project.sourceSetVersion, project.policyVersion); await state.catalog.idle();
      for (let i = 0; i < 3 && ['paused', 'interrupted'].includes(state.store.buildRow(build.id).status); i++) {
        point('index-resume', { attempt: i + 1 }); state.catalog.control(build.id, 'resume'); await state.catalog.idle();
      }
      point('index-after', { build: state.store.buildRow(build.id) }); await save();
      state.catalog.readBuildHeader(build.id); metadata = { buildId: build.id, revisions };
      point('preparation-after', { wallMs: performance.now() - began }); await save();
      const inventory = await analyze('memory-initial-facts');
      const files = state.store.one('SELECT count(*) n FROM files WHERE buildId=?', build.id).n, sources = state.store.buildSources(build.id);
      report.preparation = { files, sources, inventory, revisions, buildId: build.id }; await save();
      assert.equal(files, size.files); assert.equal(inventory.candidates, size.codeFiles); assert.equal(inventory.counts.parsed, size.codeFiles);
      assert.equal(sources.length, oracle.sourceCount); assert.ok(sources.every(source => source.status === 'ready' && source.omitted === 0));
      let facts = 0, parsed = 0;
      for (const row of state.store.db.prepare('SELECT payload FROM code_analysis_files WHERE runId=? AND status=? ORDER BY ordinal').iterate(inventory.id, 'parsed')) {
        const value = JSON.parse(row.payload).facts; parsed++;
        facts += value.symbols.length + value.operations.length + value.calls.length + Object.keys(value.records).length;
      }
      assert.equal(parsed, size.codeFiles); assert.equal(facts, size.facts);
      assert.equal(state.store.one('SELECT sum(size) bytes FROM files WHERE buildId=?', build.id).bytes, size.bytes);
      metadata = { ...metadata, inventory, sources, files, facts, manifestHash: state.analysis.snapshot(inventory.id).manifestHash };
      point('preparation-close-before'); await state.close(); state = undefined; point('preparation-close-after');
      metadata.initialHashes = await copyStoppedData(dataDir, path.join(sizeRoot, 'initial-data'));
      await writeFile(path.join(sizeRoot, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n'); await save();
    }
    async function observed(name, action) {
      const before = state.counters(), legacy = state.legacy(), baseline = process.memoryUsage(), sums = { path: 0, receipt: 0 };
      const observe = ({ phase, units }) => { sums[phase] += units; };
      let peakRss = baseline.rss, peakHeap = baseline.heapUsed, last = performance.now(), maxSliceMs = 0;
      const sample = () => { const memory = process.memoryUsage(), now = performance.now(); peakRss = Math.max(peakRss, memory.rss);
        peakHeap = Math.max(peakHeap, memory.heapUsed); maxSliceMs = Math.max(maxSliceMs, now - last); last = now; };
      let result, error; const observerError = null, instrumentation = { enabled: false, phases: [], queries: [], prepareCalls: 0 };
      const began = performance.now(), timer = setInterval(sample, oracle.resources.sampleIntervalMs);
      try { result = await action(observe); }
      catch (cause) { error = normalized(cause); }
      finally {
        clearInterval(timer); sample();
      }
      const row = { name, wallMs: performance.now() - began, maxSliceMs, baselineMemory: baseline,
        peakRssMiB: peakRss / 1048576, heapGrowthMiB: (peakHeap - baseline.heapUsed) / 1048576,
        before, after: state.counters(), legacyBefore: legacy, legacyAfter: state.legacy(), sums, instrumentation,
        metrics: result?.metrics ?? null, error, observerError };
      row.artifact = await archive(name, { result: result ?? null, error: error ?? null, observerError: observerError ?? null });
      if (result?.status === 'captured') row.receipt = await archive(name + '-receipt', await readFile(result.file, 'utf8'));
      report.operations.push(row); await save(); // Preserve raw returns before evaluating any gate.
      return result;
    }
    const capture = (name, selection = {}) => observed(name, observe => captureReceipt(state.services, receipts,
      { buildId: metadata.buildId, ...selection }, { observeCharge: observe }));
    async function blocked(name, reason) { report.operations.push({ name, blocked: reason }); await save(); }
    function choose(items, expected) {
      const [sourceName, file, label, role] = expected;
      const matches = items.filter(item => item.status === 'available' && item.sourceName === sourceName && item.path === file && item.label === label && item.role === role);
      assert.equal(matches.length, 1, 'A dependent selection needs the exact typed root.'); return matches[0].id;
    }
  
    try {
      await prepare();
      point('snapshot-validation-before'); report.initialHashes = await dataHashes(dataDir);
      assert.deepEqual(report.initialHashes, metadata.initialHashes); point('snapshot-validation-after');
      point('opening-before'); state = openState(dataDir, receipts, services); point('opening-after');
      const initial = state.analysis.snapshot(metadata.inventory.id);
      assert.equal(initial.manifestHash, metadata.manifestHash); assertSourceRowsEqual(state.store.buildSources(metadata.buildId), metadata.sources);
      report.openingCounters = state.counters(); point('opening-validation-after'); await save();
      const first = await capture('first'); let projection;
      if (first?.status === 'captured') projection = JSON.parse(JSON.parse(await readFile(first.file, 'utf8')).projectionJson);
      for (let i = 1; i <= 3; i++) await capture('repeat-' + i);
      let pin, isolated;
      if (projection) {
        pin = { inventoryId: projection.identity.inventoryId, generationId: projection.generationId };
        let chosen;
        try { chosen = choose(projection.roots.items, oracle.selectedRoot); }
        catch (error) { await blocked('selected', normalized(error)); }
        if (chosen) await capture('selected', { ...pin, rootId: chosen });
        const page = await observed('page-4', async observe => {
          const budget = new CaptureBudget({ observe });
          try { const response = await state.paths.read({ buildId: metadata.buildId, ...pin, offset: 4 }, 'roots', undefined, budget);
            return { status: response.status, projection: response, metrics: budget.stats() }; } finally { budget.close(); }
        });
        if (page?.status === 'available') {
          try { isolated = choose(page.projection.roots.items, oracle.isolatedRoot); } catch (error) { await blocked('isolated', normalized(error)); }
          if (isolated) await capture('isolated', { ...pin, rootId: isolated });
        } else await blocked('isolated', 'The exact isolated root page is unavailable.');
      } else for (const name of ['selected', 'page-4', 'isolated']) await blocked(name, 'The first capture did not supply a selection.');
      if (first?.status === 'captured') {
        await analyze('memory-replacement-one'); await analyze('memory-replacement-two');
        assert.throws(() => state.analysis.get(metadata.inventory.id));
        report.evicted = metadata.inventory.id;
        const history = await observed('history', observe => readReceipt(state.catalog, receipts, first.receiptId, { observeCharge: observe }));
        if (history?.status === 'recorded') {
          point('terminal-history-before'); await save();
          report.terminal.push(await exportStage('after-history'));
          point('terminal-history-after'); await save();
        } else report.terminalBlocked = 'No recorded history is available.';
      } else await blocked('history', 'No first receipt exists.');
    } catch (error) { report.errors.push({ phase: 'worker', ...normalized(error) }); }
    finally {
      point('closure-before');
      try { await state?.close(); state = undefined; point('closure-after'); } catch (error) { report.errors.push({ phase: 'cleanup', ...normalized(error) }); }
      await save();
    }
  }
  await ownRuntime();
  // No service-bearing owning stack or active operation remains at the second export.
  await nextTurn();
  if (report.terminal.length === 1 && report.errors.length === 0) {
    try { point('terminal-release-before'); await save();
      report.terminal.push(await exportStage('after-release')); point('terminal-release-after');
    } catch (error) { report.errors.push({ phase: 'terminal-release', ...normalized(error) }); }
  }
  await save();
  return { report, exitCode: report.errors.length || report.operations.some(row => row.error || row.observerError || row.blocked) ? 1 : 0 };
}
