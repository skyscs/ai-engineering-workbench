import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir, copyFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { receiptFixture } from './loredock-receipt-fixture.mjs';
import { captureReceipt, readReceipt, receiptLimits } from './loredock-path-receipt.mjs';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { SourceGit } from '../apps/loredock/dist/git.js';
import { CodeAnalysis } from '../apps/loredock/dist/code-analysis.js';
import { CodePaths } from '../apps/loredock/dist/code-paths.js';
import { codeFlows } from '../apps/loredock/dist/code-flows.js';
import { retrieveAnswerContext } from '../apps/loredock/dist/answer-context.js';
import { Corrections } from '../apps/loredock/dist/corrections.js';

// This entry point executes the frozen Task 071 matrix ONCE, never from CI or regression tests.
const root = fileURLToPath(new URL('../', import.meta.url));
const inputFiles = ['corpus.json', 'oracle.json', 'README.md'];
const inputBytes = await Promise.all(inputFiles.map(name => readFile(path.join(root, 'fixtures/loredock-path-receipts', name))));
const corpus = JSON.parse(inputBytes[0]), oracle = JSON.parse(inputBytes[1]);
assert.deepEqual(receiptLimits, oracle.limits);
const output = process.env.LOREDOCK_RECEIPT_OUTPUT;
assert.ok(output && path.isAbsolute(output), 'An absolute fresh owned output directory is required.');
await mkdir(output); // Exclusive first-run guard: an existing result directory is never reused.
const scratch = path.join(output, 'scratch'); await mkdir(scratch);
const artifacts = path.join(output, 'receipts'); await mkdir(artifacts);
const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value) : Array.isArray(value)
  ? '[' + value.map(canonical).join(',') + ']' : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
const records = [], observations = []; let checks = 0, failureCount = 0, serial = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const metadata = { schemaVersion: 'task071-receipt-result/1', createdAt: new Date().toISOString(),
  candidateCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  inputHashes: Object.fromEntries(inputFiles.map((name, i) => [name, hash(inputBytes[i])])),
  node: process.version, hardware: { platform: os.platform(), arch: os.arch(), cpus: os.cpus().length, cpu: os.cpus()[0]?.model, memoryBytes: os.totalmem() },
  limits: receiptLimits, resourceLimits: oracle.resources, modelRequests: 0,
  scope: 'Owned synthetic structural/integrity qualification; no independent semantic or private-pilot acceptance.' };
