import { CaptureBudget, captureAccounting } from '../loredock-capture-scale/budget.mjs';
// Task 077 diagnostic fork: trusted synchronous hooks only; original receipts remain unchanged.
import { topicRule, literalTopic } from '../loredock-literal-topics/topic.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { constants, openSync, closeSync, readFileSync, writeFileSync, fsyncSync, fstatSync, lstatSync, realpathSync, linkSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { setImmediate as yieldTurn } from 'node:timers/promises';

// Offline only: no production imports, endpoint, schema, arbitrary-file import or analysis owner.
export const receiptLimits = Object.freeze({ projectionBytes: 512 * 1024, spans: 30, textBytes: 64 * 1024,
  receiptBytes: 640 * 1024, wallMs: 5000, work: 1000000, sources: 20 });
const hash = value => createHash('sha256').update(value).digest('hex');
const bytes = value => Buffer.byteLength(value, 'utf8');
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export class ReceiptError extends Error { constructor(code, message) { super(message); this.code = code; } }
function requireValue(ok, code = 'CORRUPT_RECEIPT', message = 'The recorded receipt failed validation.') { if (!ok) throw new ReceiptError(code, message); }
function keys(value, required, optional = []) {
  requireValue(object(value) && required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key)));
}
function canonical(value, depth = 0) {
  requireValue(depth <= 40);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { requireValue(Number.isFinite(value)); return JSON.stringify(value); }
  if (Array.isArray(value)) return '[' + value.map(item => canonical(item, depth + 1)).join(',') + ']';
  requireValue(object(value));
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key], depth + 1)).join(',') + '}';
}
const same = (a, b) => canonical(a) === canonical(b);
function limitsFor(options) {
  const result = { ...receiptLimits, ...options.limits };
  for (const [key, value] of Object.entries(result)) requireValue(Object.hasOwn(receiptLimits, key) && Number.isSafeInteger(value) && value >= 0
    && value <= receiptLimits[key], 'INVALID_RECEIPT_LIMIT', 'Receipt limits may only reduce the fixed bounds.');
  return result;
}
const epoch = catalog => ({ changes: catalog.store.one('SELECT total_changes() n').n,
  version: catalog.store.one('PRAGMA data_version').data_version, policy: catalog.store.project().policyVersion,
  registry: catalog.store.project().sourceSetVersion });
