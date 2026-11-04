import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { SourceGit } from '../src/git.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { CodePathsV2 } from '../src/code-paths-v2.js';
import { NativeCaptures } from '../src/native-capture.js';
// @ts-expect-error Owned development producer is separate from the offline assessor.
import { produce } from '../../../scripts/loredock-native-assessment/produce.mjs';
// @ts-expect-error Pure offline assessor; no production codecs or service imports.
import { assessSeries, compareSeries, operations } from '../../../scripts/loredock-native-assessment/assess.mjs';
// @ts-expect-error Independently authored native format checks.
import { decodeReceipt, decodeProjection, canonical, hash } from '../../../scripts/loredock-native-assessment/codec.mjs';
// @ts-expect-error Bounded stopped-artifact reader.
import { readArtifact } from '../../../scripts/loredock-native-assessment/artifact.mjs';
// @ts-expect-error Independently checked literal witnesses.
import { directTopic } from '../../../scripts/loredock-native-assessment/projection.mjs';
type Value = Record<string, any>;
const services = { Catalog, CatalogStore, SourceGit, CodeAnalysis, CodePaths: CodePathsV2, NativeCaptures };
const dimension = (value: Value, name: string, key: string) => value.report.operations.find((row: Value) => row.name === name).dimensions[key];
const row = (value: Value, name: string) => value.rows.find((row: Value) => row.name === name);
function reseal(receipt: Value, p = JSON.parse(receipt.projectionJson)) {
  p.generationId = hash(JSON.stringify(p.identity));
  if (p.graph) {
    const mapping = new Map();
    for (const edge of p.graph.edges) { const id = hash(JSON.stringify([p.generationId, 'connected-paths-v2', 'edge', edge.kind, edge.from, edge.to, edge.environment])); mapping.set(edge.id, id); edge.id = id; }
    for (const flow of p.graph.flows) { flow.edgeIds = flow.edgeIds.map((id: string) => mapping.get(id) ?? id); flow.id = hash(JSON.stringify([p.identity.buildId, 'connected-paths-v2', flow.nodeIds[0], flow.edgeIds])); }
    const { inputHash: _, ...body } = p.graph; p.graph.inputHash = hash(JSON.stringify(body));
  }
  const { projectionId: _, ...body } = p; p.projectionId = hash(JSON.stringify(body)); receipt.projectionJson = JSON.stringify(p);
  const { receiptHash: __, ...content } = receipt; return Buffer.from(canonical({ ...content, receiptHash: hash(canonical(content)) }));
}
async function replacement(input: Value, name: string, label: string, bytes: Buffer | string) {
  const copy = structuredClone(input), raw = Buffer.from(bytes), ref = { file: `raw/mutated-${name}-${label}.json`, bytes: raw.length, sha256: hash(raw) };
  await writeFile(path.join(copy.root, ref.file), raw); row(copy, name)[label] = ref; return copy;
}

