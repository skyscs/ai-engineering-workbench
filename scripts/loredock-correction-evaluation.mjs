import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { Corrections } from '../apps/loredock/dist/corrections.js';
import { codeFlows } from '../apps/loredock/dist/code-flows.js';
import { declarationMap } from '../apps/loredock/dist/system-map.js';
import { createLoreDockFixture, fixtureGit, repositoryIds } from './loredock-fixture.mjs';

// Use production storage/services over the frozen corpus. No oracle or model input.
const fixture = await createLoreDockFixture(), directory = path.join(fixture.root, 'data');
let store = new CatalogStore(directory), catalog = new Catalog(store), corrections = new Corrections(catalog);
try {
  for (const source of repositoryIds) await catalog.addSource(path.join(fixture.root, 'sources', source));
  const state = catalog.state(); catalog.start('correction-evaluation', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  const original = codeFlows(catalog), originalMap = declarationMap(catalog), edge = original.edges.find(edge => edge.kind === 'event-delivery');
  const input = { requestId: 'dispute', buildId: original.buildId, targetKind: 'code-link', targetId: edge.id,
    projectionHash: original.inputHash, expectedRevision: 0, expectedPreviousId: null,
    action: 'dispute', statement: 'The declared local topic does not establish a shared broker or runtime parameter binding.', environment: 'local' };
  const first = corrections.save(input); assert.deepEqual(corrections.save(input), first);
  assert.deepEqual(first.affectedFlowIds, original.flows.map(flow => flow.id).sort());
  const second = corrections.save({ ...input, requestId: 'clarify', expectedRevision: 1, expectedPreviousId: first.id,
    action: 'clarify', statement: 'Review this delivery relationship only as a local candidate; production wiring remains unknown.' });
  const beforeRestart = corrections.history(first.id);
  await catalog.stop(); store.close(); store = new CatalogStore(directory); catalog = new Catalog(store); corrections = new Corrections(catalog);
  assert.deepEqual(corrections.history(first.id), beforeRestart);
  assert.deepEqual(codeFlows(catalog), original); assert.deepEqual(declarationMap(catalog), originalMap);
  const withdrawn = corrections.save({ ...input, requestId: 'withdraw', expectedRevision: 2, expectedPreviousId: second.id,
    action: 'withdraw', statement: null, environment: null });
  assert.equal(corrections.list().corrections.filter(item => item.action !== 'withdraw').length, 0);
  const history = corrections.history(withdrawn.id);
  const refs = new Set(history.versions.flatMap(version => version.original.evidenceIds));
  const evidence = [...refs].map(ref => {
    const span = catalog.evidence(ref); assert.equal(span.buildId, original.buildId);
    const { id, sourceId, sourceName, path, revision, startLine, endLine, contentHash, spanHash } = span;
    return { id, sourceId, sourceName, path, revision, startLine, endLine, contentHash, spanHash };
  });
  const nextState = catalog.state(); catalog.start('next-index', nextState.sourceSetVersion, nextState.policyVersion); await catalog.idle();
  assert.equal(corrections.list().corrections.length, 0); assert.equal(corrections.list(original.buildId).corrections[0].id, withdrawn.id);
  for (const source of repositoryIds) assert.equal(fixtureGit(fixture.root, source, ['status', '--porcelain=v1']), '');
  const authorizedHistory = history;
  catalog.revoke(catalog.state().sources.find(source => source.name === 'portal').id);
  assert.throws(() => corrections.history(first.id), /authorization change/);
  const purged = store.one('SELECT count(*) AS count FROM corrections WHERE statement IS NOT NULL OR environment IS NOT NULL OR target IS NOT NULL OR purged=0').count;
  assert.equal(purged, 0);
  console.log(JSON.stringify({ schemaVersion: 'loredock-correction-evaluation/1', checkedAt: new Date().toISOString(),
    modelRequests: 0, modelUsage: null, databaseVersion: 4, revisionVector: fixture.manifest.revisionVector,
    sourceCheckoutsUnchanged: true, originalProjectionsUnchanged: true, idempotentReplay: true, restartHistoryIdentical: true,
    invalidatedFlowIds: first.affectedFlowIds, resolvingEvidenceCount: refs.size, history: authorizedHistory, evidence,
    newIndexDoesNotInheritCorrections: true, oldIndexHistoryRetained: true,
    conservativeSourceDependencies: 'All sources in the recorded index; portal removal fences/purges the delivery correction too.',
    revokedHistoryFenced: true, retainedContentAfterPurge: purged,
    scope: 'Map/flow relationship review only. Human claims do not become deployment evidence or answer-model input.' }, null, 2));
} finally {
  await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true });
}
