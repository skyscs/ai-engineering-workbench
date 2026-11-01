import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { type AnalysisLimits, type AnalysisUnit } from '../src/code-analysis-types.js';
import { codeAnalysisFingerprint, factRanges } from '../src/code-analysis-facts.js';
import { typescriptFacts } from '../src/code-typescript.js';
import { codeFlows } from '../src/code-flows.js';
import { removeCodeAnalysisSchema } from './legacy-schema.js';
import { sha256 } from '../src/extract.js';
// @ts-expect-error Owned fixture generation is plain JavaScript.
import { createLoreDockFixture } from '../../../scripts/loredock-fixture.mjs';
// @ts-expect-error Owned volume-shape generation is plain JavaScript.
import { createCapacityFixture } from '../../../scripts/loredock-capacity-fixture.mjs';

async function setup(t: TestContext, initialLimits: Partial<AnalysisLimits> = {}) {
  const fixture = await createLoreDockFixture() as { root: string };
  const directory = path.join(fixture.root, 'analysis-data');
  let store = new CatalogStore(directory), catalog = new Catalog(store), analysis = new CodeAnalysis(catalog, initialLimits);
  t.after(async () => { await analysis.stop(); await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  for (const source of ['portal', 'order-api', 'order-worker']) await catalog.addSource(path.join(fixture.root, 'sources', source));
  const index = async (requestId: string) => {
    const state = catalog.state(), build = catalog.start(requestId, state.sourceSetVersion, state.policyVersion);
    await catalog.idle(); return build.id;
  };
  const buildId = await index('initial');
  return { directory, fixture, buildId, index, get store() { return store; }, get catalog() { return catalog; }, get analysis() { return analysis; },
    replace: async (limits: Partial<AnalysisLimits> = {}) => { await analysis.stop(); analysis = new CodeAnalysis(catalog, limits); },
    restart: async (limits: Partial<AnalysisLimits> = initialLimits) => {
      await analysis.stop(); await catalog.stop(); store.close(); store = new CatalogStore(directory); catalog = new Catalog(store); analysis = new CodeAnalysis(catalog, limits);
    } };
}
async function pauseAfterFile(state: Awaited<ReturnType<typeof setup>>, requestId = 'pause') {
  const run = state.analysis.start(requestId, state.buildId); await yieldTurn(); state.analysis.control(run.id, 'pause'); await state.analysis.idle();
  assert.equal(state.analysis.get(run.id).counts.parsed, 1); return run.id;
}

test('durable code facts retain original ranges across restart without changing sampled graphs or answers', async t => {
  const s = await setup(t), before = codeFlows(s.catalog), run = s.analysis.start('all', s.buildId);
  assert.equal(s.analysis.start('all', s.buildId).id, run.id);
  assert.throws(() => s.analysis.start('other', s.buildId), { code: 'BUSY' });
  assert.throws(() => new CodeAnalysis(s.catalog), { code: 'BUSY' });
  await s.analysis.idle(); const completed = s.analysis.get(run.id);
  assert.equal(completed.candidates, 5); assert.equal(completed.counts.parsed, 5); assert.equal(completed.published, true);
  const files = s.analysis.files(run.id), facts = files.map(file => s.analysis.file(run.id, file.fileId));
  assert.ok(facts.every(file => file.evidence.length > 0 && file.fingerprint === codeAnalysisFingerprint()));
  for (const file of facts) for (const original of file.evidence) {
    const checked = s.catalog.evidence(original.id); assert.equal(checked.buildId, s.buildId); assert.equal(checked.path, file.path); assert.equal(checked.sourceId, file.sourceId);
  }
  assert.deepEqual(codeFlows(s.catalog), before); assert.equal(s.store.all('SELECT id FROM answer_attempts').length, 0);
  await s.restart(); assert.deepEqual(files.map(file => s.analysis.file(run.id, file.fileId)), facts);
  assert.deepEqual(s.analysis.get(run.id), completed); assert.equal(s.analysis.start('all', s.buildId).id, run.id);
  const fresh = await s.index('refresh'); assert.throws(() => s.analysis.start('all', fresh), { code: 'CONFLICT' });
  const second = s.analysis.start('fresh', fresh); await s.analysis.idle();
  const freshFacts = s.analysis.files(second.id).map(file => s.analysis.file(second.id, file.fileId));
  assert.deepEqual(freshFacts.map(file => file.facts), facts.map(file => file.facts));
  assert.ok(freshFacts.every(file => file.buildId === fresh && !facts.some(old => old.fileId === file.fileId)));
  assert.equal(s.analysis.get(run.id).published, true);
});

test('pause, shutdown and recovery resume only validated units on the same pinned inventory', async t => {
  const s = await setup(t), id = await pauseAfterFile(s);
  const original = s.store.one<AnalysisUnit>("SELECT * FROM code_analysis_files WHERE runId=? AND status='parsed'", id)!;
  const progress = s.analysis.get(id); assert.equal(progress.status, 'paused'); assert.equal(progress.published, false);
  assert.throws(() => s.analysis.file(id, original.fileId), { code: 'NOT_READY' });
  await s.analysis.stop();
  // Simulate the durable state left by a process loss, without leaving an owned worker alive.
  s.store.run("UPDATE code_analyses SET status='running' WHERE id=?", id);
  await s.restart(); assert.equal(s.analysis.get(id).status, 'interrupted');
  await yieldTurn(); assert.equal(s.analysis.get(id).counts.parsed, 1);
  s.analysis.control(id, 'resume'); await s.analysis.idle(); assert.equal(s.analysis.get(id).counts.parsed, 5);
  assert.deepEqual(s.store.one('SELECT * FROM code_analysis_files WHERE runId=? AND fileId=?', id, original.fileId), original);
  assert.ok(s.analysis.get(id).elapsedMs >= progress.elapsedMs);
  const race = s.analysis.start('resume-race', s.buildId);
  s.analysis.control(race.id, 'pause'); s.analysis.control(race.id, 'resume');
  await s.analysis.idle(); assert.equal(s.analysis.get(race.id).counts.parsed, 5);
  const next = s.analysis.start('stop', s.buildId); await yieldTurn(); await s.analysis.stop();
  assert.equal(s.analysis.get(next.id).status, 'interrupted'); assert.equal(s.analysis.get(next.id).counts.parsed, 1);
  await s.restart(); s.analysis.control(next.id, 'cancel'); assert.equal(s.analysis.get(next.id).status, 'cancelled');
  assert.throws(() => s.analysis.control(next.id, 'resume'), { code: 'CONFLICT' });
});

test('resume and fact reads reject corrupt payloads, original bytes, manifests, counters and parser identity', async t => {
  const s = await setup(t), id = await pauseAfterFile(s);
  const unit = s.store.one<AnalysisUnit>("SELECT * FROM code_analysis_files WHERE runId=? AND status='parsed'", id)!;
  s.store.run("UPDATE code_analysis_files SET payload='{}' WHERE runId=? AND fileId=?", id, unit.fileId);
  assert.throws(() => s.analysis.control(id, 'resume'), { code: 'CORRUPT_CODE_CHECKPOINT' });
  s.store.run('UPDATE code_analysis_files SET payload=? WHERE runId=? AND fileId=?', unit.payload, id, unit.fileId);
  const raw = s.store.one<{ raw: Uint8Array }>('SELECT raw FROM files WHERE id=?', unit.fileId)!.raw;
  s.store.run('UPDATE files SET raw=? WHERE id=?', Buffer.alloc(raw.length, 97), unit.fileId);
  assert.throws(() => s.analysis.control(id, 'resume'), { code: 'CORRUPT_EVIDENCE' });
  s.store.run('UPDATE files SET raw=? WHERE id=?', raw, unit.fileId);
  const span = s.store.one<{ id: string; hash: string }>('SELECT id,hash FROM spans WHERE fileId=? LIMIT 1', unit.fileId)!;
  s.store.run("UPDATE spans SET hash='damaged' WHERE id=?", span.id); assert.throws(() => s.analysis.control(id, 'resume'), { code: 'CORRUPT_EVIDENCE' });
  s.store.run('UPDATE spans SET hash=? WHERE id=?', span.hash, span.id);
  const row = s.store.one<{ manifestHash: string; fingerprint: string; textBytes: number }>('SELECT * FROM code_analyses WHERE id=?', id)!;
  s.store.run("UPDATE code_analyses SET manifestHash='damaged' WHERE id=?", id); assert.throws(() => s.analysis.control(id, 'resume'), { code: 'CORRUPT_CODE_CHECKPOINT' });
  s.store.run('UPDATE code_analyses SET manifestHash=?,textBytes=textBytes+1 WHERE id=?', row.manifestHash, id); assert.throws(() => s.analysis.control(id, 'resume'), { code: 'CORRUPT_CODE_CHECKPOINT' });
  s.store.run("UPDATE code_analyses SET textBytes=?,fingerprint='old-parser' WHERE id=?", row.textBytes, id); assert.throws(() => s.analysis.control(id, 'resume'), { code: 'PARSER_CHANGED' });
  s.store.run('UPDATE code_analyses SET fingerprint=? WHERE id=?', row.fingerprint, id);
  s.analysis.control(id, 'resume'); await s.analysis.idle();
  s.store.run("UPDATE code_analysis_files SET payload='damaged' WHERE runId=? AND fileId=?", id, unit.fileId);
  assert.throws(() => s.analysis.file(id, unit.fileId), { code: 'CORRUPT_CODE_CHECKPOINT' });
  s.store.run('UPDATE code_analysis_files SET payload=? WHERE runId=? AND fileId=?', unit.payload, id, unit.fileId);
  s.store.run("UPDATE code_analyses SET fingerprint='old-parser' WHERE id=?", id); assert.throws(() => s.analysis.file(id, unit.fileId), { code: 'PARSER_CHANGED' });
});

test('all code inventory budgets leave explicit durable omissions and preserve cumulative resume limits', async t => {
  const s = await setup(t);
  const cases: { limits: Partial<AnalysisLimits>; reason: string; status: string; count: number }[] = [
    { limits: { documents: 0 }, reason: 'document-limit', status: 'unattempted', count: 5 },
    { limits: { fileBytes: 0 }, reason: 'file-byte-limit', status: 'excluded', count: 5 },
    { limits: { fileSpans: 0 }, reason: 'file-span-limit', status: 'excluded', count: 5 },
    { limits: { textBytes: 0 }, reason: 'input-byte-limit', status: 'unattempted', count: 5 },
    { limits: { filePayloadBytes: 0 }, reason: 'file-payload-limit', status: 'omitted', count: 5 },
    { limits: { payloadBytes: 0 }, reason: 'payload-limit', status: 'omitted', count: 1 },
    { limits: { wallMs: 0 }, reason: 'wall-time-limit', status: 'unattempted', count: 5 },
  ];
  for (const [index, example] of cases.entries()) {
    await s.replace(example.limits); const run = s.analysis.start(`budget-${index}`, s.buildId); await s.analysis.idle();
    const result = s.analysis.get(run.id); assert.equal(result.status, 'partial'); assert.equal(result.counts[example.status], example.count);
    assert.ok(s.analysis.files(run.id).every(file => file.reason === example.reason)); assert.equal(result.payloadBytes, 0);
  }
  await s.replace({ documents: 2 }); const id = await pauseAfterFile(s, 'cumulative');
  s.analysis.control(id, 'resume'); await s.analysis.idle(); assert.equal(s.analysis.get(id).counts.parsed, 2); assert.equal(s.analysis.get(id).counts.unattempted, 3);
  await s.replace(); assert.throws(() => new CodeAnalysis(s.catalog, { documents: 10001 }), { code: 'INVALID_LIMIT' });
  const pending = await pauseAfterFile(s, 'changed-limits'); await s.replace({ documents: 2 });
  assert.throws(() => s.analysis.control(pending, 'resume'), { code: 'CORRUPT_CODE_CHECKPOINT' });
});

test('transaction failure preserves the previous inventory and bounded retention evicts only replaceable data', async t => {
  const s = await setup(t), good = s.analysis.start('good', s.buildId); await s.analysis.idle();
  const before = s.analysis.file(good.id, s.analysis.files(good.id)[0]!.fileId);
  s.store.db.exec("CREATE TRIGGER code_disk_failure BEFORE UPDATE OF payload ON code_analysis_files WHEN NEW.status='parsed' BEGIN SELECT RAISE(ABORT,'Synthetic disk failure'); END;");
  const failed = s.analysis.start('failure', s.buildId); await s.analysis.idle();
  assert.equal(s.analysis.get(failed.id).status, 'failed'); assert.match(s.analysis.get(failed.id).reason!, /Synthetic disk failure/);
  assert.equal(s.analysis.get(failed.id).payloadBytes, 0); assert.equal(s.analysis.get(failed.id).textBytes, 0);
  assert.equal(s.analysis.get(failed.id).counts.pending, 5); assert.deepEqual(s.analysis.file(good.id, before.fileId), before);
  s.store.db.exec('DROP TRIGGER code_disk_failure');
  const next = s.analysis.start('replacement', s.buildId); await s.analysis.idle();
  assert.equal(s.analysis.list().length, 2); assert.throws(() => s.analysis.get(failed.id), { code: 'NOT_FOUND' });
  const final = s.analysis.start('final', s.buildId); await s.analysis.idle();
  assert.throws(() => s.analysis.get(good.id), { code: 'NOT_FOUND' }); assert.equal(s.analysis.get(next.id).published, true); assert.equal(s.analysis.get(final.id).published, true);
  assert.equal(s.store.one<{ count: number }>('SELECT count(*) count FROM code_analysis_files')!.count, 10);
  assert.equal(s.store.one<{ count: number }>('SELECT count(*) count FROM code_analysis_sources')!.count, 6);
});

test('registry, revocation and policy changes atomically fence and purge complete and interrupted derivatives', async t => {
  const s = await setup(t), good = s.analysis.start('good', s.buildId); await s.analysis.idle();
  const id = await pauseAfterFile(s), source = s.catalog.state().sources[0]!;
  const codeFile = s.analysis.files(good.id)[0]!.fileId;
  s.catalog.revoke(source.id);
  assert.ok(s.analysis.list().every(run => run.status === 'fenced' && run.payloadBytes === 0));
  assert.equal(s.store.all('SELECT * FROM code_analysis_files').length, 0);
  assert.throws(() => s.analysis.file(good.id, codeFile), { code: 'ANALYSIS_FENCED' });
  assert.throws(() => s.analysis.control(id, 'resume'), { code: 'CONFLICT' });
  await s.restart(); assert.equal(s.store.all('SELECT * FROM code_analysis_files').length, 0);
  const remaining = s.analysis.start('remaining', s.buildId); await yieldTurn();
  await s.catalog.addSource(path.join(s.fixture.root, 'sources', 'portal')); await s.analysis.idle();
  assert.equal(s.analysis.get(remaining.id).status, 'fenced'); assert.equal(s.store.all('SELECT * FROM code_analysis_files').length, 0);
  const current = await s.index('current'), latest = s.analysis.start('current', current); await s.analysis.idle();
  s.catalog.updatePolicy(['src']); assert.equal(s.analysis.get(latest.id).status, 'fenced'); assert.equal(s.store.all('SELECT * FROM code_analysis_files').length, 0);
  assert.throws(() => s.analysis.files(latest.id), { code: 'ANALYSIS_FENCED' });
});

test('schema 7 upgrade preserves original evidence and rejects malformed fact ranges', async t => {
  const s = await setup(t), evidence = s.catalog.evidence(s.catalog.search('billing').hits[0]!.id);
  await s.analysis.stop(); removeCodeAnalysisSchema(s.store); s.store.db.exec('PRAGMA user_version=7'); await s.restart();
  assert.equal(s.store.one<{ user_version: number }>('PRAGMA user_version')!.user_version, 9); assert.deepEqual(s.catalog.evidence(evidence.id), evidence);
  const content = '// 😀\nexport function amber() { return fetch("/amber"); }\n', facts = typescriptFacts(content, 'amber.ts'), ranges = factRanges(content, facts);
  assert.equal(ranges.symbols[0]!.startLine, 2); assert.equal(ranges.symbols[0]!.textHash, sha256(content.slice(facts.symbols[0]!.start, facts.symbols[0]!.end)));
  const detached = structuredClone(facts); detached.operations[0]!.owner = 'unknown'; assert.throws(() => factRanges(content, detached), { code: 'CORRUPT_CODE_FACTS' });
  const outside = structuredClone(facts); outside.symbols[0]!.end = content.length + 1; assert.throws(() => factRanges(content, outside), { code: 'CORRUPT_CODE_FACTS' });
  for (const value of [null, {}, { ...facts, calls: [null] }, { ...facts, records: [] }, { ...facts, gaps: [1] }]) assert.throws(() => factRanges(content, value), { code: 'CORRUPT_CODE_FACTS' });
});

test('a mismatched original Git blob is a visible file failure even before an analysis checkpoint exists', async t => {
  const s = await setup(t), file = s.store.one<{ id: string; blob: string }>("SELECT id,blob FROM files WHERE buildId=? AND path LIKE '%.ts' LIMIT 1", s.buildId)!;
  s.store.run('UPDATE files SET blob=? WHERE id=?', '0'.repeat(file.blob.length), file.id);
  const run = s.analysis.start('bad-blob', s.buildId); await s.analysis.idle();
  assert.equal(s.analysis.get(run.id).counts.failed, 1); assert.equal(s.analysis.get(run.id).counts.parsed, 4);
  assert.equal(s.analysis.files(run.id).find(item => item.fileId === file.id)!.reason, 'CORRUPT_CODE_CHECKPOINT');
  assert.throws(() => s.analysis.file(run.id, file.id), { code: 'NOT_FOUND' });
  s.store.run('UPDATE files SET blob=? WHERE id=?', file.blob, file.id);
});

test('durable inventory covers files beyond the graph sample and retains unsupported syntax across bounded pages', async t => {
  const fixture = await createCapacityFixture(5), store = new CatalogStore(path.join(fixture.root, 'code-data')), catalog = new Catalog(store), analysis = new CodeAnalysis(catalog);
  t.after(async () => { await analysis.stop(); await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  const paths = fixture.manifest.sources.map((source: { id: string }) => path.join(fixture.root, 'sources', source.id));
  const preview = await catalog.previewSources(paths); await catalog.registerSources({ paths, previewHash: preview.previewHash, requestId: 'shape' });
  const state = catalog.state(), build = catalog.start('shape', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  const graph = codeFlows(catalog), run = analysis.start('shape', build.id); await analysis.idle();
  assert.equal(graph.coverage.candidateDocuments, 121); assert.equal(graph.coverage.examinedDocuments, 100);
  const result = analysis.get(run.id); assert.equal(result.counts.parsed, 121); assert.equal(result.gaps, 7);
  const pages = [0, 50, 100].map(offset => analysis.files(run.id, offset)); assert.deepEqual(pages.map(page => page.length), [50, 50, 21]);
  assert.equal(new Set(pages.flat().map(file => file.fileId)).size, 121);
  for (const offset of [-1, 1, 50.5, 150, NaN]) assert.throws(() => analysis.files(run.id, offset), { code: 'INVALID_PAGE' });
  const unsupported = pages.flat().filter(file => file.gapCount > 0); assert.equal(unsupported.length, 6);
  assert.ok(unsupported.every(file => analysis.file(run.id, file.fileId).facts.gaps.length > 0));
  assert.deepEqual(codeFlows(catalog), graph); assert.equal(store.all('SELECT id FROM answer_attempts').length, 0);
});
