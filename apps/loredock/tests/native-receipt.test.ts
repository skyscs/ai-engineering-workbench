import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { OperationBudget } from '../src/operation-budget.js';
import { decodeNativeReceipt, encodeNativeReceipt, NativeReceiptError, receiptLimits } from '../src/native-receipt.js';
import type { ReceiptProjection, NativeReceiptContent } from '../src/native-receipt-types.js';
import { canonicalJson, catalogId, digest, recordFixture, sealProjection, serialized, sourceId } from './fixtures/native-receipt-record.js';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { SourceGit } from '../src/git.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { CodePathsV2 } from '../src/code-paths-v2.js';
import { corpusFactory } from './fixtures/memory-runner-config.js';
// @ts-expect-error Independent owned tiny source fixture; no measured-family replay.
import { receiptFixture } from '../../../scripts/loredock-capture-scale/fixture.mjs';

const decode = (input: Uint8Array, reductions?: Partial<typeof receiptLimits>) => {
  const budget = new OperationBudget(); try { return decodeNativeReceipt(input, catalogId, budget, reductions); } finally { budget.close(); }
};
function altered(content: NativeReceiptContent, change: (content: NativeReceiptContent, projection: ReceiptProjection) => void) {
  const copy = structuredClone(content), projection = JSON.parse(copy.projectionJson) as ReceiptProjection;
  change(copy, projection); copy.projectionJson = JSON.stringify(sealProjection(projection)); return serialized(copy);
}
const corrupt = (input: Uint8Array) => assert.throws(() => decode(input), NativeReceiptError);

test('independently authored native record round-trips exact canonical bytes and detached Unicode originals', () => {
  const content = recordFixture(), input = serialized(content), result = decode(input);
  assert.equal(result.serialized, input.toString()); assert.equal(result.receipt.projectionJson, content.projectionJson);
  assert.deepEqual(result.receipt.originals, content.originals); assert.deepEqual(result.receipt.dependencies, content.dependencies);
  const budget = new OperationBudget(), encoded = encodeNativeReceipt(content, catalogId, budget);
  assert.equal(encoded.serialized, input.toString()); assert.ok(budget.stats().receiptWork > input.length); budget.check(); budget.close();
  content.originals[0]!.text = 'changed'; content.dependencies[0]!.name = 'changed';
  assert.ok(encoded.receipt.originals[0]!.text.includes('雪')); assert.equal(encoded.receipt.dependencies[0]!.name, 'client');
  input.fill(0); assert.ok(result.serialized.includes('雪'));
});