await writeFile(path.join(output, 'identity.json'), JSON.stringify(metadata, null, 2) + '\n');
async function save() { await writeFile(path.join(output, 'result.json'), JSON.stringify({ ...metadata, checks, failureCount, records, observations }, null, 2) + '\n'); }
async function run(name, fn) {
  const before = checks;
  try { const detail = await fn(); records.push({ name, status: 'pass', checks: checks - before, detail: detail ?? null }); }
  catch (error) { failureCount++; records.push({ name, status: 'fail', checks: checks - before, error: { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack } }); }
  await save(); console.log(JSON.stringify(records.at(-1)));
}
async function fresh(fn, analyzed = true) {
  const s = await receiptFixture(scratch, corpus, { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths });
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
  observations.push(record);
  equal(record.after.gitCalls, counters.gitCalls + (mutable?.gitCalls ?? 0), 'No Git call outside the explicit lifecycle hook.');
  equal(record.after.writeCalls, counters.writeCalls + (mutable?.writeCalls ?? 0), 'No store.run call outside the explicit lifecycle hook.');
  equal(record.after.changedRows, counters.changedRows + (mutable?.changedRows ?? 0), 'No SQLite DML outside the explicit lifecycle hook.');
  equal(s.legacyRows(), mutable?.legacy ?? legacy, 'Legacy rows remain unchanged outside explicit lifecycle hooks.');
  if (!error && resources) {
    check(record.wallMs < receiptLimits.wallMs, 'Outer five-second deadline.');
    check(record.maxSliceMs <= oracle.resources.maxSliceMs, 'Maximum sampled uninterrupted interval.');
    check(record.peakRssMiB <= oracle.resources.sampledRssMiB, 'Sampled process RSS bound.');
    check(record.heapGrowthMiB <= oracle.resources.sampledHeapGrowthMiB, 'Sampled heap growth bound.');
    check(result.metrics.work <= receiptLimits.work, 'Total receipt work bound.');
  }
  if (error) throw error;
  return result;
}
async function capture(s, name, selection = {}, options = {}, resources = true, mutable = false) {
  const result = await observed(s, name, () => captureReceipt(s.services, s.folder, { buildId: s.buildId, ...selection }, options), resources, mutable);
  const destination = path.join(artifacts, `${String(++serial).padStart(3, '0')}-${name.replaceAll(/[^a-z0-9-]/gi, '-')}-${result.receiptId}.json`);
  await copyFile(result.file, destination); result.artifact = path.relative(output, destination); return result;
}
async function history(s, name, receipt, resources = true, options = {}) {
  const counters = s.counters(), result = await observed(s, name, () => readReceipt(s.catalog, s.folder, receipt.receiptId, options), resources);
  equal(s.counters().factReads, counters.factReads); equal(s.counters().snapshots, counters.snapshots); equal(s.counters().pathReads, counters.pathReads);
  equal(result.status, 'recorded'); equal(result.currentApplicability, 'not-checked'); return result;
}
async function rejected(s, name, fn, expected, mutable = false) {
  const before = await readdir(s.folder); let caught;
  try { await observed(s, name, fn, false, mutable); } catch (error) { caught = error; }
  check(Boolean(caught), 'Expected operation to fail.'); if (expected) equal(caught.code, expected);
  equal(await readdir(s.folder), before, 'Failure creates no receipt or pending file.'); return { code: caught.code ?? caught.name };
}
async function seedLegacy(s) {
  const graph = await codeFlows(s.catalog, s.buildId), edge = graph.edges.find(item => item.kind === 'calls');
  assert.ok(edge, 'Owned legacy fixture must provide a source link.');
  await new Corrections(s.catalog).save({ requestId: 'owned-legacy-note', buildId: s.buildId, targetKind: 'code-link', targetId: edge.id,
    projectionHash: graph.inputHash, expectedRevision: 0, expectedPreviousId: null, action: 'clarify',
    statement: 'This owned source link does not verify runtime wiring.', environment: null });
  const context = await retrieveAnswerContext(s.catalog, 'How is a seat booking placed?', s.buildId), id = randomUUID();
  s.store.run(`INSERT INTO answer_attempts
    (id,requestId,payloadHash,question,buildId,policyVersion,registryVersion,status,context,inputHash,connection,model,effort,promptVersion,schemaVersion,createdAt,reason)
    VALUES (?,?,?,?,?,?,?,'cancelled',?,?,?,'not-dispatched','not-dispatched','loredock-answer-v9','cited-answer-v3',?,?)`,
    id, 'owned-cancelled-answer', hash('owned fixture'), context.question, s.buildId, context.policyVersion, context.registryVersion,
    JSON.stringify(context), context.inputHash, '{}', '2026-03-03T00:00:00.000Z', 'Owned fixture row; no model dispatched.');
  for (const source of context.sources) s.store.run('INSERT INTO answer_sources VALUES (?,?)', id, source.sourceId);
  return { context: JSON.stringify(context), graph: JSON.stringify(await codeFlows(s.catalog, s.buildId)), rows: s.legacyRows() };
}

async function lifecycle(s, allowed, fn) {
  const before = s.counters(); await fn(); const after = s.counters();
  for (const field of ['gitCalls', 'writeCalls', 'changedRows']) allowed[field] = (allowed[field] ?? 0) + after[field] - before[field];
  allowed.legacy = s.legacyRows();
}

