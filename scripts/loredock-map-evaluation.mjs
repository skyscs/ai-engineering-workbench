import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { declarationMap } from '../apps/loredock/dist/system-map.js';
import { createLoreDockFixture, fixtureGit, repositoryIds } from './loredock-fixture.mjs';

// Model-free integration evidence. No oracle is passed to the declaration mapper.
const fixture = await createLoreDockFixture();
const store = new CatalogStore(path.join(fixture.root, 'catalog')), catalog = new Catalog(store);
try {
  for (const source of repositoryIds) await catalog.addSource(path.join(fixture.root, 'sources', source));
  const state = catalog.state(); catalog.start('map-evaluation', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  const map = declarationMap(catalog);
  assert.equal(map.inputHash, declarationMap(catalog).inputHash);
  const evidence = Object.values(map.evidence).map(ref => {
    const original = catalog.evidence(ref.id);
    assert.equal(original.path, ref.path); assert.equal(original.revision, ref.revision);
    return { ...ref, contentHash: original.contentHash, spanHash: original.spanHash };
  });
  for (const source of repositoryIds) assert.equal(fixtureGit(fixture.root, source, ['status', '--porcelain=v1']), '');
  console.log(JSON.stringify({ schemaVersion: 'loredock-map-evaluation/1', checkedAt: new Date().toISOString(),
    modelRequests: 0, modelUsage: null, revisionVector: fixture.manifest.revisionVector,
    sourceCheckoutsUnchanged: true, repeatableProjection: true, resolvedEvidenceCount: evidence.length,
    nodesByKind: Object.fromEntries([...new Set(map.nodes.map(node => node.kind))].map(kind => [kind, map.nodes.filter(node => node.kind === kind).length])),
    linksByKind: Object.fromEntries([...new Set(map.edges.map(edge => edge.kind))].map(kind => [kind, map.edges.filter(edge => edge.kind === kind).length])),
    scope: 'Supported declaration projection only; not complete L3 flow/routing acceptance.', map, evidence }, null, 2));
} finally {
  await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true });
}