test('native decoding rejects rehashed structural, nested support and dependency corruption', async t => {
  const content = recordFixture();
  const cases: Record<string, (c: NativeReceiptContent, p: ReceiptProjection) => void> = {
    'unknown receipt field': c => Object.assign(c, { extra: true }),
    'experimental receipt version': c => Object.assign(c, { schemaVersion: 'loredock-shared-capture-receipt/1' }),
    'v1 projection': (_c, p) => Object.assign(p, { schemaVersion: 'loredock-code-paths/1' }),
    'experimental identity': (_c, p) => Object.assign(p.identity, { adapter: 'connected-capture-budget-experiment-v1' }),
    'root page is not a path capture': (_c, p) => Object.assign(p, { kind: 'roots' }),
    'unknown nested identity': (_c, p) => Object.assign(p.identity.accounting, { extra: 1 }),
    'unknown coverage source': (_c, p) => Object.assign(p.coverage.sources[0]!, { extra: 1 }),
    'unknown graph coverage': (_c, p) => Object.assign(p.graph.coverage, { extra: 1 }),
    'unknown root field': (_c, p) => Object.assign(p.roots.items[0]!, { extra: 1 }),
    'unknown original field': c => Object.assign(c.originals[0]!, { extra: 1 }),
    'unknown dependency field': c => Object.assign(c.dependencies[0]!, { extra: 1 }),
    'invalid node kind': (_c, p) => Object.assign(p.graph.nodes[0]!, { kind: 'execution' }),
    'nonstring property': (_c, p) => Object.assign(p.graph.nodes[0]!.properties, { secret: 4 }),
    'negative counter': (_c, p) => { p.coverage.scannedFiles = -1; },
    'unsafe integer': (_c, p) => { p.coverage.scannedFiles = Number.MAX_SAFE_INTEGER + 1; },
    'increased saved limit': (_c, p) => { p.identity.limits.nodes = 161; p.graph.limits.nodes = 161; },
    'saved limits disagree': (_c, p) => { p.graph.limits.nodes--; },
    'missing dependency': c => { c.dependencies = []; },
    'duplicate dependency': c => { c.dependencies.push(c.dependencies[0]!); },
    'wrong dependency name': c => { c.dependencies[0]!.name = 'foreign'; },
    'wrong dependency revision': c => { c.dependencies[0]!.revision = '3'.repeat(40); },
    'wrong dependency status': c => { c.dependencies[0]!.status = 'failed'; },
    'missing dependency tree': c => { c.dependencies[0]!.tree = null; },
    'missing original': c => { c.originals = []; },
    'duplicate original': c => { c.originals.push(c.originals[0]!); },
    'wrong original source': c => { c.originals[0]!.sourceId = catalogId; },
    'wrong original build': c => { c.originals[0]!.buildId = catalogId; },
    'wrong span hash': c => { c.originals[0]!.spanHash = '0'.repeat(64); },
    'wrong original range': c => { c.originals[0]!.endLine++; },
    'nonhex blob': c => { c.originals[0]!.blobId = 'bad'; },
    'node outside original lines': (_c, p) => { p.graph.nodes[0]!.endLine = 3; Object.assign(p.roots.items[0]!, { endLine: 3 }); },
    'wrong node source': (_c, p) => { p.graph.nodes[0]!.sourceId = catalogId; Object.assign(p.roots.items[0]!, { sourceId: catalogId }); },
    'path traversal': (_c, p) => { p.graph.nodes[0]!.path = '../private'; },
    'empty node support': (_c, p) => { p.graph.nodes[0]!.evidenceIds = []; },
    'duplicate node support': (_c, p) => { p.graph.nodes[0]!.evidenceIds.push(p.graph.nodes[0]!.evidenceIds[0]!); },
    'missing graph reference': (_c, p) => { p.graph.evidence = {}; },
    'missing root reference': (_c, p) => { p.roots.evidence = {}; },
    'dictionary ID mismatch': (_c, p) => { Object.values(p.graph.evidence)[0]!.id = catalogId; },
    'graph/root original disagreement': (_c, p) => { Object.values(p.roots.evidence)[0]!.path = 'foreign.ts'; },
    'unused original reference': (c, p) => { const ref = { ...Object.values(p.graph.evidence)[0]!, id: catalogId }; p.graph.evidence[catalogId] = ref; c.originals.push({ ...c.originals[0]!, id: catalogId }); c.originals.sort((a, b) => a.id.localeCompare(b.id)); },
    'unused graph node': (_c, p) => { p.graph.nodes.push({ ...p.graph.nodes[0]!, id: '8'.repeat(64) }); p.graph.coverage.resolutionNodes++; p.coverage.resolution.nodes++; },
    'missing flow': (_c, p) => { p.graph.flows = []; },
    'duplicate flow': (_c, p) => { p.graph.flows.push(p.graph.flows[0]!); },
    'foreign flow node': (_c, p) => { p.graph.flows[0]!.nodeIds = ['0'.repeat(64)]; },
    'cycle in flow': (_c, p) => { p.graph.flows[0]!.nodeIds.push(p.graph.flows[0]!.nodeIds[0]!); },
    'wrong flow support': (_c, p) => { p.graph.flows[0]!.evidenceIds = [catalogId]; },
    'wrong selected root': (_c, p) => { p.graph.coverage.selectedRoots = ['0'.repeat(64)]; },
    'root metadata disagrees': (_c, p) => { Object.assign(p.roots.items[0]!, { label: 'wrong' }); },
    'root page offset': (_c, p) => { p.roots.offset = 4; },
    'root next page': (_c, p) => { p.roots.next = 4; },
    'root missing item': (_c, p) => { p.roots.items = []; },
    'wrong source coverage': (_c, p) => { p.coverage.sources[0]!.sourceId = catalogId; },
    'duplicated source coverage': (_c, p) => { p.coverage.sources.push(p.coverage.sources[0]!); },
    'incomplete scan': (_c, p) => { p.coverage.scannedFiles--; },
    'resolution counts disagree': (_c, p) => { p.coverage.resolution.nodes++; },
    'stale flag disagrees': (_c, p) => { p.graph.stale = true; },
    'policy versions disagree': (_c, p) => { p.graph.policyVersion++; },
  };
  for (const [name, change] of Object.entries(cases)) await t.test(name, () => corrupt(altered(content, change)));
});

