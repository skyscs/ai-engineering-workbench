import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { observeQueries } from './queries.mjs';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { services } from '../loredock-native-qualification/services.mjs';
import { openNativeState } from '../loredock-native-qualification/state.mjs';
import { runtimeIdentity } from '../loredock-native-qualification/runtime.mjs';
import { normalized, readBounded } from '../loredock-native-qualification/io.mjs';
import { prepareSources, hash } from '../loredock-capture-memory/fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url)), output = process.env.LOREDOCK_NATIVE_WORKER_AUDIT_OUTPUT;
assert.ok(output && path.isAbsolute(output) && path.resolve(output) === output); mkdirSync(output);
const report = { schemaVersion: 'native-worker-ownership-audit/1', node: process.version, v8: process.versions.v8,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), modelRequests: 0,
  resourceQualification: false, method: 'Bounded SQL prepare/execute/transaction counts on one small owned input; no memory attribution.',
  observations: [], queries: { templates: [], stages: [] }, errors: [] };
const save = () => {
  const bytes = JSON.stringify(report, null, 2) + '\n'; assert.ok(Buffer.byteLength(bytes) <= 256 * 1024);
  writeFileSync(path.join(output, 'report.json'), bytes);
};
let state, audit;
const finish = () => { audit.end(); report.queries = audit.report(); save(); };
function syncStage(name, action) { audit.begin(name); try { return action(); } finally { finish(); } }
async function asyncStage(name, action) { audit.begin(name); try { return await action(); } finally { finish(); } }
const sourcesHash = () => hash(JSON.stringify(['sources', 'build_sources', 'files', 'spans'].map(table => state.store.all('SELECT * FROM ' + table + ' ORDER BY rowid'))));
save();
try {
  assert.equal(process.execArgv.length, 0); assert.ok(!process.env.NODE_OPTIONS);
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '', 'Commit the audit before execution.');
  report.runtime = await runtimeIdentity();
  const corpus = corpusFactory();
  for (const [source, files] of Object.entries(corpus)) for (let i = 0; i < 8; i++)
    files[`ownership/diagnostic-${i}.ts`] = `// Native worker ownership diagnostic: ${source}, unit ${i}.\n`;
  const texts = Object.values(corpus).flatMap(files => Object.values(files));
  report.input = { sources: Object.keys(corpus).length, files: texts.length,
    codeFiles: Object.values(corpus).flatMap(files => Object.keys(files)).filter(file => /\.(ts|js|vue|java)$/.test(file)).length,
    bytes: texts.reduce((sum, text) => sum + Buffer.byteLength(text), 0), sha256: hash(JSON.stringify(corpus)) };
  assert.equal(report.input.files, 47); assert.equal(report.input.codeFiles, 40); assert.ok(report.input.bytes < 64 * 1024);
  writeFileSync(path.join(output, 'input.json'), JSON.stringify(corpus, null, 2) + '\n'); save();
  state = openNativeState(path.join(output, 'data'), services);
  report.revisions = await prepareSources(output, corpus, state);
  const project = state.catalog.state(), build = state.catalog.start('ownership-index', project.sourceSetVersion, project.policyVersion);
  await state.catalog.idle();
  const initial = state.analysis.start('ownership-initial', build.id); await state.analysis.idle();
  assert.equal(state.analysis.get(initial.id).counts.parsed, report.input.codeFiles);
  const beforeSources = sourcesHash(); audit = observeQueries(state.store.db);
  const captured = await asyncStage('native-capture', () => state.captures.capture({ buildId: build.id }));
  const raw = await readBounded(path.join(output, 'data', 'path-receipts', state.store.receipts.catalogId, captured.receiptId + '.json'), 640 * 1024);
  writeFileSync(path.join(output, 'receipt.json'), raw);
  writeFileSync(path.join(output, 'capture-output.json'), JSON.stringify(captured, null, 2));
  const receipt = JSON.parse(raw); assert.equal(receipt.originals.length, 10); assert.equal(receipt.dependencies.length, 4);
  for (const name of ['replacement-one', 'replacement-two']) {
    const before = state.counters();
    const next = syncStage(name + '-admission', () => state.analysis.start('ownership-' + name, build.id));
    // Start observation before the scheduled worker's first microtask executes.
    await asyncStage(name + '-worker', () => state.analysis.idle());
    const after = state.counters(), summary = state.analysis.get(next.id);
    assert.ok(summary.published); assert.equal(summary.counts.parsed, report.input.codeFiles);
    assert.equal(after.gitCalls, before.gitCalls);
    report.observations.push({ name, summary, counters: Object.fromEntries(Object.keys(after).map(key => [key, after[key] - before[key]])) }); save();
  }
  assert.throws(() => state.analysis.get(initial.id), { code: 'NOT_FOUND' });
  const before = state.counters(), history = await asyncStage('evicted-history', () => state.captures.history(captured.receiptId)), after = state.counters();
  writeFileSync(path.join(output, 'history-output.json'), JSON.stringify(history, null, 2));
  assert.deepEqual(history.projection, JSON.parse(receipt.projectionJson));
  assert.deepEqual(history.originals, receipt.originals); assert.deepEqual(history.dependencies, receipt.dependencies);
  for (const key of ['gitCalls', 'writeCalls', 'changedRows', 'factReads', 'snapshots', 'pathReads']) assert.equal(after[key], before[key]);
  assert.equal(after.originalReads - before.originalReads, receipt.originals.length);
  assert.equal(history.metrics.pathWork, 0); assert.equal(history.metrics.publicationLocks, 0);
  const afterSources = sourcesHash(); assert.equal(afterSources, beforeSources);
  report.history = { receiptId: captured.receiptId, receiptSha256: hash(raw), sourceRowsSha256: afterSources,
    originals: history.originals.length, dependencies: history.dependencies.length, metrics: history.metrics,
    counters: Object.fromEntries(Object.keys(after).map(key => [key, after[key] - before[key]])) };
  await asyncStage('owner-close', () => state.close()); report.closed = true; report.completed = true;
} catch (error) { report.errors.push({ phase: 'audit', ...normalized(error) }); }
finally {
  try { audit?.detach(); } catch (error) { report.errors.push({ phase: 'detach', ...normalized(error) }); }
  try { await state?.close(); } catch (error) { report.errors.push({ phase: 'cleanup', ...normalized(error) }); }
  report.failed = !report.completed || report.errors.length > 0; save();
}
console.log(JSON.stringify({ failed: report.failed, input: report.input, stages: report.queries.stages.map(stage => ({ name: stage.name,
  prepare: stage.queries.reduce((sum, row) => sum + row.prepare, 0), run: stage.queries.reduce((sum, row) => sum + row.run, 0),
  executions: stage.queries.reduce((sum, row) => sum + row.get + row.all + row.run + row.iterate, 0),
  exec: stage.queries.reduce((sum, row) => sum + row.exec, 0) })), errors: report.errors }));
process.exitCode = report.failed ? 1 : 0;
