import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { SourceGit } from '../apps/loredock/dist/git.js';
import { CodeAnalysis } from '../apps/loredock/dist/code-analysis.js';
import { NativeCaptures } from '../apps/loredock/dist/native-capture.js';
import { readFileSync, existsSync } from 'node:fs';
import { CodePathsV2 } from '../apps/loredock/dist/code-paths-v2.js';
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
const folder = await mkdtemp(path.join(tmpdir(), 'native-capture-built-'));
let state, captures;
try {
  state = await receiptFixture(folder, corpus, { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths: CodePathsV2 });
  await state.analyze(); captures = new NativeCaptures(state.analysis, { paths: state.paths });
  const before = state.counters(), saved = await captures.capture({ buildId: state.buildId });
  assert.equal(saved.status, 'captured'); assert.equal(saved.created, true); assert.equal(saved.metrics.publicationLocks, 1);
  const beforeHistory = state.counters(), history = await captures.history(saved.receiptId);
  assert.equal(history.status, 'recorded'); assert.equal(history.currentApplicability, 'not-checked');
  assert.equal(history.projection.graph.edges.find(edge => edge.kind === 'event-delivery').topicCheck.value, 'notice.created');
  assert.equal(history.projection.graph.nodes.find(node => node.id === history.projection.graph.flows[0].nodeIds.at(-1)).kind, 'document-write');
  assert.equal(history.metrics.pathWork, 0); assert.equal(history.metrics.publicationLocks, 0);
  for (const key of ['factReads', 'snapshots', 'pathReads']) assert.equal(state.counters()[key], beforeHistory[key]);
  const receiptFile = path.join(state.root, 'data', 'path-receipts', state.store.receipts.catalogId, saved.receiptId + '.json');
  const bytes = readFileSync(receiptFile), record = JSON.parse(bytes.toString());
  assert.equal(JSON.stringify(history.projection), record.projectionJson); assert.deepEqual(history.originals, record.originals);
  assert.deepEqual(history.dependencies, record.dependencies);
  const duplicate = await captures.capture({ buildId: state.buildId }); assert.equal(duplicate.receiptId, saved.receiptId); assert.equal(duplicate.created, false);
  for (const key of ['gitCalls', 'writeCalls', 'changedRows']) assert.equal(state.counters()[key], before[key]);
  await captures.stop(); await state.restart(); captures = new NativeCaptures(state.analysis, { paths: state.paths });
  await state.analyze('native-replacement-one'); await state.analyze('native-replacement-two');
  const beforeReopen = state.counters(), reopened = await captures.history(saved.receiptId);
  assert.deepEqual(reopened.projection, history.projection); assert.deepEqual(reopened.originals, history.originals);
  assert.deepEqual(readFileSync(receiptFile), bytes);
  for (const key of ['gitCalls', 'writeCalls', 'changedRows', 'factReads', 'snapshots', 'pathReads']) assert.equal(state.counters()[key], beforeReopen[key]);
  state.catalog.updatePolicy(['private']);
  await assert.rejects(captures.history(saved.receiptId), { code: 'POLICY_CHANGED' }); assert.deepEqual(readFileSync(receiptFile), bytes);
  const revoked = history.dependencies[0].sourceId; state.catalog.revoke(revoked);
  assert.equal(state.store.source(revoked).purge, 'completed'); assert.equal(existsSync(receiptFile), false);
  await assert.rejects(captures.history(saved.receiptId), { code: 'RECEIPT_NOT_FOUND' });
  console.log(JSON.stringify({ schemaVersion: 'native-capture-built-smoke/1', node: process.version, modelRequests: 0,
    sources: 3, nodes: history.projection.graph.nodes.length, edges: history.projection.graph.edges.length,
    originals: history.originals.length, bytes: bytes.length, captureWork: saved.metrics.totalWork,
    pathWork: saved.metrics.pathWork, receiptWork: saved.metrics.receiptWork, historyWork: history.metrics.totalWork,
    restarted: true, inventoryReplacements: 2, policyDeniesHistory: true, revocationPurges: true,
    httpOrBrowserConsumerImplemented: false }));
} finally { await captures?.stop(); await state?.close(); await rm(folder, { recursive: true, force: true }); }
