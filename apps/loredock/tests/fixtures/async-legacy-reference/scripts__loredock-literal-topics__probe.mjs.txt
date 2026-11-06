import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { receiptFixture } from '../loredock-receipt-fixture.mjs';
import { captureReceipt, readReceipt, receiptLimits, ReceiptError } from './receipt.mjs';
import { Catalog } from '../../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../../apps/loredock/dist/store.js';
import { SourceGit } from '../../apps/loredock/dist/git.js';
import { CodeAnalysis } from '../../apps/loredock/dist/code-analysis.js';
import { CodePaths as ControlPaths } from '../../apps/loredock/dist/code-paths.js';
import { createTopicPaths } from './paths.mjs';
import { codePathLimits, PathWork } from '../../apps/loredock/dist/code-paths-work.js';
import { bindingMetadata, bindingDomains, assertBindingMetadata } from '../../apps/loredock/dist/code-paths-metadata.js';
import { declarationMap } from '../../apps/loredock/dist/system-map.js';
import { compareHeaders } from '../../apps/loredock/dist/http-headers.js';
import { sha256 } from '../../apps/loredock/dist/extract.js';
import { CatalogError } from '../../apps/loredock/dist/types.js';
import { codeFlows } from '../../apps/loredock/dist/code-flows.js';
import { retrieveAnswerContext } from '../../apps/loredock/dist/answer-context.js';
import { Corrections } from '../../apps/loredock/dist/corrections.js';

const CodePaths = createTopicPaths({ codePathLimits, PathWork, bindingMetadata, bindingDomains, assertBindingMetadata, declarationMap, compareHeaders, sha256, CatalogError });

// This entry point executes the frozen Task 073 matrix ONCE, never from CI or regression tests.
const root = fileURLToPath(new URL('../../', import.meta.url));
const inputFiles = ['corpus.json', 'oracle.json', 'README.md', 'cases.json'];
const inputBytes = await Promise.all(inputFiles.map(name => readFile(path.join(root, 'fixtures/loredock-literal-topics', name))));
const corpus = JSON.parse(inputBytes[0]), oracle = JSON.parse(inputBytes[1]), variants = JSON.parse(inputBytes[3]);
assert.deepEqual(receiptLimits, oracle.receiptLimits);
const output = process.env.LOREDOCK_TOPIC_OUTPUT;
assert.ok(output && path.isAbsolute(output), 'An absolute fresh owned output directory is required.');
await mkdir(output); // Exclusive first-run guard: an existing result directory is never reused.
const scratch = path.join(output, 'scratch'); await mkdir(scratch);
const artifacts = path.join(output, 'raw'); await mkdir(artifacts);
const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value) : Array.isArray(value)
  ? '[' + value.map(canonical).join(',') + ']' : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
const records = [], observations = []; let checks = 0, failureCount = 0, serial = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const baselineBytes = await readFile(new URL('./baseline.json', import.meta.url));
const baseline = JSON.parse(baselineBytes);
for (const [file, digest] of Object.entries(baseline.copied)) assert.equal(hash(await readFile(path.join(root, file))), digest, 'Baseline source drift: ' + file);
const metadata = { baseline, baselineHash: hash(baselineBytes), freezeCommit: '8803a06', schemaVersion: 'task073-literal-topic-result/1', createdAt: new Date().toISOString(),
  candidateCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  inputHashes: Object.fromEntries(inputFiles.map((name, i) => [name, hash(inputBytes[i])])),
  node: process.version, hardware: { platform: os.platform(), arch: os.arch(), cpus: os.cpus().length, cpu: os.cpus()[0]?.model, memoryBytes: os.totalmem() },
  limits: receiptLimits, resourceLimits: oracle.resources, modelRequests: 0,
  scope: 'Owned synthetic structural/integrity qualification; no independent semantic or private-pilot acceptance.' };
