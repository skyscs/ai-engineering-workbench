import assert from 'node:assert/strict';
import path from 'node:path';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { resolveConnectedFacts } from './loredock-connected-resolution.mjs';

export const connectedLimits = { files: 600, facts: 10000, wallMs: 5000, resolutionNodes: 12000, resolutionEdges: 12000,
  bindingRecords: 12000, alternativeReferences: 12000, nodes: 160, edges: 240, flows: 2, steps: 20, traversals: 1000,
  pendingPaths: 1000, comparisons: 2000, outputBytes: 512 * 1024 };
const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const codePredicate = "(lower(path) LIKE '%.ts' OR lower(path) LIKE '%.js' OR lower(path) LIKE '%.vue' OR lower(path) LIKE '%.java')";
const unique = values => [...new Set(values)].sort();

/** Atomic admission of complete chosen paths, separate from binding resolution. */
export function admitConnectedPaths(services, resolution, limits = connectedLimits) {
  const { sha256 } = services, allNodes = new Map(resolution.nodes.map(node => [node.id, node]));
  const allEdges = new Map(resolution.edges.map(edge => [edge.id, edge]));
  const nodeKey = id => { const node = allNodes.get(id); return [node.sourceName, node.path, node.kind, node.label].join('\0'); };
  const walkKey = walk => walk.nodeIds.map(nodeKey).join('\n');
  const outgoing = new Map();
  for (const edge of resolution.edges) { const values = outgoing.get(edge.from) ?? []; values.push(edge); outgoing.set(edge.from, values); }
  for (const values of outgoing.values()) values.sort((a, b) => compareText(nodeKey(a.to), nodeKey(b.to)) || compareText(a.kind, b.kind));
  const omissions = { ...resolution.omissions }, omit = (key, count = 1) => { if (count) omissions[key] = (omissions[key] ?? 0) + count; };
  const selectedRoots = resolution.roots.slice(0, limits.flows);
  const result = { schemaVersion: 'loredock-connected-display/1', adapterVersion: 'task063-connected-v1', buildId: resolution.buildId,
    policyVersion: resolution.policyVersion, sourceSetVersion: resolution.sourceSetVersion, registryVersion: resolution.registryVersion,
    stale: resolution.stale, partial: true, deploymentCoherence: 'unknown', nodes: [], edges: [], flows: [], evidence: {},
    gaps: [...resolution.gaps, 'Only selected root paths are displayed; omitted roots and branches remain unknown here.'],
    omissions, declarationOmissions: resolution.declarationOmissions, limits,
    coverage: { ...resolution.coverage, resolutionNodes: resolution.nodes.length, resolutionEdges: resolution.edges.length,
      candidateRoots: resolution.roots.length, selectedRoots: selectedRoots.map(root => root.id), traversals: 0, unselectedNodes: 0, unselectedEdges: 0 } };
  omit('unselected-roots', resolution.roots.length - selectedRoots.length);
  for (const root of selectedRoots) {
    if (!limits.steps || !limits.pendingPaths) { omit(!limits.steps ? 'flow-step-limit' : 'pending-path-limit'); continue; }
    const pending = [{ nodeIds: [root.id], edgeIds: [] }], terminal = [];
    while (pending.length && result.coverage.traversals < limits.traversals) {
      const current = pending.pop(); result.coverage.traversals++;
      const next = (outgoing.get(current.nodeIds.at(-1)) ?? []).filter(edge => !current.nodeIds.includes(edge.to));
      if (!next.length || current.nodeIds.length >= limits.steps) {
        terminal.push(current); if (next.length) omit('flow-step-limit'); continue;
      }
      for (const edge of next.slice().reverse()) {
        if (pending.length >= limits.pendingPaths) { omit('pending-path-limit'); continue; }
        pending.push({ nodeIds: [...current.nodeIds, edge.to], edgeIds: [...current.edgeIds, edge.id] });
      }
    }
    omit('flow-traversal-limit', pending.length);
    const score = walk => (allNodes.get(walk.nodeIds.at(-1)).kind === 'document-write' ? 1000 : 0) + walk.nodeIds.length;
    terminal.sort((a, b) => score(b) - score(a) || compareText(walkKey(a), walkKey(b)));
    omit('alternate-terminal-paths', Math.max(0, terminal.length - 1));
    const chosen = terminal[0]; if (!chosen) { omit('root-without-completed-path'); continue; }
    const pathNodes = chosen.nodeIds.map(id => allNodes.get(id)), pathEdges = chosen.edgeIds.map(id => allEdges.get(id));
    const evidenceIds = unique([...pathNodes.flatMap(node => node.evidenceIds), ...pathEdges.flatMap(edge => edge.evidenceIds)]);
    const flow = { id: sha256(JSON.stringify([resolution.buildId, 'task063-connected-v1', root.id, chosen.edgeIds])),
      title: `${root.role === 'vue-action' ? 'Vue action' : root.role === 'amd-function' ? 'Dojo action' : 'HTTP client'} · ${path.posix.basename(pathNodes[0].path)}`,
      status: 'partial', environment: null, ...chosen, evidenceIds,
      gaps: unique([...pathEdges.flatMap(edge => edge.gaps), 'This is a static outline, not observed execution or a coherent deployment.',
        pathNodes.at(-1).kind === 'document-write' ? 'The receiver is not bound to a concrete database/collection by supported code.' : 'The selected path ends before an evidenced document write.',
        ...terminal.length > 1 ? ['Other static branches are omitted from this outline.'] : []]) };
    const nodes = [...result.nodes, ...pathNodes.filter(node => !result.nodes.some(existing => existing.id === node.id))];
    const edges = [...result.edges, ...pathEdges.filter(edge => !result.edges.some(existing => existing.id === edge.id))];
    const evidence = { ...result.evidence };
    for (const id of evidenceIds) { assert.ok(resolution.evidence[id], 'Missing original support.'); evidence[id] = resolution.evidence[id]; }
    if (nodes.length > limits.nodes) { omit('whole-path-node-limit'); continue; }
    if (edges.length > limits.edges) { omit('whole-path-edge-limit'); continue; }
    if (pathNodes.some(node => node.label.length > 512 || Object.values(node.properties).some(value => value.length > 512))) { omit('whole-path-property-limit'); continue; }
    const candidate = { ...result, nodes, edges, evidence, flows: [...result.flows, flow] };
    // Reserve final hashes, omission counters and coverage before atomic publication.
    if (Buffer.byteLength(JSON.stringify(candidate)) > limits.outputBytes - 16 * 1024) { omit('whole-path-output-limit'); continue; }
    Object.assign(result, candidate);
  }
  result.coverage.unselectedNodes = resolution.nodes.length - result.nodes.length;
  result.coverage.unselectedEdges = resolution.edges.length - result.edges.length;
  omit('unselected-resolution-nodes', result.coverage.unselectedNodes); omit('unselected-resolution-edges', result.coverage.unselectedEdges);
  const output = { ...result, inputHash: sha256(JSON.stringify(result)) };
  assert.ok(Buffer.byteLength(JSON.stringify(output)) <= limits.outputBytes, 'Display metadata exceeds the output bound.');
  return output;
}

