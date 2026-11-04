import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { receiptFixture } from '../loredock-capture-scale/fixture.mjs';
import { hash } from './schema.mjs';
import { corpusFactory, expectations } from './fixture.mjs';

// Functional fixture producer. Services come from source in tests and compiled modules
// in the smoke. Never imported by the offline assessor or used to infer its oracle.
export async function produce(root, services, incomplete = false) {
  await mkdir(path.join(root, 'raw'), { recursive: true }); const corpus = corpusFactory(incomplete);
  const state = await receiptFixture(root, corpus, services); let captures;
  try {
    const inventoryId = await state.analyze(), snapshot = state.analysis.snapshot(inventoryId);
    const metadata = { catalogId: state.store.receipts.catalogId, buildId: state.buildId, inventory: snapshot.summary,
      manifestHash: snapshot.manifestHash, sources: state.store.buildSources(state.buildId), revisions: state.revisions,
      policyVersion: snapshot.policyVersion, registryVersion: snapshot.registryVersion,
      sourceSetVersion: state.catalog.readBuildHeader(state.buildId).sourceSetVersion };
    captures = new services.NativeCaptures(state.analysis, { paths: state.paths });
    const rows = [], audits = [];
    const artifact = async (name, bytes) => { const file = `raw/${name}.json`; await writeFile(path.join(root, file), bytes);
      return { file, bytes: bytes.length, sha256: hash(bytes) }; };
    const save = async (name, request) => {
      const before = state.counters(), output = await captures.capture(request), after = state.counters();
      for (const key of ['gitCalls', 'writeCalls', 'changedRows']) assert.equal(after[key], before[key]);
      const raw = await readFile(path.join(state.store.directory, 'path-receipts', metadata.catalogId, output.receiptId + '.json'));
      rows.push({ name, output: await artifact(name + '-output', Buffer.from(JSON.stringify(output))), receipt: await artifact(name + '-receipt', raw) });
      audits.push({ name, before, after }); return JSON.parse(JSON.parse(raw.toString()).projectionJson);
    };
    const first = await save('first', { buildId: state.buildId });
    for (let repeat = 1; repeat <= 3; repeat++) await save('repeat-' + repeat, { buildId: state.buildId });
    const pins = { buildId: state.buildId, inventoryId, generationId: first.generationId };
    await save('selected', { ...pins, rootId: first.roots.items[0].id });
    const page = await state.paths.read({ ...pins, offset: 4 }, 'roots'); assert.equal(page.status, 'available');
    rows.push({ name: 'page-4', output: await artifact('page-4-output', Buffer.from(JSON.stringify(page))) });
    await save('isolated', { ...pins, rootId: page.roots.items[0].id });
    await state.analyze('replace-one'); await state.analyze('replace-two');
    // Analysis retains at most two inventories; the saved generation has been evicted.
    assert.throws(() => state.analysis.snapshot(inventoryId));
    await captures.stop(); await state.restart(); captures = new services.NativeCaptures(state.analysis, { paths: state.paths });
    const receipt = JSON.parse(await readFile(path.join(root, rows[0].receipt.file), 'utf8'));
    const before = state.counters(), history = await captures.history(receipt.receiptHash), after = state.counters();
    for (const key of Object.keys(before)) assert.equal(after[key], before[key]);
    rows.push({ name: 'history', output: await artifact('history-output', Buffer.from(JSON.stringify(history))) }); audits.push({ name: 'history', before, after });
    return { root, rows, metadata, corpus, ...expectations(incomplete), audits, lifecycle: { restarted: true, inventoryEvicted: true } };
  } finally { await captures?.stop(); await state.close(); }
}
