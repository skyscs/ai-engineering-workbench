import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPriorRuntime } from '../../apps/loredock/tests/fixtures/native-before-analysis-writes/load.mjs';
import { services as current } from '../loredock-native-qualification/services.mjs';
import { openNativeState } from '../loredock-native-qualification/state.mjs';
import { runtimeIdentity } from '../loredock-native-qualification/runtime.mjs';
import { configuration } from '../loredock-native-qualification/development.mjs';
import { readBounded, normalized } from '../loredock-native-qualification/io.mjs';
import { prepareSources, copyStoppedData, hash } from '../loredock-capture-memory/fixture.mjs';
import { decodeReceipt, captureOutput, historyOutput } from '../loredock-native-assessment/codec.mjs';
import { validateSupport, validateUsefulness } from '../loredock-qualification-assessment/content.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url)), output = process.env.LOREDOCK_NATIVE_UPGRADE_OUTPUT;
assert.ok(output && path.isAbsolute(output) && path.resolve(output) === output); await mkdir(output);
const planned = ['old-create', 'current-history', 'current-reanalysis', 'old-reopen', 'policy-current', 'policy-old', 'revoke-current', 'revoke-old'];
const report = { schemaVersion: 'native-compiled-upgrade/1', node: process.version, resourceQualification: false, modelRequests: 0,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), planned, phases: [], histories: [], refusals: [], errors: [] };
const config = configuration(0), corpus = config.corpusFactory(), states = [];
const save = () => writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
const raw = async (name, value) => {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
  await writeFile(path.join(output, name), bytes, { flag: 'wx' }); return { file: name, bytes: bytes.length, sha256: hash(bytes) };
};
async function phase(name, action) {
  assert.equal(name, planned[report.phases.length]); const row = { name, state: 'running' }; report.phases.push(row); await save();
  try { await action(); row.state = 'pass'; } catch (error) { row.state = 'fail'; row.error = normalized(error); throw error; } finally { await save(); }
}
const open = (folder, services) => { const state = openNativeState(folder, services); states.push(state); return state; };
const originalTables = state => hash(JSON.stringify(['sources', 'build_sources', 'files', 'spans'].map(table => state.store.all('SELECT * FROM ' + table + ' ORDER BY rowid'))));
const receiptPath = (state, id) => path.join(state.store.directory, 'path-receipts', state.store.receipts.catalogId, id + '.json');
const unchanged = (before, after, history = false) => {
  for (const key of ['gitCalls', 'writeCalls', 'changedRows', ...(history ? ['factReads', 'snapshots', 'pathReads'] : [])]) assert.equal(after[key], before[key]);
};
const typed = node => [node.sourceName, node.path, node.kind, node.label, node.properties.role ?? null];
function support(saved, metadata) {
  validateSupport(saved, corpus, metadata); validateUsefulness(saved, 'first', config.oracle, config.size);
  for (const key of ['policyVersion', 'registryVersion', 'sourceSetVersion']) assert.equal(saved.projection.identity[key], metadata[key]);
  const p = saved.projection, nodes = new Map(p.graph.nodes.map(node => [node.id, node])), edges = new Map(p.graph.edges.map(edge => [edge.id, edge]));
  assert.deepEqual(p.roots.items.map(node => [node.sourceName, node.path, node.label, node.role]), config.complete.roots);
  assert.deepEqual(p.graph.flows.map(flow => ({ nodes: flow.nodeIds.map(id => typed(nodes.get(id))), edges: flow.edgeIds.map(id => edges.get(id).kind) })), config.complete.flows);
  const ordered = rows => rows.map(row => JSON.stringify(row)).sort();
  assert.deepEqual(ordered(p.graph.nodes.map(typed)), ordered([...new Map(config.complete.flows.flatMap(flow => flow.nodes).map(node => [JSON.stringify(node), node])).values()]));
  assert.deepEqual([...new Set(p.graph.flows.flatMap(flow => flow.edgeIds))].sort(), [...edges.keys()].sort());
  assert.deepEqual(ordered(saved.receipt.originals.map(row => [row.sourceName, row.path, row.startLine, row.endLine])), ordered(config.complete.originals));
}
async function refusal(name, action, code) {
  let failure; try { await action(); } catch (error) { failure = error; }
  assert.ok(failure, 'Expected refusal: ' + name); assert.equal(failure.code, code);
  report.refusals.push({ name, code, error: normalized(failure) }); await save();
}
async function capture(name, state, metadata, expectedCreated = true) {
  const before = state.counters(), result = await state.captures.capture({ buildId: metadata.buildId });
  unchanged(before, state.counters()); const outputRef = await raw(name + '-output.json', result);
  const bytes = await readBounded(receiptPath(state, result.receiptId), 640 * 1024), receiptRef = await raw(name + '-receipt.json', bytes);
  const saved = decodeReceipt(bytes, state.store.receipts.catalogId), checked = captureOutput(Buffer.from(JSON.stringify(result)));
  assert.equal(checked.receiptId, saved.receipt.receiptHash); assert.equal(checked.created, expectedCreated); support(saved, metadata);
  return { result, saved, bytes, outputRef, receiptRef, metadata };
}
async function history(name, state, captured) {
  const before = state.counters(), value = await state.captures.history(captured.result.receiptId), after = state.counters();
  const reference = await raw(name + '-history.json', value), saved = historyOutput(Buffer.from(JSON.stringify(value)));
  unchanged(before, after, true); assert.equal(after.originalReads - before.originalReads, captured.saved.receipt.originals.length);
  assert.equal(value.metrics.pathWork, 0); assert.equal(value.metrics.publicationLocks, 0); assert.equal(value.currentApplicability, 'not-checked');
  assert.equal(JSON.stringify(value.projection), captured.saved.receipt.projectionJson);
  assert.deepEqual(value.originals, captured.saved.receipt.originals); assert.deepEqual(value.dependencies, captured.saved.receipt.dependencies);
  assert.equal(value.receiptId, captured.result.receiptId); support(saved, captured.metadata);
  assert.deepEqual(await readFile(receiptPath(state, value.receiptId)), captured.bytes);
  report.histories.push({ name, reference, originals: value.originals.length, dependencies: value.dependencies.length,
    counters: Object.fromEntries(Object.keys(after).map(key => [key, after[key] - before[key]])), metrics: value.metrics }); await save();
}