test('native integrity identities and outer canonicalization are checked independently', () => {
  const content = recordFixture(), projection = JSON.parse(content.projectionJson) as ReceiptProjection;
  for (const field of ['generationId', 'projectionId'] as const) { const copy = structuredClone(projection); copy[field] = '0'.repeat(64); corrupt(serialized({ ...content, projectionJson: JSON.stringify(copy) })); }
  for (const change of [(p: ReceiptProjection) => { p.graph.inputHash = '0'.repeat(64); }, (p: ReceiptProjection) => { p.graph.flows[0]!.id = '0'.repeat(64); }]) {
    const copy = structuredClone(projection); change(copy); const { projectionId: _id, ...rest } = copy; copy.projectionId = digest(JSON.stringify(rest));
    if (copy.graph.flows[0]!.id === '0'.repeat(64)) { const { inputHash: _graph, ...g } = copy.graph; copy.graph.inputHash = digest(JSON.stringify(g)); const { projectionId: _next, ...next } = copy; copy.projectionId = digest(JSON.stringify(next)); }
    corrupt(serialized({ ...content, projectionJson: JSON.stringify(copy) }));
  }
  const input = serialized(content); corrupt(Buffer.from(input.toString().replace(/"receiptHash":"[a-f0-9]+"/, '"receiptHash":"' + '0'.repeat(64) + '"')));
  corrupt(Buffer.from(' ' + input)); corrupt(Buffer.from(input.toString().replace('{', '{"catalogId":"' + catalogId + '",')));
  corrupt(serialized({ ...content, projectionJson: ' ' + content.projectionJson }));
  const budget = new OperationBudget(); assert.throws(() => decodeNativeReceipt(input, sourceId, budget), { code: 'RECEIPT_CATALOG_MISMATCH' }); budget.close();
});

test('UTF-8, depth, exact byte and reduced bounds fail without changing caller budgets', async () => {
  const content = recordFixture(), input = serialized(content), textBytes = Buffer.byteLength(content.originals[0]!.text);
  const exact = { receiptBytes: input.length, projectionBytes: Buffer.byteLength(content.projectionJson), textBytes, sources: 1, spans: 1 };
  assert.equal(decode(input, exact).serialized, input.toString());
  for (const key of Object.keys(exact) as (keyof typeof exact)[]) assert.throws(() => decode(input, { ...exact, [key]: exact[key] - 1 }), NativeReceiptError);
  assert.throws(() => decode(input, { depth: 1 }), { code: 'RECEIPT_DEPTH_LIMIT' });
  assert.throws(() => decode(input, { receiptBytes: receiptLimits.receiptBytes + 1 }), { code: 'INVALID_RECEIPT_LIMIT' });
  assert.throws(() => decode(input, { receiptBytes: -1 }), { code: 'INVALID_RECEIPT_LIMIT' });
  assert.throws(() => decode(input, { receiptBytes: 1.5 }), { code: 'INVALID_RECEIPT_LIMIT' });
  corrupt(Buffer.from([0xc3, 0x28])); corrupt(Buffer.from('\ufeff' + input)); corrupt(Buffer.from('{"x":"\\ud800"}'));
  corrupt(Buffer.from('{"x":1e999}')); corrupt(Buffer.from('['.repeat(41) + '0' + ']'.repeat(41)));
  const budget = new OperationBudget(); decodeNativeReceipt(input, catalogId, budget); const units = budget.stats().receiptWork; budget.close();
  const exactWork = new OperationBudget({ limits: { work: units + 7 } }); exactWork.charge('path', 7);
  decodeNativeReceipt(input, catalogId, exactWork); assert.equal(exactWork.stats().totalWork, units + 7); exactWork.check(); exactWork.close();
  const tooLittle = new OperationBudget({ limits: { work: units + 6 } }); tooLittle.charge('path', 7);
  assert.throws(() => decodeNativeReceipt(input, catalogId, tooLittle), { code: 'CAPTURE_WORK_LIMIT' }); tooLittle.close();
  assert.throws(() => decodeNativeReceipt(input, catalogId, exactWork), { code: 'CLOSED_CAPTURE_BUDGET' });
  const controller = new AbortController(), cancelled = new OperationBudget({ signal: controller.signal }); controller.abort();
  assert.throws(() => decodeNativeReceipt(input, catalogId, cancelled), { code: 'CANCELLED' }); cancelled.close();
  const expired = new OperationBudget({ limits: { wallMs: 1 } }); await delay(5);
  assert.throws(() => decodeNativeReceipt(input, catalogId, expired), { code: 'CAPTURE_TIME_LIMIT' }); expired.close();
  assert.throws(() => decodeNativeReceipt(input, catalogId, {} as OperationBudget), { code: 'INVALID_CAPTURE_BUDGET' });
});

