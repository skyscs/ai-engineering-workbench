import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, corpusFactory } from './fixtures/memory-runner-config.js';
import type { CodePathCoverage, CodePathRootPage, CodePathGraph } from '../src/code-paths-types.js';
// @ts-expect-error Input-independent observation checks; no frozen matrix or resource acceptance.
import { validateObservation, validateProjection } from '../../../scripts/loredock-capture-memory/validate.mjs';

const execute = promisify(execFile), hash = (value: string) => createHash('sha256').update(value).digest('hex');
const child = fileURLToPath(new URL('../../../scripts/loredock-memory-runner/child.mjs', import.meta.url));
const configuration = fileURLToPath(new URL('./fixtures/memory-runner-config.ts', import.meta.url));
const cwd = fileURLToPath(new URL('../', import.meta.url));
const operations = ['first', 'repeat-1', 'repeat-2', 'repeat-3', 'selected', 'page-4', 'isolated', 'history'];
interface Artifact { file: string; bytes: number; sha256: string }
interface Operation { name: string; artifact: Artifact; receipt?: Artifact }
interface Report { pid: number; operations: Operation[]; errors: { message: string }[]; initialHashes: unknown; evicted: string }
interface Projection {
  identity: { inventoryId: string }; coverage: CodePathCoverage; roots: CodePathRootPage;
  graph: Pick<CodePathGraph, 'nodes' | 'edges' | 'flows' | 'evidence'> | null;
}
interface Original { id: string; sourceName: string; path: string; revision: string; startLine: number; endLine: number;
  text: string; contentHash: string; spanHash: string; blobId: string }
interface Receipt { projectionJson: string; originals: Original[]; dependencies: { name: string }[] }

async function launch(root: string, arm: string) {
  let result;
  try {
    result = { code: 0, signal: null, ...await execute(process.execPath, ['--import', 'tsx', child, root, arm, configuration],
      { cwd, encoding: 'utf8', timeout: 60000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 }) };
  } catch (cause) {
    const error = cause as { code: number | string; signal: string | null; stdout: string; stderr: string };
    result = { code: error.code, signal: error.signal, stdout: error.stdout, stderr: error.stderr };
  }
  await writeFile(path.join(root, `${arm}-exit.json`), JSON.stringify(result, null, 2));
  return result;
}
async function artifact(folder: string, item: Artifact) {
  const text = await readFile(path.join(folder, item.file), 'utf8');
  assert.equal(Buffer.byteLength(text), item.bytes); assert.equal(hash(text), item.sha256);
  return text;
}
function checkReceipt(text: string, name: string, revisions: Record<string, string>) {
  const receipt: Receipt = JSON.parse(text), p: Projection = JSON.parse(receipt.projectionJson), corpus = corpusFactory();
  validateProjection(p); assert.ok(p.graph);
  assert.equal(p.coverage.scannedFiles, 8); assert.equal(p.coverage.metadataEntries, 14); assert.equal(p.coverage.factEntries, 21);
  assert.equal(p.roots.total, 5);
  assert.deepEqual(receipt.dependencies.map(row => row.name).sort(), Object.keys(corpus).sort());
  const originals = new Map(receipt.originals.map(row => [row.id, row]));
  assert.equal(originals.size, receipt.originals.length);
  assert.deepEqual(Object.keys({ ...p.graph.evidence, ...p.roots.evidence }).sort(), [...originals.keys()].sort());
  for (const original of originals.values()) {
    const source = corpus[original.sourceName]?.[original.path]; assert.equal(typeof source, 'string');
    assert.equal(original.contentHash, hash(source!)); assert.equal(original.revision, revisions[original.sourceName]);
    assert.equal(original.text, source!.split('\n').slice(original.startLine - 1, original.endLine).join('\n'));
    assert.equal(original.spanHash, hash(original.text));
    assert.equal(original.blobId, createHash('sha1').update(`blob ${Buffer.byteLength(source!)}\0`).update(source!).digest('hex'));
  }
  for (const item of [...p.graph.nodes, ...p.graph.edges, ...p.graph.flows]) {
    assert.ok(item.evidenceIds.length); assert.ok(item.evidenceIds.every(id => originals.has(id)));
  }
  for (const flow of p.graph.flows) {
    assert.equal(flow.nodeIds.length - 1, flow.edgeIds.length);
    flow.edgeIds.forEach((id, index) => {
      const edge = p.graph!.edges.find(row => row.id === id); assert.ok(edge);
      assert.equal(edge.from, flow.nodeIds[index]); assert.equal(edge.to, flow.nodeIds[index + 1]);
    });
    assert.equal(p.graph.nodes.find(node => node.id === flow.nodeIds.at(-1))?.kind, name === 'isolated' ? 'symbol' : 'document-write');
  }
  if (name === 'isolated') {
    assert.equal(p.graph.nodes.length, 1); assert.equal(p.graph.edges.length, 0); assert.equal(p.graph.flows.length, 1);
    assert.equal(p.graph.nodes[0]!.label, 'locate'); assert.equal(p.graph.nodes[0]!.path, 'ui/ZZLocate.vue');
    assert.ok(p.coverage.omissions['unresolved-import']);
  } else {
    assert.equal(p.graph.flows.length, name === 'selected' ? 1 : 2);
    for (const kind of ['http-request', 'handler-reference', 'event-publish', 'event-subscribe', 'document-write'])
      assert.ok(p.graph.nodes.some(node => node.kind === kind), kind);
    assert.ok(p.graph.nodes.some(node => node.label === 'book' && node.path === 'ui/AABook.vue'));
    assert.ok(p.graph.edges.some(edge => edge.kind === 'event-delivery' && edge.status === 'candidate'));
  }
  return receipt.projectionJson;
}