await writeFile(path.join(output, 'identity.json'), JSON.stringify(metadata, null, 2) + '\n');
async function save() { await writeFile(path.join(output, 'result.json'), JSON.stringify({ ...metadata, checks, failureCount, gate: failureCount ? 'rejected' : 'all-executed-cases-passed', mandatoryGates: oracle.mandatoryGates, records, observations }, null, 2) + '\n'); }
async function run(name, fn) {
  const before = checks;
  try { const detail = await fn(); records.push({ name, status: 'pass', checks: checks - before, detail: detail ?? null }); }
  catch (error) { failureCount++; records.push({ name, status: 'fail', checks: checks - before, remainingAssertions: 'Unexecuted after the first failed prerequisite/assertion in this case; never counted as passes.', error: { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack } }); }
  await save(); console.log(JSON.stringify(records.at(-1)));
}
async function fresh(fn, analyzed = true, variant = null) {
  const inputs = structuredClone(corpus);
  for (const [source, files] of Object.entries(variant?.changes ?? {})) for (const [file, text] of Object.entries(files)) {
    if (text === null) delete inputs[source][file]; else inputs[source][file] = text;
  }
  const Analysis = variant?.analysisLimits ? class extends CodeAnalysis { constructor(catalog) { super(catalog, variant.analysisLimits); } } : CodeAnalysis;
  const s = await receiptFixture(scratch, inputs, { Catalog, CatalogStore, SourceGit, CodeAnalysis: Analysis, CodePaths });
  try { if (analyzed) await s.analyze(); return await fn(s); }
  finally { await s.close(); }
}
async function observed(s, name, fn, resources = true, mutable = false) {
  const baseline = process.memoryUsage(), counters = s.counters(), legacy = s.legacyRows();
  let last = performance.now(), maxSliceMs = 0, peakRss = baseline.rss, peakHeap = baseline.heapUsed;
  const sample = () => { const now = performance.now(), memory = process.memoryUsage(); maxSliceMs = Math.max(maxSliceMs, now - last); last = now;
    peakRss = Math.max(peakRss, memory.rss); peakHeap = Math.max(peakHeap, memory.heapUsed); };
  const began = performance.now(), timer = setInterval(sample, oracle.resources.sampleIntervalMs); let result, error;
  try { result = await fn(); } catch (cause) { error = cause; }
  finally { clearInterval(timer); sample(); }
  const record = { name, status: error ? 'failed' : result.status, code: error?.code ?? null, wallMs: performance.now() - began,
    maxSliceMs, baselineRssMiB: baseline.rss / 1048576, peakRssMiB: peakRss / 1048576, heapGrowthMiB: (peakHeap - baseline.heapUsed) / 1048576,
    metrics: result?.metrics ?? null, before: counters, after: s.counters(), allowedLifecycle: mutable || null };
  // Preserve every raw return/failure before any invariant, oracle or resource assertion.
  const stem = String(++serial).padStart(4, '0') + '-' + name.replaceAll(/[^a-z0-9-]/gi, '-');
  const raw = JSON.stringify(error ? { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack } : result);
  const rawFile = path.join(artifacts, stem + '.json'); await writeFile(rawFile, raw);
  record.artifact = { file: path.relative(output, rawFile), bytes: Buffer.byteLength(raw), sha256: hash(raw), buildId: result?.identity?.buildId ?? result?.projection?.identity?.buildId ?? s.buildId };
  if (result?.status === 'captured') {
    const receipt = await readFile(result.file); const file = path.join(artifacts, stem + '-receipt.json'); await writeFile(file, receipt);
    record.receipt = { file: path.relative(output, file), bytes: receipt.length, sha256: hash(receipt) };
  }
  observations.push(record); await save();
  equal(record.after.gitCalls, counters.gitCalls + (mutable?.gitCalls ?? 0), 'No Git call outside the explicit lifecycle hook.');
  equal(record.after.writeCalls, counters.writeCalls + (mutable?.writeCalls ?? 0), 'No store.run call outside the explicit lifecycle hook.');
  equal(record.after.changedRows, counters.changedRows + (mutable?.changedRows ?? 0), 'No SQLite DML outside the explicit lifecycle hook.');
  equal(s.legacyRows(), mutable?.legacy ?? legacy, 'Legacy rows remain unchanged outside explicit lifecycle hooks.');
  if (!error && resources) {
    check(record.wallMs < receiptLimits.wallMs, 'Outer five-second deadline.');
    check(record.maxSliceMs <= oracle.resources.maxSliceMs, 'Maximum sampled uninterrupted interval.');
    check(record.peakRssMiB <= oracle.resources.sampledRssMiB, 'Sampled process RSS bound.');
    check(record.heapGrowthMiB <= oracle.resources.sampledHeapGrowthMiB, 'Sampled heap growth bound.');
    if (result.metrics) check(result.metrics.work <= receiptLimits.work, 'Total receipt work bound.');
  }
  if (error) { Object.defineProperty(error, 'observedOperationFailure', { value: true }); throw error; }
  return result;
}
async function capture(s, name, selection = {}, options = {}, resources = true, mutable = false) {
  const result = await observed(s, name, () => captureReceipt(s.services, s.folder, { buildId: s.buildId, ...selection }, options), resources, mutable);
  return result;
}
async function history(s, name, receipt, resources = true, options = {}) {
  const counters = s.counters(), result = await observed(s, name, () => readReceipt(s.catalog, s.folder, receipt.receiptId, options), resources);
  equal(s.counters().factReads, counters.factReads); equal(s.counters().snapshots, counters.snapshots); equal(s.counters().pathReads, counters.pathReads);
  equal(result.status, 'recorded'); equal(result.currentApplicability, 'not-checked'); return result;
}
async function rejected(s, name, fn, expected, mutable = false) {
  const before = await readdir(s.folder); let caught;
  try { await observed(s, name, fn, false, mutable); } catch (error) { caught = error; }
  check(caught?.observedOperationFailure === true, 'The operation itself must refuse; an observer assertion is never an expected rejection.');
  check(caught instanceof ReceiptError || caught instanceof CatalogError || caught.code === 'ENOENT', 'A normalized domain refusal is required.');
  if (expected) equal(caught.code, expected);
  equal(await readdir(s.folder), before, 'Failure creates no receipt or pending file.'); return { code: caught.code ?? caught.name };
}
async function rejectHistory(s, name, id) {
  const before = s.counters(), result = await rejected(s, name, () => readReceipt(s.catalog, s.folder, id));
  for (const field of ['factReads', 'snapshots', 'pathReads']) equal(s.counters()[field], before[field], 'Rejected history does not derive paths.');
  return result;
}
async function seedLegacy(s) {
  const graph = codeFlows(s.catalog, s.buildId), edge = graph.edges.find(item => item.kind === 'calls');
  assert.ok(edge, 'Owned legacy fixture must provide a source link.');
  new Corrections(s.catalog).save({ requestId: 'owned-legacy-note', buildId: s.buildId, targetKind: 'code-link', targetId: edge.id,
    projectionHash: graph.inputHash, expectedRevision: 0, expectedPreviousId: null, action: 'clarify',
    statement: 'This owned source link does not verify runtime wiring.', environment: null });
  const context = retrieveAnswerContext(s.catalog, 'How is a parcel queued?', s.buildId), id = randomUUID();
  s.store.run(`INSERT INTO answer_attempts
    (id,requestId,payloadHash,question,buildId,policyVersion,registryVersion,status,context,inputHash,connection,model,effort,promptVersion,schemaVersion,createdAt,reason)
    VALUES (?,?,?,?,?,?,?,'cancelled',?,?,?,'not-dispatched','not-dispatched','loredock-answer-v9','cited-answer-v3',?,?)`,
    id, 'owned-cancelled-answer', hash('owned fixture'), context.question, s.buildId, context.policyVersion, context.registryVersion,
    JSON.stringify(context), context.inputHash, '{}', '2026-03-03T00:00:00.000Z', 'Owned fixture row; no model dispatched.');
  for (const source of context.sources) s.store.run('INSERT INTO answer_sources VALUES (?,?)', id, source.sourceId);
  return { context: JSON.stringify(context), graph: JSON.stringify(codeFlows(s.catalog, s.buildId)), rows: s.legacyRows() };
}