let older, oldState, currentState, oldCapture, newCapture, buildId, revisions, sourcesHash;
const data = path.join(output, 'data');
try {
  assert.equal(process.execArgv.length, 0); assert.ok(!process.env.NODE_OPTIONS);
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '', 'Commit the compiled upgrade regression first.');
  older = await loadPriorRuntime(); report.prior = older.manifest; report.current = await runtimeIdentity(); report.input = await raw('input.json', corpus);
  await phase('old-create', async () => {
    oldState = open(data, older.services); revisions = await prepareSources(output, corpus, oldState);
    const project = oldState.catalog.state(), build = oldState.catalog.start('upgrade-index', project.sourceSetVersion, project.policyVersion);
    buildId = build.id; await oldState.catalog.idle(); const job = oldState.analysis.start('old-analysis', buildId); await oldState.analysis.idle();
    const inventory = oldState.analysis.get(job.id), snapshot = oldState.analysis.snapshot(job.id);
    assert.equal(inventory.fingerprint, older.manifest.fingerprint); assert.equal(inventory.counts.parsed, config.size.codeFiles);
    const metadata = { catalogId: oldState.store.receipts.catalogId, buildId, revisions, inventory, manifestHash: snapshot.manifestHash,
      sources: oldState.store.buildSources(buildId), policyVersion: snapshot.policyVersion, registryVersion: snapshot.registryVersion,
      sourceSetVersion: oldState.catalog.readBuildHeader(buildId).sourceSetVersion };
    sourcesHash = originalTables(oldState); await raw('old-metadata.json', metadata);
    oldCapture = await capture('old', oldState, metadata); await history('old-original', oldState, oldCapture); await oldState.close();
  });
  await phase('current-history', async () => {
    currentState = open(data, current); assert.equal(currentState.store.receipts.catalogId, oldCapture.metadata.catalogId);
    assert.notEqual(currentState.analysis.fingerprint, older.manifest.fingerprint);
    assert.equal(currentState.analysis.get(oldCapture.metadata.inventory.id).currentParser, false);
    await refusal('current-old-snapshot', () => currentState.analysis.snapshot(oldCapture.metadata.inventory.id), 'PARSER_CHANGED');
    assert.equal((await currentState.paths.read({ buildId })).status, 'unavailable');
    await refusal('current-old-capture', () => currentState.captures.capture({ buildId }), 'RECEIPT_UNAVAILABLE');
    await history('current-before-reanalysis', currentState, oldCapture); assert.equal(originalTables(currentState), sourcesHash);
  });
  await phase('current-reanalysis', async () => {
    const job = currentState.analysis.start('current-analysis', buildId); await currentState.analysis.idle();
    const inventory = currentState.analysis.get(job.id), snapshot = currentState.analysis.snapshot(job.id);
    assert.equal(inventory.currentParser, true); assert.notEqual(inventory.fingerprint, oldCapture.metadata.inventory.fingerprint);
    const metadata = { ...oldCapture.metadata, inventory, manifestHash: snapshot.manifestHash }; await raw('current-metadata.json', metadata);
    newCapture = await capture('current', currentState, metadata);
    assert.notEqual(newCapture.saved.projection.generationId, oldCapture.saved.projection.generationId);
    assert.notEqual(newCapture.result.receiptId, oldCapture.result.receiptId);
    assert.deepEqual(newCapture.saved.receipt.originals, oldCapture.saved.receipt.originals);
    assert.deepEqual(newCapture.saved.receipt.dependencies, oldCapture.saved.receipt.dependencies);
    await history('current-after-reanalysis-old', currentState, oldCapture); await history('current-new', currentState, newCapture);
    assert.equal(originalTables(currentState), sourcesHash); await currentState.close();
  });
  await phase('old-reopen', async () => {
    oldState = open(data, older.services); assert.equal(oldState.analysis.get(newCapture.metadata.inventory.id).currentParser, false);
    await refusal('old-new-snapshot', () => oldState.analysis.snapshot(newCapture.metadata.inventory.id), 'PARSER_CHANGED');
    assert.equal((await oldState.paths.read({ buildId, inventoryId: newCapture.metadata.inventory.id })).status, 'unavailable');
    const duplicate = await capture('old-reopened', oldState, oldCapture.metadata, false); assert.deepEqual(duplicate.bytes, oldCapture.bytes);
    await history('old-reopened-old', oldState, oldCapture); await history('old-reopened-new', oldState, newCapture);
    assert.equal(originalTables(oldState), sourcesHash); await oldState.close();
  });
  for (const branch of ['policy', 'revoke']) {
    const folder = path.join(output, branch); await copyStoppedData(data, folder);
    for (const [name, services] of [['current', current], ['old', older.services]]) await phase(branch + '-' + name, async () => {
      const state = open(folder, services);
      if (name === 'current') {
        if (branch === 'policy') state.catalog.updatePolicy(['ui']);
        else {
          const source = state.store.sources().find(row => row.name === config.oracle.uncitedSource); assert.ok(source);
          assert.ok(!oldCapture.saved.receipt.originals.some(row => row.sourceId === source.id)); state.catalog.revoke(source.id);
          assert.equal(state.store.source(source.id).purge, 'completed');
        }
      }
      for (const [label, captured] of [['old', oldCapture], ['new', newCapture]]) {
        await refusal(branch + '-' + name + '-' + label, () => state.captures.history(captured.result.receiptId), branch === 'policy' ? 'POLICY_CHANGED' : 'RECEIPT_NOT_FOUND');
        if (branch === 'policy') assert.deepEqual(await readFile(receiptPath(state, captured.result.receiptId)), captured.bytes);
        else await assert.rejects(readFile(receiptPath(state, captured.result.receiptId)), { code: 'ENOENT' });
      }
      if (branch === 'revoke') assert.deepEqual(await readdir(path.dirname(receiptPath(state, oldCapture.result.receiptId))), []);
      await state.close();
    });
  }
  report.completed = true;
} catch (error) { report.errors.push(normalized(error)); }
finally {
  for (const state of states) try { await state.close(); } catch (error) { report.errors.push(normalized(error)); }
  report.failed = !report.completed || report.errors.length > 0 || report.phases.length !== planned.length || report.phases.some(row => row.state !== 'pass'); await save();
}
console.log(JSON.stringify({ failed: report.failed, phases: report.phases, histories: report.histories.length, refusals: report.refusals.length, errors: report.errors }));
process.exitCode = report.failed ? 1 : 0;
