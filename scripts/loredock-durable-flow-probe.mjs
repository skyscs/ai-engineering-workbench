import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createLoreDockFixture, fixtureGit, digest } from './loredock-fixture.mjs';
import { flowCorpus, sources, supportOracle, baselineEdges } from '../fixtures/loredock-durable-flows/corpus.mjs';
import { savedFlowProjection, selectFlowFiles, graphSemantics } from './loredock-durable-flows.mjs';
import { baselineFlowLimits } from './loredock-durable-flow-assembler.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function verifyDurableFlowInputs() {
  const contract = JSON.parse(await readFile(new URL('../fixtures/loredock-durable-flows/baseline.json', import.meta.url), 'utf8'));
  for (const [file, hash] of Object.entries(contract.sourceHashes)) assert.equal(digest(await readFile(path.join(root, file))), hash, `Frozen input changed: ${file}`);
  for (const [variant, expected] of Object.entries(contract.generated)) {
    const corpus = await flowCorpus(variant);
    const files = Object.entries(corpus).flatMap(([source, files]) => Object.entries(files).map(([file, text]) => ({ source, path: file, bytes: Buffer.byteLength(text), hash: digest(text) })));
    assert.deepEqual(files, expected.files);
    assert.deepEqual(supportOracle.map(item => ({ ...item, line: corpus[item.source][item.path].split('\n').findIndex(line => line.includes(item.literal)) + 1 })), expected.support);
  }
  return contract;
}

export async function prepareFlowCase(services, variant = 'small', limits = {}) {
  const fixture = await createLoreDockFixture(), corpus = await flowCorpus(variant), directory = path.join(fixture.root, 'durable-flow-data');
  let store, catalog, analysis, gitCalls = 0, writeCalls = 0;
  const revisions = {}, originals = new Map();
  try {
    for (const source of sources) {
      for (const [file, text] of Object.entries(corpus[source])) {
        const target = path.join(fixture.root, 'sources', source, file); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, text);
      }
      if (fixtureGit(fixture.root, source, ['status', '--porcelain'])) {
        fixtureGit(fixture.root, source, ['add', '--all']); fixtureGit(fixture.root, source, ['commit', '-qm', `Prepare owned ${variant} input`]);
      }
      revisions[source] = fixtureGit(fixture.root, source, ['rev-parse', 'HEAD']);
      for (const [file, text] of Object.entries(corpus[source])) {
        assert.equal(fixtureGit(fixture.root, source, ['show', `${revisions[source]}:${file}`], false), text);
        originals.set(`${source}/${revisions[source]}/${file}`, text);
      }
    }
    function open() {
      store = new services.CatalogStore(directory);
      const run = store.run.bind(store); store.run = (...args) => { writeCalls++; return run(...args); };
      const git = new services.SourceGit(), gitRun = git.run.bind(git);
      git.run = (...args) => { gitCalls++; return gitRun(...args); };
      catalog = new services.Catalog(store, git); analysis = new services.CodeAnalysis(catalog, limits);
    }
    open();
    for (const source of sources) await catalog.addSource(path.join(fixture.root, 'sources', source));
    const index = async key => { const state = catalog.state(), build = catalog.start(key, state.sourceSetVersion, state.policyVersion); await catalog.idle(); return build.id; };
    const buildId = await index('initial');
    return { fixture, corpus, revisions, originals, directory, buildId, index,
      get store() { return store; }, get catalog() { return catalog; }, get analysis() { return analysis; },
      counters: () => ({ gitCalls, writeCalls, changedRows: store.one('SELECT total_changes() n').n }),
      analyze: async (key, id = buildId) => { const run = analysis.start(key, id); await analysis.idle(); return run.id; },
      restart: async () => { await analysis.stop(); await catalog.stop(); store.close(); open(); },
      close: async () => { await analysis.stop(); await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); } };
  } catch (error) { await analysis?.stop(); await catalog?.stop(); store?.close(); await rm(fixture.root, { recursive: true, force: true }); throw error; }
}

