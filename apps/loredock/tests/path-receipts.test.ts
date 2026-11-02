import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { SourceGit } from '../src/git.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { CodePaths } from '../src/code-paths.js';
// @ts-expect-error Separate small inputs; the frozen matrix is never executed by tests.
import { receiptFixture } from '../../../scripts/loredock-receipt-fixture.mjs';
// @ts-expect-error Offline candidate only, without a production endpoint/schema.
import { captureReceipt, readReceipt } from '../../../scripts/loredock-path-receipt.mjs';

// Deliberately separate inputs; the frozen Task 071 corpus is never imported by CI/tests.
const corpus = {
  'receipt-client': { 'README.md': '# Receipt regression\n', 'action.ts': 'export function submit() { return fetch("/check", { method: "POST" }); }\n' },
  'receipt-notes': { 'README.md': '# Uncited regression scope\n' },
};
async function setup(t: TestContext, inputs: Record<string, Record<string, string>> = corpus) {
  const parent = await mkdtemp(path.join(tmpdir(), 'receipt-regression-'));
  const s = await receiptFixture(parent, inputs, { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths }); t.after(async () => { await s.close(); await rm(parent, { recursive: true, force: true }); });
  await s.analyze(); return s;
}
test('receipt preserves ordered projection and complete originals after eviction and restart', async t => {
  const s = await setup(t), before = s.counters();
  const first = await captureReceipt(s.services, s.folder, { buildId: s.buildId });
  const second = await captureReceipt(s.services, s.folder, { buildId: s.buildId });
  assert.equal(first.receiptId, second.receiptId); assert.equal(first.metrics.publicationLocks, 1);
  const bytes = await readFile(first.file, 'utf8'), receipt = JSON.parse(bytes), projection = JSON.parse(receipt.projectionJson);
  assert.equal(projection.graph.flows.length, 1); assert.equal(receipt.dependencies.length, 2);
  assert.deepEqual(receipt.originals.map((row: { sourceName: string }) => row.sourceName), ['receipt-client']);
  assert.equal(s.counters().writeCalls, before.writeCalls); assert.equal(s.counters().changedRows, before.changedRows);
  const id = projection.identity.inventoryId; await s.analyze('replacement'); await s.analyze('eviction');
  assert.throws(() => s.analysis.get(id)); await s.restart(); const stable = s.counters();
  const historical = await readReceipt(s.catalog, s.folder, first.receiptId);
  assert.equal(historical.status, 'recorded'); assert.equal(historical.currentApplicability, 'not-checked');
  assert.deepEqual(historical.projection, projection); assert.equal(await readFile(first.file, 'utf8'), bytes);
  assert.deepEqual(s.counters(), stable);
});
test('receipt capture fences a write at handoff and blocks a competing connection under the final guard', async t => {
  const s = await setup(t), second = new DatabaseSync(path.join(s.root, 'data/loredock.db')); t.after(() => second.close());
  await assert.rejects(captureReceipt(s.services, s.folder, { buildId: s.buildId }, { checkpoint({ stage }: { stage: string }) {
    if (stage === 'handoff') second.prepare("UPDATE files SET reason='external-regression' WHERE path='README.md'").run();
  } }), { code: 'RECEIPT_FENCED' });
  assert.deepEqual(await readdir(s.folder), []);
  const captured = await captureReceipt(s.services, s.folder, { buildId: s.buildId }, { insideFence() {
    assert.throws(() => second.prepare("UPDATE files SET reason='blocked' WHERE path='README.md'").run(), /locked/);
  } });
  assert.ok(captured.receiptId);
});
test('receipt rejects malformed/bounded/cancelled work and fences uncited dependencies', async t => {
  const s = await setup(t);
  for (const options of [{ limits: { receiptBytes: 0 } }, { limits: { spans: 0 } }, { limits: { textBytes: 0 } }, { limits: { work: 0 } },
    { limits: { wallMs: 0 } }, { limits: { projectionBytes: 0 } }, { limits: { sources: 1 } }, { limits: { unknown: 1 } }]) {
    await assert.rejects(captureReceipt(s.services, s.folder, { buildId: s.buildId }, options)); assert.deepEqual(await readdir(s.folder), []);
  }
  const controller = new AbortController();
  await assert.rejects(captureReceipt(s.services, s.folder, { buildId: s.buildId }, { signal: controller.signal,
    checkpoint({ stage }: { stage: string }) { if (stage === 'prepared') controller.abort(); } }), { code: 'CANCELLED' });
  assert.deepEqual(await readdir(s.folder), []);
  const captured = await captureReceipt(s.services, s.folder, { buildId: s.buildId });
  const raw = await readFile(captured.file, 'utf8'); await writeFile(captured.file, raw + 'x');
  await assert.rejects(readReceipt(s.catalog, s.folder, captured.receiptId), { code: 'CORRUPT_RECEIPT' }); await writeFile(captured.file, raw);
  s.catalog.revoke(s.catalog.state().sources.find((row: { id: string; name: string }) => row.name === 'receipt-notes').id);
  await assert.rejects(readReceipt(s.catalog, s.folder, captured.receiptId), { code: 'RECEIPT_SCOPE_FENCED' });
});

test('receipt readers reject duplicate keys and invalid UTF-8 even when parsing could hide the edit', async t => {
  const s = await setup(t), result = await captureReceipt(s.services, s.folder, { buildId: s.buildId });
  const raw = await readFile(result.file, 'utf8');
  await writeFile(result.file, '{"receiptHash":' + JSON.stringify(result.receiptId) + ',' + raw.slice(1));
  await assert.rejects(readReceipt(s.catalog, s.folder, result.receiptId), { code: 'CORRUPT_RECEIPT' });
  await writeFile(result.file, Buffer.concat([Buffer.from(raw.slice(0, -1)), Buffer.from([0xff]), Buffer.from('}') ]));
  await assert.rejects(readReceipt(s.catalog, s.folder, result.receiptId), { code: 'CORRUPT_RECEIPT' });
});

test('receipt keeps complete support for a candidate hop without changing its status', async t => {
  const s = await setup(t, {
    caller: { 'README.md': '# Candidate regression\n', 'client.ts': 'export function send() { return fetch("/regression", { method: "POST" }); }\n' },
    handler: { 'README.md': '# Handler regression\n',
      'config/routes.json': JSON.stringify({ routes: [{ method: 'POST', path: '/regression', handler: 'Handler.accept' }] }),
      'Handler.java': 'final class Handler { void accept(String key) {} }\n' },
  });
  const saved = await captureReceipt(s.services, s.folder, { buildId: s.buildId });
  const read = await readReceipt(s.catalog, s.folder, saved.receiptId);
  const edge = read.projection.graph.edges.find((item: { kind: string }) => item.kind === 'http-target');
  assert.ok(edge); assert.equal(edge.status, 'candidate'); assert.equal(read.projection.deploymentCoherence, 'unknown');
  for (const id of edge.evidenceIds) assert.ok(read.originals.some((item: { id: string }) => item.id === id));
  assert.equal(new Set(read.originals.map((item: { sourceName: string }) => item.sourceName)).size, 2);
});
