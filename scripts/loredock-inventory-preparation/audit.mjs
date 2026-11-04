import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { configuration } from '../../apps/loredock/tests/fixtures/prepared-qualification-config.ts';
import { openState, prepareSources } from '../loredock-capture-memory/fixture.mjs';
import { MemoryObserver } from '../loredock-capture-memory/observer.mjs';
import { captureReceipt, readReceipt } from '../loredock-capture-memory/receipt.mjs';

// Independent tiny source/counter audit only. No frozen corpus or resource score.
const root = fileURLToPath(new URL('../../', import.meta.url)), output = process.env.LOREDOCK_INVENTORY_AUDIT_OUTPUT;
assert.ok(output && path.isAbsolute(output)); mkdirSync(output);
const hash = value => createHash('sha256').update(value).digest('hex');
const report = { schemaVersion: 'loredock-inventory-preparation-audit/1', node: process.version, v8: process.versions.v8,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), modelRequests: 0,
  method: 'Instrumented tiny query counts only; no resource acceptance or large-input extrapolation.',
  stages: [], templates: [], errors: [] };
const normalize = error => ({ name: error.name, code: error.code ?? null, message: error.message, stack: error.stack });
const observer = new MemoryObserver(true, { phaseRecords: 64, queryIdentities: 128 });
const save = () => {
  const bytes = JSON.stringify(report, null, 2) + '\n'; assert.ok(Buffer.byteLength(bytes) <= 256 * 1024, 'Audit report bound exceeded.');
  writeFileSync(path.join(output, 'report.json'), bytes);
};
const finishStage = name => {
  const result = observer.end(); assert.equal(result.queries.reduce((sum, row) => sum + row.calls, 0), result.prepareCalls);
  report.stages.push({ name, ...result }); save();
};
function syncStage(name, action) { observer.begin(); try { return action(); } finally { finishStage(name); } }
async function asyncStage(name, action) { observer.begin(); try { return await action(); } finally { finishStage(name); } }
let state, detach;
save();
try {
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '', 'Commit the audit entry point first.');
  const config = await configuration(0), corpus = config.corpusFactory();
  for (const [source, files] of Object.entries(corpus)) for (let index = 0; index < 8; index++)
    files[`audit/marker-${index}.ts`] = `export const inventoryMarker = "${source}/${index}";\n`;
  const values = Object.values(corpus).flatMap(files => Object.values(files));
  report.input = { sources: Object.keys(corpus).length, files: values.length, bytes: values.reduce((sum, text) => sum + Buffer.byteLength(text), 0),
    codeFiles: Object.values(corpus).flatMap(files => Object.keys(files)).filter(file => /\.(?:ts|js|vue|java)$/.test(file)).length,
    sha256: hash(JSON.stringify(corpus)) };
  assert.equal(report.input.sources, 3); assert.ok(report.input.files <= 64 && report.input.bytes <= 64 * 1024); save();
  writeFileSync(path.join(output, 'input.json'), JSON.stringify(corpus) + '\n');
  const receipts = path.join(output, 'receipts'); mkdirSync(receipts);
  state = openState(path.join(output, 'data'), receipts, config.services);
  await prepareSources(output, corpus, state);
  const project = state.catalog.state(), build = state.catalog.start('audit-index', project.sourceSetVersion, project.policyVersion); await state.catalog.idle();
  const initial = state.analysis.start('audit-initial', build.id); await state.analysis.idle();
  assert.ok(state.analysis.get(initial.id).published); assert.equal(state.analysis.get(initial.id).candidates, report.input.codeFiles);
  detach = observer.attach(state.store.db);
  const captured = await asyncStage('reference-capture', () => captureReceipt(state.services, receipts, { buildId: build.id }));
  const firstBytes = readFileSync(captured.file), first = JSON.parse(firstBytes);
  assert.equal(first.originals.length, 10); assert.equal(first.dependencies.length, 3);
  for (const name of ['replacement-one', 'replacement-two']) {
    const next = syncStage(name + '-start', () => state.analysis.start('audit-' + name, build.id));
    // No await between synchronous admission and beginning the worker observation.
    await asyncStage(name + '-worker', () => state.analysis.idle());
    const summary = state.analysis.get(next.id); assert.ok(summary.published); assert.equal(summary.counts.parsed, report.input.codeFiles);
  }
  assert.throws(() => state.analysis.get(initial.id), { code: 'NOT_FOUND' });
  const before = state.counters(), history = await asyncStage('evicted-history', () => readReceipt(state.catalog, receipts, captured.receiptId)), after = state.counters();
  assert.deepEqual(history.projection, JSON.parse(first.projectionJson)); assert.deepEqual(history.originals, first.originals); assert.deepEqual(history.dependencies, first.dependencies);
  assert.equal(history.metrics.pathWork, 0);
  for (const key of ['pathReads', 'factReads', 'snapshots', 'gitCalls', 'writeCalls', 'changedRows']) assert.equal(after[key], before[key]);
  report.history = { receiptId: captured.receiptId, receiptSha256: hash(firstBytes), pathWork: history.metrics.pathWork,
    reads: Object.fromEntries(Object.keys(after).map(key => [key, after[key] - before[key]])) };
  const templates = [...observer.templates.entries()].map(([sql, row]) => ({ sha256: row.sha256, sql, bytes: Buffer.byteLength(sql), kind: sql.trimStart().split(/\s/, 1)[0] }));
  assert.ok(templates.reduce((sum, row) => sum + row.bytes, 0) <= 64 * 1024);
  for (const row of templates) assert.equal(hash(row.sql), row.sha256);
  report.templates = templates; report.completed = true;
} catch (error) { report.errors.push({ phase: 'audit', ...normalize(error) }); }
finally {
  detach?.();
  try { await state?.close(); } catch (error) { report.errors.push({ phase: 'cleanup', ...normalize(error) }); }
  report.failed = !report.completed || report.errors.length > 0; save();
}
console.log(JSON.stringify({ failed: report.failed, input: report.input,
  stages: report.stages.map(row => ({ name: row.name, prepareCalls: row.prepareCalls, identities: row.queries.length })), errors: report.errors }));
process.exitCode = report.failed ? 1 : 0;