class Work {
  constructor(catalog, options, budget) { this.budget = budget; this.catalog = catalog; this.options = options; this.limits = limitsFor(options);
    this.began = budget.began; this.initial = epoch(catalog); this.units = 0; this.checkpoints = 0; this.check(); }
  charge(count = 1) { this.budget.charge('receipt', count); this.units += count; this.check(); }
  check() {
    this.budget.check();
    requireValue(!this.options.signal?.aborted, 'CANCELLED', 'Receipt work was cancelled.');
    requireValue(this.units <= this.limits.work, 'RECEIPT_WORK_LIMIT', 'Receipt work bound exceeded.');
    requireValue(performance.now() - this.began < this.limits.wallMs, 'RECEIPT_TIME_LIMIT', 'Receipt cooperative time bound reached.');
    requireValue(same(epoch(this.catalog), this.initial), 'RECEIPT_FENCED', 'Catalog input changed during receipt work.');
  }
  async step(stage) { this.charge(); await yieldTurn(); this.checkpoints++;
    await this.options.checkpoint?.({ stage, units: this.units, checkpoints: this.checkpoints, budget: this.budget }); this.check(); }
  stats() { return { ...this.budget.stats(), work: this.budget.stats().totalWork, checkpoints: this.checkpoints }; }
}
function dependencies(catalog, buildId, limits) {
  const build = catalog.readBuildHeader(buildId), rows = catalog.store.buildSources(buildId);
  requireValue(rows.length <= limits.sources, 'RECEIPT_SOURCE_LIMIT', 'Receipt source scope exceeds its bound.');
  const result = rows.map(row => { requireValue(catalog.store.source(row.sourceId).status === 'active', 'RECEIPT_SCOPE_FENCED', 'A receipt dependency was revoked.');
    return { sourceId: row.sourceId, name: row.name, revision: row.revision, tree: row.tree, status: row.status, omitted: row.omitted }; });
  result.sort((a, b) => a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0);
  return { build, result };
}
const originalKeys = ['id', 'buildId', 'sourceId', 'sourceName', 'revision', 'path', 'startLine', 'endLine', 'contentHash', 'spanHash', 'blobId', 'text'];
function original(catalog, id) { const evidence = catalog.evidence(id); return Object.fromEntries(originalKeys.map(key => [key, evidence[key]])); }
function validateProjection(serialized, limits, work) {
  requireValue(typeof serialized === 'string'); work.charge(bytes(serialized));
  requireValue(bytes(serialized) <= limits.projectionBytes, 'RECEIPT_PROJECTION_LIMIT', 'Projection bytes exceed the receipt bound.');
  let value; try { value = JSON.parse(serialized); } catch { throw new ReceiptError('CORRUPT_RECEIPT', 'Invalid recorded projection JSON.'); }
  requireValue(serialized === JSON.stringify(value));
  keys(value, ['schemaVersion', 'status', 'kind', 'generationId', 'projectionId', 'identity', 'coverage', 'graph', 'selection', 'partial', 'deploymentCoherence', 'roots']);
  requireValue(value.schemaVersion === 'loredock-shared-capture-paths/1' && value.status === 'available' && value.kind === 'paths'
    && value.partial === true && value.deploymentCoherence === 'unknown' && hex(value.generationId) && hex(value.projectionId));
  const { projectionId, ...content } = value;
  requireValue(hash(JSON.stringify(content)) === projectionId && hash(JSON.stringify(value.identity)) === value.generationId);
  keys(value.identity, ['buildId', 'sourceSetVersion', 'inventoryId', 'fingerprint', 'analysisLimits', 'manifestHash', 'metadataDigest',
    'declarationAdapter', 'declarationInputHash', 'policyVersion', 'registryVersion', 'adapter', 'topicRule', 'accounting', 'limits']);
  requireValue(value.identity.adapter === 'connected-capture-budget-experiment-v1' && same(value.identity.topicRule, topicRule) && same(value.identity.accounting, captureAccounting));
  const graph = value.graph;
  keys(graph, ['schemaVersion', 'adapterVersion', 'buildId', 'policyVersion', 'sourceSetVersion', 'registryVersion', 'stale', 'partial',
    'deploymentCoherence', 'nodes', 'edges', 'flows', 'evidence', 'gaps', 'omissions', 'declarationOmissions', 'limits', 'coverage', 'inputHash']);
  requireValue(graph.schemaVersion === 'loredock-shared-capture-display/1' && graph.adapterVersion === 'connected-capture-budget-experiment-v1'
    && graph.partial === true && graph.deploymentCoherence === 'unknown' && graph.buildId === value.identity.buildId
    && graph.policyVersion === value.identity.policyVersion && graph.registryVersion === value.identity.registryVersion
    && graph.sourceSetVersion === value.identity.sourceSetVersion && Array.isArray(graph.nodes) && graph.nodes.length <= 160
    && Array.isArray(graph.edges) && graph.edges.length <= 240 && Array.isArray(graph.flows) && graph.flows.length <= 2);
  keys(value.roots, ['offset', 'limit', 'total', 'previous', 'next', 'outsidePage', 'unavailableEntries', 'items', 'evidence']);
  keys(value.selection, ['rootId', 'offset']);
  requireValue(value.roots.limit === 4 && Array.isArray(value.roots.items) && value.roots.items.length <= 4
    && value.selection.offset === 0 && value.roots.offset === 0);
  const evidence = new Map(), used = new Set(), nodeIds = new Set(), edgeIds = new Set();
  for (const dictionary of [graph.evidence, value.roots.evidence]) {
    requireValue(object(dictionary));
    for (const [id, ref] of Object.entries(dictionary)) {
      work.charge(); keys(ref, ['id', 'sourceName', 'path', 'revision', 'startLine', 'endLine']);
      requireValue(ref.id === id && (!evidence.has(id) || same(evidence.get(id), ref)));
      evidence.set(id, ref);
    }
  }
  requireValue(evidence.size <= limits.spans, 'RECEIPT_SPAN_LIMIT', 'Complete original support exceeds the receipt span bound.');
  const support = ids => { requireValue(Array.isArray(ids) && ids.length > 0); for (const id of ids) { requireValue(evidence.has(id)); used.add(id); } };
  for (const node of graph.nodes) {
    work.charge(); keys(node, ['id', 'kind', 'label', 'sourceId', 'sourceName', 'path', 'revision', 'startLine', 'endLine', 'properties', 'evidenceIds']);
    requireValue(typeof node.id === 'string' && !nodeIds.has(node.id)); nodeIds.add(node.id); support(node.evidenceIds);
  }
  for (const edge of graph.edges) {
    work.charge(); keys(edge, ['id', 'kind', 'from', 'to', 'status', 'reason', 'environment', 'gaps', 'evidenceIds'], ['headerCheck', 'topicCheck']);
    requireValue(typeof edge.id === 'string' && !edgeIds.has(edge.id) && nodeIds.has(edge.from) && nodeIds.has(edge.to)
      && ['static', 'candidate'].includes(edge.status)); edgeIds.add(edge.id); support(edge.evidenceIds);
    if (edge.kind === 'event-delivery') {
      const witness = edge.topicCheck; keys(witness, ['rule', 'value', 'publisher', 'subscriber']);
      requireValue(edge.status === 'candidate' && witness.rule === topicRule.version && typeof witness.value === 'string');
      for (const [key, endpoint, kind] of [['publisher', edge.from, 'event-publish'], ['subscriber', edge.to, 'event-subscribe']]) {
        const item = witness[key], node = graph.nodes.find(row => row.id === endpoint);
        keys(item, ['expression', 'evidenceIds']);
        requireValue(node.kind === kind && literalTopic(item.expression) !== null && literalTopic(item.expression) === witness.value
          && item.expression === node.properties.topicExpression && same(item.evidenceIds, [...new Set(node.evidenceIds)].sort())
          && item.evidenceIds.every(id => edge.evidenceIds.includes(id)));
        support(item.evidenceIds);
      }
    } else requireValue(!Object.hasOwn(edge, 'topicCheck'));
  }
  for (const flow of graph.flows) {
    work.charge(); keys(flow, ['id', 'title', 'status', 'environment', 'nodeIds', 'edgeIds', 'evidenceIds', 'gaps']);
    requireValue(flow.status === 'partial' && flow.environment === null && Array.isArray(flow.nodeIds) && flow.nodeIds.length > 0
      && flow.nodeIds.length <= 20 && flow.nodeIds.every(id => nodeIds.has(id)) && Array.isArray(flow.edgeIds)
      && flow.edgeIds.length === flow.nodeIds.length - 1 && flow.edgeIds.every(id => edgeIds.has(id)));
    for (let i = 0; i < flow.edgeIds.length; i++) { const edge = graph.edges.find(item => item.id === flow.edgeIds[i]);
      requireValue(edge.from === flow.nodeIds[i] && edge.to === flow.nodeIds[i + 1]); }
    support(flow.evidenceIds);
  }
  for (const root of value.roots.items) {
    work.charge();
    if (root.status === 'unavailable') keys(root, ['status', 'id', 'reason']);
    else { keys(root, ['status', 'id', 'role', 'sourceId', 'sourceName', 'path', 'revision', 'label', 'startLine', 'endLine', 'evidenceIds']);
      requireValue(root.status === 'available'); support(root.evidenceIds); }
  }
  requireValue(used.size === evidence.size);
  return { value, evidence };
}
function authorized(catalog, value, saved, limits) {
  const current = dependencies(catalog, value.identity.buildId, limits);
  requireValue(current.build.policyVersion === value.identity.policyVersion && current.build.sourceSetVersion === value.identity.sourceSetVersion
    && same(current.result, saved), 'RECEIPT_SCOPE_FENCED', 'Recorded source scope changed or is no longer available.');
  requireValue(Array.isArray(value.coverage.sources) && same(value.coverage.sources.map(row => row.sourceId).sort(), saved.map(row => row.sourceId).sort()));
  return current;
}
function checkOriginal(ref, item, value, deps) {
  keys(item, originalKeys);
  requireValue(item.buildId === value.identity.buildId && item.id === ref.id && item.sourceName === ref.sourceName
    && item.path === ref.path && item.revision === ref.revision && item.startLine === ref.startLine && item.endLine === ref.endLine
    && deps.some(dep => dep.sourceId === item.sourceId && dep.name === item.sourceName && dep.revision === item.revision)
    && hex(item.contentHash) && hex(item.spanHash) && hash(item.text) === item.spanHash);
}
function directory(value) {
  requireValue(typeof value === 'string' && path.isAbsolute(value) && lstatSync(value).isDirectory() && !lstatSync(value).isSymbolicLink(),
    'INVALID_RECEIPT_DIRECTORY', 'Use an owned absolute receipt directory.');
  return realpathSync(value);
}
function readFile(file, maximum) {
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { const info = fstatSync(fd); requireValue(info.isFile() && info.size <= maximum, 'RECEIPT_BYTES_LIMIT', 'Recorded receipt exceeds its byte bound.');
    try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(readFileSync(fd)); }
    catch { throw new ReceiptError('CORRUPT_RECEIPT', 'Receipt bytes are not valid UTF-8.'); } } finally { closeSync(fd); }
}
function publish(folder, id, serialized, work) {
  const temporary = path.join(folder, '.' + randomUUID() + '.pending'), target = path.join(folder, id + '.json');
  let fd, created = false;
  try {
    fd = openSync(temporary, 'wx', 0o600); writeFileSync(fd, serialized); fsyncSync(fd); closeSync(fd); fd = undefined;
    try { linkSync(temporary, target); created = true; }
    catch (error) { if (error.code !== 'EEXIST') throw error; requireValue(readFile(target, work.limits.receiptBytes) === serialized); }
    const hook = work.options.afterPublish?.({ created }); requireValue(!hook?.then, 'INVALID_RECEIPT_HOOK', 'Publication hooks must be synchronous.');
    work.check();
    unlinkSync(temporary); const directoryFd = openSync(folder, constants.O_RDONLY);
    try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
    work.check(); return { target, created };
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    try { unlinkSync(temporary); } catch (failure) { if (failure.code !== 'ENOENT') throw failure; }
    if (created) unlinkSync(target);
    throw error;
  }
}

