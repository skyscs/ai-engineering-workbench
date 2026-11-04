import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { configuration } from '../../apps/loredock/tests/fixtures/worker-qualification-config.ts';
import { openState, prepareSources } from '../loredock-capture-memory/fixture.mjs';
import { captureReceipt } from '../loredock-capture-memory/receipt.mjs';

// Independent tiny representation counts only. No frozen corpus or resource score.
const root = fileURLToPath(new URL('../../', import.meta.url)), output = process.env.LOREDOCK_REPRESENTATION_OUTPUT;
assert.ok(output && path.isAbsolute(output)); mkdirSync(output);
const hash = value => createHash('sha256').update(value).digest('hex'), bytes = value => Buffer.byteLength(JSON.stringify(value));
const report = { schemaVersion: 'loredock-path-representation-audit/1', node: process.version, v8: process.versions.v8,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), modelRequests: 0,
  method: 'Validated tiny representation counts and serialized bytes, not heap sizes, ownership attribution or resource acceptance.', operations: [], errors: [] };
const save = () => { const raw = JSON.stringify(report, null, 2) + '\n'; assert.ok(Buffer.byteLength(raw) <= 256 * 1024);
  writeFileSync(path.join(output, 'report.json'), raw); };
const normalize = error => ({ name: error.name, code: error.code ?? null, message: error.message, stack: error.stack });
let state, plain, current;
const observer = { enabled: true, attach: () => () => {}, phase(name, counts) {
  if (!current) return; assert.ok(current.phases.length < 64);
  for (const value of Object.values(counts)) assert.ok(value === null || Number.isSafeInteger(value) && value >= 0);
  current.phases.push({ name, counts });
} };
const group = () => ({ files: 0, facts: 0, gaps: 0, evidenceRefs: 0, factsBytes: 0, rangesBytes: 0, evidenceBytes: 0,
  compactBytes: 0, fullBytes: 0, emptyContainers: 0, gapSignatures: {}, emptyShapeSignatures: {} });
