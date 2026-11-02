import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpus, totalmem, loadavg } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { bindingCorpus, sourceNames } from '../fixtures/loredock-binding-coverage/corpus.mjs';
import { prepareBindingCase, bindingGit } from './loredock-binding-fixture.mjs';
import { verifySavedTree } from './loredock-binding-metadata.mjs';
import { bindingProjection, bindingLimits } from './loredock-binding-coverage.mjs';
import { reopenSupport } from './loredock-durable-flow-probe.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)), digest = bytes => createHash('sha256').update(bytes).digest('hex');
export async function verifyBindingContract() {
  const contract = JSON.parse(await readFile(new URL('../fixtures/loredock-binding-coverage/baseline.json', import.meta.url), 'utf8'));
  for (const [file, hash] of Object.entries(contract.sourceHashes)) assert.equal(digest(await readFile(path.join(root, file))), hash);
  for (const expected of contract.generated) {
    const corpus = bindingCorpus(expected.total, expected.variant);
    const files = sourceNames.flatMap(source => Object.entries(corpus[source]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([file, { text, mode }]) => ({ source, path: file, mode, bytes: Buffer.byteLength(text), hash: digest(text) })));
    assert.equal(digest(JSON.stringify(files)), expected.fileManifestHash); assert.equal(files.length, expected.total);
    assert.equal(files.filter(file => /\.(ts|js|vue|java)$/i.test(file.path)).length, expected.codePaths);
    for (const item of expected.sources) {
      const rows = files.filter(file => file.source === item.source);
      assert.equal(rows.length, item.files); assert.equal(rows.reduce((sum, file) => sum + file.bytes, 0), item.bytes);
      assert.equal(digest(JSON.stringify(rows)), item.hash);
    }
  }
  return contract;
}
function graphCheck(value) {
  if (!value.graph) return;
  const graph = value.graph, nodes = new Map(graph.nodes.map(node => [node.id, node])), edges = new Map(graph.edges.map(edge => [edge.id, edge]));
  assert.equal(nodes.size, graph.nodes.length); assert.equal(edges.size, graph.edges.length);
  for (const item of [...graph.nodes, ...graph.edges, ...graph.flows]) for (const id of item.evidenceIds) assert.ok(graph.evidence[id]);
  for (const edge of graph.edges) assert.ok(nodes.has(edge.from) && nodes.has(edge.to));
  for (const flow of graph.flows) {
    assert.equal(flow.status, 'partial'); assert.equal(flow.nodeIds.length, flow.edgeIds.length + 1);
    assert.equal(new Set(flow.nodeIds).size, flow.nodeIds.length); assert.ok(flow.nodeIds.length <= 20);
    flow.edgeIds.forEach((id, i) => { assert.equal(edges.get(id).from, flow.nodeIds[i]); assert.equal(edges.get(id).to, flow.nodeIds[i + 1]); });
  }
  assert.ok(graph.nodes.length <= 160 && graph.edges.length <= 240 && graph.flows.length <= 2);
  assert.ok(Buffer.byteLength(JSON.stringify(value.envelope)) <= 512 * 1024);
}
const stable = value => { const { stats, measurement, reopened, harnessError, ...rest } = value;
  return { ...rest, deterministicWork: { units: stats.workUnits, checkpoints: stats.checkpoints } }; };
const normalizedPaths = value => value.graph?.flows.map(flow => flow.nodeIds.map(id => {
  const node = value.graph.nodes.find(node => node.id === id); return [node.sourceName, node.path, node.kind, node.label];
}));
const writes = value => value.graph?.flows.filter(flow => value.graph.nodes.find(node => node.id === flow.nodeIds.at(-1)).kind === 'document-write').length;
const emptyFailure = value => value.status === 'failed' && value.graph === null && !value.envelope && !value.resolution;

