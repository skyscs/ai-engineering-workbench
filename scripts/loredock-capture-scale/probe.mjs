import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { scaleCorpus, sourceNames } from '../../fixtures/loredock-capture-scale/corpus.mjs';
import { variantCorpus } from '../../fixtures/loredock-capture-scale/variants.mjs';
import { receiptFixture } from './fixture.mjs';
import { captureReceipt, readReceipt, ReceiptError } from './receipt.mjs';
import { CaptureBudget, BudgetError, captureAccounting } from './budget.mjs';
import { createCapturePaths } from './paths.mjs';
import { Catalog } from '../../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../../apps/loredock/dist/store.js';
import { SourceGit } from '../../apps/loredock/dist/git.js';
import { CodeAnalysis } from '../../apps/loredock/dist/code-analysis.js';
import { codePathLimits, PathWork } from '../../apps/loredock/dist/code-paths-work.js';
import { bindingMetadata, bindingDomains, assertBindingMetadata } from '../../apps/loredock/dist/code-paths-metadata.js';
import { declarationMap } from '../../apps/loredock/dist/system-map.js';
import { compareHeaders } from '../../apps/loredock/dist/http-headers.js';
import { sha256 } from '../../apps/loredock/dist/extract.js';
import { CatalogError } from '../../apps/loredock/dist/types.js';

// One opt-in frozen run. Never import this entry point from ordinary tests/CI.
const root = fileURLToPath(new URL('../../', import.meta.url));
const inputNames = ['corpus.mjs', 'variants.mjs', 'oracle.json', 'preflight.json', 'variants-manifest.json', 'README.md'];
const inputBytes = await Promise.all(inputNames.map(name => readFile(path.join(root, 'fixtures/loredock-capture-scale', name))));
const oracle = JSON.parse(inputBytes[2]), preflight = JSON.parse(inputBytes[3]), variantManifest = JSON.parse(inputBytes[4]);
const Paths = createCapturePaths({ codePathLimits, PathWork, bindingMetadata, bindingDomains, assertBindingMetadata, declarationMap, compareHeaders, sha256, CatalogError });
const hash = value => createHash('sha256').update(value).digest('hex');
const output = process.env.LOREDOCK_CAPTURE_SCALE_OUTPUT;
assert.ok(output && path.isAbsolute(output), 'Use a fresh absolute owned measurement directory.');
await mkdir(output); const scratch = path.join(output, 'scratch'), rawDir = path.join(output, 'raw');
await mkdir(scratch); await mkdir(rawDir);
const baselineBytes = await readFile(new URL('./baseline.json', import.meta.url)), baseline = JSON.parse(baselineBytes);
for (const [file, digest] of Object.entries(baseline.files)) assert.equal(hash(await readFile(path.join(root, file))), digest, 'Baseline drift: ' + file);
const identity = { schemaVersion: 'task075-shared-capture-result/1', createdAt: new Date().toISOString(), freezeCommit: 'efc1e92',
  candidateCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  inputs: Object.fromEntries(inputNames.map((name, i) => [name, hash(inputBytes[i])])), baseline, baselineHash: hash(baselineBytes),
  node: process.version, hardware: { platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0]?.model, cpus: os.cpus().length, memoryBytes: os.totalmem() },
  limits: oracle.limits, resources: oracle.resources, accounting: captureAccounting, modelRequests: 0 };
