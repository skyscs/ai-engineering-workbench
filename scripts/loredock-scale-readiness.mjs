import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { createScaleFixture, scaleBaseline, scaleGit } from './loredock-scale-fixture.mjs';

/** Measure the supported boundary without bypassing registration or claiming scale acceptance. */
export async function evaluateScaleReadiness() {
  const started = performance.now(), fixture = await createScaleFixture(), generationMs = performance.now() - started;
  let store, catalog;
  try {
    let textBytes = 0;
    const byRepository = [];
    for (const source of fixture.manifest.sources) {
      const files = fixture.manifest.evidence.filter(file => file.sourceId === source.id);
      let bytes = 0;
      for (const file of files) bytes += (await readFile(path.join(fixture.root, 'sources', source.id, file.path))).length;
      textBytes += bytes; byRepository.push({ id: source.id, role: source.role, files: files.length, textBytes: bytes });
    }
    store = new CatalogStore(path.join(fixture.root, 'data')); catalog = new Catalog(store);
    const registrationStarted = performance.now(); let blocker = null;
    for (const source of fixture.manifest.sources) {
      try { await catalog.addSource(path.join(fixture.root, 'sources', source.id)); }
      catch (error) {
        if (error.code !== 'SOURCE_LIMIT') throw error;
        blocker = { source: source.id, code: error.code, message: error.message }; break;
      }
    }
    const registeredSources = catalog.state().sources.length;
    const registrationMs = performance.now() - registrationStarted;
    // This deliberately fails when capacity changes: review the benchmark contract at that point.
    assert.equal(registeredSources, 3); assert.equal(blocker?.source, 'checkout-bff');
    const state = catalog.state(), indexStarted = performance.now();
    catalog.start('supported-pilot-only', state.sourceSetVersion, state.policyVersion); await catalog.idle();
    const build = catalog.state().builds[0]; assert.equal(build.coverage.indexed, 18);
    const pilotIndexMs = performance.now() - indexStarted;
    for (const source of fixture.manifest.sources) assert.equal(scaleGit(fixture.root, source.id, ['status', '--porcelain=v1']), '');
    return { schemaVersion: 'loredock-scale-readiness/1', checkedAt: new Date().toISOString(), baseline: scaleBaseline(fixture),
      fixture: { sourceCount: 20, textFiles: fixture.manifest.evidence.length, excludedCanaries: 60, textBytes, repositories: byRepository },
      measurements: { generationMs, registrationMs, pilotIndexMs, nodeVersion: process.version, platform: process.platform },
      production: { requestedSources: 20, registeredSources, rejectedSources: 1, unattemptedSources: 16,
        blocker, indexedSources: build.sources.length, indexedFiles: build.coverage.indexed, status: 'blocked-at-registration',
        twentySourceIngestion: 'not-run', twentySourceLatency: null, twentySourceRetainedBytes: null },
      modelRequests: 0, modelUsage: null, questionCount: fixture.oracle.questions.length,
      answerQuality: 'not-evaluated', routingQuality: 'not-evaluated', sourceCheckoutsUnchanged: true,
      scope: 'Small heterogeneous topology and current three-source boundary; not production load or L5 acceptance.' };
  } finally { await catalog?.stop(); store?.close(); await rm(fixture.root, { recursive: true, force: true }); }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  console.log(JSON.stringify(await evaluateScaleReadiness(), null, 2));
}
