import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { Corrections } from '../apps/loredock/dist/corrections.js';
import { Reconciliation } from '../apps/loredock/dist/reconciliation.js';
import { codeFlows } from '../apps/loredock/dist/code-flows.js';
import { createLoreDockFixture, fixtureGit, repositoryIds } from './loredock-fixture.mjs';

const fixture = await createLoreDockFixture(), store = new CatalogStore(path.join(fixture.root, 'data')), catalog = new Catalog(store);
const corrections = new Corrections(catalog), reconciliation = new Reconciliation(catalog);
try {
  for (const repo of repositoryIds) await catalog.addSource(path.join(fixture.root, 'sources', repo));
  const index = async requestId => { const state = catalog.state(), result = catalog.start(requestId, state.sourceSetVersion, state.policyVersion); await catalog.idle(); return store.build(result.id); };
  const initial = await index('initial'), originalGraph = codeFlows(catalog), edge = originalGraph.edges.find(edge => edge.kind === 'event-delivery');
  const original = corrections.save({ requestId: 'original-review', buildId: initial.id, targetKind: 'code-link', targetId: edge.id, projectionHash: originalGraph.inputHash,
    expectedRevision: 0, expectedPreviousId: null, action: 'dispute', statement: 'Review the broker binding before relying on delivery in this scope.', environment: 'local' });
  const pinnedOriginal = corrections.inspect(original.id), unchanged = await index('unchanged'), preview = reconciliation.preview();
  assert.equal(preview.entries[0].status, 'support-unchanged'); assert.equal(corrections.list().corrections.length, 0);
  const request = { requestId: 'explicit-reapplication', buildId: unchanged.id, sourceCorrectionId: original.id, targetId: preview.entries[0].current.id, previewHash: preview.previewHash, expectedRevision: preview.revision };
  const reapplied = reconciliation.reapply(request), current = corrections.inspect(reapplied.id);
  assert.deepEqual(reapplied.affectedFlowIds, codeFlows(catalog).flows.map(flow => flow.id).sort());
  assert.deepEqual(corrections.inspect(original.id), pinnedOriginal); assert.deepEqual(reconciliation.reapply(request), reapplied);
  const protectedPreview = reconciliation.preview(); assert.equal(protectedPreview.entries[0].status, 'already-reviewed');
  const skipped = await index('skipped-review'); assert.equal(corrections.list().corrections.length, 0);
  const target = path.join(fixture.root, 'sources/order-worker/src/main/java/OrderConsumer.java');
  await writeFile(target, await readFile(target, 'utf8') + '\n// Review the external broker binding separately.\n');
  fixtureGit(fixture.root, 'order-worker', ['add', '--all']); fixtureGit(fixture.root, 'order-worker', ['commit', '-qm', 'Change owned reconciliation source context']);
  const changed = await index('changed-support'), defaultPreview = reconciliation.preview(), changedPreview = reconciliation.preview(undefined, unchanged.id);
  assert.equal(defaultPreview.entries.length, 0); assert.equal(changedPreview.entries[0].status, 'support-changed');
  const evidenceIds = [...new Set([pinnedOriginal, current].flatMap(version => version.original.evidenceIds).concat(changedPreview.entries[0].current.evidenceIds))];
  const evidence = evidenceIds.map(id => { const span = catalog.evidence(id); return { id, buildId: span.buildId, sourceId: span.sourceId, sourceName: span.sourceName,
    path: span.path, revision: span.revision, startLine: span.startLine, endLine: span.endLine, contentHash: span.contentHash, spanHash: span.spanHash }; });
  for (const repo of repositoryIds) assert.equal(fixtureGit(fixture.root, repo, ['status', '--porcelain=v1']), '');
  console.log(JSON.stringify({ schemaVersion: 'loredock-reconciliation-evaluation/1', checkedAt: new Date().toISOString(), databaseVersion: store.one('PRAGMA user_version').user_version,
    modelRequests: 0, modelUsage: null, originalRevisionVector: fixture.manifest.revisionVector,
    changedRevisionVector: Object.fromEntries(repositoryIds.map(repo => [repo, fixtureGit(fixture.root, repo, ['rev-parse', 'HEAD'])])),
    controlledFixtureChanges: 'A supporting worker Java file gains a comment. Frozen templates and normal checkouts are unchanged.',
    initialBuildId: initial.id, unchangedBuildId: unchanged.id, skippedBuildId: skipped.id, changedBuildId: changed.id,
    noAutomaticTransfer: true, original: pinnedOriginal, preview, reapplied: current, exactReplay: true, bothFlowsRequireReview: true,
    originalHistoryUnchanged: true, protectedPreview, defaultAfterSkippedReview: defaultPreview, changedSupport: changedPreview, evidence,
    sourceCheckoutsPreservedDuringIndexing: true, scope: 'Explicit source-supported review reapplication only; no semantic/AI reconciliation, answer integration or complete L4 acceptance.' }, null, 2));
} finally { await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); }