test('native assessment accepts actual independent inputs and preserves separate failure dimensions', { timeout: 180000 }, async t => {
  const folder = await mkdtemp(path.join(tmpdir(), 'native-assessment-')); let passed = false;
  t.after(async () => { if (passed) await rm(folder, { recursive: true, force: true }); else t.diagnostic(`Retained native assessment inputs: ${folder}`); });
  const positive = await produce(path.join(folder, 'complete'), services), assessed = await assessSeries(positive);
  assert.equal(assessed.report.failed, false, JSON.stringify(assessed.report));
  assert.equal(assessed.report.resources, 'not-evaluated'); assert.equal(assessed.report.currentAuthorization, 'not-evaluated');
  assert.equal(assessed.report.summary.usefulness.required, 7); assert.equal(assessed.report.summary.support.required, 8);
  assert.deepEqual(positive.rows.map((row: Value) => row.name), operations);
  assert.deepEqual(positive.lifecycle, { restarted: true, inventoryEvicted: true });
  const incomplete = await produce(path.join(folder, 'incomplete'), services, true);
  assert.equal((await assessSeries(incomplete)).report.failed, false);
  const wrongOracle = await assessSeries({ ...incomplete, oracle: positive.oracle });
  assert.equal(dimension(wrongOracle, 'first', 'support').state, 'pass'); assert.equal(dimension(wrongOracle, 'first', 'usefulness').state, 'fail');
  assert.equal(dimension(wrongOracle, 'history', 'history').state, 'pass');
  const original = JSON.parse(await readFile(path.join(positive.root, row(positive, 'first').receipt.file), 'utf8'));
  await t.test('unknown fields at every structured boundary fail with recomputed identities', async () => {
    const targets = ['receipt', 'original', 'dependency', 'projection', 'identity', 'analysisLimits', 'pathLimits', 'accounting', 'topicRule',
      'coverage', 'source', 'resolution', 'graph', 'graphCoverage', 'node', 'edge', 'headerCheck', 'topicCheck', 'publisher', 'subscriber', 'flow', 'selection', 'roots', 'root', 'evidence'];
    for (const target of targets) {
      const receipt = structuredClone(original), p = JSON.parse(receipt.projectionJson), g = p.graph, topic = g.edges.find((edge: Value) => edge.topicCheck);
      const values: Value = { receipt, original: receipt.originals[0], dependency: receipt.dependencies[0], projection: p, identity: p.identity,
        analysisLimits: p.identity.analysisLimits, pathLimits: p.identity.limits, accounting: p.identity.accounting, topicRule: p.identity.topicRule,
        coverage: p.coverage, source: p.coverage.sources[0], resolution: p.coverage.resolution, graph: g, graphCoverage: g.coverage,
        node: g.nodes[0], edge: g.edges[0], headerCheck: g.edges.find((edge: Value) => edge.headerCheck).headerCheck,
        topicCheck: topic.topicCheck, publisher: topic.topicCheck.publisher, subscriber: topic.topicCheck.subscriber,
        flow: g.flows[0], selection: p.selection, roots: p.roots, root: p.roots.items[0], evidence: Object.values(g.evidence)[0] };
      values[target].unexpected = true;
      assert.throws(() => decodeReceipt(reseal(receipt, p), positive.metadata.catalogId), target);
    }
  });
  await t.test('rehashed shape, witness, range and complete dependency mutations fail', async () => {
    const mutations: Record<string, (receipt: Value, p: Value) => void> = {
      schema: receipt => { receipt.schemaVersion = 'loredock-shared-capture-receipt/1'; },
      catalog: receipt => { receipt.catalogId = '33333333-3333-4333-8333-333333333333'; },
      oldProjection: (_, p) => { p.schemaVersion = 'loredock-shared-capture-paths/1'; },
      endpoint: (_, p) => { p.graph.edges[0].to = 'a'.repeat(64); },
      role: (_, p) => { p.graph.nodes.find((row: Value) => row.kind === 'event-subscribe').kind = 'document-write'; },
      witness: (_, p) => { p.graph.edges.find((row: Value) => row.topicCheck).topicCheck.value = 'wrong.topic'; },
      expression: (_, p) => { p.graph.edges.find((row: Value) => row.topicCheck).topicCheck.publisher.expression = 'settings.topic'; },
      header: (_, p) => { p.graph.edges.find((row: Value) => row.headerCheck).headerCheck.status = 'gap'; },
      range: receipt => { receipt.originals[0].endLine++; },
      text: receipt => { receipt.originals[0].text += ' altered'; },
      duplicate: receipt => { receipt.originals[1] = receipt.originals[0]; },
      extra: receipt => { receipt.originals.push({ ...receipt.originals[0], id: '33333333-3333-4333-8333-333333333333' }); },
      dependency: receipt => { receipt.dependencies = receipt.dependencies.filter((row: Value) => row.name !== 'z-independent-notes'); },
      traversal: receipt => { receipt.originals[0].path = '../outside'; },
      flow: (_, p) => { p.graph.flows[0].nodeIds.reverse(); },
      coverage: (_, p) => { p.coverage.resolution.nodes++; },
      support: (_, p) => { p.graph.nodes[0].evidenceIds = ['33333333-3333-4333-8333-333333333333']; },
    };
    for (const [name, mutate] of Object.entries(mutations)) {
      const receipt = structuredClone(original), p = JSON.parse(receipt.projectionJson); mutate(receipt, p);
      assert.throws(() => decodeReceipt(reseal(receipt, p), positive.metadata.catalogId), name);
    }
    for (const bytes of [Buffer.from([0xff]), Buffer.from('\ufeff' + canonical(original)), Buffer.from(' '.repeat(655361)),
      Buffer.from('{"receiptHash":' + JSON.stringify(original.receiptHash) + ',' + canonical(original).slice(1)),
      Buffer.from('{"x":'.repeat(42) + '0' + '}'.repeat(42)), Buffer.from('{"x":"\\ud800"}')]) assert.throws(() => decodeReceipt(bytes, positive.metadata.catalogId));
    const p = JSON.parse(original.projectionJson); assert.throws(() => decodeProjection(JSON.stringify(p), 'roots'));
  });
  await t.test('raw comparison survives unsupported shape and does not establish acceptance', async () => {
    const changed = structuredClone(original); changed.schemaVersion = 'unknown/1';
    const input = await replacement(positive, 'first', 'receipt', reseal(changed)), invalid = await assessSeries(input);
    assert.equal(invalid.report.failed, true); assert.equal(dimension(invalid, 'first', 'shape').state, 'fail');
    assert.equal(dimension(invalid, 'history', 'history').reason, 'first-receipt-shape-unavailable');
    const comparison = compareSeries(invalid, invalid); assert.equal(comparison.required, 7); assert.equal(comparison.failed, true);
    assert.ok(comparison.parity.every((row: Value) => row.state === 'pass' && row.meaning === 'byte-equality-only'));
  });
  await t.test('consistent rehashed policy identities still fail separately pinned source authority', async () => {
    const receipt = structuredClone(original), p = JSON.parse(receipt.projectionJson);
    p.identity.policyVersion++; p.graph.policyVersion++;
    const bytes = reseal(receipt, p), changed = JSON.parse(bytes.toString());
    let input = await replacement(positive, 'first', 'receipt', bytes);
    const output = JSON.parse(await readFile(path.join(input.root, row(input, 'first').output.file), 'utf8'));
    output.receiptId = changed.receiptHash; output.metrics.receiptBytes = bytes.length;
    output.metrics.projectionBytes = Buffer.byteLength(changed.projectionJson);
    input = await replacement(input, 'first', 'output', JSON.stringify(output));
    const result = await assessSeries(input);
    assert.equal(dimension(result, 'first', 'shape').state, 'pass');
    assert.equal(dimension(result, 'first', 'support').state, 'fail');
    assert.equal(dimension(result, 'first', 'usefulness').state, 'blocked');
    assert.equal(result.report.failed, true);
  });
  await t.test('damaged outputs or false source/usefulness expectations preserve intact receipt comparisons and history', async () => {
    const broken = await assessSeries(await replacement(positive, 'first', 'output', '{'));
    assert.equal(broken.report.failed, true); assert.equal(dimension(broken, 'first', 'shape').state, 'fail');
    assert.equal(dimension(broken, 'first', 'support').state, 'pass'); assert.equal(dimension(broken, 'history', 'history').state, 'pass');
    for (const what of ['support', 'usefulness']) {
      const input = structuredClone(positive);
      if (what === 'support') input.corpus['b-permit-api']['Grants.java'] += '// A different independently expected file.\n';
      else input.oracle.defaultOriginals++;
      const result = await assessSeries(input); assert.equal(result.report.failed, true); assert.equal(dimension(result, 'first', what).state, 'fail');
      assert.equal(dimension(result, 'history', 'history').state, 'pass'); assert.equal(dimension(result, 'repeat-1', 'rawRepeat').state, 'pass');
      assert.ok(compareSeries(result, assessed).parity.every((row: Value) => row.state === 'pass'));
    }
  });
  await t.test('individually valid changed history fails exact saved-content comparison', async () => {
    const history = JSON.parse(await readFile(path.join(positive.root, row(positive, 'history').output.file), 'utf8'));
    for (const what of ['original', 'dependency', 'id', 'projection']) {
      const copy = structuredClone(history);
      if (what === 'original') { copy.originals[0].contentHash = 'a'.repeat(64); }
      if (what === 'dependency') copy.dependencies[0].tree = 'a'.repeat(40);
      if (what === 'id') copy.receiptId = 'b'.repeat(64);
      if (what === 'projection') { copy.projection.coverage.inventoryCounts.injected = 1;
        copy.projection = JSON.parse(JSON.parse(reseal(original, copy.projection).toString()).projectionJson); }
      const result = await assessSeries(await replacement(positive, 'history', 'output', JSON.stringify(copy)));
      assert.equal(dimension(result, 'history', 'shape').state, 'pass', what);
      assert.equal(dimension(result, 'history', 'history').state, 'fail', what); assert.equal(result.report.failed, true);
    }
  });
  await t.test('missing, duplicate and corrupt artifacts preserve all required denominators', async () => {
    for (const what of ['missing-row', 'duplicate-row', 'missing-file', 'hash', 'bytes', 'metric']) {
      let input = structuredClone(positive);
      if (what === 'missing-row') input.rows.shift();
      if (what === 'duplicate-row') input.rows.push(structuredClone(input.rows[0]));
      if (what === 'missing-file') row(input, 'first').receipt.file = 'raw/absent.json';
      if (what === 'hash') row(input, 'first').receipt.sha256 = 'a'.repeat(64);
      if (what === 'bytes') row(input, 'first').receipt.bytes--;
      if (what === 'metric') { const output = JSON.parse(await readFile(path.join(input.root, row(input, 'first').output.file), 'utf8'));
        output.metrics.spans++; input = await replacement(input, 'first', 'output', JSON.stringify(output)); }
      const result = await assessSeries(input); assert.equal(result.report.failed, true, what);
      assert.equal(result.report.summary.artifact.required, 8); assert.equal(result.report.summary.usefulness.required, 7);
      assert.equal(compareSeries(result, assessed).required, 7);
    }
  });
  passed = true;
});