async function lifecycle(s, allowed, fn) {
  const before = s.counters(); await fn(); const after = s.counters();
  for (const field of ['gitCalls', 'writeCalls', 'changedRows']) allowed[field] = (allowed[field] ?? 0) + after[field] - before[field];
  allowed.legacy = s.legacyRows();
}

function expectedNode(projection, [sourceName, file, kind, label, role]) {
  const rows = projection.graph.nodes.filter(node => node.sourceName === sourceName && node.path === file && node.kind === kind
    && node.label === label && (role === null || node.properties.role === role));
  equal(rows.length, 1, 'Exactly one typed expected node: ' + [sourceName, file, kind, label, role].join('/'));
  return rows[0];
}
function validateProjection(s, p, positive = false, expected = {}, experimental = true) {
  equal(p.status, 'available'); equal(p.partial, true); equal(p.deploymentCoherence, 'unknown');
  const { projectionId, ...body } = p;
  equal(hash(JSON.stringify(body)), projectionId); equal(hash(JSON.stringify(p.identity)), p.generationId);
  equal(p.identity.adapter, experimental ? oracle.adapter : 'connected-paths-v1');
  if (experimental) equal(p.identity.topicRule, oracle.rule);
  check(Buffer.byteLength(JSON.stringify(p)) <= 524288, 'Complete bounded wire projection.');
  const graph = p.graph, refs = { ...graph.evidence, ...p.roots.evidence }, originals = new Map();
  for (const [id, ref] of Object.entries(refs)) {
    const original = s.catalog.evidence(id), text = s.originals.get(`${original.sourceName}/${original.revision}/${original.path}`);
    check(typeof text === 'string', 'Original belongs to the independently recorded fixture source.');
    equal(text.split('\n').slice(ref.startLine - 1, ref.endLine).join('\n'), original.text);
    equal(hash(text), original.contentHash); equal(hash(original.text), original.spanHash);
    originals.set(id, original);
  }
  for (const item of [...graph.nodes, ...graph.edges, ...graph.flows, ...p.roots.items.filter(item => item.status === 'available')]) {
    check(item.evidenceIds.length > 0); for (const id of item.evidenceIds) check(originals.has(id), 'Complete original support.');
  }
  const nodes = new Map(graph.nodes.map(node => [node.id, node])), edges = new Map(graph.edges.map(edge => [edge.id, edge]));
  for (const flow of graph.flows) {
    equal(flow.edgeIds.length, flow.nodeIds.length - 1);
    for (let i = 0; i < flow.edgeIds.length; i++) { const edge = edges.get(flow.edgeIds[i]); equal(edge.from, flow.nodeIds[i]); equal(edge.to, flow.nodeIds[i + 1]); }
  }
  for (const edge of graph.edges.filter(edge => edge.kind === 'event-delivery')) {
    equal(edge.status, 'candidate');
    if (!experimental) continue;
    const witness = edge.topicCheck, value = expected.topic ?? oracle.defaultTopic;
    equal(witness.rule, oracle.rule.version); equal(witness.value, value);
    equal(edge.environment, Object.hasOwn(expected, 'environment') ? expected.environment : oracle.defaultEnvironment);
    for (const [key, endpoint, kind] of [['publisher', edge.from, 'event-publish'], ['subscriber', edge.to, 'event-subscribe']]) {
      const node = nodes.get(endpoint); equal(node.kind, kind); equal(witness[key].expression, '"' + value + '"');
      equal(witness[key].expression, node.properties.topicExpression); equal(witness[key].evidenceIds, [...new Set(node.evidenceIds)].sort());
      for (const id of witness[key].evidenceIds) check(edge.evidenceIds.includes(id));
    }
    check(edge.gaps.some(gap => gap.includes('Configuration settings'))); check(edge.gaps.some(gap => gap.includes('broker')));
  }
  if (positive) {
    equal(graph.flows.length, 2); check(graph.edges.some(edge => edge.kind === 'event-delivery'));
    for (const flow of graph.flows) equal(nodes.get(flow.nodeIds.at(-1)).kind, 'document-write');
  }
}

