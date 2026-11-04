import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { SourceGit } from '../apps/loredock/dist/git.js';
import { CodeAnalysis } from '../apps/loredock/dist/code-analysis.js';
import { CodePaths } from '../apps/loredock/dist/code-paths.js';
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
const folder = await mkdtemp(path.join(tmpdir(), 'native-v2-built-'));
let state;
try {
  state = await receiptFixture(folder, corpus, { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths: CodePathsV2 });
  await state.analyze(); const before = state.counters(), budget = new OperationBudget(); let value, metrics;
  try { value = await state.paths.read({ buildId: state.buildId }, 'paths', undefined, budget); metrics = budget.stats(); }
  finally { budget.close(); }
  assert.equal(value.schemaVersion, 'loredock-code-paths/2'); assert.equal(value.status, 'available');
  assert.equal(value.graph.edges.find(edge => edge.kind === 'event-delivery').topicCheck.value, 'notice.created');
  assert.equal(value.graph.nodes.find(node => node.id === value.graph.flows[0].nodeIds.at(-1)).kind, 'document-write');
  assert.ok(metrics.pathWork > 0); assert.equal(metrics.totalWork, metrics.pathWork);
  assert.deepEqual(await state.paths.read({ buildId: state.buildId }), value);
  for (const ref of Object.values({ ...value.graph.evidence, ...value.roots.evidence })) assert.equal(state.catalog.evidence(ref.id).revision, ref.revision);
  const v1 = new CodePaths(state.analysis);
  try { const old = await v1.read({ buildId: state.buildId }); assert.equal(old.schemaVersion, 'loredock-code-paths/1');
    assert.ok(!old.graph.edges.some(edge => edge.kind === 'event-delivery')); }
  finally { await v1.stop(); }
  for (const key of ['gitCalls', 'writeCalls', 'changedRows']) assert.equal(state.counters()[key], before[key]);
  await state.restart(); assert.deepEqual(await state.paths.read({ buildId: state.buildId }), value);
  console.log(JSON.stringify({ schemaVersion: 'native-v2-built-smoke/1', node: process.version, modelRequests: 0,
    sources: 3, nodes: value.graph.nodes.length, edges: value.graph.edges.length,
    originalReferences: Object.keys(value.graph.evidence).length, pathWork: metrics.pathWork, restarted: true, v1Preserved: true }));
} finally { await state?.close(); await rm(folder, { recursive: true, force: true }); }