async function measure(services, state, options) {
  const before = state.counters(), memory = process.memoryUsage(), systemLoadBefore = loadavg(), began = performance.now();
  const hookWork = { gitCalls: 0, writeCalls: 0, changedRows: 0 };
  let peakRss = memory.rss, peakHeap = memory.heapUsed, samples = 0, lastBeat = began, maxDelayMs = 0;
  const sample = () => { const next = process.memoryUsage(); peakRss = Math.max(peakRss, next.rss); peakHeap = Math.max(peakHeap, next.heapUsed); samples++; };
  const timer = setInterval(() => { const now = performance.now(); maxDelayMs = Math.max(maxDelayMs, now - lastBeat - 10); lastBeat = now; sample(); }, 10);
  let value, projectionMs;
  try {
    const start = performance.now();
    value = await bindingProjection(services, state.analysis, options.buildId ?? state.buildId, { ...options, checkpoint: async info => {
      sample(); const hookBefore = state.counters();
      try { await options.checkpoint?.(info); }
      finally { const after = state.counters(); for (const key of Object.keys(hookWork)) hookWork[key] += after[key] - hookBefore[key]; sample(); }
    } });
    projectionMs = performance.now() - start;
    // Flush the heartbeat after synchronous final work, before receipt serialization/verification.
    await new Promise(resolve => setTimeout(resolve, 12)); sample();
  } finally { clearInterval(timer); }
  const afterMemory = process.memoryUsage();
  const measurement = { projectionMs, maxTimerDelayMs: maxDelayMs, intervalMs: 10, samples, systemLoadBefore,
    memory: { rssBefore: memory.rss, rssPeakSampled: peakRss, rssAfter: afterMemory.rss, heapBefore: memory.heapUsed, heapPeakSampled: peakHeap, heapAfter: afterMemory.heapUsed,
      limitation: 'Checkpoint/10ms samples may miss allocation peaks. One process, no forced GC or cold-cache claim.' },
    envelopeBytes: value.envelope ? Buffer.byteLength(JSON.stringify(value.envelope)) : 0, lifecycleHookWork: hookWork };
  try {
    graphCheck(value);
    value.reopened = reopenSupport(state, value.resolution ? { ...value, graph: { ...value.graph, evidence: value.resolution.evidence } } : value);
  } catch (error) { value.harnessError = { message: error.message, stack: error.stack }; }
  const after = state.counters();
  measurement.projectionWork = Object.fromEntries(Object.keys(before).map(key => [key, after[key] - before[key] - hookWork[key]]));
  return { ...value, measurement };
}