await writeFile(path.join(output, 'identity.json'), JSON.stringify(identity, null, 2) + '\n');
const records = [], observations = [], preparations = []; let checks = 0, failures = 0, serial = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const equal = (a, b, message) => { assert.deepEqual(a, b, message); checks++; };
async function save() { await writeFile(path.join(output, 'result.json'), JSON.stringify({ ...identity, checks, failures, records, observations, preparations }, null, 2) + '\n'); }
async function archive(name, bytes) {
  const file = 'raw/' + String(++serial).padStart(4, '0') + '-' + name.replaceAll(/[^a-z0-9-]/gi, '-') + '.json';
  await writeFile(path.join(output, file), bytes);
  return { file, bytes: Buffer.byteLength(bytes), sha256: hash(bytes) };
}
async function run(name, fn) {
  const before = checks;
  try { const detail = await fn(); records.push({ name, status: 'pass', checks: checks - before, detail: detail ?? null }); }
  catch (error) { failures++; records.push({ name, status: 'fail', checks: checks - before,
    remainingAssertions: 'Unexecuted after the first failed prerequisite/assertion; not counted as passes.',
    error: { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack } }); }
  await save(); console.log(JSON.stringify(records.at(-1)));
}
async function finishAnalysis(s, key) {
  const id = await s.analyze(key, s.buildId);
  for (let i = 0; i < 3 && ['paused', 'interrupted'].includes(s.analysis.get(id).status); i++) { s.analysis.control(id, 'resume'); await s.analysis.idle(); }
  return s.analysis.get(id);
}
async function prepare(name, corpus, analysisLimits) {
  const began = performance.now(), entry = { name, status: 'preparing', startedAt: new Date().toISOString() }; preparations.push(entry); await save();
  console.log(JSON.stringify({ phase: 'preparation', name }));
  const Analysis = analysisLimits ? class extends CodeAnalysis { constructor(catalog) { super(catalog, analysisLimits); } } : CodeAnalysis;
  const s = await receiptFixture(scratch, corpus, { Catalog, CatalogStore, SourceGit, CodeAnalysis: Analysis, CodePaths: Paths });
  try {
    for (let i = 0; i < 3 && ['paused', 'interrupted'].includes(s.store.buildRow(s.buildId).status); i++) { s.catalog.control(s.buildId, 'resume'); await s.catalog.idle(); }
    s.catalog.readBuildHeader(s.buildId); entry.sourceAndIndexMs = performance.now() - began;
    const started = performance.now(), inventory = await finishAnalysis(s, 'scale-initial');
    entry.analysisMs = performance.now() - started; entry.wallMs = performance.now() - began;
    entry.files = s.store.one('SELECT count(*) n FROM files WHERE buildId=?', s.buildId).n; entry.inventory = inventory;
    entry.sources = s.store.buildSources(s.buildId); entry.status = 'prepared'; await save();
    check(inventory.published, 'Prepared inventory must be published.'); s.preparation = entry; return s;
  } catch (error) { entry.status = 'failed'; entry.error = error.message; await save(); await s.close(); throw error; }
}
async function fresh(name, fn, variant) {
  const corpus = variant ? variantCorpus(variant.name) : scaleCorpus(24);
  if (variant) equal(hash(JSON.stringify(corpus)), variantManifest.find(row => row.name === variant.name).sha256);
  const s = await prepare(name, corpus, variant?.analysisLimits);
  try { return await fn(s); } finally { await s.close(); }
}
async function observed(s, name, fn, { resources = true, allowed = {}, metrics } = {}) {
  const before = s.counters(), legacy = s.legacyRows(), memory = process.memoryUsage();
  const sums = { path: 0, receipt: 0 }, deltas = { path: {}, receipt: {} };
  // Accepted delta histograms retain exact counts/sums without adding an unbounded event log.
  const observe = ({ phase, units }) => { sums[phase] += units; deltas[phase][units] = (deltas[phase][units] ?? 0) + 1; };
  let last = performance.now(), maxSliceMs = 0, peakRss = memory.rss, peakHeap = memory.heapUsed;
  const sample = () => { const now = performance.now(), current = process.memoryUsage(); maxSliceMs = Math.max(maxSliceMs, now - last); last = now;
    peakRss = Math.max(peakRss, current.rss); peakHeap = Math.max(peakHeap, current.heapUsed); };
  const began = performance.now(), timer = setInterval(sample, oracle.resources.sampleIntervalMs); let result, error;
  try { result = await fn(observe); } catch (cause) { error = cause; } finally { clearInterval(timer); sample(); }
  const record = { name, status: error ? 'failed' : result.status, code: error?.code ?? null, wallMs: performance.now() - began, maxSliceMs,
    baselineRssMiB: memory.rss / 1048576, peakRssMiB: peakRss / 1048576, heapGrowthMiB: (peakHeap - memory.heapUsed) / 1048576,
    metrics: result?.metrics ?? metrics?.() ?? null, sums, deltas, before, after: s.counters(), allowed };
  record.artifact = await archive(name, JSON.stringify(error ? { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack } : result));
  if (result?.status === 'captured') record.receipt = await archive(name + '-receipt', await readFile(result.file));
  observations.push(record); await save(); // Every raw return/failure precedes all assertions.
  for (const field of ['gitCalls', 'writeCalls', 'changedRows']) equal(record.after[field], before[field] + (allowed[field] ?? 0), 'No mutation outside an explicit lifecycle hook.');
  equal(s.legacyRows(), allowed.legacy ?? legacy, 'Existing answer/correction rows stay unchanged.');
  if (record.metrics) {
    equal(record.metrics.pathWork, sums.path); equal(record.metrics.receiptWork, sums.receipt);
    equal(record.metrics.totalWork, sums.path + sums.receipt); equal(record.metrics.accountingVersion, oracle.accounting);
    check(record.metrics.totalWork <= oracle.limits.work);
  }
  if (!error && resources) {
    check(record.wallMs < oracle.limits.wallMs, 'Outer capture/read time.'); check(maxSliceMs <= oracle.resources.maxSliceMs, 'Maximum sampled interval.');
    check(record.peakRssMiB <= oracle.resources.sampledRssMiB, 'Sampled RSS.'); check(record.heapGrowthMiB <= oracle.resources.sampledHeapGrowthMiB, 'Sampled heap growth.');
  }
  if (error) { Object.defineProperty(error, 'operationRefusal', { value: true }); throw error; }
  return result;
}
async function capture(s, name, selection = {}, options = {}, observedOptions = {}) {
  return observed(s, name, observe => captureReceipt(s.services, s.folder, { buildId: s.buildId, ...selection }, { ...options, observeCharge: observe }), observedOptions);
}
async function projection(s, name, request, kind = 'paths') {
  let budget;
  try { return await observed(s, name, observe => { budget = new CaptureBudget({ observe }); return s.paths.read(request, kind, undefined, budget); }, { metrics: () => budget?.stats() }); }
  finally { budget?.close(); }
}
async function history(s, name, receipt) {
  const before = s.counters(), result = await observed(s, name, observe => readReceipt(s.catalog, s.folder, receipt.receiptId, { observeCharge: observe }));
  for (const field of ['pathReads', 'factReads', 'snapshots']) equal(s.counters()[field], before[field]);
  equal(result.metrics.pathWork, 0); equal(result.status, 'recorded'); equal(result.currentApplicability, 'not-checked'); return result;
}
async function refusal(s, name, fn, code, allowed = {}) {
  const files = (await readdir(s.folder)).sort(); let error;
  try { await observed(s, name, fn, { resources: false, allowed }); } catch (cause) { error = cause; }
  check(error?.operationRefusal === true, 'An observer/cleanup failure cannot count as a refused operation.');
  check(error instanceof BudgetError || error instanceof ReceiptError || error instanceof CatalogError || error.code === 'ENOENT', 'Normalized domain refusal.');
  if (code) equal(error.code, code);
  equal((await readdir(s.folder)).sort(), files, 'No new target or pending file after refusal.'); return { code: error.code };
}
function expectedNode(p, [sourceName, file, kind, label, role]) {
  const matches = p.graph.nodes.filter(node => node.sourceName === sourceName && node.path === file && node.kind === kind && node.label === label && (role === null || node.properties.role === role));
  equal(matches.length, 1, 'Exactly one expected typed identity: ' + [sourceName, file, kind, label, role].join('/')); return matches[0];
}
function validate(s, p, { flows, minimumFlows, topic = oracle.topic } = {}) {
  equal(p.status, 'available'); equal(p.partial, true); equal(p.deploymentCoherence, 'unknown'); equal(p.identity.adapter, oracle.adapter);
  equal(p.identity.accounting, captureAccounting); const { projectionId, ...body } = p;
  equal(hash(JSON.stringify(body)), projectionId); equal(hash(JSON.stringify(p.identity)), p.generationId);
  check(Buffer.byteLength(JSON.stringify(p)) <= oracle.limits.projectionBytes);
  const graph = p.graph, refs = { ...graph.evidence, ...p.roots.evidence }, originals = new Map();
  for (const [id, ref] of Object.entries(refs)) {
    const item = s.catalog.evidence(id), source = s.originals.get(`${item.sourceName}/${item.revision}/${item.path}`);
    check(typeof source === 'string'); equal(source.split('\n').slice(ref.startLine - 1, ref.endLine).join('\n'), item.text);
    equal(hash(source), item.contentHash); equal(hash(item.text), item.spanHash); originals.set(id, item);
  }
  for (const item of [...graph.nodes, ...graph.edges, ...graph.flows, ...p.roots.items.filter(row => row.status === 'available')]) {
    check(item.evidenceIds.length > 0); for (const id of item.evidenceIds) check(originals.has(id), 'Every issued support ID reopens.');
  }
  const nodes = new Map(graph.nodes.map(node => [node.id, node])), edges = new Map(graph.edges.map(edge => [edge.id, edge]));
  for (const flow of graph.flows) {
    equal(flow.edgeIds.length, flow.nodeIds.length - 1);
    for (let i = 0; i < flow.edgeIds.length; i++) { const edge = edges.get(flow.edgeIds[i]); equal(edge.from, flow.nodeIds[i]); equal(edge.to, flow.nodeIds[i + 1]); }
    if (flows || minimumFlows) equal(nodes.get(flow.nodeIds.at(-1)).kind, 'document-write');
  }
  if (flows !== undefined) equal(graph.flows.length, flows);
  if (minimumFlows !== undefined) check(graph.flows.length >= minimumFlows);
  if (flows || minimumFlows) check(graph.edges.some(edge => edge.kind === 'event-delivery'));
  for (const edge of graph.edges.filter(edge => edge.kind === 'event-delivery')) {
    equal(edge.status, 'candidate'); equal(edge.environment, oracle.environment); equal(edge.topicCheck.value, topic);
    equal(edge.topicCheck.rule, 'direct-java-topic-literal/1');
    for (const [key, endpoint, kind] of [['publisher', edge.from, 'event-publish'], ['subscriber', edge.to, 'event-subscribe']]) {
      const node = nodes.get(endpoint); equal(node.kind, kind); equal(edge.topicCheck[key].expression, '"' + topic + '"');
      equal(edge.topicCheck[key].evidenceIds, [...new Set(node.evidenceIds)].sort());
      for (const id of edge.topicCheck[key].evidenceIds) check(edge.evidenceIds.includes(id));
    }
    check(edge.gaps.some(gap => gap.includes('broker'))); check(edge.gaps.some(gap => gap.includes('Configuration settings')));
  }
}
async function recorded(s, result) {
  const raw = await readFile(result.file, 'utf8'), receipt = JSON.parse(raw), p = JSON.parse(receipt.projectionJson);
  equal(receipt.dependencies.map(row => row.name).sort(), [...sourceNames].sort()); equal(receipt.dependencies.length, 20);
  check(!receipt.originals.some(row => row.sourceName === oracle.uncitedSource));
  for (const [key, cap] of Object.entries(oracle.limits)) if (key !== 'wallMs' && key in result.metrics) check(result.metrics[key] <= cap);
  return { raw, receipt, p };
}