function captureControl(services, state, buildId) {
  const start = performance.now(), graph = services.codeFlows(state.catalog, buildId), projectionMs = performance.now() - start;
  const selection = selectFlowFiles(state.catalog, buildId), payloads = []; let bytes = 0;
  const verifyStart = performance.now();
  for (const file of selection.files) {
    if (Math.max(file.size, file.storedBytes) > baselineFlowLimits.fileBytes || bytes + file.size > baselineFlowLimits.textBytes) continue;
    const issued = state.store.all('SELECT id FROM spans WHERE fileId=? ORDER BY startLine LIMIT ?', file.id, baselineFlowLimits.fileSpans + 1);
    if (issued.length > baselineFlowLimits.fileSpans) continue;
    const document = services.readMapDocument(state.catalog, buildId, file, issued);
    const facts = file.path.endsWith('.java') ? services.javaFacts(document.content) : services.typescriptFacts(document.content, file.path);
    payloads.push({ fileId: file.id, path: file.path, sourceId: file.sourceId, facts, ranges: services.factRanges(document.content, facts), evidence: document.refs }); bytes += file.size;
  }
  return { mode: 'control', status: 'available', graph, selection: selection.files, payloads,
    timings: { projectionMs, inputVerificationMs: performance.now() - verifyStart } };
}

function reopenSupport(state, value) {
  const refs = new Map(Object.values(value.graph?.evidence ?? {}).map(ref => [ref.id, ref]));
  for (const payload of value.payloads ?? []) for (const ref of payload.evidence) refs.set(ref.id, ref);
  const reopened = [];
  for (const ref of refs.values()) {
    const original = state.catalog.evidence(ref.id), text = state.originals.get(`${original.sourceName}/${original.revision}/${original.path}`);
    assert.notEqual(text, undefined, 'Citation is outside the independently frozen source bytes.');
    for (const key of ['sourceId', 'sourceName', 'revision', 'path', 'startLine', 'endLine', 'contentHash', 'spanHash']) assert.equal(original[key], ref[key]);
    assert.equal(original.buildId, value.graph?.buildId ?? value.buildId);
    assert.equal(original.contentHash, digest(text));
    assert.equal(original.blobId, servicesBlobHash(text, original.blobId.length));
    assert.equal(original.text, text.replaceAll('\r\n', '\n').split('\n').slice(original.startLine - 1, original.endLine).join('\n'));
    assert.equal(digest(original.text), original.spanHash);
    reopened.push({ id: original.id, buildId: original.buildId, sourceId: original.sourceId, path: original.path,
      revision: original.revision, blobId: original.blobId, contentHash: original.contentHash, startLine: original.startLine, endLine: original.endLine, spanHash: original.spanHash });
  }
  return reopened;
}
function servicesBlobHash(text, length) {
  // Owned fixtures use SHA-1 Git objects; the full blob header is part of the hash.
  assert.equal(length, 40); return createHashForBlob(text);
}
function createHashForBlob(text) { const raw = Buffer.from(text); return createHash('sha1').update(`blob ${raw.length}\0`).update(raw).digest('hex'); }

async function measure(services, state, mode, buildId = state.buildId, options = {}) {
  const before = state.counters(), began = performance.now(), rssBefore = process.memoryUsage().rss;
  let rssPeak = rssBefore, samples = 1;
  const interval = setInterval(() => { rssPeak = Math.max(rssPeak, process.memoryUsage().rss); samples++; }, 10);
  const excludedHook = { gitCalls: 0, writeCalls: 0, changedRows: 0 };
  let value;
  try {
    const afterFile = options.afterFile ? async info => {
      const begin = state.counters();
      try { await options.afterFile(info); } finally {
        const end = state.counters(); for (const key of Object.keys(excludedHook)) excludedHook[key] += end[key] - begin[key];
      }
    } : undefined;
    value = mode === 'control' ? captureControl(services, state, buildId)
      : await savedFlowProjection(services, state.analysis, buildId, mode, { ...options, afterFile });
    const reopenStart = performance.now(); value.reopened = reopenSupport(state, value); value.reopenMs = performance.now() - reopenStart;
  } catch (error) { value = { status: 'harness-failed', error: { code: error.code ?? null, message: error.message, stack: error.stack } }; }
  finally { clearInterval(interval); rssPeak = Math.max(rssPeak, process.memoryUsage().rss); samples++; }
  const after = state.counters(), projectionWork = Object.fromEntries(Object.keys(before).map(key => [key, after[key] - before[key] - excludedHook[key]]));
  return { ...value, measurement: { wallMs: performance.now() - began, serializedResultBytes: Buffer.byteLength(JSON.stringify(value)),
    graphBytes: value.graph ? Buffer.byteLength(JSON.stringify(value.graph)) : 0, payloadBytes: Buffer.byteLength(JSON.stringify(value.payloads ?? [])),
    projectionWork, excludedLifecycleHook: excludedHook,
    processRss: { before: rssBefore, peakSampled: rssPeak, after: process.memoryUsage().rss, samples, intervalMs: 10,
      limitation: 'Process samples including verification; excludes child-process memory, misses synchronous peaks and does not isolate GC/OS caches.' } } };
}