for (const variant of variants) await run('structure-' + variant.name, () => fresh(async s => {
  const control = new ControlPaths(s.analysis); let prior;
  try { prior = await observed(s, variant.name + '-control', () => control.read({ buildId: s.buildId })); }
  finally { await control.stop(); }
  const current = await observed(s, variant.name + '-candidate', () => s.paths.read({ buildId: s.buildId }));
  validateProjection(s, prior, false, {}, false);
  validateProjection(s, current, variant.expected.delivery, variant.expected);
  if (Object.hasOwn(variant.expected, 'controlDelivery')) equal(prior.graph.edges.some(edge => edge.kind === 'event-delivery'), variant.expected.controlDelivery);
  equal(current.graph.edges.some(edge => edge.kind === 'event-delivery'), variant.expected.delivery);
  if (variant.expected.reason) check(current.coverage.omissions[variant.expected.reason] > 0, 'Expected omission: ' + variant.expected.reason);
  if (variant.expected.unknown) check(Object.keys(current.coverage.omissions).length > 0 || current.coverage.incompleteBindings > 0, 'Unresolved/unsupported input is visible.');
  if (variant.expected.alternatePaths) check(current.graph.omissions['alternate-terminal-paths'] > 0);
  return { controlDelivery: prior.graph.edges.some(edge => edge.kind === 'event-delivery'), candidateDelivery: variant.expected.delivery,
    controlGeneration: prior.generationId, candidateGeneration: current.generationId, omissions: current.coverage.omissions };
}, true, variant));

