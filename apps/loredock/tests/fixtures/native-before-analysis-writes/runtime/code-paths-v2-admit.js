import path from 'node:path';
import { CatalogError } from './types.js';
import { sha256 } from './extract.js';
const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const unique = (values) => [...new Set(values)].sort();
/** Atomic admission of complete chosen paths, separate from binding resolution. */
export async function admitPaths(resolution, limits, work, rootId) {
    const allNodes = new Map(), allEdges = new Map();
    await work.step('admit', 0, true);
    for (const node of resolution.nodes) {
        await work.step('admit');
        allNodes.set(node.id, node);
    }
    for (const edge of resolution.edges) {
        await work.step('admit');
        allEdges.set(edge.id, edge);
    }
    const nodeKey = (id) => { const node = allNodes.get(id); return [node.sourceName, node.path, node.kind, node.label].join('\0'); };
    const walkKey = (walk) => walk.nodeIds.map(nodeKey).join('\n');
    const outgoing = new Map();
    for (const edge of resolution.edges) {
        await work.step('admit');
        const values = outgoing.get(edge.from) ?? [];
        values.push(edge);
        outgoing.set(edge.from, values);
    }
    for (const values of outgoing.values())
        values.sort((a, b) => compareText(nodeKey(a.to), nodeKey(b.to)) || compareText(a.kind, b.kind));
    const omissions = { ...resolution.omissions }, omit = (key, count = 1) => { if (count)
        omissions[key] = (omissions[key] ?? 0) + count; };
    const selectedRoots = rootId ? resolution.roots.filter(root => root.id === rootId).slice(0, 1) : resolution.roots.slice(0, limits.flows);
    if (rootId && selectedRoots.length !== 1)
        throw new CatalogError('INVALID_ROOT', 'Choose a root in this generation.', 400);
    const result = { schemaVersion: 'loredock-connected-display/2', adapterVersion: 'connected-paths-v2', buildId: resolution.buildId,
        policyVersion: resolution.policyVersion, sourceSetVersion: resolution.sourceSetVersion, registryVersion: resolution.registryVersion,
        stale: resolution.stale, partial: true, deploymentCoherence: 'unknown', nodes: [], edges: [], flows: [], evidence: {},
        gaps: [...resolution.gaps, 'Only selected root paths are displayed; omitted roots and branches remain unknown here.'],
        omissions, declarationOmissions: resolution.declarationOmissions, limits,
        coverage: { ...resolution.coverage, resolutionNodes: resolution.nodes.length, resolutionEdges: resolution.edges.length,
            candidateRoots: resolution.roots.length, selectedRoots: selectedRoots.map(root => root.id), traversals: 0, unselectedNodes: 0, unselectedEdges: 0 } };
    omit('unselected-roots', resolution.roots.length - selectedRoots.length);
    for (const root of selectedRoots) {
        if (!limits.steps || !limits.pendingPaths) {
            omit(!limits.steps ? 'flow-step-limit' : 'pending-path-limit');
            continue;
        }
        const pending = [{ nodeIds: [root.id], edgeIds: [] }], terminal = [];
        while (pending.length && result.coverage.traversals < limits.traversals) {
            await work.step('admit');
            const current = pending.pop();
            result.coverage.traversals++;
            const next = (outgoing.get(current.nodeIds.at(-1)) ?? []).filter(edge => !current.nodeIds.includes(edge.to));
            if (!next.length || current.nodeIds.length >= limits.steps) {
                terminal.push(current);
                if (next.length)
                    omit('flow-step-limit');
                continue;
            }
            for (const edge of next.slice().reverse()) {
                await work.step('admit');
                if (pending.length >= limits.pendingPaths) {
                    omit('pending-path-limit');
                    continue;
                }
                pending.push({ nodeIds: [...current.nodeIds, edge.to], edgeIds: [...current.edgeIds, edge.id] });
            }
        }
        omit('flow-traversal-limit', pending.length);
        const score = (walk) => (allNodes.get(walk.nodeIds.at(-1)).kind === 'document-write' ? 1000 : 0) + walk.nodeIds.length;
        terminal.sort((a, b) => score(b) - score(a) || compareText(walkKey(a), walkKey(b)));
        omit('alternate-terminal-paths', Math.max(0, terminal.length - 1));
        const chosen = terminal[0];
        if (!chosen) {
            omit('root-without-completed-path');
            continue;
        }
        const pathNodes = chosen.nodeIds.map(id => allNodes.get(id)), pathEdges = chosen.edgeIds.map(id => allEdges.get(id));
        const evidenceIds = unique([...pathNodes.flatMap(node => node.evidenceIds), ...pathEdges.flatMap(edge => edge.evidenceIds)]);
        const flow = { id: sha256(JSON.stringify([resolution.buildId, 'connected-paths-v2', root.id, chosen.edgeIds])),
            title: `${root.role === 'vue-action' ? 'Vue action' : root.role === 'amd-function' ? 'Dojo action' : 'HTTP client'} · ${path.posix.basename(pathNodes[0].path)}`,
            status: 'partial', environment: null, ...chosen, evidenceIds,
            gaps: unique([...pathEdges.flatMap(edge => edge.gaps), 'This is a static outline, not observed execution or a coherent deployment.',
                pathNodes.at(-1).kind === 'document-write' ? 'The receiver is not bound to a concrete database/collection by supported code.' : 'The selected path ends before an evidenced document write.',
                ...terminal.length > 1 ? ['Other static branches are omitted from this outline.'] : []]) };
        const nodes = [...result.nodes, ...pathNodes.filter(node => !result.nodes.some(existing => existing.id === node.id))];
        const edges = [...result.edges, ...pathEdges.filter(edge => !result.edges.some(existing => existing.id === edge.id))];
        const evidence = { ...result.evidence };
        for (const id of evidenceIds) {
            const ref = resolution.evidence[id];
            if (!ref)
                throw new CatalogError('CORRUPT_CODE_FACTS', 'Path original support is unavailable.', 409);
            evidence[id] = ref;
        }
        if (nodes.length > limits.nodes) {
            omit('whole-path-node-limit');
            continue;
        }
        if (edges.length > limits.edges) {
            omit('whole-path-edge-limit');
            continue;
        }
        if (pathNodes.some(node => node.label.length > 512 || Object.values(node.properties).some(value => value.length > 512))) {
            omit('whole-path-property-limit');
            continue;
        }
        const candidate = { ...result, nodes, edges, evidence, flows: [...result.flows, flow] };
        // Reserve final hashes, omission counters and coverage before atomic publication.
        if (Buffer.byteLength(JSON.stringify(candidate)) > limits.outputBytes - 16 * 1024) {
            omit('whole-path-output-limit');
            continue;
        }
        Object.assign(result, candidate);
    }
    result.coverage.unselectedNodes = resolution.nodes.length - result.nodes.length;
    result.coverage.unselectedEdges = resolution.edges.length - result.edges.length;
    omit('unselected-resolution-nodes', result.coverage.unselectedNodes);
    omit('unselected-resolution-edges', result.coverage.unselectedEdges);
    const output = { ...result, inputHash: sha256(JSON.stringify(result)) };
    if (Buffer.byteLength(JSON.stringify(output)) > limits.outputBytes)
        throw new CatalogError('OUTPUT_LIMIT', 'Path display metadata exceeds its byte bound.', 409);
    await work.step('admit', 0, true);
    return output;
}
