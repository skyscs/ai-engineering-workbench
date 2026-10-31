import assert from 'node:assert/strict';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { SourceGit } from '../apps/loredock/dist/git.js';
import { projectOrientation } from '../apps/loredock/dist/orientation.js';
import { createLoreDockFixture, fixtureGit, repositoryIds } from './loredock-fixture.mjs';

class CountingGit extends SourceGit {
  commands = 0;
  async run(...args) { this.commands++; return super.run(...args); }
}
const fixture = await createLoreDockFixture(), directory = path.join(fixture.root, 'data'), git = new CountingGit();
let store = new CatalogStore(directory), catalog = new Catalog(store, git);
try {
  for (const repo of repositoryIds) await catalog.addSource(path.join(fixture.root, 'sources', repo));
  const index = async requestId => { const state = catalog.state(), next = catalog.start(requestId, state.sourceSetVersion, state.policyVersion); await catalog.idle(); return store.build(next.id); };
  await index('initial'); const beforeCommands = git.commands, initial = projectOrientation(catalog);
  assert.equal(initial.coverage.withContext, 3); assert.equal(initial.coverage.examinedDocuments, 6); assert.equal(git.commands, beforeCommands);
  assert.match(initial.sources.find(source => source.sourceName === 'order-api').context.text, /orders.created.v1/);
  const collect = result => Object.keys(result.evidence).map(id => {
    const span = catalog.evidence(id); return { id, buildId: span.buildId, sourceId: span.sourceId, sourceName: span.sourceName, path: span.path, revision: span.revision,
      startLine: span.startLine, endLine: span.endLine, contentHash: span.contentHash, spanHash: span.spanHash };
  });
  const originalEvidence = collect(initial);
  for (const source of initial.sources) {
    const span = catalog.evidence(source.context.evidenceIds[0]);
    assert.equal(source.context.text, span.text.split('\n').slice(source.context.startLine - span.startLine, source.context.endLine - span.startLine + 1).join('\n'));
  }
  const apiReadme = path.join(fixture.root, 'sources/order-api/README.md');
  await writeFile(apiReadme, (await readFile(apiReadme, 'utf8')).replace('POST /api/orders accepts', 'OrientationEvaluationMarker: updated documented context.\nPOST /api/orders accepts'));
  await rename(path.join(fixture.root, 'sources/order-worker/README.md'), path.join(fixture.root, 'sources/order-worker/ORIENTATION.md'));
  for (const repo of ['order-api', 'order-worker']) { fixtureGit(fixture.root, repo, ['add', '--all']); fixtureGit(fixture.root, repo, ['commit', '-qm', 'Update owned orientation documentation']); }
  await index('updated'); const updatedCommands = git.commands, updated = projectOrientation(catalog), historical = projectOrientation(catalog, initial.buildId);
  assert.equal(git.commands, updatedCommands); assert.equal(updated.coverage.withContext, 2); assert.equal(updated.sources.find(source => source.sourceName === 'order-worker').readme.state, 'missing');
  assert.equal(historical.stale, true); assert.deepEqual(historical.sources.map(source => source.context), initial.sources.map(source => source.context));
  assert.match(updated.sources.find(source => source.sourceName === 'order-api').context.text, /OrientationEvaluationMarker/);
  const updatedEvidence = collect(updated);
  await catalog.stop(); store.close(); store = new CatalogStore(directory); catalog = new Catalog(store, git);
  assert.deepEqual(projectOrientation(catalog), updated);
  const removed = updated.sources.find(source => source.sourceName === 'order-api'); catalog.revoke(removed.sourceId);
  const fenced = projectOrientation(catalog);
  assert.equal(fenced.sources.length, 2); assert.equal(JSON.stringify(fenced).includes('OrientationEvaluationMarker'), false);
  assert.throws(() => catalog.evidence(removed.context.evidenceIds[0]), /unavailable/);
  for (const repo of repositoryIds) assert.equal(fixtureGit(fixture.root, repo, ['status', '--porcelain=v1']), '');
  console.log(JSON.stringify({ schemaVersion: 'loredock-orientation-evaluation/1', checkedAt: new Date().toISOString(), databaseVersion: store.one('PRAGMA user_version').user_version,
    modelRequests: 0, modelUsage: null, orientationGitCommands: 0, orientationReadOnly: true, originalRevisionVector: fixture.manifest.revisionVector,
    changedRevisionVector: Object.fromEntries(repositoryIds.map(repo => [repo, fixtureGit(fixture.root, repo, ['rev-parse', 'HEAD'])])),
    controlledFixtureChanges: 'The API README introduction changes and the worker root README moves to ORIENTATION.md. Frozen templates and normal checkouts are unchanged.',
    initial, updated, historical, fenced, evidence: [...originalEvidence, ...updatedEvidence], allExcerptLinesResolve: true,
    outdatedTopicPreserved: true, missingDocumentationVisible: true, historicalContextPinned: true, restart: true, revokedContextAndCitationsFenced: true,
    sourceCheckoutsPreservedDuringIndexing: true, scope: 'Basic verbatim repository context and reading navigation; no semantic synthesis, runtime verification, full milestone acceptance or scale claim.' }, null, 2));
} finally { await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); }