for (const [limit, value] of Object.entries(oracle.pathReducedLimits)) await run('path-limit-' + limit, () => fresh(async s => {
  const paths = new CodePaths(s.analysis, { limits: { [limit]: value } });
  try {
    if (['outputBytes', 'work', 'facts', 'bindingRecords'].includes(limit)) return await rejected(s, 'path-limit-' + limit, () => paths.read({ buildId: s.buildId }));
    const p = await observed(s, 'path-limit-' + limit, () => paths.read({ buildId: s.buildId }));
    validateProjection(s, p);
    if (limit === 'comparisons') { check(!p.graph.edges.some(edge => edge.kind === 'event-delivery')); check(p.coverage.omissions['comparison-limit'] > 0); }
    else if (limit === 'steps') { for (const flow of p.graph.flows) check(flow.nodeIds.length <= 1); check(p.graph.omissions['flow-step-limit'] > 0); }
    else equal(p.graph.flows.length, 0);
  } finally { await paths.stop(); }
}));
for (const stage of oracle.pathCancelStages) await run('path-cancel-' + stage, () => fresh(async s => {
  const controller = new AbortController(); let reached = false;
  const paths = new CodePaths(s.analysis, { checkpoint(info) { if (info.stage === stage) { reached = true; controller.abort(); } } });
  try { await rejected(s, 'path-cancel-' + stage, () => paths.read({ buildId: s.buildId }, 'paths', controller.signal), 'CANCELLED'); check(reached); }
  finally { await paths.stop(); }
}));

// Stable captures share one catalog so repeated identity is a meaningful assertion.
await fresh(async s => {
  const legacy = await seedLegacy(s); let first, selected, isolated, projection;
  await run('default-first', async () => {
    first = await capture(s, 'default-first'); const receipt = JSON.parse(await readFile(first.file, 'utf8')); projection = JSON.parse(receipt.projectionJson);
    equal(projection.graph.flows.length, oracle.defaultFlows);
    for (const identity of oracle.requiredNodes) expectedNode(projection, identity);
    validateProjection(s, projection, true);
    for (const flow of projection.graph.flows) equal(projection.graph.nodes.find(node => node.id === flow.nodeIds.at(-1)).kind, 'document-write');
    check(projection.graph.edges.some(edge => edge.status === 'candidate')); equal(projection.partial, true); equal(projection.deploymentCoherence, 'unknown');
    equal(receipt.dependencies.map(dep => dep.name).sort(), oracle.sourceNames.slice().sort());
    check(!receipt.originals.some(item => item.sourceName === oracle.uncitedSource), 'Uncited source still belongs to receipt scope.');
    for (const original of receipt.originals) { const text = s.originals.get(`${original.sourceName}/${original.revision}/${original.path}`); check(typeof text === 'string');
      equal(text.split('\n').slice(original.startLine - 1, original.endLine).join('\n'), original.text); equal(hash(original.text), original.spanHash); equal(hash(text), original.contentHash); }
    return { ...first, file: undefined };
  });
  await run('default-repeat', async () => { assert.ok(first); const again = await capture(s, 'default-repeat'); equal(again.receiptId, first.receiptId); return { receiptId: again.receiptId }; });
  const pin = () => ({ inventoryId: projection.identity.inventoryId, generationId: projection.generationId });
  await run('selected-first', async () => { assert.ok(projection); const root = projection.roots.items.find(item => item.sourceName === 'parcel-console' && item.path === 'ui/AAQueue.vue' && item.role === 'vue-action' && item.label === 'enqueue'); assert.ok(root);
    selected = await capture(s, 'selected-first', { ...pin(), rootId: root.id }); const read = await history(s, 'selected-read', selected); equal(read.projection.graph.flows.length, 1); return { receiptId: selected.receiptId }; });
  await run('selected-repeat', async () => { assert.ok(selected); const root = projection.roots.items.find(item => item.sourceName === 'parcel-console' && item.path === 'ui/AAQueue.vue' && item.role === 'vue-action' && item.label === 'enqueue');
    const again = await capture(s, 'selected-repeat', { ...pin(), rootId: root.id }); equal(again.receiptId, selected.receiptId); });
  await run('isolated', async () => { assert.ok(projection); const [sourceName, file, label] = oracle.isolatedRoot;
    let page = projection.roots; const roots = [...page.items];
    while (page.next !== null) { const response = await observed(s, 'root-page-' + page.next, () => s.paths.read({ buildId: s.buildId, ...pin(), offset: page.next }, 'roots')); page = response.roots; roots.push(...page.items); }
    const root = roots.find(item => item.sourceName === sourceName && item.path === file && item.role === 'vue-action' && item.label === label); assert.ok(root); check(!projection.roots.items.some(item => item.id === root.id), 'Isolated root is beyond the first page.');
    isolated = await capture(s, 'isolated', { ...pin(), rootId: root.id }); const read = await history(s, 'isolated-read', isolated);
    equal(read.projection.graph.nodes.length, 1); equal(read.projection.graph.edges.length, 0); });
  await run('roundtrip', async () => { assert.ok(first); const raw = await readFile(first.file, 'utf8'), wrapper = JSON.parse(JSON.stringify(JSON.parse(raw)));
    const parsed = JSON.parse(wrapper.projectionJson), { projectionId, ...content } = parsed;
    equal(hash(JSON.stringify(content)), projectionId); check(hash(canonical(content)) !== projectionId, 'Recursive canonicalization would break the producer projection hash.');
    equal(wrapper.projectionJson, JSON.parse(raw).projectionJson); const read = await history(s, 'roundtrip-read', first); equal(read.projection, projection);
    equal(JSON.stringify(retrieveAnswerContext(s.catalog, 'How is a parcel queued?', s.buildId)), legacy.context);
    equal(JSON.stringify(codeFlows(s.catalog, s.buildId)), legacy.graph); equal(s.legacyRows(), legacy.rows);
    for (const [source, revision] of Object.entries(s.revisions)) { equal(s.git(source, ['rev-parse', 'HEAD']), revision); equal(s.git(source, ['status', '--porcelain=v1']), ''); }
  });
  await run('external-lock', async () => { const writer = new DatabaseSync(path.join(s.root, 'data/loredock.db')); let blocked = false;
    try { const receipt = await capture(s, 'external-lock', {}, { insideFence() {
      try { writer.prepare("UPDATE files SET reason='must-not-commit' WHERE path='README.md'").run(); } catch (error) { assert.match(error.message, /locked/); blocked = true; }
    } }); check(blocked, 'Second SQLite writer is blocked inside final guard.'); equal(receipt.receiptId, first.receiptId); }
    finally { writer.close(); }
  });
});