function support(value, expected) {
  if (!value.graph) return null;
  return expected.map(item => {
    const nodes = value.graph.nodes.filter(node => node.sourceName === item.source && node.path === item.path && node.kind === item.kind && node.label === item.label);
    const facts = (value.payloads ?? []).filter(payload => payload.path === item.path && payload.evidence[0]?.sourceName === item.source);
    const retained = facts.some(payload => item.kind === 'symbol' ? payload.facts.symbols.some(fact => fact.qualifiedName === item.label)
      : payload.facts.operations.some(fact => fact.kind === item.kind));
    return { ...item, retained, present: nodes.some(node => node.startLine <= item.line && node.endLine >= item.line), nodeIds: nodes.map(node => node.id) };
  });
}
const graphCounts = graph => Object.fromEntries([...new Set(graph.edges.map(edge => edge.kind))].sort().map(kind => [kind, graph.edges.filter(edge => edge.kind === kind).length]));
function sameReading(a, b) {
  const key = value => ({ status: value.status, graph: value.graph, selection: value.selection, payloads: value.payloads, coverage: value.coverage, error: value.error, reopened: value.reopened });
  return isDeepStrictEqual(key(a), key(b));
}

export async function runDurableFlowProbe(services, outputDirectory) {
  const contract = await verifyDurableFlowInputs();
  await mkdir(outputDirectory); // Refuse to overwrite previous observations.
  const receipt = { schemaVersion: 'loredock-durable-flow-comparison/1', createdAt: new Date().toISOString(), node: process.versions.node,
    implementationCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), contractHash: digest(JSON.stringify(contract)),
    implementationHashes: {}, cases: [], modelRequests: 0, productionChanged: false };
  for (const file of ['scripts/loredock-durable-flow-assembler.mjs', 'scripts/loredock-durable-flows.mjs', 'scripts/loredock-durable-flow-probe.mjs',
    ...['code-flows','code-analysis','code-analysis-facts','code-analysis-types','code-facts','code-typescript','code-java','map-document','extract','system-map','http-headers'].map(name => `apps/loredock/dist/${name}.js`)]) {
    receipt.implementationHashes[file] = digest(await readFile(path.join(root, file)));
  }
  const save = async () => writeFile(path.join(outputDirectory, 'result.json'), JSON.stringify(receipt, null, 2) + '\n');
  await save();
  async function scenario(id, variant, run, limits = {}) {
    const entry = { id, variant, checks: [], observations: [] }; receipt.cases.push(entry); let state;
    const check = (name, condition) => entry.checks.push({ name, passed: !!condition });
    try {
      state = await prepareFlowCase(services, variant, limits);
      entry.revisions = state.revisions; entry.buildId = state.buildId; entry.fingerprint = state.analysis.fingerprint;
      const observe = async (mode, buildId = state.buildId, options = {}) => {
        const observation = await measure(services, state, mode, buildId, options); entry.observations.push({ mode, buildId, ...observation });
        check(`${mode} projection is read-only`, Object.values(observation.measurement.projectionWork).every(value => value === 0));
        check(`${mode} harness completed`, observation.status !== 'harness-failed'); await save(); return observation;
      };
      await run(state, observe, check, entry);
      for (const source of sources) check(`${source} working tree stays clean`, fixtureGit(state.fixture.root, source, ['status', '--porcelain']) === '');
    } catch (error) { entry.error = { code: error.code ?? null, message: error.message, stack: error.stack }; check('Scenario completed', false); }
    finally { await state?.close(); await save(); }
    console.log(`${id}: ${entry.checks.filter(check => check.passed).length}/${entry.checks.length} mechanical checks`);
  }
  for (const [id, variant] of [['F01','small'], ['F02','long-path'], ['F03','dense'], ['F04','ambiguous'], ['F05-topic','topic'], ['F05-environment','environment']]) {
    await scenario(id, variant, async (state, observe, check, entry) => {
      await state.analyze('inventory');
      const control = await observe('control'), controlRepeat = await observe('control'); check('Control repeats exactly', sameReading(control, controlRepeat));
      const parity = await observe('parity'), parityRepeat = await observe('parity'); check('Parity repeats exactly', sameReading(parity, parityRepeat));
      const wide = await observe('wide'), wideRepeat = await observe('wide'); check('Wider reading repeats exactly', sameReading(wide, wideRepeat));
      check('Ordered parity graph matches production', !!parity.graph && isDeepStrictEqual(graphSemantics(control.graph), graphSemantics(parity.graph)));
      check('Exact selected files match', isDeepStrictEqual(control.selection, parity.selection));
      check('Facts, ranges and originals match', isDeepStrictEqual(control.payloads, (parity.payloads ?? []).map(({ fileId, path, sourceId, facts, ranges, evidence }) => ({ fileId, path, sourceId, facts, ranges, evidence }))));
      entry.support = Object.fromEntries([['control', control], ['parity', parity], ['wide', wide]].map(([name, value]) => [name, support(value, contract.generated[variant].support)]));
      entry.edgeCounts = Object.fromEntries([['control', control], ['parity', parity], ['wide', wide]].map(([name, value]) => [name, value.graph ? graphCounts(value.graph) : null]));
      check('Wider scan retains every critical fact', entry.support.wide?.every(item => item.retained));
      entry.widerSupportGate = entry.support.wide?.every(item => item.present) === true;
      if (id === 'F01') {
        check('Small control has every critical node', entry.support.control.every(item => item.present));
        check('Small control edge counts match oracle', isDeepStrictEqual(entry.edgeCounts.control, baselineEdges));
        check('Two partial outlines reach document writes', control.graph.flows.length === 2 && control.graph.flows.every(flow => control.graph.nodes.find(node => node.id === flow.nodeIds.at(-1)).kind === 'document-write' && flow.status === 'partial'));
      }
      if (id === 'F02') check('Short-path filler displaces all sampled original code', control.payloads.every(file => /^a\d{3}\.ts$/.test(file.path)) && control.graph.coverage.candidateDocuments === 365);
      if (id === 'F03') check('Dense input remains retained within payload bounds', wide.payloads.some(file => file.path === 'a.ts' && file.facts.symbols.length === 200));
      if (id === 'F04') for (const [name, value] of [['control',control], ['parity',parity], ['wide',wide]]) {
        check(`${name} rejects ambiguous import and handler`, !value.graph.edges.some(edge => ['calls','implements'].includes(edge.kind)) && value.graph.omissions['ambiguous-import'] > 0 && value.graph.omissions['ambiguous-handler'] > 0);
        entry.ambiguousAlternatives = wide.payloads.flatMap(file => file.facts.symbols.filter(symbol => ['submitOrder','Orders.accept'].includes(symbol.qualifiedName)).map(symbol => ({ source: file.sourceName, path: file.path, symbol: symbol.qualifiedName })));
      }
      if (id.startsWith('F05')) for (const [name, value] of [['control',control], ['parity',parity], ['wide',wide]]) {
        check(`${name} preserves unresolved wiring`, !value.graph.edges.some(edge => ['calls','event-delivery','dispatch-candidate'].includes(edge.kind)) && value.graph.omissions['unsupported-import-target'] > 0);
        check(`${name} HTTP bindings remain candidate`, value.graph.edges.filter(edge => edge.kind === 'http-target').length === 2 && value.graph.edges.filter(edge => edge.kind === 'http-target').every(edge => edge.status === 'candidate' && edge.gaps.length > 0));
      }
    });
  }
  await scenario('F06-absent', 'small', async (state, observe, check) => {
    for (const mode of ['parity','wide']) { const result = await observe(mode); check(`${mode} unavailable without analysis`, result.status === 'unavailable' && result.graph === null); }
    check('Control independently available', !!(await observe('control')).graph);
  });
  await scenario('F06-unpublished', 'small', async (state, observe, check) => {
    const run = state.analysis.start('paused', state.buildId); state.analysis.control(run.id, 'pause'); await state.analysis.idle();
    for (const mode of ['parity','wide']) { const result = await observe(mode, state.buildId, { inventoryId: run.id }); check(`${mode} rejects unpublished facts`, result.status === 'failed' && result.error.code === 'NOT_READY' && !result.graph); }
  });
  await scenario('F06-partial', 'small', async (state, observe, check) => {
    await state.analyze('limited'); const parity = await observe('parity'), wide = await observe('wide');
    check('Missing retained parity files prevent parity', parity.status === 'unavailable' && parity.coverage.missing.length === 3);
    check('Wider partial exposes retained and unattempted counts', wide.status === 'partial' && wide.coverage.scannedFiles === 2 && wide.coverage.inventoryCounts.unattempted === 3);
  }, { documents: 2 });
  await scenario('F06-syntax', 'syntax-gap', async (state, observe, check) => {
    await state.analyze('syntax'); const parity = await observe('parity'), wide = await observe('wide'), control = await observe('control');
    check('Syntax gaps remain visible', wide.status === 'partial' && wide.coverage.syntaxGaps > 0 && wide.coverage.filesWithSyntaxGaps > 0);
    check('Partial syntax preserves parity', isDeepStrictEqual(graphSemantics(control.graph), graphSemantics(parity.graph)));
  });
  await scenario('F06-time', 'small', async (state, observe, check) => {
    await state.analyze('time'); const value = await observe('wide', state.buildId, { wallMs: 0 });
    check('Zero cooperative time budget discloses unscanned files', value.status === 'partial' && value.coverage.timedOut && !value.coverage.scanComplete && value.coverage.scannedFiles === 0 && value.coverage.unvisitedFiles === 5);
  });
  for (const damage of ['checkpoint','payload','original','parser','limits']) await scenario(`F07-${damage}`, 'small', async (state, observe, check) => {
    const id = await state.analyze('damage'), fileId = state.analysis.snapshot(id).fileIds[0];
    if (damage === 'checkpoint') state.store.run("UPDATE code_analysis_files SET checkpointHash='damaged' WHERE runId=? AND fileId=?", id, fileId);
    if (damage === 'payload') state.store.run("UPDATE code_analysis_files SET payload='{}' WHERE runId=? AND fileId=?", id, fileId);
    if (damage === 'original') { const bytes = state.store.one('SELECT length(raw) n FROM files WHERE id=?', fileId).n; state.store.run('UPDATE files SET raw=? WHERE id=?', Buffer.alloc(bytes, 97), fileId); }
    if (damage === 'parser') state.store.run("UPDATE code_analyses SET fingerprint='other-parser' WHERE id=?", id);
    if (damage === 'limits') state.store.run("UPDATE code_analyses SET limits='{}' WHERE id=?", id);
    for (const mode of ['parity','wide']) {
      const value = await observe(mode, state.buildId, { inventoryId: id });
      check(`${mode} rejects ${damage} without data`, value.status === 'failed' && value.graph === null && value.payloads.length === 0 &&
        value.error.code === (damage === 'parser' ? 'PARSER_CHANGED' : damage === 'original' ? 'CORRUPT_EVIDENCE' : 'CORRUPT_CODE_CHECKPOINT'));
    }
  });
  for (const change of ['add','revoke','policy','evict']) await scenario(`F08-${change}`, 'small', async (state, observe, check) => {
    const id = await state.analyze('first');
    if (change === 'evict') await state.analyze('second');
    if (change === 'add') await cp(path.join(state.fixture.root, 'sources', 'portal'), path.join(state.fixture.root, 'extra-source'), { recursive: true });
    let changed = false;
    const value = await observe('wide', state.buildId, { inventoryId: id, afterFile: async () => {
      if (changed) return; changed = true;
      if (change === 'add') await state.catalog.addSource(path.join(state.fixture.root, 'extra-source'));
      if (change === 'revoke') state.catalog.revoke(state.catalog.state().sources[0].id);
      if (change === 'policy') state.catalog.updatePolicy(['src']);
      if (change === 'evict') await state.analyze('third');
    } });
    check('Scope hook executes after a consumed file', changed);
    check('Pending result discards all consumed data', value.status === 'failed' && value.graph === null && value.payloads.length === 0 && !value.inventory && !value.selection);
    check('Expected fence or eviction is explicit', value.error?.code === (change === 'evict' ? 'NOT_FOUND' : 'ANALYSIS_FENCED'));
  });
  await scenario('F09-history', 'small', async (state, observe, check, entry) => {
    const first = await state.analyze('first'), old = await observe('wide'), oldControl = await observe('control');
    check('Initial history repeat stays exact', sameReading(old, await observe('wide')));
    const file = 'src/orders.ts', text = state.corpus.portal[file] + '// Owned second revision for immutable-history comparison.\n';
    await writeFile(path.join(state.fixture.root, 'sources', 'portal', file), text);
    fixtureGit(state.fixture.root, 'portal', ['add', file]); fixtureGit(state.fixture.root, 'portal', ['commit', '-qm', 'Add owned history revision']);
    const revision = fixtureGit(state.fixture.root, 'portal', ['rev-parse', 'HEAD']);
    for (const [name, original] of Object.entries(state.corpus.portal)) state.originals.set(`portal/${revision}/${name}`, name === file ? text : original);
    const nextBuild = await state.index('second'); await state.analyze('second', nextBuild); entry.secondBuildId = nextBuild; entry.secondRevision = revision;
    const oldWithNewIndex = await observe('wide'), current = await observe('wide', nextBuild);
    check('Current index repeats exactly', sameReading(current, await observe('wide', nextBuild)));
    check('Old facts retain original identities', isDeepStrictEqual(old.payloads, oldWithNewIndex.payloads));
    const oldControlWithNewIndex = await observe('control');
    await state.restart();
    check('Old projection survives restart', sameReading(oldWithNewIndex, await observe('wide')));
    check('Current projection survives restart', sameReading(current, await observe('wide', nextBuild)));
    await state.analyze('third', nextBuild);
    const evicted = await observe('wide', state.buildId, { inventoryId: first });
    check('Historical inventory eviction is explicit', evicted.status === 'failed' && evicted.error.code === 'NOT_FOUND');
    check('Default read reports unavailable after eviction', (await observe('wide')).status === 'unavailable');
    check('Legacy graph survives fact eviction', sameReading(oldControlWithNewIndex, await observe('control')));
    check('Saved original evidence survives fact eviction', reopenSupport(state, old).length === old.reopened.length);
    check('Both generations were independently read', oldControl.graph.buildId !== current.graph.buildId);
  });
  receipt.summary = { cases: receipt.cases.length, checks: receipt.cases.flatMap(item => item.checks).length,
    passed: receipt.cases.flatMap(item => item.checks).filter(item => item.passed).length,
    failedChecks: receipt.cases.flatMap(item => item.checks.filter(check => !check.passed).map(check => ({ case: item.id, ...check }))),
    widerSupportGate: receipt.cases.filter(item => item.widerSupportGate !== undefined).map(item => ({ case: item.id, passed: item.widerSupportGate })),
    promotion: 'No production switch. A wider support failure rejects the naive selection; parity alone does not authorize integration.' };
  await save(); return receipt.summary;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  assert.ok(process.argv[2], 'Pass a new output directory.');
  const modules = await Promise.all(['catalog','store','git','code-analysis','code-analysis-facts','code-flows','code-typescript','code-java','system-map','map-document','extract','http-headers','types'].map(name => import(`../apps/loredock/dist/${name}.js`)));
  const result = await runDurableFlowProbe(Object.assign({}, ...modules), path.resolve(process.argv[2]));
  console.log(JSON.stringify(result, null, 2)); if (result.failedChecks.length) process.exitCode = 1;
}
