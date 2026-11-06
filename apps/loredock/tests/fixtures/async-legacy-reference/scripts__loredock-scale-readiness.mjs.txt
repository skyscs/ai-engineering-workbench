import assert from 'node:assert/strict';
import { rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { SourceGit } from '../apps/loredock/dist/git.js';
import { projectOrientation } from '../apps/loredock/dist/orientation.js';
import { declarationMap } from '../apps/loredock/dist/system-map.js';
import { codeFlows } from '../apps/loredock/dist/code-flows.js';
import { createScaleFixture, scaleBaseline, scaleGit } from './loredock-scale-fixture.mjs';

/** Production ingestion measurement. Version 1 remains a historical three-source blocker artifact. */
export async function evaluateScaleReadiness() {
  const started = performance.now(), fixture = await createScaleFixture(), generationMs = performance.now() - started;
  let store, catalog;
  class CountingGit extends SourceGit {
    commands = 0;
    async run(...args) { this.commands++; return super.run(...args); }
  }
  const git = new CountingGit();
  try {
    store = new CatalogStore(path.join(fixture.root, 'data')); catalog = new Catalog(store, git);
    const paths = fixture.manifest.sources.map(source => path.join(fixture.root, 'sources', source.id));
    let phase = performance.now(); const preview = await catalog.previewSources(paths);
    const previewMs = performance.now() - phase; assert.equal(preview.ready, 20);
    phase = performance.now(); await catalog.registerSources({ paths, previewHash: preview.previewHash, requestId: 'scale-import' });
    const registrationMs = performance.now() - phase, registrationGitCommands = git.commands;
    const index = async requestId => {
      const before = performance.now(), commands = git.commands, state = catalog.state();
      const build = catalog.start(requestId, state.sourceSetVersion, state.policyVersion); await catalog.idle();
      return { ...store.build(build.id), durationMs: performance.now() - before, gitCommands: git.commands - commands };
    };
    const initial = await index('initial'); assert.equal(initial.coverage.indexed, 79); assert.equal(initial.coverage.excluded, 60);
    phase = performance.now(); const overview = projectOrientation(catalog), overviewMs = performance.now() - phase;
    assert.equal(overview.coverage.withContext, 20); assert.equal(overview.sources.length, 20);
    for (const card of overview.sources) for (const id of card.context.evidenceIds) assert.equal(catalog.evidence(id).sourceId, card.sourceId);
    const declarations = declarationMap(catalog), flows = codeFlows(catalog);
    const refresh = await index('unchanged-refresh'); assert.equal(refresh.refresh.reusedFiles, 79); assert.equal(refresh.refresh.gitReadAttempts, 20);
    const retained = store.one('SELECT coalesce(sum(length(raw)),0) rawBytes FROM files');
    const retainedSpans = store.one('SELECT coalesce(sum(length(CAST(text AS BLOB))),0) textBytes FROM spans');
    store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    const databaseBytes = (await stat(path.join(store.directory, 'loredock.db'))).size;
    for (const source of fixture.manifest.sources) assert.equal(scaleGit(fixture.root, source.id, ['status', '--porcelain=v1']), '');
    return { schemaVersion: 'loredock-scale-readiness/2', checkedAt: new Date().toISOString(), baseline: scaleBaseline(fixture), databaseVersion: store.one('PRAGMA user_version').user_version,
      measurements: { generationMs, previewMs, registrationMs, registrationGitCommands, overviewMs, nodeVersion: process.version, platform: process.platform },
      production: { requestedSources: 20, registeredSources: catalog.state().sources.length,
        initial: { durationMs: initial.durationMs, gitCommands: initial.gitCommands, gitBlobReads: initial.refresh.gitReadAttempts, coverage: initial.coverage,
          omittedPaths: initial.sources.reduce((sum, source) => sum + source.omitted, 0), allocation: JSON.parse(store.buildRow(initial.id).allocation) },
        refresh: { durationMs: refresh.durationMs, gitCommands: refresh.gitCommands, gitBlobReads: refresh.refresh.gitReadAttempts, reusedFiles: refresh.refresh.reusedFiles },
        orientation: { ...overview.coverage, outputBytes: Buffer.byteLength(JSON.stringify(overview)), omissions: overview.omissions },
        deeperProjections: { declarationCoverage: declarations.coverage, flowCoverage: flows.coverage, semanticQuality: 'not-evaluated' },
        retained: { generations: 2, rawBytes: retained.rawBytes, spanTextBytes: retainedSpans.textBytes, databaseBytes, includesIndexesAndMetadata: true } },
      modelRequests: 0, modelUsage: null, questionCount: fixture.oracle.questions.length, answerQuality: 'not-evaluated', routingQuality: 'not-evaluated', sourceCheckoutsUnchanged: true,
      scope: 'Small heterogeneous topology using production limits. Separate automated imbalance/long-document tests; not a production load benchmark or L5 acceptance.' };
  } finally { await catalog?.stop(); store?.close(); await rm(fixture.root, { recursive: true, force: true }); }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) console.log(JSON.stringify(await evaluateScaleReadiness(), null, 2));