for (const name of ['missing', 'unpublished', 'incompatible', 'root-page', 'busy']) await run('availability-' + name, () => fresh(async s => {
  if (name === 'unpublished') { const row = s.analysis.start('pause', s.buildId); s.analysis.control(row.id, 'pause'); await s.analysis.idle(); }
  if (name === 'incompatible') { const id = await s.analyze(); s.store.run('UPDATE code_analyses SET fingerprint=? WHERE id=?', '0'.repeat(64), id); }
  if (name === 'root-page') { await s.analyze(); return rejected(s, name, () => captureReceipt(s.services, s.folder, { buildId: s.buildId, offset: 0 }), 'INVALID_RECEIPT_SELECTION'); }
  if (name === 'busy') {
    await s.analyze(); let release, enter; const entered = new Promise(resolve => { enter = resolve; }); let first = true;
    const service = new CodePaths(s.analysis, { checkpoint: async () => { if (first) { first = false; enter(); await new Promise(resolve => { release = resolve; }); } } });
    const active = service.read({ buildId: s.buildId }); await entered;
    try { return await rejected(s, name, () => captureReceipt(s.services, s.folder, { buildId: s.buildId }), 'PATHS_BUSY'); }
    finally { release(); await active; await service.stop(); }
  }
  return rejected(s, name, () => captureReceipt(s.services, s.folder, { buildId: s.buildId }), 'RECEIPT_UNAVAILABLE');
}, false));

const limitCodes = { projectionBytes: 'RECEIPT_PROJECTION_LIMIT', spans: 'RECEIPT_SPAN_LIMIT', textBytes: 'RECEIPT_TEXT_LIMIT', receiptBytes: 'RECEIPT_BYTES_LIMIT', wallMs: 'RECEIPT_TIME_LIMIT', work: 'RECEIPT_WORK_LIMIT', sources: 'RECEIPT_SOURCE_LIMIT' };
for (const limit of Object.keys(oracle.receiptLimits)) await run('limit-' + limit, () => fresh(s => rejected(s, 'limit-' + limit,
  () => captureReceipt(s.services, s.folder, { buildId: s.buildId }, { limits: { [limit]: limit === 'sources' ? 1 : 0 } }), limitCodes[limit])));
