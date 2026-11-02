import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { SourceGit } from '../src/git.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { CodePaths } from '../src/code-paths.js';
import { codePathLimits, PathWork } from '../src/code-paths-work.js';
import { bindingMetadata, bindingDomains, assertBindingMetadata } from '../src/code-paths-metadata.js';
import { declarationMap } from '../src/system-map.js';
import { compareHeaders } from '../src/http-headers.js';
import { sha256 } from '../src/extract.js';
import { CatalogError } from '../src/types.js';
// @ts-expect-error The offline fork uses injected source services, never prebuilt application output.
import { createTopicPaths } from '../../../scripts/loredock-literal-topics/paths.mjs';
// @ts-expect-error Separate offline receipt identity; no production schema change.
import { captureReceipt, readReceipt } from '../../../scripts/loredock-literal-topics/receipt.mjs';
// @ts-expect-error Owned small regressions never load the frozen qualification inputs.
import { receiptFixture } from '../../../scripts/loredock-receipt-fixture.mjs';
// @ts-expect-error The original reader must refuse a new experimental identity.
import { readReceipt as readOldReceipt } from '../../../scripts/loredock-path-receipt.mjs';

const TopicPaths = createTopicPaths({ codePathLimits, PathWork, bindingMetadata, bindingDomains, assertBindingMetadata, declarationMap, compareHeaders, sha256, CatalogError });
const contract = JSON.stringify({ name: 'Changed', version: 1, transport: 'Kafka', fields: { key: 'string' } });
// Independent minimal inputs: no Task 071/073 corpus, oracle or probe is imported.
const publisher = 'record Changed(String key) {}\ninterface EventPublisher { void publish(String topic, String key, Changed event); }\nclass Handler { EventPublisher publisher; void accept(String key) { var event = new Changed(key); publisher.publish("changes", key, event); } }\n';
const consumer = 'record Changed(String key) {}\ninterface MongoCollection { void replaceOne(String selector, Changed document, boolean upsert); }\ninterface KafkaSubscriber { void subscribe(String topic, String group, Reader handler); }\nclass Reader { MongoCollection collection; void start(KafkaSubscriber subscriber, String group) { subscriber.subscribe("changes", group, this); } void onMessage(Changed event) { collection.replaceOne(event.key(), event, true); } }\n';
async function setup(t: TestContext, dynamic = false) {
  const parent = await mkdtemp(path.join(tmpdir(), 'literal-topic-regression-'));
  const corpus: Record<string, Record<string, string>> = {
    client: { 'action.ts': 'export function send() { return fetch("/change", { method: "POST" }); }\n', 'README.md': '# Regression client\n' },
    publisher: { 'README.md': '# Regression publisher\n', 'Handler.java': dynamic ? publisher.replace('"changes", key', 'key, key') : publisher,
      'config/routes.json': JSON.stringify({ routes: [{ method: 'POST', path: '/change', handler: 'Handler.accept' }] }),
      'contracts/Changed.json': contract, 'config/topic.json': JSON.stringify(dynamic ? { orderTopic: 'changes' } : { streamLabel: 'changes' }) },
    reader: { 'README.md': '# Regression reader\n', 'Reader.java': dynamic ? consumer.replace('"changes", group', 'group, group') : consumer,
      'contracts/Changed.json': contract, 'config/topic.json': JSON.stringify(dynamic ? { orderTopic: 'changes' } : { streamLabel: 'changes' }) },
  };
  const s = await receiptFixture(parent, corpus, { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths: TopicPaths });
  t.after(async () => { await s.close(); await rm(parent, { recursive: true, force: true }); });
  await s.analyze(); return s;
}
test('literal candidate keeps complete topic witnesses and readable history under its distinct identity', async t => {
  const s = await setup(t), before = s.counters(), saved = await captureReceipt(s.services, s.folder, { buildId: s.buildId });
  const raw = await readFile(saved.file, 'utf8'), recorded = await readReceipt(s.catalog, s.folder, saved.receiptId);
  const graph = recorded.projection.graph, edge = graph.edges.find((row: { kind: string }) => row.kind === 'event-delivery');
  assert.ok(edge, JSON.stringify({ omissions: graph.omissions, nodes: graph.nodes.map((node: { label: string }) => node.label) })); assert.equal(edge.status, 'candidate'); assert.equal(edge.topicCheck.value, 'changes');
  assert.equal(graph.nodes.find((row: { id: string }) => row.id === graph.flows[0].nodeIds.at(-1)).kind, 'document-write');
  for (const item of [edge.topicCheck.publisher, edge.topicCheck.subscriber]) {
    assert.equal(item.expression, '"changes"');
    for (const id of item.evidenceIds) assert.ok(recorded.originals.some((row: { id: string }) => row.id === id));
  }
  assert.equal(s.counters().writeCalls, before.writeCalls); assert.equal(s.counters().gitCalls, before.gitCalls);
  await assert.rejects(readOldReceipt(s.catalog, s.folder, saved.receiptId), { code: 'CORRUPT_RECEIPT' });
  await s.analyze('replace'); await s.analyze('evict'); await s.restart();
  const stable = s.counters(); assert.deepEqual((await readReceipt(s.catalog, s.folder, saved.receiptId)).projection, recorded.projection);
  assert.deepEqual(s.counters(), stable); assert.equal(await readFile(saved.file, 'utf8'), raw);
});
test('dynamic expressions abstain even when the old configuration profile supplies a candidate', async t => {
  const s = await setup(t, true), control = new CodePaths(s.analysis);
  t.after(() => control.stop()); const old = await control.read({ buildId: s.buildId });
  assert.ok(old.status === 'available' && old.graph?.edges.some(edge => edge.kind === 'event-delivery'));
  const candidate = await s.paths.read({ buildId: s.buildId });
  assert.ok(!candidate.graph.edges.some((edge: { kind: string }) => edge.kind === 'event-delivery'));
  assert.ok(candidate.coverage.omissions['unresolved-topic-expression'] > 0);
});
test('same-label handler reference and symbol remain distinct when an alternative invalidates uniqueness', async t => {
  const s = await setup(t), saved = await captureReceipt(s.services, s.folder, { buildId: s.buildId });
  const old = (await readReceipt(s.catalog, s.folder, saved.receiptId)).projection;
  const symbol = old.graph.nodes.filter((row: { sourceName: string; path: string; kind: string; label: string }) => row.sourceName === 'publisher' && row.path === 'Handler.java' && row.kind === 'symbol' && row.label === 'Handler.accept');
  assert.equal(symbol.length, 1); assert.ok(old.graph.edges.some((edge: { kind: string; to: string }) => edge.kind === 'implements' && edge.to === symbol[0].id));
  await s.write('publisher', 'other/Handler.java', 'class Handler { void accept(String key) {} }\n'); s.commit('publisher');
  const build = await s.index('alternative'); await s.analyze('alternative', build);
  const next = await s.paths.read({ buildId: build }); assert.notEqual(next.generationId, old.generationId);
  assert.ok(!next.graph.edges.some((edge: { kind: string }) => edge.kind === 'implements'));
  assert.deepEqual((await readReceipt(s.catalog, s.folder, saved.receiptId)).projection, old);
});
const canonical = (value: unknown): string => value === null || typeof value !== 'object' ? JSON.stringify(value) : Array.isArray(value)
  ? '[' + value.map(canonical).join(',') + ']' : '{' + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => JSON.stringify(key) + ':' + canonical(item)).join(',') + '}';
test('receipt rejects a resealed topic witness that contradicts its endpoint expression', async t => {
  const s = await setup(t), saved = await captureReceipt(s.services, s.folder, { buildId: s.buildId });
  const receipt = JSON.parse(await readFile(saved.file, 'utf8')), projection = JSON.parse(receipt.projectionJson);
  projection.graph.edges.find((edge: { kind: string }) => edge.kind === 'event-delivery').topicCheck.value = 'invented';
  const { projectionId: ignored, ...projectionContent } = projection; void ignored;
  projection.projectionId = sha256(JSON.stringify(projectionContent)); receipt.projectionJson = JSON.stringify(projection);
  const { receiptHash: previous, ...content } = receipt; void previous;
  receipt.receiptHash = createHash('sha256').update(canonical(content)).digest('hex');
  await writeFile(path.join(s.folder, receipt.receiptHash + '.json'), canonical(receipt));
  await assert.rejects(readReceipt(s.catalog, s.folder, receipt.receiptHash), { code: 'CORRUPT_RECEIPT' });
});
