import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { codeFlows } from '../apps/loredock/dist/code-flows.js';
import { createLoreDockFixture, fixtureGit, repositoryIds } from './loredock-fixture.mjs';

// Production projection over the original frozen corpus; the oracle is never an input.
const fixture = await createLoreDockFixture();
const store = new CatalogStore(path.join(fixture.root, 'catalog')), catalog = new Catalog(store);
try {
  for (const source of repositoryIds) await catalog.addSource(path.join(fixture.root, 'sources', source));
  const state = catalog.state(); catalog.start('flow-evaluation', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  const value = codeFlows(catalog);
  assert.equal(value.flows.length, 2); assert.equal(value.inputHash, codeFlows(catalog).inputHash);
  const evidence = Object.values(value.evidence).map(ref => {
    const original = catalog.evidence(ref.id);
    assert.equal(original.path, ref.path); assert.equal(original.revision, ref.revision);
    return { ...ref, contentHash: original.contentHash, spanHash: original.spanHash };
  });
  const outlines = value.flows.map(flow => {
    const nodes = flow.nodeIds.map(id => value.nodes.find(node => node.id === id));
    assert.equal(nodes.at(-1).kind, 'document-write');
    const edges = flow.edgeIds.map(id => value.edges.find(edge => edge.id === id));
    assert.equal(edges.filter(edge => edge.status === 'candidate').length, 3);
    return { title: flow.title, status: flow.status, environment: flow.environment,
      steps: nodes.map(node => ({ source: node.sourceName, path: node.path, label: node.label, kind: node.kind })),
      candidateHops: edges.filter(edge => edge.status === 'candidate').map(edge => ({ kind: edge.kind, scope: edge.environment, reason: edge.reason })), gaps: flow.gaps };
  });
  for (const source of repositoryIds) assert.equal(fixtureGit(fixture.root, source, ['status', '--porcelain=v1']), '');
  console.log(JSON.stringify({ schemaVersion: 'loredock-flow-evaluation/1', checkedAt: new Date().toISOString(),
    modelRequests: 0, modelUsage: null, revisionVector: fixture.manifest.revisionVector,
    sourceCheckoutsUnchanged: true, repeatableProjection: true, resolvedEvidenceCount: evidence.length,
    nodesByKind: Object.fromEntries([...new Set(value.nodes.map(node => node.kind))].map(kind => [kind, value.nodes.filter(node => node.kind === kind).length])),
    linksByKind: Object.fromEntries([...new Set(value.edges.map(edge => edge.kind))].map(kind => [kind, value.edges.filter(edge => edge.kind === kind).length])),
    scope: 'Two bounded static pilot outlines with explicit candidate hops and unresolved wiring; not full L3 or runtime acceptance.', outlines, projection: value, evidence }, null, 2));
} finally {
  await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true });
}
