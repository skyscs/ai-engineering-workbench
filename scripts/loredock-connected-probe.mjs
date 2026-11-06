import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { connectedCorpus, criticalNodes, sourceNames } from '../fixtures/loredock-connected-admission/corpus.mjs';
import { prepareConnectedCase, connectedGit } from './loredock-connected-fixture.mjs';
import { connectedProjection, connectedLimits } from './loredock-connected-admission.mjs';
import { savedFlowProjection } from './loredock-durable-flows.mjs';
import { reopenSupport } from './loredock-durable-flow-probe.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)), digest = bytes => createHash('sha256').update(bytes).digest('hex');
export async function verifyConnectedContract() {
  const contract = JSON.parse(await readFile(new URL('../fixtures/loredock-connected-admission/baseline.json', import.meta.url), 'utf8'));
  for (const [file, hash] of Object.entries(contract.sourceHashes)) assert.equal(digest(await readFile(path.join(root, file))), hash, `Frozen input changed: ${file}`);
  for (const [variant, expected] of Object.entries(contract.generated)) {
    const corpus = connectedCorpus(variant), files = Object.entries(corpus).flatMap(([source, files]) => Object.entries(files).map(([file, text]) => ({ source, path: file, bytes: Buffer.byteLength(text), hash: digest(text) })));
    assert.deepEqual(files, expected.files);
    assert.deepEqual(criticalNodes.map(item => ({ ...item, line: corpus[item.source][item.path].split('\n').findIndex(line => line.includes(item.literal)) + 1 })), expected.support);
  }
  return contract;
}
function graphCheck(graph) {
  const nodes = new Map(graph.nodes.map(node => [node.id, node])), edges = new Map(graph.edges.map(edge => [edge.id, edge]));
  assert.equal(nodes.size, graph.nodes.length); assert.equal(edges.size, graph.edges.length);
  for (const item of [...graph.nodes, ...graph.edges, ...graph.flows]) for (const id of item.evidenceIds) assert.ok(graph.evidence[id]);
  for (const edge of graph.edges) assert.ok(nodes.has(edge.from) && nodes.has(edge.to));
  for (const flow of graph.flows) {
    assert.equal(flow.nodeIds.length, flow.edgeIds.length + 1); assert.equal(flow.status, 'partial');
    flow.edgeIds.forEach((id, index) => { const edge = edges.get(id); assert.equal(edge.from, flow.nodeIds[index]); assert.equal(edge.to, flow.nodeIds[index + 1]); });
  }
  assert.ok(graph.nodes.length <= 160 && graph.edges.length <= 240 && graph.flows.length <= 2);
  assert.ok(graph.flows.every(flow => flow.nodeIds.length <= 20));
  assert.ok(Buffer.byteLength(JSON.stringify(graph)) <= 512 * 1024);
}
async function measure(services, state, mode, buildId, options = {}) {
  const began = performance.now(), before = state.counters(), rssBefore = process.memoryUsage().rss;
  const hookWork = { gitCalls: 0, writeCalls: 0, changedRows: 0 }; let peak = rssBefore, samples = 1, value;
  const timer = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); samples++; }, 10);
  try {
    const afterFile = options.afterFile ? async info => {
      const start = state.counters(); try { await options.afterFile(info); } finally {
        const end = state.counters(); for (const key of Object.keys(hookWork)) hookWork[key] += end[key] - start[key];
      }
    } : undefined;
    const projectionStart = performance.now();
    value = mode === 'production' ? { status: 'available', graph: await services.codeFlows(state.catalog, buildId), payloads: [] }
      : mode === 'naive' ? await savedFlowProjection(services, state.analysis, buildId, 'wide')
        : await connectedProjection(services, state.analysis, buildId, { ...options, afterFile });
    value.projectionMs = performance.now() - projectionStart;
    if (value.graph) graphCheck(value.graph);
    const verifyStart = performance.now();
    value.reopened = reopenSupport(state, value.resolution ? { ...value, graph: { ...value.graph, evidence: { ...value.resolution.evidence, ...value.graph.evidence } } } : value);
    value.reopenMs = performance.now() - verifyStart;
  } catch (error) { value = { ...value, status: 'harness-failed', error: { code: error.code ?? null, message: error.message, stack: error.stack } }; }
  finally { clearInterval(timer); peak = Math.max(peak, process.memoryUsage().rss); samples++; }
  const after = state.counters();
  return { ...value, measurement: { wallMs: performance.now() - began, graphBytes: value.graph ? Buffer.byteLength(JSON.stringify(value.graph)) : 0,
    resultBytes: Buffer.byteLength(JSON.stringify(value)), projectionWork: Object.fromEntries(Object.keys(before).map(key => [key, after[key] - before[key] - hookWork[key]])),
    lifecycleHookWork: hookWork, processRss: { before: rssBefore, peakSampled: peak, after: process.memoryUsage().rss, samples, intervalMs: 10,
      limitation: 'Includes verification; misses synchronous peaks and child-process memory; no forced GC or isolated OS cache.' } } };
}
function stableReading(value) {
  const { timings, projectionMs, reopened, reopenMs, measurement, ...semantic } = value; return { ...semantic, reopened };
}
function support(value, expected) {
  return expected.map(item => ({ ...item, present: !!value.graph?.nodes.some(node => node.sourceName === item.source && node.path === item.path
    && node.kind === item.kind && node.label === item.label && node.startLine <= item.line && node.endLine >= item.line) }));
}
const hasWriteEnding = (graph, flow) => graph.nodes.find(node => node.id === flow.nodeIds.at(-1)).kind === 'document-write';