interface State { root: string; buildId: string; catalog: Catalog; store: CatalogStore; analysis: CodeAnalysis; paths: CodePathsV2; analyze(key?: string): Promise<string>; close(): Promise<void> }
test('actual native v2 default, selected and isolated records preserve all support and refuse rehashed topic/edge corruption', async t => {
  const folder = await mkdtemp(path.join(tmpdir(), 'native-receipt-')), state = await receiptFixture(folder, corpusFactory(), { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths: CodePathsV2 }) as State;
  t.after(async () => { await state.close(); await rm(folder, { recursive: true, force: true }); }); await state.analyze();
  const first = await state.paths.read({ buildId: state.buildId }); assert.ok(first.status === 'available' && first.graph);
  const page = await state.paths.read({ buildId: state.buildId, offset: 4 }, 'roots'); assert.ok(page.status === 'available');
  let complete: NativeReceiptContent | undefined;
  for (const rootId of [undefined, first.roots.items[0]!.id, page.roots.items[0]!.id]) {
    const budget = new OperationBudget();
    const projection = await state.paths.read({ buildId: state.buildId, ...(rootId ? { rootId } : {}) }, 'paths', undefined, budget);
    assert.ok(projection.status === 'available' && projection.graph);
    const evidence = Object.keys({ ...projection.graph.evidence, ...projection.roots.evidence }).sort();
    const originals = evidence.map(id => { const { snippet: _s, metadata: _m, ...item } = state.catalog.evidence(id); return item; });
    const dependencies = state.store.buildSources(state.buildId).map(({ sourceId, name, revision, tree, status, omitted }) => ({ sourceId, name, revision, tree, status, omitted })).sort((a, b) => a.sourceId < b.sourceId ? -1 : 1);
    const content: NativeReceiptContent = { schemaVersion: 'loredock-code-path-receipt/1', catalogId, projectionJson: JSON.stringify(projection), originals, dependencies };
    const before = state.store.one<{ n: number }>('SELECT total_changes() n')!.n;
    const encoded = encodeNativeReceipt(content, catalogId, budget); assert.equal(encoded.serialized, serialized(content).toString());
    assert.deepEqual(encoded.projection, projection); assert.equal(state.store.one<{ n: number }>('SELECT total_changes() n')!.n, before);
    assert.ok(budget.stats().pathWork > 0 && budget.stats().receiptWork > 0); budget.close();
    if (rootId === undefined) complete = content;
  }
  assert.ok(complete);
  const changes: Record<string, (c: NativeReceiptContent, p: ReceiptProjection) => void> = {
    'missing witness': (_c, p) => { delete p.graph.edges.find(e => e.kind === 'event-delivery')!.topicCheck; },
    'dynamic topic': (_c, p) => { p.graph.edges.find(e => e.topicCheck)!.topicCheck!.publisher.expression = 'configuration.topic'; },
    'different topic value': (_c, p) => { p.graph.edges.find(e => e.topicCheck)!.topicCheck!.value = 'other.topic'; },
    'foreign witness support': (_c, p) => { p.graph.edges.find(e => e.topicCheck)!.topicCheck!.publisher.evidenceIds = [catalogId]; },
    'wrong witness rule': (_c, p) => { Object.assign(p.graph.edges.find(e => e.topicCheck)!.topicCheck!, { rule: 'settings/1' }); },
    'extra witness field': (_c, p) => { Object.assign(p.graph.edges.find(e => e.topicCheck)!.topicCheck!.publisher, { extra: true }); },
    'runtime status': (_c, p) => { Object.assign(p.graph.edges[0]!, { status: 'observed' }); },
    'wrong endpoint': (_c, p) => { p.graph.edges[0]!.to = '0'.repeat(64); },
    'missing edge support': (_c, p) => { p.graph.edges.find(e => e.topicCheck)!.evidenceIds = [p.graph.edges.find(e => e.topicCheck)!.evidenceIds[0]!]; },
    'broken flow': (_c, p) => { p.graph.flows[0]!.edgeIds.reverse(); },
    'literal absent from originals': (c, p) => {
      const witness = p.graph.edges.find(e => e.topicCheck)!.topicCheck!;
      for (const id of witness.publisher.evidenceIds) { const item = c.originals.find(o => o.id === id)!; item.text = item.text.replaceAll(witness.publisher.expression, '"absent"'); item.spanHash = digest(item.text); }
    },
  };
  for (const [name, change] of Object.entries(changes)) await t.test(name, () => corrupt(altered(complete!, change)));
  // Decode is entirely source-independent, even once inventories have been replaced.
  await state.analyze('codec-replacement-one'); await state.analyze('codec-replacement-two');
  assert.equal(decode(serialized(complete)).receipt.projectionJson, complete.projectionJson);
});