save();
try {
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '', 'Commit the audit before execution.');
  const config = await configuration(0), corpus = config.corpusFactory();
  for (const [source, files] of Object.entries(corpus)) for (let index = 0; index < 8; index++)
    files[`representation/marker-${index}.ts`] = `export const representationMarker = "${source}/${index}";\n`;
  const values = Object.values(corpus).flatMap(files => Object.values(files));
  report.input = { sources: Object.keys(corpus).length, files: values.length, bytes: values.reduce((n, text) => n + Buffer.byteLength(text), 0),
    codeFiles: Object.values(corpus).flatMap(files => Object.keys(files)).filter(file => /\.(?:ts|js|vue|java)$/.test(file)).length,
    sha256: hash(JSON.stringify(corpus)) };
  assert.equal(report.input.sources, 3); assert.ok(report.input.files <= 64 && report.input.bytes <= 64 * 1024); save();
  writeFileSync(path.join(output, 'input.json'), JSON.stringify(corpus) + '\n');
  const receipts = path.join(output, 'receipts'); mkdirSync(receipts);
  state = openState(path.join(output, 'data'), receipts, config.services, observer);
  plain = new config.services.CodePaths(state.analysis);
  await prepareSources(output, corpus, state);
  const project = state.catalog.state(), build = state.catalog.start('representation-index', project.sourceSetVersion, project.policyVersion); await state.catalog.idle();
  const inventory = state.analysis.start('representation-facts', build.id); await state.analysis.idle();
  assert.ok(state.analysis.get(inventory.id).published); assert.equal(state.analysis.get(inventory.id).counts.parsed, report.input.codeFiles);
  const read = state.analysis.file.bind(state.analysis);
  state.analysis.file = (...args) => {
    const payload = read(...args); if (!current) return payload;
    const { facts, ranges, evidence } = payload;
    const count = facts.symbols.length + facts.operations.length + facts.calls.length + Object.keys(facts.records).length;
    const target = count ? current.supported : current.factFree;
    target.files++; target.facts += count; target.gaps += facts.gaps.length; target.evidenceRefs += evidence.length;
    for (const [key, value] of Object.entries({ facts, ranges, evidence })) target[key + 'Bytes'] += bytes(value);
    target.compactBytes += bytes({ facts, ranges, evidence }); target.fullBytes += bytes(payload);
    target.emptyContainers += [facts.symbols, facts.operations, facts.calls, facts.records, ranges.symbols, ranges.operations]
      .filter(value => Object.keys(value).length === 0).length;
    const signature = hash(JSON.stringify(facts.gaps)); target.gapSignatures[signature] = (target.gapSignatures[signature] ?? 0) + 1;
    if (!count) {
      const serialized = JSON.stringify({ facts, ranges }), shape = hash(serialized);
      const entry = target.emptyShapeSignatures[shape] ?? { bytes: Buffer.byteLength(serialized), files: 0 };
      entry.files++; target.emptyShapeSignatures[shape] = entry;
      assert.ok(Object.keys(target.emptyShapeSignatures).length <= 32);
    }
    assert.ok(Object.keys(target.gapSignatures).length <= 32); return payload;
  };
  async function operation(paths, selection, kind) {
    const before = state.counters(); let raw, metrics, receiptId;
    if (kind === 'roots') raw = JSON.stringify(await paths.read({ buildId: build.id, ...selection }, 'roots'));
    else {
      const result = await captureReceipt({ ...state.services, paths }, receipts, { buildId: build.id, ...selection });
      raw = readFileSync(result.file, 'utf8'); receiptId = result.receiptId;
      const { wallMs: _wall, ...stable } = result.metrics; metrics = stable;
    }
    const after = state.counters(), reads = Object.fromEntries(Object.keys(after).map(key => [key, after[key] - before[key]]));
    for (const key of ['gitCalls', 'writeCalls', 'changedRows']) assert.equal(reads[key], 0);
    // The caller swaps only the path reader; its wrapper counter naturally differs.
    delete reads.pathReads; return { raw, metrics, receiptId, reads };
  }
  async function pair(name, selection = {}, kind = 'paths') {
    assert.ok(report.operations.length < 8); const expected = await operation(plain, selection, kind);
    current = { name, phases: [], supported: group(), factFree: group() };
    try {
      const actual = await operation(state.paths, selection, kind); assert.deepEqual(actual, expected);
      const value = JSON.parse(actual.raw), projection = kind === 'roots' ? value : JSON.parse(value.projectionJson);
      assert.equal(current.supported.files + current.factFree.files, report.input.codeFiles);
      assert.equal(current.supported.facts, projection.coverage.factEntries);
      Object.assign(current, { rawSha256: hash(actual.raw), rawBytes: Buffer.byteLength(actual.raw), receiptId: actual.receiptId,
        reads: actual.reads, metrics: actual.metrics, coverage: projection.coverage,
        displayedOriginals: kind === 'roots' ? Object.keys(projection.roots.evidence).length : value.originals.length });
      return projection;
    } finally { report.operations.push(current); current = undefined; save(); }
  }
  const first = await pair('default'); await pair('repeat');
  const pin = { inventoryId: first.identity.inventoryId, generationId: first.generationId };
  await pair('selected', { ...pin, rootId: first.roots.items[0].id });
  const page = await pair('page-4', { ...pin, offset: 4 }, 'roots');
  await pair('isolated', { ...pin, rootId: page.roots.items[0].id });
  report.completed = true;
} catch (error) { report.errors.push({ phase: 'audit', ...normalize(error) }); }
finally {
  current = undefined;
  try { await plain?.stop(); await state?.close(); } catch (error) { report.errors.push({ phase: 'cleanup', ...normalize(error) }); }
  report.failed = !report.completed || report.errors.length > 0; save();
}
console.log(JSON.stringify({ failed: report.failed, input: report.input, operations: report.operations.map(row => ({ name: row.name,
  supported: row.supported.files, factFree: row.factFree.files, phases: row.phases.length })), errors: report.errors }));
process.exitCode = report.failed ? 1 : 0;
