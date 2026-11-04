import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { SourceGit } from '../apps/loredock/dist/git.js';
import { CodeAnalysis } from '../apps/loredock/dist/code-analysis.js';
import { encodeNativeReceipt } from '../apps/loredock/dist/native-receipt.js';
import { readFileSync, existsSync } from 'node:fs';
import { CodePathsV2 } from '../apps/loredock/dist/code-paths-v2.js';
import { OperationBudget } from '../apps/loredock/dist/operation-budget.js';
import { receiptFixture } from './loredock-capture-scale/fixture.mjs';

// Functional compiled-module check on fresh owned inputs; no frozen resource family.
const contract = JSON.stringify({ name: 'Notice', version: 1, transport: 'Kafka', fields: { key: 'string' } });
const corpus = {
  console: { 'README.md': '# Native compiled smoke\n', 'send.ts': 'export function notify() { return fetch("/notices", { method: "POST" }); }\n' },
  producer: { 'README.md': '# Producer\n', 'routes.json': JSON.stringify({ routes: [{ method: 'POST', path: '/notices', handler: 'Notices.send' }] }),
    'contracts/Notice.json': contract,
    'Notices.java': 'record Notice(String key) {}\ninterface EventPublisher { void publish(String topic, String key, Notice event); }\nclass Notices { EventPublisher publisher; void send(String key) { var notice = new Notice(key); publisher.publish("notice.created", key, notice); } }\n' },
  consumer: { 'README.md': '# Consumer\n', 'contracts/Notice.json': contract,
    'Writer.java': 'record Notice(String key) {}\ninterface MongoCollection { void replaceOne(String selector, Notice document, boolean upsert); }\ninterface KafkaSubscriber { void subscribe(String topic, String group, Writer handler); }\nclass Writer { MongoCollection collection; void start(KafkaSubscriber subscriber, String group) { subscriber.subscribe("notice.created", group, this); } void onMessage(Notice notice) { collection.replaceOne(notice.key(), notice, true); } }\n' },
};
const folder = await mkdtemp(path.join(tmpdir(), 'native-storage-built-'));
let state;
try {
  state = await receiptFixture(folder, corpus, { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths: CodePathsV2 });
  await state.analyze(); const before = state.counters(), budget = new OperationBudget(), catalogId = state.store.receipts.catalogId;
  let encoded, metrics, published;
  try {
    const projection = await state.paths.read({ buildId: state.buildId }, 'paths', undefined, budget);
    assert.equal(projection.graph.edges.find(edge => edge.kind === 'event-delivery').topicCheck.value, 'notice.created');
    const ids = Object.keys({ ...projection.graph.evidence, ...projection.roots.evidence }).sort();
    const originals = ids.map(id => { const { snippet, metadata, ...item } = state.catalog.evidence(id); return item; });
    const dependencies = state.store.buildSources(state.buildId).map(({ sourceId, name, revision, tree, status, omitted }) =>
      ({ sourceId, name, revision, tree, status, omitted })).sort((a, b) => a.sourceId < b.sourceId ? -1 : 1);
    encoded = encodeNativeReceipt({ schemaVersion: 'loredock-code-path-receipt/1', catalogId,
      projectionJson: JSON.stringify(projection), originals, dependencies }, catalogId, budget);
    assert.deepEqual(encoded.projection, projection);
    state.store.db.exec('BEGIN IMMEDIATE');
    try {
      published = state.store.receipts.publish(Buffer.from(encoded.serialized), budget, () => {
        budget.check(); const project = state.store.project();
        assert.equal(project.policyVersion, projection.identity.policyVersion); assert.equal(project.sourceSetVersion, projection.identity.registryVersion);
        state.catalog.readBuildHeader(state.buildId);
        for (const dep of dependencies) assert.equal(state.store.source(dep.sourceId).status, 'active');
      });
    } finally { state.store.db.exec('ROLLBACK'); }
    assert.equal(published.created, true); metrics = budget.stats();
    assert.ok(metrics.pathWork > 0 && metrics.receiptWork > 0);
  } finally { budget.close(); }
  for (const key of ['gitCalls', 'writeCalls', 'changedRows']) assert.equal(state.counters()[key], before[key]);
  await state.restart(); await state.analyze('codec-replacement-one'); await state.analyze('codec-replacement-two');
  const beforeDecode = state.counters(), readBudget = new OperationBudget();
  try {
    const decoded = state.store.receipts.read(published.receiptHash, readBudget);
    assert.deepEqual(decoded, encoded);
    assert.equal(readBudget.stats().pathWork, 0);
    for (const key of ['gitCalls', 'writeCalls', 'changedRows', 'factReads', 'snapshots', 'pathReads'])
      assert.equal(state.counters()[key], beforeDecode[key]);
  } finally { readBudget.close(); }
  const receiptFile = path.join(state.root, 'data', 'path-receipts', catalogId, published.receiptHash + '.json');
  const originalBytes = readFileSync(receiptFile); state.catalog.updatePolicy(['private']);
  assert.deepEqual(readFileSync(receiptFile), originalBytes);
  assert.throws(() => state.catalog.evidence(encoded.receipt.originals[0].id), { code: 'POLICY_CHANGED' });
  const revoked = encoded.receipt.dependencies[0].sourceId; state.catalog.revoke(revoked);
  assert.equal(state.store.source(revoked).purge, 'completed'); assert.equal(existsSync(receiptFile), false);
  const missing = new OperationBudget();
  try { assert.throws(() => state.store.receipts.read(published.receiptHash, missing), { code: 'RECEIPT_NOT_FOUND' }); }
  finally { missing.close(); }
  console.log(JSON.stringify({ schemaVersion: 'native-receipt-storage-built-smoke/1' , node: process.version, modelRequests: 0,
    sources: 3, nodes: encoded.projection.graph.nodes.length, edges: encoded.projection.graph.edges.length,
    originals: encoded.receipt.originals.length, bytes: Buffer.byteLength(encoded.serialized),
    pathWork: metrics.pathWork, receiptWork: metrics.receiptWork, restarted: true, inventoryReplacements: 2,
    nativeStorageImplemented: true, policyRetainsBytes: true, sourceRevocationPurges: true, captureHistoryServiceImplemented: false }));
} finally { await state?.close(); await rm(folder, { recursive: true, force: true }); }