export async function runConnectedProbe(services, output) {
  const contract = await verifyConnectedContract(); await mkdir(output);
  const receipt = { schemaVersion: 'loredock-connected-admission-measurement/1', createdAt: new Date().toISOString(), node: process.versions.node,
    implementationCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), contractHash: digest(JSON.stringify(contract)),
    implementationHashes: {}, limits: connectedLimits, cases: [], modelRequests: 0, productionChanged: false };
  for (const file of ['scripts/loredock-connected-resolution.mjs','scripts/loredock-connected-admission.mjs','scripts/loredock-connected-fixture.mjs','scripts/loredock-connected-probe.mjs',
    ...['code-flows','code-analysis','code-analysis-facts','code-analysis-types','code-facts','code-typescript','code-java','system-map','map-document','http-headers','extract'].map(name => `apps/loredock/dist/${name}.js`)]) receipt.implementationHashes[file] = digest(await readFile(path.join(root, file)));
  const save = () => writeFile(path.join(output, 'result.json'), JSON.stringify(receipt, null, 2) + '\n'); await save();
  async function scenario(id, variant, run, analysisLimits = {}) {
    const entry = { id, variant, checks: [], observations: [] }; receipt.cases.push(entry); let state;
    const check = (name, passed) => entry.checks.push({ name, passed: !!passed });
    try {
      state = await prepareConnectedCase(services, variant, analysisLimits);
      entry.revisions = state.revisions; entry.buildId = state.buildId; entry.fingerprint = state.analysis.fingerprint;
      const observe = async (mode = 'connected', buildId = state.buildId, options = {}) => {
        const value = await measure(services, state, mode, buildId, options); entry.observations.push({ mode, buildId, ...value });
        check(`${mode} projection stays read-only`, Object.values(value.measurement.projectionWork).every(value => value === 0));
        check(`${mode} harness completes`, value.status !== 'harness-failed'); await save(); return value;
      };
      await run(state, observe, check, entry);
      for (const source of sourceNames) check(`${source} checkout stays clean`, connectedGit(state.root, source, ['status', '--porcelain']) === '');
    } catch (error) { entry.error = { code: error.code ?? null, message: error.message, stack: error.stack }; check('Scenario completed', false); }
    finally { await state?.close(); await save(); }
    console.log(`${id}: ${entry.checks.filter(item => item.passed).length}/${entry.checks.length}`);
  }
  for (const [id, variant] of [['C01','small'],['C02','distractions'],['C03','dense'],['C04','ambiguity'],['C05','truncated'],['C06','missing'],['C07-topic','topic'],['C07-environment','environment'],['C08','roots'],['C09','long-chain']]) {
    await scenario(id, variant, async (state, observe, check, entry) => {
      await state.analyze('facts'); const observations = {};
      for (const mode of ['production','naive','connected']) {
        observations[mode] = await observe(mode); const repeat = await observe(mode);
        check(`${mode} repeats exactly`, isDeepStrictEqual(stableReading(observations[mode]), stableReading(repeat)));
      }
      const candidate = observations.connected; check('Connected result is available', candidate.status === 'available' && !!candidate.graph);
      entry.support = Object.fromEntries(Object.entries(observations).map(([mode, value]) => [mode, support(value, contract.generated[variant].support)]));
      if (['C01','C02','C03'].includes(id)) {
        check('Seven required nodes survive admission', entry.support.connected.every(item => item.present));
        check('Both selected paths reach the write', candidate.graph.flows.length === 2 && candidate.graph.flows.every(flow => hasWriteEnding(candidate.graph, flow)));
        check('All runtime crossings stay candidate', candidate.graph.edges.filter(edge => ['http-target','event-delivery','dispatch-candidate'].includes(edge.kind)).every(edge => edge.status === 'candidate' && edge.gaps.length));
        check('Display contains exactly the supported path union', candidate.graph.nodes.length === 13 && candidate.graph.edges.length === 12);
      }
      if (id === 'C03') check('Both dense files retain eighty symbols without parser gaps', candidate.payloads.filter(file => ['a.ts','b.ts'].includes(file.path)).length === 2 && candidate.payloads.filter(file => ['a.ts','b.ts'].includes(file.path)).every(file => file.facts.symbols.length === 80 && !file.facts.gaps.length));
      if (id === 'C04') {
        check('Alternatives outside display remain ambiguous', ['calls','implements'].every(kind => candidate.resolution.resolutions.some(item => item.kind === kind && item.targets.length === 2 && item.outcome === 'ambiguous')));
        check('No arbitrary unique binding is displayed', !candidate.graph.edges.some(edge => ['calls','implements'].includes(edge.kind)));
        check('At least one ambiguity alternative is not displayed', candidate.resolution.resolutions.filter(item => item.outcome === 'ambiguous').some(item => item.targets.some(id => !candidate.graph.nodes.some(node => node.id === id))));
      }
      if (id === 'C05') {
        check('Both truncated sources are incomplete', Object.keys(candidate.coverage.incompleteSources).length === 2);
        check('One retained target is not called unique', ['calls','implements'].every(kind => candidate.resolution.resolutions.some(item => item.kind === kind && item.targets.length === 1 && item.outcome === 'incomplete')));
        check('Truncation cannot produce positive unique bindings', !candidate.graph.edges.some(edge => ['calls','implements'].includes(edge.kind)));
      }
      if (id === 'C06') {
        check('Missing fact units remain explicit', candidate.coverage.inventoryCounts.parsed === 4 && candidate.coverage.inventoryCounts.unattempted === 2);
        check('Missing later handler prevents uniqueness', candidate.resolution.resolutions.some(item => item.kind === 'implements' && item.outcome === 'incomplete') && !candidate.graph.edges.some(edge => edge.kind === 'implements'));
      }
      if (id.startsWith('C07')) {
        check('Contradictory delivery is absent', !candidate.resolution.edges.some(edge => ['event-delivery','dispatch-candidate'].includes(edge.kind)));
        check('HTTP matches remain qualified candidates', candidate.graph.edges.filter(edge => edge.kind === 'http-target').length === 2 && candidate.graph.edges.filter(edge => edge.kind === 'http-target').every(edge => edge.status === 'candidate' && edge.gaps.length));
      }
      if (id === 'C08') {
        const paths = candidate.graph.flows.map(flow => candidate.graph.nodes.find(node => node.id === flow.nodeIds[0]).path);
        check('Competing roots select A/B deterministically', isDeepStrictEqual(paths, ['src/A.vue','src/B.vue']));
        check('Two excluded roots remain disclosed', candidate.graph.omissions['unselected-roots'] === 2 && candidate.graph.partial === true);
      }
      if (id === 'C09') {
        check('Long path exposes its depth cap', candidate.graph.omissions['flow-step-limit'] > 0 && candidate.graph.flows.some(flow => flow.nodeIds.length === 20 && !hasWriteEnding(candidate.graph, flow)));
        check('Independent shorter root still reaches the write', candidate.graph.flows.some(flow => hasWriteEnding(candidate.graph, flow)));
      }
    }, id === 'C06' ? { documents: 4 } : {});
  }
  for (const [name, limits, expected] of [['facts',{ facts: 4 },'RESOLUTION_LIMIT'], ['time',{ wallMs: 0 },'SCAN_INCOMPLETE'], ['nodes',{ nodes: 1 },null], ['comparisons',{ comparisons: 0 },null]]) {
    await scenario(`C10-${name}`, 'small', async (state, observe, check) => {
      await state.analyze('facts'); const value = await observe('connected', state.buildId, { limits });
      if (expected) check('Incomplete universe returns no data', value.status === 'failed' && value.error.code === expected && value.graph === null && value.payloads.length === 0);
      if (name === 'nodes') check('Whole paths are atomically omitted', value.status === 'available' && !value.graph.nodes.length && !value.graph.edges.length && !value.graph.flows.length && value.graph.omissions['whole-path-node-limit'] === 2);
      if (name === 'comparisons') check('Comparison cap creates no invented cross-source candidate', value.status === 'available' && value.graph.omissions['comparison-limit'] > 0 && !value.graph.edges.some(edge => ['http-target','event-delivery'].includes(edge.kind)) && value.graph.limits.comparisons === 0);
    });
  }
  for (const change of ['add','revoke','policy','evict','original']) await scenario(`C11-${change}`, 'small', async (state, observe, check) => {
    const id = await state.analyze('first');
    if (change === 'evict') await state.analyze('second');
    if (change === 'add') await cp(path.join(state.root, 'sources/console'), path.join(state.root, 'extra'), { recursive: true });
    if (change === 'original') {
      const fileId = state.analysis.snapshot(id).fileIds[0], size = state.store.one('SELECT length(raw) n FROM files WHERE id=?', fileId).n;
      state.store.run('UPDATE files SET raw=? WHERE id=?', Buffer.alloc(size, 97), fileId);
    }
    let changed = false;
    const value = await observe('connected', state.buildId, { inventoryId: id, afterFile: change === 'original' ? undefined : async () => {
      if (changed) return; changed = true;
      if (change === 'add') await state.catalog.addSource(path.join(state.root, 'extra'));
      if (change === 'revoke') state.catalog.revoke(state.catalog.state().sources[0].id);
      if (change === 'policy') state.catalog.updatePolicy(['src']);
      if (change === 'evict') await state.analyze('third');
    } });
    check('Failure discards consumed source data', value.status === 'failed' && value.graph === null && !value.resolution && !value.inventory && value.payloads.length === 0);
    check('Expected failure code is retained', value.error?.code === (change === 'original' ? 'CORRUPT_EVIDENCE' : change === 'evict' ? 'NOT_FOUND' : 'ANALYSIS_FENCED'));
    if (change !== 'original') check('Change occurs after a consumed file', changed);
  });
  await scenario('C12-history', 'small', async (state, observe, check, entry) => {
    const first = await state.analyze('first'), old = await observe();
    const text = state.corpus.console['src/parcels.ts'] + '// Owned second revision.\n';
    await writeFile(path.join(state.root, 'sources/console/src/parcels.ts'), text);
    connectedGit(state.root, 'console', ['add','src/parcels.ts']); connectedGit(state.root, 'console', ['commit','-qm','Add owned second parcel revision']);
    const revision = connectedGit(state.root, 'console', ['rev-parse','HEAD']); entry.secondRevision = revision;
    for (const [file, original] of Object.entries(state.corpus.console)) state.originals.set(`console/${revision}/${file}`, file === 'src/parcels.ts' ? text : original);
    const next = await state.index('second'); await state.analyze('second', next);
    const oldHistorical = await observe(), current = await observe('connected', next);
    check('Original historical facts stay exact', isDeepStrictEqual(old.payloads, oldHistorical.payloads));
    check('Historical selected identities stay exact', isDeepStrictEqual(old.graph.flows, oldHistorical.graph.flows));
    await state.restart();
    check('Historical reading survives restart', isDeepStrictEqual(stableReading(oldHistorical), stableReading(await observe())));
    check('Current reading survives restart', isDeepStrictEqual(stableReading(current), stableReading(await observe('connected', next))));
    await state.analyze('third', next); const evicted = await observe('connected', state.buildId, { inventoryId: first });
    check('Eviction is explicit and has no graph', evicted.status === 'failed' && evicted.error.code === 'NOT_FOUND' && evicted.graph === null);
    check('Default historical read is unavailable', (await observe()).status === 'unavailable');
    check('Retained original citations still reopen', reopenSupport(state, old).length > 0);
  });
  receipt.summary = { cases: receipt.cases.length, checks: receipt.cases.flatMap(item => item.checks).length,
    failedChecks: receipt.cases.flatMap(item => item.checks.filter(check => !check.passed).map(check => ({ case: item.id, ...check }))),
    observations: receipt.cases.reduce((sum, item) => sum + item.observations.length, 0),
    reopenedSpanOccurrences: receipt.cases.flatMap(item => item.observations).reduce((sum, item) => sum + (item.reopened?.length ?? 0), 0),
    decision: 'Known synthetic policy qualification only. Keep production unchanged; integration requires its own provenance, missing-root navigation and compatibility contract.' };
  await save(); return receipt.summary;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  assert.ok(process.argv[2], 'Pass a new output directory.');
  const modules = await Promise.all(['catalog','store','git','code-analysis','code-flows','system-map','extract','http-headers','types'].map(name => import(`../apps/loredock/dist/${name}.js`)));
  const result = await runConnectedProbe(Object.assign({}, ...modules), path.resolve(process.argv[2]));
  console.log(JSON.stringify(result, null, 2)); if (result.failedChecks.length) process.exitCode = 1;
}
