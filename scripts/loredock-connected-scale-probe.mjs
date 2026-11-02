import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpus, totalmem } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { scaleCorpus, sourceNames } from '../fixtures/loredock-connected-scale/corpus.mjs';
import { prepareScaleCase, scaleGit } from './loredock-connected-scale-fixture.mjs';
import { scaleProjection, scaleLimits } from './loredock-connected-scale.mjs';
import { reopenSupport } from './loredock-durable-flow-probe.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)), digest = bytes => createHash('sha256').update(bytes).digest('hex');
export async function verifyScaleContract() {
  const contract = JSON.parse(await readFile(new URL('../fixtures/loredock-connected-scale/baseline.json', import.meta.url), 'utf8'));
  for (const [file, hash] of Object.entries(contract.sourceHashes)) assert.equal(digest(await readFile(path.join(root, file))), hash);
  for (const expected of contract.generated) {
    const corpus = scaleCorpus(expected.total, expected.variant);
    const files = sourceNames.flatMap(source => Object.entries(corpus[source]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([file, text]) => ({ source, path: file, bytes: Buffer.byteLength(text), hash: digest(text) })));
    assert.equal(digest(JSON.stringify(files)), expected.fileManifestHash); assert.equal(files.length, expected.total);
    assert.equal(files.filter(file => /\.(ts|js|vue|java)$/.test(file.path)).length, expected.codeFiles);
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
  const before = state.counters(), memory = process.memoryUsage(), began = performance.now();
  const hookWork = { gitCalls: 0, writeCalls: 0, changedRows: 0 };
  let peakRss = memory.rss, peakHeap = memory.heapUsed, samples = 0, lastBeat = began, maxDelayMs = 0;
  const sample = () => { const next = process.memoryUsage(); peakRss = Math.max(peakRss, next.rss); peakHeap = Math.max(peakHeap, next.heapUsed); samples++; };
  const timer = setInterval(() => { const now = performance.now(); maxDelayMs = Math.max(maxDelayMs, now - lastBeat - 10); lastBeat = now; sample(); }, 10);
  let value, projectionMs;
  try {
    const start = performance.now();
    value = await scaleProjection(services, state.analysis, state.buildId, { ...options, checkpoint: async info => {
      sample(); const hookBefore = state.counters();
      try { await options.checkpoint?.(info); }
      finally { const after = state.counters(); for (const key of Object.keys(hookWork)) hookWork[key] += after[key] - hookBefore[key]; sample(); }
    } });
    projectionMs = performance.now() - start;
    // Flush the heartbeat after synchronous final work, before receipt serialization/verification.
    await new Promise(resolve => setTimeout(resolve, 12)); sample();
  } finally { clearInterval(timer); }
  const afterMemory = process.memoryUsage();
  const measurement = { projectionMs, maxTimerDelayMs: maxDelayMs, intervalMs: 10, samples,
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

export async function runScaleProbe(services, output) {
  const contract = await verifyScaleContract(); await mkdir(output);
  const receipt = { schemaVersion: 'loredock-connected-scale-measurement/1', createdAt: new Date().toISOString(), node: process.versions.node,
    hardware: { cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryBytes: totalmem() },
    implementationCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), contractHash: digest(JSON.stringify(contract)),
    implementationHashes: {}, limits: scaleLimits, cases: [], modelRequests: 0, productionChanged: false };
  for (const file of ['scripts/loredock-connected-scale.mjs', 'scripts/loredock-connected-scale-resolution.mjs', 'scripts/loredock-connected-scale-admission.mjs',
    'scripts/loredock-connected-scale-fixture.mjs', 'scripts/loredock-connected-scale-probe.mjs',
    ...['catalog','store','code-analysis','code-analysis-facts','code-analysis-types','code-typescript','code-java','system-map','map-document','http-headers','extract'].map(name => `apps/loredock/dist/${name}.js`)])
    receipt.implementationHashes[file] = digest(await readFile(path.join(root, file)));
  const save = () => writeFile(path.join(output, 'result.json'), JSON.stringify(receipt, null, 2) + '\n'); await save(); let observation = 0, baselinePaths;
  async function scenario(id, total, variant, run, setup = {}) {
    const entry = { id, totalFiles: total, variant, checks: [], observations: [] }; receipt.cases.push(entry); let state;
    const check = (name, passed) => entry.checks.push({ name, passed: !!passed });
    try {
      state = await prepareScaleCase(services, total, variant, setup); entry.revisions = state.revisions; entry.buildId = state.buildId;
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
      for (const source of sourceNames) check(`${source}: owned checkout clean`, scaleGit(state.root, source, ['status', '--porcelain']) === '');
    } catch (error) { entry.error = { code: error.code ?? null, message: error.message, stack: error.stack }; check('Scenario completed', false); }
    finally { await state?.close(); await save(); }
    console.log(`${id}: ${entry.checks.filter(item => item.passed).length}/${entry.checks.length}`);
  }
  for (const [i, total] of [120, 600, 3600, 10000].entries()) await scenario(`S0${i + 1}`, total, 'base', async (_state, observe, check) => {
    const first = await observe(), repeat = await observe(); check('Exact repeat', isDeepStrictEqual(stable(first), stable(repeat)));
    const expected = contract.generated.find(item => item.total === total && item.variant === 'base');
    for (const [name, value] of [['first', first], ['repeat', repeat]]) {
      check(`${name}: complete useful path family`, value.status === 'available' && value.envelope.coverage.scannedFiles === expected.codeFiles
        && value.graph.nodes.length === 13 && value.graph.edges.length === 12 && writes(value) === 2);
      check(`${name}: seven original critical nodes`, expected.support.every(item => value.graph?.nodes.some(node => node.sourceName === item.source
        && node.path === item.path && node.kind === item.kind && node.label === item.label && node.startLine <= item.line && node.endLine >= item.line)));
      const { measurement: m } = value;
      check(`${name}: <=5000ms wall`, m.projectionMs <= 5000);
      check(`${name}: <=100ms timer delay`, m.maxTimerDelayMs <= 100);
      check(`${name}: RSS growth <=256MiB and total <=1GiB`, m.memory.rssPeakSampled - m.memory.rssBefore <= 256 * 1024 ** 2 && m.memory.rssPeakSampled <= 1024 ** 3);
      check(`${name}: heap growth <=128MiB`, m.memory.heapPeakSampled - m.memory.heapBefore <= 128 * 1024 ** 2);
    }
    if (total === 600) baselinePaths = normalizedPaths(first);
  });
  await scenario('S05', 600, 'base', async (_s, observe, check) => {
    const first = await observe(), repeat = await observe(); check('Exact repeat', isDeepStrictEqual(stable(first), stable(repeat)));
    check('Normalized paths ignore registration order', isDeepStrictEqual(normalizedPaths(first), baselinePaths));
  }, { registration: [...sourceNames].reverse() });
  for (const [id, variant] of [['S06','ambiguity'], ['S07','truncation']]) await scenario(id, 600, variant, async (_s, observe, check) => {
    const first = await observe(), repeat = await observe(); check('Exact repeat', isDeepStrictEqual(stable(first), stable(repeat)));
    for (const kind of ['calls', 'implements']) {
      check(`${kind}: no false unique edge`, first.status === 'available' && !first.resolution.edges.some(edge => edge.kind === kind));
      check(`${kind}: alternatives/incompleteness recorded`, first.resolution?.resolutions.some(item => item.kind === kind
        && (variant === 'ambiguity' ? item.targets.length === 2 && item.outcome === 'ambiguous' : item.outcome === 'incomplete')));
    }
  });
  await scenario('S08', 600, 'base', async (_s, observe, check, entry) => {
    const value = await observe(); check('Published partial inventory', entry.inventory.published && entry.inventory.status === 'partial');
    check('Missing target facts cannot establish bindings', value.status === 'available' && Object.keys(value.envelope.coverage.incompleteSources).length > 0
      && !value.resolution.edges.some(edge => ['implements','event-delivery','dispatch-candidate'].includes(edge.kind)));
  }, { analysisLimits: { documents: 20 } });
  await scenario('S09', 600, 'roots', async (_s, observe, check) => {
    const first = await observe(), repeat = await observe(); check('Exact repeat', isDeepStrictEqual(stable(first), stable(repeat)));
    check('Nine roots and seven default omissions', first.resolution?.roots.length === 9 && first.graph?.omissions['unselected-roots'] === 7);
    const root = first.resolution?.nodes.find(node => node.label === 'isolated'); assert.ok(root);
    const selected = await observe({ rootId: root.id }); check('Explicit isolated later root', selected.graph?.nodes.length === 1
      && selected.graph.nodes[0].id === root.id && selected.graph.edges.length === 0 && selected.graph.flows.length === 1);
  });
  await scenario('S10', 3600, 'branches', async (_s, observe, check) => {
    const first = await observe(), repeat = await observe(); check('Exact repeat', isDeepStrictEqual(stable(first), stable(repeat)));
    check('Wide branches preserve useful paths', first.status === 'available' && writes(first) === 2);
    const limited = await observe({ limits: { traversals: 20, pendingPaths: 4 } });
    check('Branch work is bounded and disclosed', limited.status === 'available' && limited.graph.coverage.traversals <= 20
      && limited.graph.omissions['pending-path-limit'] > 0);
  });
  await scenario('S11', 600, 'cycle', async (_s, observe, check) => {
    const first = await observe(), repeat = await observe(); check('Exact repeat', isDeepStrictEqual(stable(first), stable(repeat)));
    check('Cycle does not hide supported writes', first.status === 'available' && writes(first) === 2);
  });
  await scenario('S12', 120, 'base', async (_s, observe, check) => {
    for (const limits of [{ files: 4 }, { facts: 4 }, { resolutionNodes: 1 }, { resolutionEdges: 1 }, { bindingRecords: 0 }, { alternativeReferences: 0 }, { work: 0 }, { wallMs: 0 }]) {
      const value = await observe({ limits }); check(`Whole failure at ${Object.keys(limits)[0]} bound`, emptyFailure(value));
    }
    const display = await observe({ limits: { nodes: 1 } }); check('Whole-path display omission', display.status === 'available'
      && display.graph.nodes.length === 0 && display.graph.flows.length === 0 && display.graph.omissions['whole-path-node-limit'] === 2);
    const compared = await observe({ limits: { comparisons: 0 } }); check('Candidate comparison cap visible', compared.status === 'available'
      && compared.graph.omissions['comparison-limit'] > 0 && !compared.resolution.edges.some(edge => ['http-target','event-delivery'].includes(edge.kind)));
  });
  await scenario('S13', 120, 'base', async (_s, observe, check) => {
    for (const stage of ['read','resolve','admit']) {
      const controller = new AbortController(); let reached = false;
      const value = await observe({ signal: controller.signal, checkpoint(info) { if (info.stage === stage) { reached = true; controller.abort(); } } });
      check(`${stage}: cancellation discards pending data`, reached && emptyFailure(value) && value.error.code === 'CANCELLED');
    }
  });
  for (const stage of ['read','resolve','admit']) await scenario(`S14-${stage}`, 120, 'base', async (s, observe, check) => {
    let changed = false; const value = await observe({ checkpoint(info) { if (info.stage === stage && !changed) { changed = true; s.catalog.updatePolicy(['blocked']); } } });
    check('Policy mutation discards pending data', changed && emptyFailure(value) && value.error.code === 'ANALYSIS_FENCED');
  });
  await scenario('S15', 120, 'base', async (s, observe, check) => {
    let changed = false; const value = await observe({ checkpoint(info) { if (info.stage === 'resolve' && !changed) { changed = true; s.catalog.revoke(s.catalog.state().sources[0].id); } } });
    check('Source revocation discards pending data', changed && emptyFailure(value) && value.error.code === 'ANALYSIS_FENCED');
  });
  await scenario('S16', 120, 'base', async (s, observe, check) => {
    let changed = false; const value = await observe({ checkpoint: async info => { if (info.stage === 'admit' && !changed) {
      changed = true; await s.analyze('replacement'); await s.analyze('evict');
    } } });
    check('Inventory eviction discards pending data', changed && emptyFailure(value) && value.error.code === 'ANALYSIS_FENCED');
  });
  await scenario('S17', 120, 'base', async (s, observe, check) => {
    let changed = false; const value = await observe({ checkpoint: async info => { if (info.stage === 'read' && !changed) {
      changed = true; await s.catalog.addSource(path.join(s.root, 'sources', sourceNames.at(-1)));
    } } });
    check('Source addition discards pending data', changed && emptyFailure(value) && value.error.code === 'ANALYSIS_FENCED');
  }, { registration: sourceNames.slice(0, -1) });
  for (const corruption of ['facts','original']) await scenario(`S18-${corruption}`, 120, 'base', async (s, observe, check, entry) => {
    const file = s.store.one("SELECT id FROM files WHERE buildId=? AND path='z/provision.ts'", s.buildId);
    if (corruption === 'facts') s.store.run("UPDATE code_analysis_files SET payload='{}' WHERE runId=? AND fileId=?", entry.inventory.id, file.id);
    else s.store.run('UPDATE files SET raw=? WHERE id=?', Buffer.from('corrupt original'), file.id);
    const value = await observe(); check('Corruption fails without a graph', emptyFailure(value));
  });
  await scenario('S19', 120, 'base', async (s, observe, check) => {
    const first = await observe(); await s.restart(); const restored = await observe(); check('Restart retains identity and supported paths', isDeepStrictEqual(stable(first), stable(restored)));
  });
  receipt.summary = { cases: receipt.cases.length, observations: observation, checks: receipt.cases.reduce((sum, entry) => sum + entry.checks.length, 0),
    failures: receipt.cases.flatMap(entry => entry.checks.filter(check => !check.passed).map(check => ({ case: entry.id, ...check }))),
    reopenedSpans: receipt.cases.flatMap(entry => entry.observations).reduce((sum, item) => sum + item.reopenedSpans, 0),
    decision: 'Offline qualification only; production integration requires a separate typed backend task and unchanged historical consumers.' };
  await save(); return receipt.summary;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  assert.ok(process.argv[2], 'Pass a new output directory.');
  const modules = await Promise.all(['catalog','store','git','code-analysis','system-map','extract','http-headers','types'].map(name => import(`../apps/loredock/dist/${name}.js`)));
  const result = await runScaleProbe(Object.assign({}, ...modules), path.resolve(process.argv[2]));
  console.log(JSON.stringify(result, null, 2)); if (result.failures.length) process.exitCode = 1;
}