/** Capture only from the injected trusted reader. This is not a client graph import. */
async function captureOwned({ catalog, analysis, paths }, folder, request, options, budget) {
  const work = new Work(catalog, options, budget), limits = work.limits;
  requireValue(object(request) && request.offset === undefined && request.kind === undefined, 'INVALID_RECEIPT_SELECTION', 'Only path selections can be recorded.');
  const destination = directory(folder); await work.step('start');
  const deps = dependencies(catalog, request.buildId, limits).result;
  const response = await paths.read(request, 'paths', options.signal, budget);
  requireValue(response.status === 'available', 'RECEIPT_UNAVAILABLE', 'No compatible published path inventory is available.');
  await work.step('projection');
  const projectionJson = JSON.stringify(response), { value, evidence } = validateProjection(projectionJson, limits, work);
  options.diagnostic?.('receipt-projection', { projectionBytes: bytes(projectionJson), evidenceReferences: evidence.size });
  authorized(catalog, value, deps, limits);
  const originals = []; let textBytes = 0;
  for (const [id, ref] of [...evidence.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    await work.step('originals'); const item = original(catalog, id); checkOriginal(ref, item, value, deps);
    textBytes += bytes(item.text); work.charge(bytes(item.text));
    requireValue(textBytes <= limits.textBytes, 'RECEIPT_TEXT_LIMIT', 'Complete originals exceed the receipt text bound.'); originals.push(item);
  }
  options.diagnostic?.('receipt-originals', { originals: originals.length, textBytes });
  await work.step('prepared');
  const content = { schemaVersion: 'loredock-shared-capture-receipt/1', projectionJson, originals, dependencies: deps };
  const receiptHash = hash(canonical(content)), serialized = canonical({ ...content, receiptHash }); work.charge(bytes(serialized));
  requireValue(bytes(serialized) <= limits.receiptBytes, 'RECEIPT_BYTES_LIMIT', 'Complete receipt exceeds its serialized bound.');
  await work.step('handoff');
  // No await or untrusted asynchronous callback in the final catalog/file handoff.
  let publication;
  options.diagnostic?.('receipt-publication-before', { projectionBytes: bytes(projectionJson), receiptBytes: bytes(serialized), originals: originals.length });
  try {
    catalog.store.db.exec('BEGIN IMMEDIATE');
    try {
      const probe = options.insideFence?.(); requireValue(!probe?.then, 'INVALID_RECEIPT_HOOK', 'The final receipt guard is synchronous.');
      work.check(); authorized(catalog, value, deps, limits);
      const snapshot = analysis.snapshot(value.identity.inventoryId); work.charge(snapshot.summary.candidates);
      requireValue(snapshot.manifestHash === value.identity.manifestHash && snapshot.summary.fingerprint === value.identity.fingerprint);
      work.check(); publication = publish(destination, receiptHash, serialized, work);
    } finally { catalog.store.db.exec('ROLLBACK'); }
    work.check();
    options.diagnostic?.('receipt-publication-after', { projectionBytes: bytes(projectionJson), receiptBytes: bytes(serialized), originals: originals.length });
    return { status: 'captured', receiptId: receiptHash, file: publication.target,
      metrics: { ...work.stats(), projectionBytes: bytes(projectionJson), receiptBytes: bytes(serialized), textBytes, spans: originals.length, sources: deps.length, publicationLocks: 1 } };
  } catch (error) { if (publication?.created) unlinkSync(publication.target); throw error; }
}

/** Read only an owned capture by its retained expected ID; never derive a replacement. */
async function readOwned(catalog, folder, receiptId, options, budget) {
  const work = new Work(catalog, options, budget), limits = work.limits;
  requireValue(hex(receiptId), 'INVALID_RECEIPT_ID', 'Choose a recorded receipt identity.');
  const serialized = readFile(path.join(directory(folder), receiptId + '.json'), limits.receiptBytes); work.charge(bytes(serialized));
  let receipt; try { receipt = JSON.parse(serialized); } catch { throw new ReceiptError('CORRUPT_RECEIPT', 'Invalid receipt JSON.'); }
  keys(receipt, ['schemaVersion', 'projectionJson', 'originals', 'dependencies', 'receiptHash']);
  requireValue(receipt.schemaVersion === 'loredock-shared-capture-receipt/1' && serialized === canonical(receipt));
  const { receiptHash, ...content } = receipt;
  requireValue(receiptHash === receiptId && hash(canonical(content)) === receiptHash);
  const { value, evidence } = validateProjection(receipt.projectionJson, limits, work);
  requireValue(Array.isArray(receipt.dependencies) && Array.isArray(receipt.originals) && receipt.originals.length === evidence.size);
  authorized(catalog, value, receipt.dependencies, limits);
  let textBytes = 0; const seen = new Set();
  for (const item of receipt.originals) {
    await work.step('originals'); requireValue(object(item) && !seen.has(item.id) && evidence.has(item.id)); seen.add(item.id);
    checkOriginal(evidence.get(item.id), item, value, receipt.dependencies);
    const current = original(catalog, item.id); requireValue(same(current, item));
    textBytes += bytes(item.text); work.charge(bytes(item.text));
    requireValue(textBytes <= limits.textBytes, 'RECEIPT_TEXT_LIMIT', 'Complete originals exceed the receipt text bound.');
  }
  await work.step('handoff'); authorized(catalog, value, receipt.dependencies, limits); work.check();
  const project = catalog.store.project();
  return { status: 'recorded', receiptId, currentApplicability: 'not-checked',
    stale: value.identity.buildId !== project.publishedBuildId || value.identity.registryVersion !== project.sourceSetVersion,
    projection: value, originals: receipt.originals, dependencies: receipt.dependencies,
    metrics: { ...work.stats(), projectionBytes: bytes(receipt.projectionJson), receiptBytes: bytes(serialized), textBytes, spans: seen.size, sources: receipt.dependencies.length, publicationLocks: 0 } };
}

export async function captureReceipt(services, folder, request, options = {}) {
  const limits = limitsFor(options);
  const budget = new CaptureBudget({ limits: options.budgetLimits, signal: options.signal, observe: options.observeCharge, wallCeiling: limits.wallMs });
  try { return await captureOwned(services, folder, request, options, budget); } finally { budget.close(); }
}
export async function readReceipt(catalog, folder, receiptId, options = {}) {
  const limits = limitsFor(options);
  const budget = new CaptureBudget({ limits: options.budgetLimits, signal: options.signal, observe: options.observeCharge, wallCeiling: limits.wallMs });
  try { return await readOwned(catalog, folder, receiptId, options, budget); } finally { budget.close(); }
}
