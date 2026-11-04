import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareSources, dataHashes, copyStoppedData, hash } from '../loredock-capture-memory/fixture.mjs';
import { openNativeState } from './state.mjs';
import { assertSourceRowsEqual } from '../loredock-memory-runner/source-rows.mjs';
import { readBounded, readJSON, normalized } from './io.mjs';

// Trusted offline configuration; never imports a reserved corpus or experimental capture.
export async function runNativeWorker({ root, arm, config, services }) {
  assert.ok(path.isAbsolute(root)); assert.ok(['same-process', 'reopened-process'].includes(arm));
  const folder = path.join(root, arm), directory = path.join(folder, 'data'); await mkdir(path.join(folder, 'raw'), { recursive: true });
  const report = { schemaVersion: 'native-qualification-worker/1', arm, pid: process.pid, node: process.version, execArgv: process.execArgv,
    size: config.size, lifecycle: [], operations: [], errors: [] };
  let state, metadata;
  const save = () => writeFile(path.join(folder, 'result.json'), JSON.stringify(report, null, 2));
  const point = stage => report.lifecycle.push({ stage, ...process.memoryUsage() });
  const archive = async (name, raw) => { const file = `raw/${name}.json`; await writeFile(path.join(folder, file), raw);
    return { file, bytes: raw.length, sha256: hash(raw) }; };
  async function analyze(key) {
    point(key + '-before'); const job = state.analysis.start(key, metadata.buildId); await state.analysis.idle();
    for (let attempt = 0; attempt < 3 && ['paused', 'interrupted'].includes(state.analysis.get(job.id).status); attempt++) {
      state.analysis.control(job.id, 'resume'); await state.analysis.idle();
    }
    const summary = state.analysis.get(job.id); assert.ok(summary.published); point(key + '-after'); await save(); return summary;
  }
  async function prepare() {
    point('preparation-before'); const corpus = config.corpusFactory(); assert.equal(hash(JSON.stringify(corpus)), config.corpusHash);
    assert.equal(Object.keys(corpus).length, config.oracle.sourceCount);
    state = openNativeState(directory, services); const revisions = await prepareSources(root, corpus, state), project = state.catalog.state();
    const build = state.catalog.start('native-initial', project.sourceSetVersion, project.policyVersion); await state.catalog.idle();
    for (let attempt = 0; attempt < 3 && ['paused', 'interrupted'].includes(state.store.buildRow(build.id).status); attempt++) {
      state.catalog.control(build.id, 'resume'); await state.catalog.idle();
    }
    const header = state.catalog.readBuildHeader(build.id); metadata = { buildId: build.id };
    const inventory = await analyze('native-initial-facts'), snapshot = state.analysis.snapshot(inventory.id);
    const sources = state.store.buildSources(build.id), files = state.store.one('SELECT count(*) n FROM files WHERE buildId=?', build.id).n;
    assert.equal(files, config.size.files); assert.equal(inventory.candidates, config.size.codeFiles); assert.equal(inventory.counts.parsed, config.size.codeFiles);
    assert.ok(sources.every(row => row.status === 'ready' && row.omitted === 0));
    let facts = 0;
    for (const row of state.store.db.prepare('SELECT payload FROM code_analysis_files WHERE runId=? AND status=? ORDER BY ordinal').iterate(inventory.id, 'parsed')) {
      const value = JSON.parse(row.payload).facts; facts += value.symbols.length + value.operations.length + value.calls.length + Object.keys(value.records).length;
    }
    assert.equal(facts, config.size.facts); assert.equal(state.store.one('SELECT sum(size) bytes FROM files WHERE buildId=?', build.id).bytes, config.size.bytes);
    metadata = { catalogId: state.store.receipts.catalogId, buildId: build.id, revisions, inventory, manifestHash: snapshot.manifestHash, sources,
      policyVersion: snapshot.policyVersion, registryVersion: snapshot.registryVersion, sourceSetVersion: header.sourceSetVersion };
    point('preparation-close-before'); await state.close(); state = undefined; point('preparation-close-after');
    metadata.initialHashes = await copyStoppedData(directory, path.join(root, 'initial-data'));
    assert.ok(!Object.keys(metadata.initialHashes).some(name => name.startsWith('path-receipts/')));
    await copyStoppedData(path.join(root, 'initial-data'), path.join(root, 'reopened-process', 'data'));
    await writeFile(path.join(root, 'metadata.json'), JSON.stringify(metadata, null, 2)); await save();
  }
  async function observed(name, action) {
    const before = state.counters(), legacyBefore = state.legacy(), baseline = process.memoryUsage(), sums = { path: 0, receipt: 0 };
    let peakRss = baseline.rss, peakHeap = baseline.heapUsed, last = performance.now(), maxSliceMs = 0;
    const sample = () => { const memory = process.memoryUsage(), now = performance.now(); peakRss = Math.max(peakRss, memory.rss);
      peakHeap = Math.max(peakHeap, memory.heapUsed); maxSliceMs = Math.max(maxSliceMs, now - last); last = now; };
    let result, metrics, error, budget; const began = performance.now(), timer = setInterval(sample, 5);
    try {
      budget = new services.OperationBudget({ observe: ({ phase, units }) => { sums[phase] += units; } });
      result = await action(budget); metrics = result.metrics ?? budget.stats();
    } catch (cause) { error = normalized(cause); }
    finally { budget?.close(); clearInterval(timer); sample(); }
    const row = { name, wallMs: performance.now() - began, maxSliceMs, baselineMemory: baseline, peakRssMiB: peakRss / 1048576,
      heapGrowthMiB: (peakHeap - baseline.heapUsed) / 1048576, before, after: state.counters(), legacyBefore, legacyAfter: state.legacy(),
      sums, metrics: metrics ?? null, error: error ?? null, observerError: null,
      instrumentation: { enabled: false, phases: [], queries: [], prepareCalls: 0 } };
    report.operations.push(row);
    try {
      row.output = await archive(name + '-output', Buffer.from(JSON.stringify(result ?? null)));
      if (result?.status === 'captured') {
        assert.match(result.receiptId, /^[a-f0-9]{64}$/);
        row.receipt = await archive(name + '-receipt', await readBounded(path.join(directory, 'path-receipts', metadata.catalogId, result.receiptId + '.json'), 655360));
      }
    } catch (cause) { report.errors.push({ phase: 'archive', operation: name, ...normalized(cause) }); }
    await save(); return result;
  }
  const capture = (name, request = {}) => observed(name, budget => state.captures.capture({ buildId: metadata.buildId, ...request }, undefined, budget));
  const blocked = async (name, reason) => { report.operations.push({ name, blocked: reason }); await save(); };
  const choose = (items, expected) => { const matches = items.filter(item => item.status === 'available'
    && JSON.stringify([item.sourceName, item.path, item.label, item.role]) === JSON.stringify(expected)); assert.equal(matches.length, 1); return matches[0].id; };
  try {
    if (arm === 'same-process') await prepare(); else metadata = await readJSON(path.join(root, 'metadata.json'));
    report.initialHashes = await dataHashes(directory); assert.deepEqual(report.initialHashes, metadata.initialHashes);
    point('opening-before'); state = openNativeState(directory, services); point('opening-after');
    assert.equal(state.store.receipts.catalogId, metadata.catalogId); assert.equal(state.analysis.snapshot(metadata.inventory.id).manifestHash, metadata.manifestHash);
    assertSourceRowsEqual(state.store.buildSources(metadata.buildId), metadata.sources); await save();
    const first = await capture('first'); let projection;
    if (first?.status === 'captured') {
      const firstRow = report.operations[0]; if (firstRow.receipt) projection = JSON.parse((await readJSON(path.join(folder, firstRow.receipt.file))).projectionJson);
    }
    for (let repeat = 1; repeat <= 3; repeat++) await capture('repeat-' + repeat);
    if (projection) {
      const pins = { inventoryId: projection.identity.inventoryId, generationId: projection.generationId };
      let selected;
      try { selected = choose(projection.roots.items, config.oracle.selectedRoot); } catch (error) { await blocked('selected', normalized(error)); }
      if (selected) await capture('selected', { ...pins, rootId: selected });
      const page = await observed('page-4', budget => state.paths.read({ buildId: metadata.buildId, ...pins, offset: 4 }, 'roots', undefined, budget));
      if (page?.status === 'available') {
        let isolated; try { isolated = choose(page.roots.items, config.oracle.isolatedRoot); } catch (error) { await blocked('isolated', normalized(error)); }
        if (isolated) await capture('isolated', { ...pins, rootId: isolated });
      } else await blocked('isolated', 'The isolated root page is unavailable.');
    } else for (const name of ['selected', 'page-4', 'isolated']) await blocked(name, 'The first capture is unavailable.');
    if (first?.status === 'captured') {
      await analyze('native-replacement-one'); await analyze('native-replacement-two'); assert.throws(() => state.analysis.get(metadata.inventory.id));
      report.evicted = metadata.inventory.id; await observed('history', budget => state.captures.history(first.receiptId, undefined, budget));
    } else await blocked('history', 'No first receipt exists.');
  } catch (error) { report.errors.push({ phase: 'worker', ...normalized(error) }); }
  finally {
    point('closure-before'); try { await state?.close(); point('closure-after'); } catch (error) { report.errors.push({ phase: 'cleanup', ...normalized(error) }); }
    await save();
  }
  return { report, exitCode: report.errors.length || report.operations.some(row => row.error || row.blocked) ? 1 : 0 };
}