export async function connectedProjection(services, analysis, buildId, options = {}) {
  const limits = { ...connectedLimits, ...options.limits };
  for (const [key, value] of Object.entries(limits)) assert.ok(Number.isInteger(value) && value >= 0 && value <= connectedLimits[key], 'Limits may only decrease.');
  const began = performance.now(), catalog = analysis.catalog;
  let readMs = 0, resolveMs = 0, admitMs = 0;
  const finish = value => ({ schemaVersion: 'loredock-connected-probe/1', buildId, ...value,
    timings: { readMs, resolveMs, admitMs, wallMs: performance.now() - began } });
  try {
    catalog.readBuildHeader(buildId);
    const inventory = options.inventoryId ? analysis.get(options.inventoryId) : analysis.list().find(run => run.buildId === buildId && run.published);
    if (!inventory) return finish({ status: 'unavailable', reason: 'No published inventory for this index.', graph: null, payloads: [] });
    assert.equal(inventory.buildId, buildId);
    const snapshot = analysis.snapshot(inventory.id);
    if (snapshot.summary.candidates > limits.files) throw new services.CatalogError('RESOLUTION_LIMIT', 'Candidate file bound exceeded.', 409);
    const units = [];
    for (let offset = 0; offset < snapshot.summary.candidates; offset += 50) units.push(...analysis.files(inventory.id, offset));
    const incomplete = new Map();
    const mark = (id, reason) => { const reasons = incomplete.get(id) ?? []; reasons.push(reason); incomplete.set(id, reasons); };
    for (const unit of units) if (unit.status !== 'parsed') mark(unit.sourceId, `${unit.path}: ${unit.status}: ${unit.reason}`);
    for (const file of catalog.store.all(`SELECT sourceId,path,status FROM files WHERE buildId=? AND status<>'indexed' AND ${codePredicate}`, buildId)) mark(file.sourceId, `${file.path}: index ${file.status}`);
    const entries = []; let factEntries = 0;
    const deadline = () => { if (performance.now() - began >= limits.wallMs) throw new services.CatalogError('SCAN_INCOMPLETE', 'Cooperative read/resolve time bound reached; no graph is issued.', 409); };
    for (const fileId of snapshot.fileIds) {
      deadline(); const payload = analysis.file(inventory.id, fileId);
      const file = catalog.store.one('SELECT id,sourceId,path,size,length(raw) storedBytes FROM files WHERE id=?', fileId);
      factEntries += payload.facts.symbols.length + payload.facts.operations.length + payload.facts.calls.length + Object.keys(payload.facts.records).length;
      if (factEntries > limits.facts) throw new services.CatalogError('RESOLUTION_LIMIT', 'Fact universe bound exceeded; no truncated binding search.', 409);
      entries.push({ file, payload });
      for (const gap of payload.facts.gaps) mark(payload.sourceId, `${payload.path}: ${gap}`);
      await yieldTurn(); await options.afterFile?.({ fileId, inventoryId: inventory.id, scannedFiles: entries.length });
    }
    const fence = () => {
      const current = analysis.snapshot(inventory.id);
      if (current.manifestHash !== snapshot.manifestHash || current.policyVersion !== snapshot.policyVersion || current.registryVersion !== snapshot.registryVersion)
        throw new services.CatalogError('ANALYSIS_FENCED', 'Inventory changed during connected projection.', 409);
    };
    fence(); deadline(); readMs = performance.now() - began;
    const resolveStart = performance.now();
    const resolution = resolveConnectedFacts(services, catalog, buildId, { entries, candidateDocuments: snapshot.summary.candidates,
      omissions: {}, incompleteSources: new Set(incomplete.keys()), comparisons: limits.comparisons, limits });
    resolveMs = performance.now() - resolveStart; deadline();
    const admitStart = performance.now(), graph = admitConnectedPaths(services, resolution, limits); admitMs = performance.now() - admitStart;
    await yieldTurn(); fence(); deadline();
    return finish({ status: 'available', partial: true, graph, resolution, payloads: entries.map(entry => entry.payload), units,
      inventory: { ...snapshot.summary, manifestHash: snapshot.manifestHash, policyVersion: snapshot.policyVersion, registryVersion: snapshot.registryVersion },
      coverage: { scannedFiles: entries.length, retainedFiles: snapshot.fileIds.length, scanComplete: true, factEntries,
        inputBytes: entries.reduce((sum, entry) => sum + entry.file.size, 0), incompleteSources: Object.fromEntries(incomplete),
        inventoryCounts: snapshot.summary.counts, syntaxGaps: snapshot.summary.gaps }, limits });
  } catch (error) {
    return finish({ status: 'failed', graph: null, payloads: [], limits, error: { code: error.code ?? 'PROBE_FAILED', message: error.message } });
  }
}
