import assert from 'node:assert/strict';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { assembleSavedFlows, baselineFlowLimits } from './loredock-durable-flow-assembler.mjs';

export const probeLimits = { files: 600, wallMs: 5000 };
const predicate = "(lower(f.path) LIKE '%.ts' OR lower(f.path) LIKE '%.js' OR lower(f.path) LIKE '%.vue' OR lower(f.path) LIKE '%.java')";

export function selectFlowFiles(catalog, buildId, wide = false) {
  catalog.readBuildHeader(buildId);
  const candidateDocuments = catalog.store.one(`SELECT count(*) count FROM files f JOIN sources s ON s.id=f.sourceId
    WHERE f.buildId=? AND f.status='indexed' AND s.status='active' AND ${predicate}`, buildId).count;
  assert.ok(candidateDocuments <= probeLimits.files, 'Offline corpus exceeds its frozen 600-file bound.');
  const files = catalog.store.all(`SELECT id,sourceId,path,size,storedBytes FROM (
    SELECT f.id,f.sourceId,f.path,f.size,length(f.raw) storedBytes,
      row_number() OVER (PARTITION BY f.sourceId ORDER BY length(f.path),f.path) position
    FROM files f JOIN sources s ON s.id=f.sourceId WHERE f.buildId=? AND f.status='indexed' AND s.status='active' AND ${predicate})
    ORDER BY position,sourceId,path LIMIT ?`, buildId, wide ? probeLimits.files : baselineFlowLimits.documents);
  return { candidateDocuments, files };
}