test('separate diagnostic processes retain all captures, JSON source headers and evicted history', { timeout: 210000 }, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'memory-runner-regression-'));
  let passed = false;
  t.after(async () => { if (passed) await rm(root, { recursive: true, force: true }); else t.diagnostic(`Retained child reports and exits: ${root}`); });
  const pids = new Set<number>(), baseline = new Map<string, string>();
  for (const arm of config.oracle.arms) {
    const exit = await launch(root, arm); assert.equal(exit.code, 0, JSON.stringify(exit)); assert.equal(exit.signal, null);
    const folder = path.join(root, arm), report: Report = JSON.parse(await readFile(path.join(folder, 'result.json'), 'utf8'));
    const metadata = JSON.parse(await readFile(path.join(root, 'metadata.json'), 'utf8'));
    pids.add(report.pid); assert.notEqual(report.pid, process.pid);
    assert.deepEqual(report.errors, []); assert.deepEqual(report.initialHashes, metadata.initialHashes);
    assert.equal(report.evicted, metadata.inventory.id);
    assert.deepEqual(report.operations.map(row => row.name), operations);
    let firstProjection: string | undefined, firstReceipt: string | undefined;
    for (const operation of report.operations) {
      validateObservation(operation, arm, config.oracle);
      const raw = JSON.parse(await artifact(folder, operation.artifact)); assert.equal(raw.error, null); assert.equal(raw.observerError, null);
      let parity: string;
      if (operation.receipt) {
        parity = await artifact(folder, operation.receipt);
        const projection = checkReceipt(parity, operation.name, metadata.revisions);
        if (operation.name === 'first') { firstProjection = projection; firstReceipt = parity; }
        if (operation.name.startsWith('repeat-')) assert.equal(parity, firstReceipt);
      } else {
        assert.ok(['page-4', 'history'].includes(operation.name));
        parity = JSON.stringify(raw.result.projection); validateProjection(raw.result.projection);
        if (operation.name === 'history') { assert.equal(raw.result.status, 'recorded'); assert.equal(parity, firstProjection); }
        else {
          assert.equal(raw.result.status, 'available'); assert.equal(raw.result.projection.roots.offset, 4);
          assert.equal(raw.result.projection.roots.items.length, 1); assert.equal(raw.result.projection.roots.items[0].label, 'locate');
        }
      }
      if (arm === 'same-process') baseline.set(operation.name, parity);
      else assert.equal(parity, baseline.get(operation.name), `${arm}/${operation.name} byte parity`);
    }
  }
  assert.equal(pids.size, 3); assert.equal(baseline.size, 8);

  // A valid stopped catalog must still refuse altered serialized source columns.
  const invalid = path.join(root, 'changed-header'); await mkdir(invalid);
  await cp(path.join(root, 'initial-data'), path.join(invalid, 'reopened-process', 'data'), { recursive: true });
  const metadata = JSON.parse(await readFile(path.join(root, 'metadata.json'), 'utf8'));
  metadata.sources[0].name = 'changed-source-name';
  await writeFile(path.join(invalid, 'metadata.json'), JSON.stringify(metadata));
  const exit = await launch(invalid, 'reopened-process'); assert.equal(exit.code, 1); assert.equal(exit.signal, null);
  assert.match(exit.stderr, /Recorded source rows differ/);
  const refused: Report = JSON.parse(await readFile(path.join(invalid, 'reopened-process', 'result.json'), 'utf8'));
  assert.equal(refused.operations.length, 0); assert.equal(refused.errors.length, 1); assert.match(refused.errors[0]!.message, /column values/);
  passed = true;
});