for (const limits of [{ unknown: 1 }, { spans: 31 }, { work: -1 }, { wallMs: 0.5 }]) await run('invalid-limit-' + JSON.stringify(limits), () => fresh(s =>
  rejected(s, 'invalid-limit', () => captureReceipt(s.services, s.folder, { buildId: s.buildId }, { limits }), 'INVALID_RECEIPT_LIMIT')));
for (const stage of oracle.captureCancelStages) await run('cancel-' + stage, () => fresh(async s => {
  const controller = new AbortController(); let reached = false;
  const result = await rejected(s, 'cancel-' + stage, () => captureReceipt(s.services, s.folder, { buildId: s.buildId }, { signal: controller.signal,
    checkpoint(info) { if (info.stage === stage) { reached = true; controller.abort(); } } }), 'CANCELLED'); check(reached); return result;
}));

async function mutate(s, kind) {
  const inventory = s.analysis.list()[0];
  if (kind === 'metadata') s.store.run("UPDATE files SET mode='100755' WHERE path='README.md'");
  else if (kind === 'manifest') s.store.run('UPDATE code_analyses SET manifestHash=? WHERE id=?', '0'.repeat(64), inventory.id);
  else if (kind === 'original') s.store.run("UPDATE files SET raw=? WHERE path='ui/AAQueue.vue'", Buffer.from('changed owned original'));
  else if (kind === 'policy') s.catalog.updatePolicy(['changed-owned-policy']);
  else if (kind === 'registry') await s.addSource();
  else s.catalog.revoke(s.catalog.state().sources.find(source => source.name === (kind === 'cited-revocation' ? 'parcel-console' : oracle.uncitedSource)).id);
}
for (const stage of oracle.captureMutationStages) for (const mutation of oracle.captureMutations) await run('fence-' + stage + '-' + mutation, () => fresh(async s => {
  let reached = false; const allowed = {};
  const result = await rejected(s, 'fence-' + stage + '-' + mutation, () => captureReceipt(s.services, s.folder, { buildId: s.buildId }, {
    async checkpoint(info) { if (!reached && info.stage === stage) { reached = true; await lifecycle(s, allowed, () => mutate(s, mutation)); } },
  }), 'RECEIPT_FENCED', allowed); check(reached); return result;
}));
await run('external-commit-before-handoff', () => fresh(async s => {
  const writer = new DatabaseSync(path.join(s.root, 'data/loredock.db')), initial = s.counters().changedRows; let changed = false;
  try { const result = await rejected(s, 'external-commit', () => captureReceipt(s.services, s.folder, { buildId: s.buildId }, {
    checkpoint({ stage }) { if (stage === 'handoff') { writer.prepare("UPDATE files SET reason='external-owned-write' WHERE path='README.md'").run(); changed = true; } },
  }), 'RECEIPT_FENCED', { externalCommits: 1 }); check(changed); equal(s.counters().changedRows, initial); return result; }
  finally { writer.close(); }
}));

