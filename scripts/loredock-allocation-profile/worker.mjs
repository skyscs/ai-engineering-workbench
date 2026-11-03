import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { openState, prepareSources, copyStoppedData, dataHashes, hash } from '../loredock-capture-memory/fixture.mjs';
import { captureReceipt } from '../loredock-capture-memory/receipt.mjs';
import { assertSourceRowsEqual } from '../loredock-memory-runner/source-rows.mjs';
import { sampleAllocation, normalizedError } from './sample.mjs';
import { summarizeProfile } from './summary.mjs';

// Trusted tooling configuration only. The reader never calls its corpus factory.
export async function runProfileWorker({ root, role, config }) {
  assert.ok(path.isAbsolute(root) && ['prepare', 'read'].includes(role));
  const { oracle, size, services, corpusFactory, expectedCorpusHash, repositoryRoot } = config;
  const folder = path.join(root, role), dataDir = path.join(folder, 'data'), receipts = path.join(folder, 'receipts');
  await mkdir(folder, { recursive: true }); await mkdir(receipts);
  const report = { role, pid: process.pid, node: process.version, v8: process.versions.v8, execArgv: process.execArgv,
    lifecycle: [], artifacts: {}, errors: [], profileValid: false, profilePolicy: {
      allowUnmappedSamples: oracle.profile.allowUnmappedSamples, backendStopForcesGC: oracle.profile.backendStopForcesGC,
      backendExportAllocationsIncluded: oracle.profile.backendExportAllocationsIncluded }, resourceAcceptance: 'not-evaluated-profiled' };
  let state;
  const point = stage => report.lifecycle.push({ stage, atMs: performance.now(), ...process.memoryUsage() });
  const save = () => writeFile(path.join(folder, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  async function archive(name, value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    await writeFile(path.join(folder, name), text);
    return { file: name, bytes: Buffer.byteLength(text), sha256: hash(text) };
  }
  try {
    if (role === 'prepare') {
      point('preparation-before');
      const corpus = corpusFactory(); assert.equal(hash(JSON.stringify(corpus)), expectedCorpusHash);
      assert.equal(Object.keys(corpus).length, oracle.sourceCount);
      state = openState(dataDir, receipts, services);
      const revisions = await prepareSources(root, corpus, state), project = state.catalog.state();
      const build = state.catalog.start('allocation-initial', project.sourceSetVersion, project.policyVersion); await state.catalog.idle();
      for (let i = 0; i < 3 && ['paused', 'interrupted'].includes(state.store.buildRow(build.id).status); i++) {
        point('index-resume-' + (i + 1)); state.catalog.control(build.id, 'resume'); await state.catalog.idle();
      }
      state.catalog.readBuildHeader(build.id); point('index-after'); await save();
      const run = state.analysis.start('allocation-facts', build.id); await state.analysis.idle();
      for (let i = 0; i < 3 && ['paused', 'interrupted'].includes(state.analysis.get(run.id).status); i++) {
        point('analysis-resume-' + (i + 1)); state.analysis.control(run.id, 'resume'); await state.analysis.idle();
      }
      const inventory = state.analysis.get(run.id); assert.ok(inventory.published); point('analysis-after'); await save();
      const files = state.store.one('SELECT count(*) n FROM files WHERE buildId=?', build.id).n;
      const sources = state.store.buildSources(build.id);
      assert.equal(files, size.files); assert.equal(inventory.candidates, size.codeFiles); assert.equal(inventory.counts.parsed, size.codeFiles);
      assert.equal(sources.length, oracle.sourceCount); assert.ok(sources.every(row => row.status === 'ready' && row.omitted === 0));
      let facts = 0, parsed = 0;
      // Preparation-only expectation check; no payload arrays cross into the reader process.
      for (const row of state.store.db.prepare('SELECT payload FROM code_analysis_files WHERE runId=? AND status=? ORDER BY ordinal').iterate(inventory.id, 'parsed')) {
        const { facts: value } = JSON.parse(row.payload); parsed++;
        facts += value.symbols.length + value.operations.length + value.calls.length + Object.keys(value.records).length;
      }
      assert.equal(parsed, size.codeFiles); assert.equal(facts, size.facts);
      const metadata = { buildId: build.id, inventory, sources, files, facts, revisions,
        manifestHash: state.analysis.snapshot(inventory.id).manifestHash };
      point('preparation-close-before'); await state.close(); state = undefined; point('preparation-close-after');
      metadata.initialHashes = await copyStoppedData(dataDir, path.join(root, 'initial-data'));
      await copyStoppedData(path.join(root, 'initial-data'), path.join(root, 'read', 'data'));
      await writeFile(path.join(root, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
      report.preparation = { files, facts, inventory }; point('preparation-after'); await save();
    } else {
      const metadata = JSON.parse(await readFile(path.join(root, 'metadata.json')));
      report.initialHashes = await dataHashes(dataDir); assert.deepEqual(report.initialHashes, metadata.initialHashes);
      point('opening-before'); state = openState(dataDir, receipts, services); point('opening-after');
      assert.equal(state.analysis.snapshot(metadata.inventory.id).manifestHash, metadata.manifestHash);
      assertSourceRowsEqual(state.store.buildSources(metadata.buildId), metadata.sources);
      const before = state.counters(), legacyBefore = state.legacy(), sums = { path: 0, receipt: 0 };
      const parameters = Object.fromEntries(['samplingInterval', 'includeObjectsCollectedByMajorGC', 'includeObjectsCollectedByMinorGC'].map(key => [key, oracle.profile[key]]));
      point('sampling-before'); await save();
      const { profile, ...observation } = await sampleAllocation(() => captureReceipt(state.services, receipts, { buildId: metadata.buildId },
        { observeCharge: ({ phase, units }) => { sums[phase] += units; } }), parameters);
      point('sampling-after');
      const capture = { ...observation, before, after: state.counters(), legacyBefore, legacyAfter: state.legacy(), sums };
      report.artifacts.profile = await archive('allocation.heapprofile', profile);
      report.artifacts.capture = await archive('capture.json', capture);
      if (capture.result?.status === 'captured') report.artifacts.receipt = await archive('receipt.json', await readFile(capture.result.file, 'utf8'));
      await save(); // Preserve every first profile/result before structural or semantic assertions.
      assert.equal(capture.actionError, null); assert.deepEqual(capture.profilerErrors, []);
      assert.equal(capture.result?.status, 'captured', 'The complete profiled capture must return a receipt.');
      const summary = summarizeProfile(profile, oracle.profile, repositoryRoot);
      report.artifacts.summary = await archive('summary.json', summary); report.profileValid = true;
      report.sampleReferenceStatus = summary.sampleReferenceStatus;
    }
  } catch (error) { report.errors.push({ phase: role, ...normalizedError(error) }); }
  finally {
    point('closure-before');
    try { await state?.close(); point('closure-after'); } catch (error) { report.errors.push({ phase: 'cleanup', ...normalizedError(error) }); }
    await save();
  }
  return { report, exitCode: report.errors.length ? 1 : 0 };
}