/** Read-only offline comparison; deliberate lifecycle hooks are supplied only by the harness. */
export async function savedFlowProjection(services, analysis, buildId, mode = 'parity', options = {}) {
  assert.ok(mode === 'parity' || mode === 'wide');
  const wallMs = options.wallMs ?? probeLimits.wallMs;
  assert.ok(Number.isInteger(wallMs) && wallMs >= 0 && wallMs <= probeLimits.wallMs);
  const began = performance.now(), catalog = analysis.catalog;
  let validationMs = 0, assemblyMs = 0;
  const base = { schemaVersion: 'loredock-durable-flow-read/1', mode, buildId, status: 'unavailable', graph: null,
    inventory: null, selection: [], units: [], payloads: [], coverage: null, reason: null };
  const result = value => ({ ...base, ...value, timings: { validationMs, assemblyMs, wallMs: performance.now() - began } });
  try {
    catalog.readBuildHeader(buildId);
    const inventory = options.inventoryId ? analysis.get(options.inventoryId)
      : analysis.list().find(run => run.buildId === buildId && run.published);
    if (!inventory) return result({ reason: 'No published code inventory exists for this index.' });
    assert.equal(inventory.buildId, buildId);
    const snapshotStart = performance.now(), snapshot = analysis.snapshot(inventory.id);
    validationMs += performance.now() - snapshotStart;
    base.inventory = { ...snapshot.summary, manifestHash: snapshot.manifestHash, policyVersion: snapshot.policyVersion, registryVersion: snapshot.registryVersion };
    for (let offset = 0; offset < snapshot.summary.candidates; offset += 50) base.units.push(...analysis.files(inventory.id, offset));
    const selection = selectFlowFiles(catalog, buildId, mode === 'wide'), byId = new Map(selection.files.map(file => [file.id, file]));
    const files = mode === 'wide' ? snapshot.fileIds.map(id => {
      const file = byId.get(id); assert.ok(file, 'Retained file is outside the current authorized code inventory.'); return file;
    }) : selection.files;
    base.selection = files;
    const omissions = {}, entries = [], retained = new Set(snapshot.fileIds);
    const omit = reason => { omissions[reason] = (omissions[reason] ?? 0) + 1; };
    if (mode === 'parity' && selection.candidateDocuments > files.length) omissions['document-limit'] = selection.candidateDocuments - files.length;
    let bytes = 0, visited = 0, timedOut = false;
    const missing = [];
    for (const file of files) {
      if (performance.now() - began >= wallMs) { timedOut = true; break; }
      visited++;
      assert.ok(Number.isSafeInteger(file.size) && file.size >= 0 && Number.isSafeInteger(file.storedBytes) && file.storedBytes >= 0);
      if (mode === 'parity') {
        if (Math.max(file.size, file.storedBytes) > baselineFlowLimits.fileBytes) { omit('file-byte-limit'); continue; }
        if (bytes + file.size > baselineFlowLimits.textBytes) { omit('input-byte-limit'); continue; }
        if (catalog.store.all('SELECT id FROM spans WHERE fileId=? ORDER BY startLine LIMIT ?', file.id, baselineFlowLimits.fileSpans + 1).length > baselineFlowLimits.fileSpans) { omit('file-span-limit'); continue; }
      }
      if (!retained.has(file.id)) { missing.push({ ...file, reason: base.units.find(unit => unit.fileId === file.id)?.reason ?? 'No retained payload.' }); continue; }
      const start = performance.now(), payload = analysis.file(inventory.id, file.id);
      validationMs += performance.now() - start;
      entries.push({ file, payload }); bytes += file.size;
      await yieldTurn();
      await options.afterFile?.({ visited, inventoryId: inventory.id });
    }
    const fence = () => {
      const start = performance.now(), current = analysis.snapshot(inventory.id);
      validationMs += performance.now() - start;
      if (current.manifestHash !== snapshot.manifestHash || current.policyVersion !== snapshot.policyVersion || current.registryVersion !== snapshot.registryVersion) {
        throw new services.CatalogError('ANALYSIS_FENCED', 'The inventory changed during the experimental scan.', 409);
      }
    };
    fence();
    const coverage = { candidateFiles: selection.candidateDocuments, retainedFiles: snapshot.fileIds.length, selectedFiles: files.length,
      visitedFiles: visited, scannedFiles: entries.length, unvisitedFiles: files.length - visited, missing, timedOut,
      scanComplete: !timedOut, originalBytes: bytes, payloadBytes: entries.reduce((sum, entry) => sum + Buffer.byteLength(JSON.stringify(entry.payload)), 0),
      omissions, inventoryCounts: snapshot.summary.counts, syntaxGaps: snapshot.summary.gaps, filesWithSyntaxGaps: snapshot.summary.filesWithGaps };
    if (missing.length) return result({ coverage, reason: 'Selected parity files lack retained facts; fresh parsing is not substituted.' });
    const start = performance.now();
    const graph = assembleSavedFlows(services, catalog, buildId, { entries, omissions, candidateDocuments: selection.candidateDocuments,
      inputLimits: mode === 'wide' ? { documents: probeLimits.files, textBytes: analysis.limits.textBytes } : {} });
    assemblyMs = performance.now() - start;
    fence();
    return result({ graph, coverage, payloads: entries.map(entry => entry.payload), status: timedOut || snapshot.summary.status === 'partial' ? 'partial' : 'available' });
  } catch (error) {
    // Never return consumed facts, identifiers or partial graph data after a failed fence.
    return { schemaVersion: base.schemaVersion, mode, buildId, status: 'failed', graph: null, payloads: [],
      error: { code: error.code ?? 'PROBE_FAILED', message: error.message }, timings: { validationMs, assemblyMs, wallMs: performance.now() - began } };
  }
}

/** Only generated graph identities/provenance are normalized; ordered semantics remain. */
export function graphSemantics(graph) {
  const nodeIds = new Map(graph.nodes.map((node, index) => [node.id, `node:${index}`]));
  const edgeIds = new Map(graph.edges.map((edge, index) => [edge.id, `edge:${index}`]));
  const nodeId = id => { assert.ok(nodeIds.has(id), 'Dangling graph node.'); return nodeIds.get(id); };
  const edgeId = id => { assert.ok(edgeIds.has(id), 'Dangling graph edge.'); return edgeIds.get(id); };
  const { schemaVersion, adapterVersion, inputHash, ...rest } = graph;
  return { ...rest,
    nodes: graph.nodes.map(node => ({ ...node, id: nodeId(node.id) })),
    edges: graph.edges.map(edge => ({ ...edge, id: edgeId(edge.id), from: nodeId(edge.from), to: nodeId(edge.to) })),
    flows: graph.flows.map((flow, index) => ({ ...flow, id: `flow:${index}`, nodeIds: flow.nodeIds.map(nodeId), edgeIds: flow.edgeIds.map(edgeId) })) };
}