export async function runBindingProbe(services, output) {
  const contract = await verifyBindingContract(); await mkdir(output);
  const receipt = { schemaVersion: 'loredock-binding-coverage-measurement/1', createdAt: new Date().toISOString(), node: process.versions.node,
    hardware: { cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryBytes: totalmem() },
    implementationCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), contractHash: digest(JSON.stringify(contract)),
    implementationHashes: {}, limits: bindingLimits, cases: [], modelRequests: 0, productionChanged: false };
  for (const file of ['scripts/loredock-binding-coverage.mjs', 'scripts/loredock-binding-resolution.mjs', 'scripts/loredock-binding-admission.mjs',
    'scripts/loredock-binding-metadata.mjs', 'scripts/loredock-binding-fixture.mjs', 'scripts/loredock-binding-probe.mjs',
    ...['catalog','store','git','code-analysis','code-analysis-facts','code-analysis-types','code-typescript','code-java','system-map','map-document','http-headers','extract'].map(name => `apps/loredock/dist/${name}.js`)])
    receipt.implementationHashes[file] = digest(await readFile(path.join(root, file)));
  const save = () => writeFile(path.join(output, 'result.json'), JSON.stringify(receipt, null, 2) + '\n'); await save(); let observation = 0, baselinePaths;
  async function scenario(id, total, variant, run, setup = {}) {
    const entry = { id, totalFiles: total, variant, checks: [], observations: [] }; receipt.cases.push(entry); let state;
    const check = (name, passed) => entry.checks.push({ name, passed: !!passed });
    try {
      state = await prepareBindingCase(services, total, variant, setup); entry.revisions = state.revisions; entry.buildId = state.buildId;
      const inventoryId = await state.analyze('facts'); entry.inventory = state.analysis.get(inventoryId);
      const observe = async (options = {}) => {
        const value = await measure(services, state, options), name = `observation-${String(++observation).padStart(3, '0')}.json`;
        const bytes = JSON.stringify(value) + '\n'; await writeFile(path.join(output, name), bytes);
        entry.observations.push({ file: name, sha256: digest(bytes), bytes: Buffer.byteLength(bytes), status: value.status, error: value.error ?? value.harnessError ?? null,
          stats: value.stats, measurement: value.measurement, reopenedSpans: value.reopened?.length ?? 0, coverage: value.envelope?.coverage,
          graph: value.graph ? { nodes: value.graph.nodes.length, edges: value.graph.edges.length, flows: value.graph.flows.length, roots: value.resolution.roots.length, omissions: value.graph.omissions } : null });
        check(`${name}: original/support/envelope verification`, !value.harnessError);
        check(`${name}: no read-side Git/store mutations`, Object.values(value.measurement.projectionWork).every(value => value === 0));
        await save(); return value;
      };
      await run(state, observe, check, entry);
      for (const source of sourceNames) check(`${source}: owned checkout clean`, bindingGit(state.root, source, ['status', '--porcelain']) === '');
    } catch (error) { entry.error = { code: error.code ?? null, message: error.message, stack: error.stack,
      exitStatus: error.status ?? null, signal: error.signal ?? null, stderr: error.stderr?.toString() ?? null }; check('Scenario completed', false); }
    finally { await state?.close(); await save(); }
    console.log(`${id}: ${entry.checks.filter(item => item.passed).length}/${entry.checks.length}`);
  }
  const treeCase = { id: 'B00', checks: [], observations: [] }; receipt.cases.push(treeCase);
  const vectors = JSON.parse(await readFile(new URL('../fixtures/loredock-binding-coverage/tree-vectors.json', import.meta.url), 'utf8')).vectors;
  async function treeObservation(id, entries, expected) {
    let units = 0, value;
    try { value = { status: 'verified', tree: await verifySavedTree(entries, expected, { async step(_stage, count = 1) { units += count; } }) }; }
    catch (error) { value = { status: 'failed', error: { code: error.code ?? null, message: error.message } }; }
    value.workUnits = units;
    const name = `observation-${String(++observation).padStart(3, '0')}.json`, bytes = JSON.stringify(value) + '\n';
    await writeFile(path.join(output, name), bytes);
    treeCase.observations.push({ id, file: name, sha256: digest(bytes), bytes: Buffer.byteLength(bytes), ...value });
    await save(); return value;
  }
  for (const vector of vectors) {
    const first = await treeObservation(vector.id, vector.entries, vector.tree), repeat = await treeObservation(`${vector.id}-repeat`, vector.entries, vector.tree);
    treeCase.checks.push({ name: `${vector.id}: exact independent tree and deterministic work`, passed: first.tree === vector.tree && isDeepStrictEqual(first, repeat) });
  }
  const mixed = vectors.find(vector => vector.id === 'sha1-mixed');
  for (const [name, entries] of [
    ['wrong-blob', mixed.entries.map((entry, i) => i ? entry : { ...entry, blob: '0'.repeat(40) })],
    ['duplicate', [...mixed.entries, mixed.entries[0]]],
    ['ancestor', [...mixed.entries, { ...mixed.entries[0], path: 'bin' }]],
  ]) {
    const value = await treeObservation(name, entries, mixed.tree);
    treeCase.checks.push({ name: `${name}: invalid coverage rejected`, passed: value.status === 'failed' });
  }
  await save();
  const binding = (value, kind) => value.resolution?.resolutions.filter(item => item.kind === kind) ?? [];
  const noEdge = (value, kind) => value.status === 'available' && !value.resolution.edges.some(edge => edge.kind === kind);
  const blocked = (value, kind) => noEdge(value, kind) && binding(value, kind).some(item => item.incomplete);
  for (const [i, total] of [200, 800, 4000, 10000].entries()) await scenario(`B0${i + 1}`, total, 'base', async (_state, observe, check) => {
    const first = await observe(), repeat = await observe(); check('Exact repeat', isDeepStrictEqual(stable(first), stable(repeat)));
    const expected = contract.generated.find(item => item.total === total && item.variant === 'base');
    for (const [name, value] of [['first', first], ['repeat', repeat]]) {
      check(`${name}: complete useful path family`, value.status === 'available' && value.envelope.coverage.scannedFiles === expected.codePaths
        && value.envelope.coverage.metadataEntries === total && value.graph.nodes.length === 13 && value.graph.edges.length === 12 && writes(value) === 2);
      check(`${name}: verified trees retain unrelated gaps`, value.envelope?.coverage.sources.length === 20
        && value.envelope.coverage.sources.every(source => source.treeVerified && source.javaComplete && source.filesWithGaps > 0));
      check(`${name}: complete binding domains`, value.resolution?.resolutions.length > 0 && value.resolution.resolutions.every(item => !item.incomplete));
      check(`${name}: seven original critical nodes`, expected.support.every(item => value.graph?.nodes.some(node => node.sourceName === item.source
        && node.path === item.path && node.kind === item.kind && node.label === item.label && node.startLine <= item.line && node.endLine >= item.line)));
      const { measurement: m } = value;
      check(`${name}: <=5000ms wall`, m.projectionMs <= 5000);
      check(`${name}: <=100ms timer delay`, m.maxTimerDelayMs <= 100);
      check(`${name}: RSS growth <=256MiB and total <=1GiB`, m.memory.rssPeakSampled - m.memory.rssBefore <= 256 * 1024 ** 2 && m.memory.rssPeakSampled <= 1024 ** 3);
      check(`${name}: heap growth <=128MiB`, m.memory.heapPeakSampled - m.memory.heapBefore <= 128 * 1024 ** 2);
    }
    if (total === 800) baselinePaths = normalizedPaths(first);
  });
  await scenario('B05', 800, 'base', async (_s, observe, check) => {
    const first = await observe(), repeat = await observe(); check('Exact repeat', isDeepStrictEqual(stable(first), stable(repeat)));
    check('Normalized paths ignore registration order', first.status === 'available' && isDeepStrictEqual(normalizedPaths(first), baselinePaths));
  }, { registration: [...sourceNames].reverse() });
  for (const [id, variant] of [['B06', 'alternatives'], ['B07', 'truncated']]) await scenario(id, 200, variant, async (_s, observe, check) => {
    const first = await observe(), repeat = await observe(); check('Exact repeat', isDeepStrictEqual(stable(first), stable(repeat)));
    for (const kind of ['calls', 'implements']) {
      check(`${kind}: no false unique edge`, noEdge(first, kind));
      check(`${kind}: alternatives/completeness retained`, binding(first, kind).some(item => variant === 'alternatives'
        ? item.targets.length === 2 && item.outcome === 'ambiguous' && !item.incomplete : item.incomplete && item.domain.reasons['target-parser-gaps'] > 0));
    }
  });
  await scenario('B08', 200, 'unsupported-target', async (_s, observe, check) => {
    const value = await observe(); check('Unsupported relevant target blocks uniqueness', blocked(value, 'calls')
      && binding(value, 'calls').some(item => item.targets.length === 1 && item.outcome === 'unique' && item.incomplete));
  });
  await scenario('B09', 200, 'missing-target', async (_s, observe, check) => {
    const value = await observe(); check('Verified absent paths give a complete unresolved domain', noEdge(value, 'calls')
      && binding(value, 'calls').some(item => item.targets.length === 0 && item.outcome === 'unresolved' && !item.incomplete));
  });
  const excludedPaths = ['zz/client.js', 'zz/Shadow.java'];
  await scenario('B10', 200, 'alternatives', async (_s, observe, check) => {
    const value = await observe();
    for (const kind of ['calls', 'implements']) check(`${kind}: excluded alternate remains a blocker`, blocked(value, kind)
      && binding(value, kind).some(item => item.targets.length === 1 && item.domain.reasons['index-content-unavailable'] > 0));
  }, { excludedPaths });
  for (const [id, variant, documents, kind] of [['B11', 'base', 8, 'calls'], ['B12', 'alternatives', 14, 'implements']])
    await scenario(id, 200, variant, async (_s, observe, check, entry) => {
      const value = await observe(); check('Published partial inventory', entry.inventory.published && entry.inventory.status === 'partial');
      check(`${kind}: unattempted target blocks uniqueness`, blocked(value, kind)
        && binding(value, kind).some(item => item.domain.reasons['code-facts-unavailable'] > 0));
      if (id === 'B12') check('Visible handler retained before its unattempted alternative', binding(value, kind).some(item => item.targets.length === 1));
    }, { analysisLimits: { documents } });
  for (const [id, variant, kind, reason] of [['B13', 'java-gap', 'consumer', 'target-parser-gaps'], ['B14', 'java-case', 'implements', 'uncertain-java-profile']])
    await scenario(id, 200, variant, async (_s, observe, check) => {
      const value = await observe(); check('Relevant Java uncertainty blocks positive binding', binding(value, kind).some(item => item.incomplete && item.domain.reasons[reason] > 0)
        && noEdge(value, kind === 'consumer' ? 'dispatch-candidate' : kind));
    });
  await scenario('B15', 200, 'consumer-alternative', async (_s, observe, check) => {
    const value = await observe(); check('Both consumers remain ambiguous', noEdge(value, 'dispatch-candidate')
      && binding(value, 'consumer').some(item => item.targets.length === 2 && item.outcome === 'ambiguous' && !item.incomplete));
  });
  await scenario('B16', 200, 'alternatives', async (_s, observe, check) => {
    const value = await observe(); check('Every source share omission remains unknown', value.status === 'available'
      && value.envelope.coverage.sources.every(source => source.omittedPaths === 1 && !source.treeVerified && !source.javaComplete));
    for (const kind of ['calls', 'implements']) check(`${kind}: no false uniqueness through unknown paths`, blocked(value, kind));
  }, { catalogLimits: { paths: 180 } });
  await scenario('B17', 200, 'base', async (s, observe, check) => {
    const value = await observe(), source = s.catalog.readBuild(s.buildId).sources.find(source => source.name === 'booking-api');
    check('Failed enumeration remains explicit', value.status === 'available' && value.envelope.coverage.sources.some(item => item.sourceId === source.sourceId
      && item.status === 'failed' && !item.treeVerified && !item.javaComplete));
    check('No handler edge from unavailable source', noEdge(value, 'implements'));
  }, { failInventory: 'booking-api' });
  for (const [id, variant, kind, reason] of [['B18', 'symlink-target', 'calls', 'opaque-import-boundary'],
    ['B19', 'opaque-ancestor', 'calls', 'opaque-import-boundary'], ['B20', 'gitlink', 'consumer', 'opaque-java-boundary']])
    await scenario(id, 200, variant, async (_s, observe, check) => {
      const value = await observe(); check('Opaque tree entries still verify', value.envelope?.coverage.sources.every(source => source.treeVerified));
      check('Relevant opaque boundary blocks uniqueness', binding(value, kind).some(item => item.incomplete && item.domain.reasons[reason] > 0)
        && noEdge(value, kind === 'consumer' ? 'dispatch-candidate' : kind));
      if (id === 'B18') check('Retained suffix candidate does not hide symlink target', binding(value, kind).some(item => item.targets.length === 1));
    });
  await scenario('B21', 800, 'roots', async (_s, observe, check) => {
    const first = await observe(), repeat = await observe(); check('Exact repeat', isDeepStrictEqual(stable(first), stable(repeat)));
    check('Eight roots and six default omissions', first.resolution?.roots.length === 8 && first.graph?.omissions['unselected-roots'] === 6);
    const root = first.resolution?.nodes.find(node => node.label === 'isolated'); assert.ok(root);
    const generationId = first.envelope.generationId, selected = await observe({ rootId: root.id, generationId });
    check('Explicit isolated later root', selected.graph?.nodes.length === 1 && selected.graph.nodes[0].id === root.id
      && selected.graph.edges.length === 0 && selected.graph.flows.length === 1);
    for (const options of [{ rootId: 'foreign', generationId }, { rootId: root.id, generationId: 'foreign' }, { rootId: root.id }]) {
      const value = await observe(options); check('Foreign or missing root generation fails without pending data', emptyFailure(value));
    }
  });
  await scenario('B22', 2400, 'branches', async (_s, observe, check) => {
    const first = await observe(), repeat = await observe(); check('Exact repeat', isDeepStrictEqual(stable(first), stable(repeat)));
    check('Wide branches preserve useful paths and full resolution', first.status === 'available' && writes(first) === 2
      && first.envelope.coverage.scannedFiles === 2375 && binding(first, 'calls').length === 73);
    const limited = await observe({ limits: { traversals: 20, pendingPaths: 4 } });
    check('Branch work is bounded and disclosed', limited.status === 'available' && limited.graph.coverage.traversals <= 20
      && limited.graph.omissions['pending-path-limit'] > 0);
  });
  await scenario('B23', 800, 'cycle', async (_s, observe, check) => {
    const first = await observe(), repeat = await observe(); check('Exact repeat', isDeepStrictEqual(stable(first), stable(repeat)));
    check('Cycle does not hide supported writes', first.status === 'available' && writes(first) === 2);
  });
  await scenario('B24', 200, 'base', async (_s, observe, check) => {
    for (const limits of [{ files: 4 }, { facts: 4 }, { resolutionNodes: 1 }, { resolutionEdges: 1 }, { bindingRecords: 0 }, { alternativeReferences: 0 },
      { work: 0 }, { wallMs: 0 }, { metadataEntries: 4 }, { metadataBytes: 1 }]) {
      const value = await observe({ limits }); check(`Whole failure at ${Object.keys(limits)[0]} bound`, emptyFailure(value));
    }
    const display = await observe({ limits: { nodes: 1 } }); check('Whole-path display omission', display.status === 'available'
      && display.graph.nodes.length === 0 && display.graph.flows.length === 0 && display.graph.omissions['whole-path-node-limit'] === 2);
    const compared = await observe({ limits: { comparisons: 0 } }); check('Candidate comparison cap visible', compared.status === 'available'
      && compared.graph.omissions['comparison-limit'] > 0 && !compared.resolution.edges.some(edge => ['http-target', 'event-delivery'].includes(edge.kind)));
  });
  await scenario('B25', 200, 'base', async (_s, observe, check) => {
    for (const stage of ['metadata', 'read', 'resolve', 'admit']) {
      const controller = new AbortController(); let reached = false;
      const value = await observe({ signal: controller.signal, checkpoint(info) { if (info.stage === stage) { reached = true; controller.abort(); } } });
      check(`${stage}: cancellation discards pending data`, reached && emptyFailure(value) && value.error.code === 'CANCELLED');
    }
  });
  for (const stage of ['metadata', 'read', 'resolve', 'admit']) await scenario(`B26-${stage}`, 200, 'base', async (s, observe, check) => {
    let changed = false; const value = await observe({ checkpoint(info) { if (info.stage === stage && !changed) { changed = true; s.catalog.updatePolicy(['blocked']); } } });
    check('Policy mutation discards pending data', changed && emptyFailure(value) && value.error.code === 'ANALYSIS_FENCED');
  });
  await scenario('B27', 200, 'base', async (s, observe, check) => {
    let changed = false; const value = await observe({ checkpoint(info) { if (info.stage === 'resolve' && !changed) { changed = true; s.catalog.revoke(s.catalog.state().sources[0].id); } } });
    check('Source revocation discards pending data', changed && emptyFailure(value) && value.error.code === 'ANALYSIS_FENCED');
  });
  await scenario('B28', 200, 'base', async (s, observe, check) => {
    let changed = false; const value = await observe({ checkpoint: async info => { if (info.stage === 'metadata' && !changed) {
      changed = true; await s.catalog.addSource(path.join(s.root, 'sources', sourceNames.at(-1)));
    } } });
    check('Source addition discards pending data', changed && emptyFailure(value) && value.error.code === 'ANALYSIS_FENCED');
  }, { registration: sourceNames.slice(0, -1) });
  await scenario('B29', 200, 'base', async (s, observe, check) => {
    let changed = false; const value = await observe({ checkpoint: async info => { if (info.stage === 'admit' && !changed) {
      changed = true; await s.analyze('replacement'); await s.analyze('evict');
    } } });
    check('Inventory eviction discards pending data', changed && emptyFailure(value) && value.error.code === 'ANALYSIS_FENCED');
  });
  for (const corruption of ['facts', 'original']) await scenario(`B30-${corruption}`, 200, 'base', async (s, observe, check, entry) => {
    const file = s.store.one("SELECT id FROM files WHERE buildId=? AND path='zz/client.ts'", s.buildId);
    if (corruption === 'facts') s.store.run("UPDATE code_analysis_files SET payload='{}' WHERE runId=? AND fileId=?", entry.inventory.id, file.id);
    else s.store.run('UPDATE files SET raw=? WHERE id=?', Buffer.from('corrupt original'), file.id);
    const value = await observe(); check('Corruption fails without a graph', emptyFailure(value));
  });
  await scenario('B31', 200, 'alternatives', async (s, observe, check, entry) => {
    const file = s.store.one("SELECT * FROM files WHERE buildId=? AND path='zz/client.js'", s.buildId);
    const indexed = s.store.one("SELECT id FROM files WHERE buildId=? AND path='zz/client.ts'", s.buildId);
    assert.equal(file.status, 'excluded');
    const mutations = [
      ['remove-excluded-row', () => s.store.run('DELETE FROM files WHERE id=?', file.id)],
      ['alter-blob', () => s.store.run('UPDATE files SET blob=? WHERE id=?', '0'.repeat(40), file.id)],
      ['alter-mode', () => s.store.run("UPDATE files SET mode='100755' WHERE id=?", file.id)],
      ['alter-path', () => s.store.run("UPDATE files SET path='zz/other.js' WHERE id=?", file.id)],
      ['alter-root-tree', () => s.store.run('UPDATE build_sources SET tree=? WHERE buildId=? AND sourceId=?', '0'.repeat(40), s.buildId, file.sourceId)],
      ['duplicate-path', () => {
        const all = s.store.all.bind(s.store);
        s.store.all = (sql, ...args) => {
          const rows = all(sql, ...args);
          return sql.includes('FROM files WHERE buildId=? ORDER BY sourceId,path,id')
            ? rows.map(row => row.id === file.id ? { ...row, path: 'zz/client.ts' } : row) : rows;
        };
      }],
      ['ancestor-collision', () => s.store.run("UPDATE files SET path='zz' WHERE id=?", file.id)],
      ['remove-indexed-unit', () => s.store.run('DELETE FROM code_analysis_files WHERE runId=? AND fileId=?', entry.inventory.id, indexed.id)],
    ];
    entry.injections = [];
    for (const [name, mutate] of mutations) {
      const all = s.store.all, before = s.counters(); s.store.db.exec('SAVEPOINT owned_injection');
      try {
        mutate(); const after = s.counters();
        entry.injections.push({ name, work: Object.fromEntries(Object.keys(before).map(key => [key, after[key] - before[key]])) });
        const value = await observe(); check(`${name}: inconsistent metadata never establishes absence`, emptyFailure(value));
      } finally { s.store.all = all; s.store.db.exec('ROLLBACK TO owned_injection; RELEASE owned_injection'); }
    }
    let changed = false;
    const late = await observe({ checkpoint(info) { if (info.stage === 'admit' && !changed) {
      changed = true; s.store.run("UPDATE files SET reason='changed excluded metadata' WHERE id=?", file.id);
    } } });
    check('Final metadata fence discards pending graph', changed && emptyFailure(late) && late.error.code === 'METADATA_CHANGED');
  }, { excludedPaths });
  await scenario('B32', 200, 'base', async (s, observe, check) => {
    const first = await observe(); await s.restart(); const restored = await observe();
    check('Restart retains identity and supported paths', isDeepStrictEqual(stable(first), stable(restored)));
    const newBuild = await s.index('new-index'); await s.analyze('new-facts', newBuild);
    const historical = await observe(), repeat = await observe();
    check('Historical repeats remain exact', isDeepStrictEqual(stable(historical), stable(repeat)));
    check('Old index is explicitly stale with unchanged supported paths', historical.graph?.stale === true
      && historical.envelope.generationId === first.envelope?.generationId && isDeepStrictEqual(normalizedPaths(historical), normalizedPaths(first)));
  });
  receipt.summary = { cases: receipt.cases.length, observations: observation, checks: receipt.cases.reduce((sum, entry) => sum + entry.checks.length, 0),
    failures: receipt.cases.flatMap(entry => entry.checks.filter(check => !check.passed).map(check => ({ case: entry.id, ...check }))),
    reopenedSpans: receipt.cases.flatMap(entry => entry.observations).reduce((sum, item) => sum + (item.reopenedSpans ?? 0), 0),
    decision: 'Offline qualification only; production integration requires a separate typed backend task and unchanged historical consumers.' };
  await save(); return receipt.summary;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  assert.ok(process.argv[2], 'Pass a new output directory.');
  const modules = await Promise.all(['catalog','store','git','code-analysis','system-map','extract','http-headers','types'].map(name => import(`../apps/loredock/dist/${name}.js`)));
  const result = await runBindingProbe(Object.assign({}, ...modules), path.resolve(process.argv[2]));
  console.log(JSON.stringify(result, null, 2)); if (result.failures.length) process.exitCode = 1;
}