for (const size of oracle.sizes) {
  const prefix = 'size-' + size.pathsPerSource, corpus = scaleCorpus(size.pathsPerSource); let s, first, prior;
  await run(prefix + '-preparation', async () => {
    const planned = preflight.vectors.find(row => row.pathsPerSource === size.pathsPerSource);
    for (const [name, files] of Object.entries(corpus)) {
      const row = planned.sources.find(row => row.name === name);
      equal(hash(JSON.stringify(Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))), row.contentHash);
    }
    s = await prepare(prefix, corpus); equal(s.preparation.files, size.files); equal(s.preparation.inventory.candidates, size.codeFiles);
    equal(s.preparation.inventory.examined, size.codeFiles); equal(s.preparation.inventory.counts.parsed, size.codeFiles);
    equal(s.preparation.sources.length, 20); check(s.preparation.sources.every(row => row.omitted === 0));
  });
  if (!s) continue; // The preparation failure explicitly blocks this size's dependent operations.
  try {
    await run(prefix + '-first', async () => {
      first = await capture(s, prefix + '-first'); prior = await recorded(s, first); validate(s, prior.p, { flows: 2 });
      equal(prior.p.coverage.factEntries, size.facts); equal(prior.p.coverage.scannedFiles, size.codeFiles); equal(prior.p.coverage.metadataEntries, size.files);
      check(prior.p.coverage.sources.every(row => row.treeVerified)); for (const expected of oracle.requiredNodes) expectedNode(prior.p, expected);
      return { receiptId: first.receiptId, metrics: first.metrics };
    });
    await run(prefix + '-repeat', async () => { assert.ok(first); const again = await capture(s, prefix + '-repeat'); equal(again.receiptId, first.receiptId); equal(await readFile(again.file, 'utf8'), prior.raw); });
    await run(prefix + '-selected', async () => {
      assert.ok(prior); const p = prior.p, chosen = p.roots.items.filter(row => row.sourceName === 'a-sensor-ui' && row.path === 'app/AARecord.vue' && row.role === 'vue-action' && row.label === 'record'); equal(chosen.length, 1);
      const result = await capture(s, prefix + '-selected', { inventoryId: p.identity.inventoryId, generationId: p.generationId, rootId: chosen[0].id });
      const saved = await recorded(s, result); validate(s, saved.p, { flows: 1 });
    });
    await run(prefix + '-isolated', async () => {
      assert.ok(prior); const pin = { buildId: s.buildId, inventoryId: prior.p.identity.inventoryId, generationId: prior.p.generationId };
      let page = prior.p.roots; const roots = [...page.items];
      while (page.next !== null) { const response = await projection(s, prefix + '-page-' + page.next, { ...pin, offset: page.next }, 'roots'); page = response.roots; roots.push(...page.items); }
      const [sourceName, file, label, role] = oracle.isolatedRoot;
      const selected = roots.filter(row => row.sourceName === sourceName && row.path === file && row.label === label && row.role === role); equal(selected.length, 1);
      check(!prior.p.roots.items.some(row => row.id === selected[0].id));
      const saved = await capture(s, prefix + '-isolated', { ...pin, rootId: selected[0].id }), record = await recorded(s, saved);
      validate(s, record.p); equal(record.p.graph.nodes.length, 1); equal(record.p.graph.edges.length, 0);
    });
    await run(prefix + '-aggregate-only', async () => {
      assert.ok(first); const ceiling = Math.max(first.metrics.pathWork, first.metrics.receiptWork);
      check(first.metrics.pathWork > 0 && first.metrics.receiptWork > 0); check(first.metrics.totalWork > ceiling);
      await refusal(s, prefix + '-aggregate-only', observe => captureReceipt(s.services, s.folder, { buildId: s.buildId }, { budgetLimits: { work: ceiling }, observeCharge: observe }), oracle.aggregateError);
      equal(await readFile(first.file, 'utf8'), prior.raw);
      const recovery = await capture(s, prefix + '-recovery'); equal(recovery.receiptId, first.receiptId);
      return { ceiling, pathWork: first.metrics.pathWork, receiptWork: first.metrics.receiptWork };
    });
    await run(prefix + '-eviction-restart-history', async () => {
      assert.ok(prior); const started = performance.now(); await finishAnalysis(s, 'replacement'); await finishAnalysis(s, 'eviction');
      assert.throws(() => s.analysis.get(prior.p.identity.inventoryId)); await s.restart();
      preparations.push({ name: prefix + '-history-preparation', wallMs: performance.now() - started, status: 'prepared' }); await save();
      const read = await history(s, prefix + '-history', first); equal(read.projection, prior.p); equal(await readFile(first.file, 'utf8'), prior.raw);
      for (const [source, revision] of Object.entries(s.revisions)) { equal(s.git(source, ['rev-parse', 'HEAD']), revision); equal(s.git(source, ['status', '--porcelain=v1']), ''); }
    });
  } finally { await s.close(); }
}
for (const variant of oracle.variants) await run('variant-' + variant.name, () => fresh('variant-' + variant.name, async s => {
  const saved = await capture(s, variant.name), record = await recorded(s, saved); validate(s, record.p, variant);
  for (const reason of variant.reasons ?? []) check(record.p.coverage.omissions[reason] > 0, 'Exact relevant omission: ' + reason);
  for (const reason of variant.graphReasons ?? []) check(record.p.graph.omissions[reason] > 0, 'Exact display omission: ' + reason);
  if (variant.noDelivery) check(!record.p.graph.edges.some(edge => edge.kind === 'event-delivery'));
  if (variant.noImplements) check(!record.p.graph.edges.some(edge => edge.kind === 'implements'));
  if (variant.minimumTextBytes) check(saved.metrics.textBytes >= variant.minimumTextBytes);
  if (variant.omittedPaths) equal(s.preparation.sources.reduce((n, row) => n + row.omitted, 0), variant.omittedPaths);
  return { receiptId: saved.receiptId, metrics: saved.metrics, omissions: record.p.coverage.omissions, displayOmissions: record.p.graph.omissions };
}, variant));

