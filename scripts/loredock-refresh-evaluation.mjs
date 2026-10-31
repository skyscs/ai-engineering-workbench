import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { SourceGit } from '../apps/loredock/dist/git.js';
import { indexChanges } from '../apps/loredock/dist/index-changes.js';
import { codeFlows } from '../apps/loredock/dist/code-flows.js';
import { createLoreDockFixture, fixtureGit, repositoryIds } from './loredock-fixture.mjs';

class CountingGit extends SourceGit {
  reads = 0;
  async blob(...args) { this.reads++; return super.blob(...args); }
}
const fixture = await createLoreDockFixture(), store = new CatalogStore(path.join(fixture.root, 'data')), git = new CountingGit(), catalog = new Catalog(store, git);
try {
  for (const repo of repositoryIds) await catalog.addSource(path.join(fixture.root, 'sources', repo));
  const index = async requestId => { const state = catalog.state(); const next = catalog.start(requestId, state.sourceSetVersion, state.policyVersion); await catalog.idle(); return store.build(next.id); };
  const initial = await index('initial'), oldIds = store.all('SELECT s.id FROM spans s JOIN files f ON f.id=s.fileId WHERE f.buildId=?', initial.id).map(row => row.id);
  const unchanged = await index('unchanged');
  assert.equal(initial.refresh.gitReadAttempts, 21); assert.equal(unchanged.refresh.gitReadAttempts, 3); assert.equal(unchanged.refresh.reusedFiles, 18);
  const unchangedComparison = indexChanges(catalog), newIds = store.all('SELECT s.id FROM spans s JOIN files f ON f.id=s.fileId WHERE f.buildId=?', unchanged.id).map(row => row.id);
  assert.ok(newIds.every(id => !oldIds.includes(id)));
  const evidence = newIds.map(id => { const span = catalog.evidence(id); return { id, path: span.path, sourceName: span.sourceName, revision: span.revision, startLine: span.startLine, endLine: span.endLine, contentHash: span.contentHash, spanHash: span.spanHash }; });
  for (const repo of repositoryIds) assert.equal(fixtureGit(fixture.root, repo, ['status', '--porcelain=v1']), '');
  const target = (repo, name) => path.join(fixture.root, 'sources', repo, name);
  await writeFile(target('order-api', 'README.md'), await readFile(target('order-api', 'README.md'), 'utf8') + '\nRefreshEvaluationMarker.\n');
  await rm(target('portal', 'legacy/orders.js'));
  const originalConsumer = await readFile(target('order-worker', 'src/main/java/OrderConsumer.java'), 'utf8');
  await writeFile(target('order-worker', 'src/main/java/AuditConsumer.java'), 'package audit;\n' + originalConsumer.replaceAll('OrderConsumer', 'AuditConsumer'));
  for (const repo of repositoryIds) { fixtureGit(fixture.root, repo, ['add', '--all']); fixtureGit(fixture.root, repo, ['commit', '-qm', 'Apply owned refresh evaluation changes']); }
  const expected = Object.fromEntries(repositoryIds.map(repo => [repo, fixtureGit(fixture.root, repo, ['rev-parse', 'HEAD'])]));
  const changed = await index('changed'), changes = indexChanges(catalog);
  assert.equal(changes.counts.added, 1); assert.equal(changes.counts.changed, 1); assert.equal(changes.counts.removed, 1);
  assert.equal(changed.refresh.reusedFiles, 16); assert.equal(changed.refresh.gitReadAttempts, 5);
  assert.ok(codeFlows(catalog).nodes.some(node => node.label === 'audit.AuditConsumer.onMessage'));
  for (const repo of repositoryIds) assert.equal(fixtureGit(fixture.root, repo, ['status', '--porcelain=v1']), '');
  console.log(JSON.stringify({ schemaVersion: 'loredock-refresh-evaluation/1', checkedAt: new Date().toISOString(), databaseVersion: store.one('PRAGMA user_version').user_version,
    modelRequests: 0, modelUsage: null, originalRevisionVector: fixture.manifest.revisionVector, changedRevisionVector: expected,
    sourceCheckoutsPreservedDuringIndexing: true, controlledFixtureChanges: 'Change API README, add a packaged worker consumer, remove the legacy client; frozen templates are unchanged.',
    totalGitBlobReadAttempts: git.reads, initial: { buildId: initial.id, metrics: initial.refresh }, unchanged: unchangedComparison, changed: changes,
    newEvidenceIdsIndependent: true, resolvingNewEvidenceCount: evidence.length, evidence,
    addedConsumerDiscovered: true, historicalLegacyClientAvailable: catalog.search('submitLegacy', initial.id).hits.length > 0,
    scope: 'Validated deterministic file reuse and inventory changes only; no AI-unit cache, correction reconciliation or full L4 acceptance.' }, null, 2));
} finally { await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); }
