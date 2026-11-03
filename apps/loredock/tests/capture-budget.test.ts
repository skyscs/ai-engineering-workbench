import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, readdir, readFile, rm, unlink } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { SourceGit } from '../src/git.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { codePathLimits, PathWork } from '../src/code-paths-work.js';
import { bindingMetadata, bindingDomains, assertBindingMetadata } from '../src/code-paths-metadata.js';
import { declarationMap } from '../src/system-map.js';
import { compareHeaders } from '../src/http-headers.js';
import { sha256 } from '../src/extract.js';
import { CatalogError } from '../src/types.js';
// @ts-expect-error Offline factory injects source services; CI needs no prebuilt daemon.
import { createCapturePaths } from '../../../scripts/loredock-capture-scale/paths.mjs';
// @ts-expect-error Separate offline receipt implementation, never a frozen matrix import.
import { captureReceipt, readReceipt } from '../../../scripts/loredock-capture-scale/receipt.mjs';
// @ts-expect-error Internal operation capability, not a public request parameter.
import { CaptureBudget } from '../../../scripts/loredock-capture-scale/budget.mjs';
// @ts-expect-error Owned small integration fixture, separate from the scale corpus.
import { receiptFixture } from '../../../scripts/loredock-capture-scale/fixture.mjs';
const Paths = createCapturePaths({ codePathLimits, PathWork, bindingMetadata, bindingDomains, assertBindingMetadata, declarationMap, compareHeaders, sha256, CatalogError });
const contract = JSON.stringify({ name: 'AlertRaised', version: 1, transport: 'Kafka', fields: { key: 'string' } });
const inputs = {
  dashboard: { 'README.md': '# Budget regression\n', 'action.ts': 'export function raise() { return fetch("/alert", { method: "POST" }); }\n' },
  emitter: { 'README.md': '# Emitter\n', 'config/routes.json': JSON.stringify({ routes: [{ method: 'POST', path: '/alert', handler: 'Alerts.raise' }] }), 'contracts/Alert.json': contract,
    'Alerts.java': 'record AlertRaised(String key) {}\ninterface EventPublisher { void publish(String topic, String key, AlertRaised event); }\nclass Alerts { EventPublisher publisher; void raise(String key) { var event = new AlertRaised(key); publisher.publish("alerts", key, event); } }\n' },
  sink: { 'README.md': '# Sink\n', 'contracts/Alert.json': contract,
    'Listener.java': 'record AlertRaised(String key) {}\ninterface MongoCollection { void replaceOne(String selector, AlertRaised document, boolean upsert); }\ninterface KafkaSubscriber { void subscribe(String topic, String group, Listener handler); }\nclass Listener { MongoCollection collection; void start(KafkaSubscriber subscriber, String group) { subscriber.subscribe("alerts", group, this); } void onMessage(AlertRaised event) { collection.replaceOne(event.key(), event, true); } }\n' },
};
async function setup(t: TestContext) {
  const parent = await mkdtemp(path.join(tmpdir(), 'capture-budget-'));
  const s = await receiptFixture(parent, inputs, { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths: Paths });
  t.after(async () => { await s.close(); await rm(parent, { recursive: true, force: true }); });
  await s.analyze(); return s;
}
const ledger = () => { const counts = { path: 0, receipt: 0 }; return { counts, observe({ phase, units }: { phase: 'path' | 'receipt'; units: number }) { counts[phase] += units; } }; };
test('capture aggregates nested work, refuses a shared-only ceiling and recovers its prior receipt', async t => {
  const s = await setup(t), charges = ledger(), before = s.counters();
  const first = await captureReceipt(s.services, s.folder, { buildId: s.buildId }, { observeCharge: charges.observe });
  assert.equal(first.metrics.pathWork, charges.counts.path); assert.equal(first.metrics.receiptWork, charges.counts.receipt);
  assert.equal(first.metrics.totalWork, charges.counts.path + charges.counts.receipt); assert.equal(first.metrics.work, first.metrics.totalWork);
  assert.ok(charges.counts.path > 0 && charges.counts.receipt > 0);
  const raw = await readFile(first.file, 'utf8'), projection = JSON.parse(JSON.parse(raw).projectionJson);
  assert.ok(projection.graph.edges.some((edge: { kind: string }) => edge.kind === 'event-delivery'));
  assert.equal(projection.graph.nodes.find((node: { id: string }) => node.id === projection.graph.flows[0].nodeIds.at(-1)).kind, 'document-write');
  const ceiling = Math.max(charges.counts.path, charges.counts.receipt);
  await assert.rejects(captureReceipt(s.services, s.folder, { buildId: s.buildId }, { budgetLimits: { work: ceiling } }), { code: 'CAPTURE_WORK_LIMIT' });
  assert.equal(await readFile(first.file, 'utf8'), raw); assert.deepEqual(await readdir(s.folder), [first.receiptId + '.json']);
  assert.equal((await captureReceipt(s.services, s.folder, { buildId: s.buildId })).receiptId, first.receiptId);
  assert.equal(s.counters().gitCalls, before.gitCalls); assert.equal(s.counters().writeCalls, before.writeCalls); assert.equal(s.counters().changedRows, before.changedRows);
});
test('the original capture deadline is checked while the nested reader is yielding', async t => {
  const s = await setup(t); let reached = false;
  const paths = new Paths(s.analysis, { async checkpoint({ stage, budget }: { stage: string; budget: { deadline: number } }) {
    if (stage === 'read' && !reached) { reached = true; await delay(Math.max(0, budget.deadline - performance.now()) + 5); }
  } }); t.after(() => paths.stop());
  await assert.rejects(captureReceipt({ ...s.services, paths }, s.folder, { buildId: s.buildId }, { budgetLimits: { wallMs: 1000 } }), { code: 'CAPTURE_TIME_LIMIT' });
  assert.ok(reached); assert.deepEqual(await readdir(s.folder), []);
  assert.equal((await captureReceipt(s.services, s.folder, { buildId: s.buildId })).status, 'captured');
});
test('cancellation after linking cleans a new receipt and preserves an identical existing receipt', async t => {
  const s = await setup(t), initial = await captureReceipt(s.services, s.folder, { buildId: s.buildId }), raw = await readFile(initial.file, 'utf8');
  for (const existing of [false, true]) {
    if (!existing) await unlink(initial.file); else await captureReceipt(s.services, s.folder, { buildId: s.buildId });
    const controller = new AbortController(); let reached = false;
    await assert.rejects(captureReceipt(s.services, s.folder, { buildId: s.buildId }, { signal: controller.signal,
      afterPublish({ created }: { created: boolean }) { assert.equal(created, !existing); reached = true; controller.abort(); } }), { code: 'CANCELLED' });
    assert.ok(reached); assert.deepEqual(await readdir(s.folder), existing ? [initial.receiptId + '.json'] : []);
    if (existing) assert.equal(await readFile(initial.file, 'utf8'), raw);
  }
});
test('historical shared receipts survive eviction/restart with zero nested path work', async t => {
  const s = await setup(t), saved = await captureReceipt(s.services, s.folder, { buildId: s.buildId }), raw = await readFile(saved.file, 'utf8');
  await s.analyze('replacement'); await s.analyze('eviction'); await s.restart();
  const before = s.counters(), charges = ledger(), history = await readReceipt(s.catalog, s.folder, saved.receiptId, { observeCharge: charges.observe });
  assert.equal(history.metrics.pathWork, 0); assert.equal(history.metrics.totalWork, charges.counts.receipt); assert.equal(charges.counts.path, 0);
  assert.deepEqual(s.counters(), before); assert.equal(await readFile(saved.file, 'utf8'), raw);
  assert.equal(history.status, 'recorded'); assert.equal(history.currentApplicability, 'not-checked');
});
test('closed and foreign budgets refuse before reading facts and request failures release ownership', async t => {
  const s = await setup(t), budget = new CaptureBudget(); budget.close(); const before = s.counters();
  await assert.rejects(s.paths.read({ buildId: s.buildId }, 'paths', undefined, budget), { code: 'CLOSED_CAPTURE_BUDGET' });
  await assert.rejects(s.paths.read({ buildId: s.buildId }, 'paths', undefined, {}), { code: 'INVALID_CAPTURE_BUDGET' });
  assert.equal(s.counters().factReads, before.factReads); assert.equal(s.counters().snapshots, before.snapshots);
  const live = new CaptureBudget(); await s.paths.read({ buildId: s.buildId }, 'paths', undefined, live);
  await assert.rejects(s.paths.read({ buildId: s.buildId }, 'paths', undefined, live), { code: 'CAPTURE_BUDGET_OWNERSHIP' }); live.close();
  assert.equal((await s.paths.read({ buildId: s.buildId })).status, 'available');
});