test('offline topic witnesses reject trailing newlines, escapes and overlong UTF-8 values', () => {
  assert.equal(directTopic('"permit.granted.v3"'), 'permit.granted.v3');
  assert.equal(directTopic('"' + '😀'.repeat(64) + '"'), '😀'.repeat(64));
  for (const value of ['"permit.granted.v3"\n', '"permit.granted.v3"\r\n', '"a\\nb"', '""', 'settings.topic', '"' + '😀'.repeat(65) + '"'])
    assert.throws(() => directTopic(value));
});

test('native artifact reads reject unsafe references, non-files, symlinks and growth or truncation after stat', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'native-artifact-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'raw')); const file = path.join(root, 'raw/test.json'), raw = Buffer.from('{}'); await writeFile(file, raw);
  const ref = { file: 'raw/test.json', bytes: raw.length, sha256: hash(raw) }; assert.deepEqual(await readArtifact(root, ref), raw);
  await mkdir(path.join(root, 'raw/directory.json')); await symlink(file, path.join(root, 'raw/link.json'));
  for (const file of ['../outside.json', '/etc/passwd', 'raw/directory.json', 'raw/link.json']) await assert.rejects(readArtifact(root, { ...ref, file }));
  for (const bytes of [-1, 655361, 1]) await assert.rejects(readArtifact(root, { ...ref, bytes }));
  const alias = path.join(root, 'alias'); await symlink(root, alias); await assert.rejects(readArtifact(alias, ref));
  for (const changed of ['{', '{} extra']) {
    await writeFile(file, raw); await assert.rejects(readArtifact(root, ref, { afterStat: () => writeFile(file, changed) }));
  }
});