for (const domain of ['path', 'receipt']) for (const stage of oracle[domain + 'Stages']) for (const fault of oracle.faults) {
  const name = domain + '-' + stage + '-' + fault;
  await run(name, () => fresh(name, async s => {
    const controller = new AbortController(); let reached = false; const injected = [];
    const hook = async info => {
      if (reached || info.stage !== stage) return; reached = true;
      if (fault === 'budget') { injected.push({ phase: domain, units: oracle.limits.work + 1, stage }); info.budget.charge(domain, oracle.limits.work + 1); }
      else if (fault === 'deadline') await delay(Math.max(0, info.budget.deadline - performance.now()) + 5);
      else controller.abort();
    };
    const paths = domain === 'path' ? new Paths(s.analysis, { checkpoint: hook }) : s.paths;
    try {
      const result = await refusal(s, name, observe => captureReceipt({ ...s.services, paths }, s.folder, { buildId: s.buildId }, {
        signal: controller.signal, observeCharge: observe, ...(domain === 'receipt' ? { checkpoint: hook } : {}),
      }), oracle[fault === 'budget' ? 'aggregateError' : fault === 'deadline' ? 'deadlineError' : 'cancelError']);
      check(reached, 'The intended stage was reached.');
      const recovered = await capture(s, name + '-recovery'); check(recovered.status === 'captured');
      return { ...result, reached, injected };
    } finally { if (paths !== s.paths) await paths.stop(); }
  }));
}
for (const name of oracle.publication) await run('publication-' + name, () => fresh('publication-' + name, async s => {
  if (name === 'new-target-cancel' || name === 'existing-target-cancel') {
    const existing = name === 'existing-target-cancel'; let saved, raw;
    if (existing) { saved = await capture(s, name + '-initial'); raw = await readFile(saved.file, 'utf8'); }
    const controller = new AbortController(); let hook;
    await refusal(s, name, observe => captureReceipt(s.services, s.folder, { buildId: s.buildId }, {
      signal: controller.signal, observeCharge: observe, afterPublish(info) { hook = info; controller.abort(); },
    }), 'CANCELLED');
    check(Boolean(hook)); equal(hook.created, !existing); if (existing) equal(await readFile(saved.file, 'utf8'), raw);
    return { existing, created: hook.created };
  }
  const writer = new DatabaseSync(path.join(s.root, 'data/loredock.db')); let reached = false;
  try {
    if (name === 'external-commit') {
      const result = await refusal(s, name, observe => captureReceipt(s.services, s.folder, { buildId: s.buildId }, { observeCharge: observe,
        checkpoint({ stage }) { if (stage === 'handoff') { writer.prepare("UPDATE files SET reason='owned-external-epoch' WHERE path='README.md'").run(); reached = true; } },
      }), 'RECEIPT_FENCED', { externalCommits: 1 }); check(reached); return result;
    }
    const saved = await capture(s, name, {}, { insideFence() {
      try { writer.prepare("UPDATE files SET reason='must-not-commit' WHERE path='README.md'").run(); }
      catch (error) { if (!/locked/.test(error.message)) throw error; reached = true; }
    } }); check(reached); return { receiptId: saved.receiptId, competingWriterBlocked: reached };
  } finally { writer.close(); }
}));
for (const name of oracle.history) await run('history-' + name, () => fresh('history-' + name, async s => {
  const saved = await capture(s, name + '-initial'), record = await recorded(s, saved); validate(s, record.p, { flows: 2 });
  if (name === 'eviction' || name === 'restart') {
    await finishAnalysis(s, 'replace-history'); await finishAnalysis(s, 'evict-history'); assert.throws(() => s.analysis.get(record.p.identity.inventoryId));
    if (name === 'restart') await s.restart();
    const read = await history(s, name + '-read', saved); equal(read.projection, record.p);
  } else {
    if (name.endsWith('revocation')) s.catalog.revoke(s.catalog.state().sources.find(source => source.name === (name === 'cited-revocation' ? 'a-sensor-ui' : oracle.uncitedSource)).id);
    if (name === 'policy') s.catalog.updatePolicy(['owned-changed-policy']);
    if (name === 'corrupt-original') s.store.run("UPDATE spans SET text=text || ' changed' WHERE id=?", record.receipt.originals[0].id);
    const before = s.counters();
    await refusal(s, name + '-read', observe => readReceipt(s.catalog, s.folder, saved.receiptId, { observeCharge: observe }));
    for (const field of ['pathReads', 'factReads', 'snapshots']) equal(s.counters()[field], before[field]);
  }
  equal(await readFile(saved.file, 'utf8'), record.raw);
}));
await save(); console.log(JSON.stringify({ output, cases: records.length, checks, failures, observations: observations.length }));
process.exitCode = failures ? 1 : 0;