for (const name of oracle.historyCases) await run('history-' + name, () => fresh(async s => {
  await seedLegacy(s); const captured = await capture(s, 'history-' + name + '-capture'), raw = await readFile(captured.file, 'utf8');
  const record = JSON.parse(raw), prior = JSON.parse(record.projectionJson);
  const id = prior.identity.inventoryId;
  if (name === 'eviction' || name === 'restart') { await s.analyze('new-one'); await s.analyze('new-two'); assert.throws(() => s.analysis.get(id)); if (name === 'restart') await s.restart(); }
  if (name === 'new-index') await s.index('new-index');
  if (name === 'registry-growth') await s.addSource();
  if (name === 'parser-change') s.store.run('UPDATE code_analyses SET fingerprint=? WHERE id=?', '1'.repeat(64), id);
  if (name === 'alternative-change') {
    const alternate = oracle.alternative; await s.write(alternate.source, alternate.path, alternate.text); s.commit(alternate.source);
    const next = await s.index('alternative'); await s.analyze('alternative', next);
    const current = await observed(s, 'alternative-current-projection', () => s.paths.read({ buildId: next })); equal(current.status, 'available'); check(current.generationId !== prior.generationId);
    const handler = expectedNode(prior, ['parcel-publisher', 'java/Parcels.java', 'symbol', 'Parcels.queue', 'java-method']);
    check(prior.graph.edges.some(edge => edge.kind === 'implements' && edge.to === handler.id));
    const reference = expectedNode(current, ['parcel-publisher', 'config/routes.json', 'handler-reference', 'Parcels.queue', null]);
    check(!current.graph.edges.some(edge => edge.kind === 'implements' && edge.from === reference.id));
    for (const [file, text] of Object.entries(corpus[alternate.source])) equal(await readFile(path.join(s.root, 'sources', alternate.source, file), 'utf8'), text);
  }
  if (name === 'cited-revocation' || name === 'uncited-revocation' || name === 'policy') await mutate(s, name);
  if (name === 'missing-original') s.store.run('DELETE FROM spans WHERE id=?', record.originals[0].id);
  if (name === 'corrupt-original') s.store.run("UPDATE spans SET text=text || ' altered' WHERE id=?", record.originals[0].id);
  if (name === 'missing-file') await unlink(captured.file);
  const failure = ['cited-revocation', 'uncited-revocation', 'policy', 'missing-original', 'corrupt-original', 'missing-file'].includes(name);
  const currentLegacy = s.legacyRows();
  if (failure) await rejectHistory(s, 'history-' + name, captured.receiptId);
  else { const read = await history(s, 'history-' + name, captured); equal(read.projection, prior);
    if (['new-index', 'registry-growth', 'alternative-change'].includes(name)) equal(read.stale, true); }
  equal(s.legacyRows(), currentLegacy); if (name !== 'missing-file') equal(await readFile(captured.file, 'utf8'), raw);
}));

for (const name of oracle.corruptions) await run('corrupt-' + name, () => fresh(async s => {
  const captured = await capture(s, 'corrupt-' + name + '-capture');
  const raw = await readFile(captured.file, 'utf8'), receipt = JSON.parse(raw), projection = JSON.parse(receipt.projectionJson);
  const delivery = projection.graph.edges.find(edge => edge.kind === 'event-delivery'); check(Boolean(delivery), 'Corruption starts from a complete path.');
  if (name === 'unknown-adapter') projection.identity.adapter = 'unrecognized-experiment';
  if (name === 'unknown-schema') projection.schemaVersion = 'unknown-topic-paths/9';
  if (name === 'topic-value') delivery.topicCheck.value = 'forged';
  if (name === 'topic-expression') delivery.topicCheck.publisher.expression = '"forged"';
  if (name === 'topic-support') delivery.topicCheck.publisher.evidenceIds = [...delivery.topicCheck.subscriber.evidenceIds];
  if (name === 'topic-rule') delivery.topicCheck.rule = 'unknown-rule/9';
  if (name === 'missing-witness') delete delivery.topicCheck;
  if (name === 'unexpected-witness') projection.graph.edges.find(edge => edge.kind !== 'event-delivery').topicCheck = structuredClone(delivery.topicCheck);
  if (name === 'original-text') receipt.originals[0].text += ' forged';
  if (name === 'missing-dependency') receipt.dependencies = receipt.dependencies.filter(row => row.name !== oracle.uncitedSource);
  projection.generationId = hash(JSON.stringify(projection.identity));
  const { projectionId: _oldProjection, ...body } = projection; projection.projectionId = hash(JSON.stringify(body));
  receipt.projectionJson = JSON.stringify(projection);
  const { receiptHash: _oldReceipt, ...content } = receipt; receipt.receiptHash = hash(canonical(content));
  let expected = receipt.receiptHash, bytes = canonical(receipt);
  if (name === 'outer-hash') { expected = captured.receiptId; bytes = raw + ' '; }
  if (name === 'duplicate-key') { expected = captured.receiptId; bytes = '{"receiptHash":' + JSON.stringify(expected) + ',' + raw.slice(1); }
  const file = path.join(s.folder, expected + '.json'); await writeFile(file, bytes);
  const artifact = path.join(artifacts, 'corrupt-' + name + '-mutated.json'); await writeFile(artifact, bytes);
  const info = { file: path.relative(output, artifact), bytes: Buffer.byteLength(bytes), sha256: hash(bytes) };
  observations.push({ name: 'edited-' + name, artifact: info }); await save();
  const result = await rejectHistory(s, 'corrupt-' + name, expected);
  return { ...result, artifact: info };
}));

await save(); console.log(JSON.stringify({ output, checks, cases: records.length, observations: observations.length, failureCount }));
process.exitCode = failureCount ? 1 : 0;