// Stable captures share one catalog so repeated identity is a meaningful assertion.
await fresh(async s => {
  const legacy = await seedLegacy(s); let first, selected, isolated, projection;
  await run('default-first', async () => {
    first = await capture(s, 'default-first'); const receipt = JSON.parse(await readFile(first.file, 'utf8')); projection = JSON.parse(receipt.projectionJson);
    equal(projection.graph.flows.length, oracle.defaultFlows);
    for (const [sourceName, file, kind, label] of oracle.criticalNodes)
      check(projection.graph.nodes.some(node => node.sourceName === sourceName && node.path === file && node.kind === kind && node.label === label), 'Required source node: ' + label);
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
  await run('selected-first', async () => { assert.ok(projection); const root = projection.roots.items.find(item => item.label === 'reserve'); assert.ok(root);
    selected = await capture(s, 'selected-first', { ...pin(), rootId: root.id }); const read = await history(s, 'selected-read', selected); equal(read.projection.graph.flows.length, 1); return { receiptId: selected.receiptId }; });
  await run('selected-repeat', async () => { assert.ok(selected); const root = projection.roots.items.find(item => item.label === 'reserve');
    const again = await capture(s, 'selected-repeat', { ...pin(), rootId: root.id }); equal(again.receiptId, selected.receiptId); });
  await run('isolated', async () => { assert.ok(projection); const [sourceName, file, label] = oracle.isolatedRoot;
    const root = projection.roots.items.find(item => item.sourceName === sourceName && item.path === file && item.label === label); assert.ok(root);
    isolated = await capture(s, 'isolated', { ...pin(), rootId: root.id }); const read = await history(s, 'isolated-read', isolated);
    equal(read.projection.graph.nodes.length, 1); equal(read.projection.graph.edges.length, 0); });
  await run('roundtrip', async () => { assert.ok(first); const raw = await readFile(first.file, 'utf8'), wrapper = JSON.parse(JSON.stringify(JSON.parse(raw)));
    const parsed = JSON.parse(wrapper.projectionJson), { projectionId, ...content } = parsed;
    equal(hash(JSON.stringify(content)), projectionId); check(hash(canonical(content)) !== projectionId, 'Recursive canonicalization would break the producer projection hash.');
    equal(wrapper.projectionJson, JSON.parse(raw).projectionJson); const read = await history(s, 'roundtrip-read', first); equal(read.projection, projection);
    equal(JSON.stringify(await retrieveAnswerContext(s.catalog, 'How is a seat booking placed?', s.buildId)), legacy.context);
    equal(JSON.stringify(await codeFlows(s.catalog, s.buildId)), legacy.graph); equal(s.legacyRows(), legacy.rows);
    for (const [source, revision] of Object.entries(s.revisions)) { equal(s.git(source, ['rev-parse', 'HEAD']), revision); equal(s.git(source, ['status', '--porcelain=v1']), ''); }
  });
  await run('external-lock', async () => { const writer = new DatabaseSync(path.join(s.root, 'data/loredock.db')); let blocked = false;
    try { const receipt = await capture(s, 'external-lock', {}, { insideFence() {
      try { writer.prepare("UPDATE files SET reason='must-not-commit' WHERE path='README.md'").run(); } catch (error) { assert.match(error.message, /locked/); blocked = true; }
    } }); check(blocked, 'Second SQLite writer is blocked inside final guard.'); equal(receipt.receiptId, first.receiptId); }
    finally { writer.close(); }
  });
});

for (const name of oracle.availabilityFailures) await run('availability-' + name, () => fresh(async s => {
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
for (const limit of Object.keys(oracle.limits)) await run('limit-' + limit, () => fresh(s => rejected(s, 'limit-' + limit,
  () => captureReceipt(s.services, s.folder, { buildId: s.buildId }, { limits: { [limit]: limit === 'sources' ? 1 : 0 } }), limitCodes[limit])));
for (const limits of [{ unknown: 1 }, { spans: 31 }, { work: -1 }, { wallMs: 0.5 }]) await run('invalid-limit-' + JSON.stringify(limits), () => fresh(s =>
  rejected(s, 'invalid-limit', () => captureReceipt(s.services, s.folder, { buildId: s.buildId }, { limits }), 'INVALID_RECEIPT_LIMIT')));
for (const stage of oracle.captureStages) await run('cancel-' + stage, () => fresh(async s => {
  const controller = new AbortController(); let reached = false;
  const result = await rejected(s, 'cancel-' + stage, () => captureReceipt(s.services, s.folder, { buildId: s.buildId }, { signal: controller.signal,
    checkpoint(info) { if (info.stage === stage) { reached = true; controller.abort(); } } }), 'CANCELLED'); check(reached); return result;
}));

async function mutate(s, kind) {
  const inventory = s.analysis.list()[0];
  if (kind === 'metadata') s.store.run("UPDATE files SET mode='100755' WHERE path='README.md'");
  else if (kind === 'manifest') s.store.run('UPDATE code_analyses SET manifestHash=? WHERE id=?', '0'.repeat(64), inventory.id);
  else if (kind === 'original') s.store.run("UPDATE files SET raw=? WHERE path='ui/AAReserve.vue'", Buffer.from('changed owned original'));
  else if (kind === 'policy') s.catalog.updatePolicy(['changed-owned-policy']);
  else if (kind === 'registry') await s.addSource();
  else s.catalog.revoke(s.catalog.state().sources.find(source => source.name === (kind === 'cited-revocation' ? 'seat-desk' : oracle.uncitedSource)).id);
}
for (const stage of oracle.captureStages) for (const mutation of oracle.mutations) await run('fence-' + stage + '-' + mutation, () => fresh(async s => {
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
    const current = await s.paths.read({ buildId: next }); equal(current.status, 'available'); check(current.generationId !== prior.generationId);
    const handler = prior.graph.nodes.find(node => node.label === 'Reservations.place'); assert.ok(handler);
    check(prior.graph.edges.some(edge => edge.kind === 'implements' && edge.to === handler.id));
    check(!current.graph.edges.some(edge => edge.kind === 'implements' && current.graph.nodes.find(node => node.id === edge.to)?.label === 'Reservations.place'));
    for (const [file, text] of Object.entries(corpus[alternate.source])) equal(await readFile(path.join(s.root, 'sources', alternate.source, file), 'utf8'), text);
  }
  if (name === 'cited-revocation' || name === 'uncited-revocation' || name === 'policy') await mutate(s, name);
  if (name === 'missing-original') s.store.run('DELETE FROM spans WHERE id=?', record.originals[0].id);
  if (name === 'corrupt-original') s.store.run("UPDATE spans SET text=text || ' altered' WHERE id=?", record.originals[0].id);
  if (name === 'missing-file') await unlink(captured.file);
  const failure = ['cited-revocation', 'uncited-revocation', 'policy', 'missing-original', 'corrupt-original', 'missing-file'].includes(name);
  const currentLegacy = s.legacyRows();
  if (failure) await rejected(s, 'history-' + name, () => readReceipt(s.catalog, s.folder, captured.receiptId));
  else { const read = await history(s, 'history-' + name, captured); equal(read.projection, prior);
    if (['new-index', 'registry-growth', 'alternative-change'].includes(name)) equal(read.stale, true); }
  equal(s.legacyRows(), currentLegacy); if (name !== 'missing-file') equal(await readFile(captured.file, 'utf8'), raw);
}));

for (const name of oracle.corruptions) await run('corrupt-' + name, () => fresh(async s => {
  const captured = await capture(s, 'corrupt-' + name + '-capture'), receipt = JSON.parse(await readFile(captured.file, 'utf8'));
  let projection = JSON.parse(receipt.projectionJson);
  if (name === 'format') receipt.schemaVersion = 'unknown-receipt/9';
  if (name === 'projection-json') receipt.projectionJson = '{invalid';
  if (name === 'generation') projection.generationId = '0'.repeat(64);
  if (name === 'projection-hash') projection.projectionId = '0'.repeat(64);
  if (name === 'receipt-hash') receipt.receiptHash = '0'.repeat(64);
  if (name === 'original-text') receipt.originals[0].text += ' forged';
  if (name === 'original-hash') receipt.originals[0].contentHash = '0'.repeat(64);
  if (name === 'original-range') receipt.originals[0].startLine++;
  if (name === 'foreign-build') receipt.originals[0].buildId = randomUUID();
  if (name === 'missing-support') receipt.originals.pop();
  if (name === 'missing-dependency') receipt.dependencies = receipt.dependencies.filter(dep => dep.name !== oracle.uncitedSource);
  if (name === 'unknown-key') receipt.unknown = 'forged field';
  if (['generation', 'projection-hash'].includes(name)) receipt.projectionJson = JSON.stringify(projection);
  if (name !== 'receipt-hash') { const { receiptHash: _old, ...content } = receipt; receipt.receiptHash = hash(canonical(content)); }
  const expectedId = name === 'receipt-hash' ? captured.receiptId : receipt.receiptHash;
  const mutated = path.join(s.folder, expectedId + '.json'); await writeFile(mutated, canonical(receipt));
  const artifact = path.join(artifacts, 'corrupt-' + name + '-mutated.json'); await copyFile(mutated, artifact);
  const failure = await rejected(s, 'corrupt-' + name, () => readReceipt(s.catalog, s.folder, expectedId));
  return { ...failure, artifact: path.relative(output, artifact) };
}));
await save(); console.log(JSON.stringify({ output, checks, cases: records.length, observations: observations.length, failureCount }));
process.exitCode = failureCount ? 1 : 0;
