import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { Catalog } from '../src/catalog.js';
import type { CatalogStore } from '../src/store.js';
import { CodeAnalysis as ReferenceAnalysis } from './fixtures/integration-reference/index.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { CatalogStore as ProductionStore } from '../src/store.js';
import type { AnalysisUnit } from '../src/code-analysis-types.js';
import { config } from './fixtures/streaming-snapshot-config.js';
// @ts-expect-error Independent owned setup helpers, with no frozen corpus or measurement entry point.
import { openState, prepareSources } from '../../../scripts/loredock-capture-memory/fixture.mjs';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
interface State { store: CatalogStore; catalog: Catalog; analysis: CodeAnalysis; close(): Promise<void> }
async function setup(t: TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), 'production-snapshot-regression-'));
  const state = openState(path.join(root, 'data'), path.join(root, 'receipts'), { ...config.services, CatalogStore: ProductionStore, CodeAnalysis }) as State;
  let passed = false;
  t.after(async () => { await state.close(); if (passed) await rm(root, { recursive: true, force: true }); else t.diagnostic(`Retained production snapshot regression: ${root}`); });
  await prepareSources(root, config.corpusFactory(), state);
  const project = state.catalog.state(), build = state.catalog.start('snapshot-index', project.sourceSetVersion, project.policyVersion);
  await state.catalog.idle();
  const run = state.analysis.start('snapshot-analysis', build.id); await state.analysis.idle();
  assert.ok(state.analysis.get(run.id).published);
  const baseline = () => ReferenceAnalysis.prototype.snapshot.call(state.analysis, run.id);
  const candidate = () => state.analysis.snapshot(run.id);
  const units = () => state.store.all<AnalysisUnit>('SELECT * FROM code_analysis_files WHERE runId=? ORDER BY ordinal', run.id);
  const rehash = () => {
    for (const unit of units()) state.store.run('UPDATE code_analysis_files SET checkpointHash=? WHERE runId=? AND fileId=?',
      hash(JSON.stringify([unit.runId, unit.fileId, unit.ordinal, unit.inputHash, unit.status, unit.reason,
        unit.inputBytes, unit.payloadBytes, unit.gapCount, unit.payloadHash])), run.id, unit.fileId);
  };
  const totals = () => {
    const rows = units();
    state.store.run('UPDATE code_analyses SET candidates=?,textBytes=?,payloadBytes=?,manifestHash=? WHERE id=?', rows.length,
      rows.reduce((sum, row) => sum + row.inputBytes, 0), rows.reduce((sum, row) => sum + row.payloadBytes, 0),
      hash(JSON.stringify(rows.map(({ fileId, inputHash }) => ({ fileId, inputHash })))), run.id);
  };
  const scenario = (action: () => void) => {
    state.store.db.exec('SAVEPOINT snapshot_case');
    try { action(); } finally { state.store.db.exec('ROLLBACK TO snapshot_case; RELEASE snapshot_case'); }
    assert.deepEqual(candidate(), baseline(), 'The iterator must release after success or refusal.');
  };
  return { ...state, run, build, baseline, candidate, units, rehash, totals, scenario, pass: () => { passed = true; } };
}

test('production streamed snapshots preserve exact empty, escaped and mixed-state manifests without full header arrays', async t => {
  const s = await setup(t);
  assert.deepEqual(s.candidate(), s.baseline());
  s.scenario(() => {
    const rows = s.units();
    s.store.run('UPDATE code_analysis_files SET inputHash=? WHERE runId=? AND fileId=?', 'quote"\\line\n雪😀', s.run.id, rows[0]!.fileId);
    for (const [index, status] of ['excluded', 'failed', 'unattempted', 'omitted'].entries())
      s.store.run('UPDATE code_analysis_files SET status=?,payload=NULL,payloadHash=NULL,payloadBytes=0,inputBytes=0,gapCount=0 WHERE runId=? AND fileId=?',
        status, s.run.id, rows[index + 1]!.fileId);
    s.rehash(); s.totals();
    assert.deepEqual(s.candidate(), s.baseline());
    assert.deepEqual(s.candidate().fileIds, s.units().filter(row => row.status === 'parsed').map(row => row.fileId));
  });
  s.scenario(() => {
    s.store.run('DELETE FROM code_analysis_files WHERE runId=?', s.run.id); s.totals();
    assert.deepEqual(s.candidate(), s.baseline()); assert.deepEqual(s.candidate().fileIds, []);
    assert.equal(s.candidate().manifestHash, hash('[]'));
  });
  const all = s.store.all.bind(s.store);
  s.store.all = (sql, ...args) => {
    assert.ok(!sql.includes('length(CAST(payload AS BLOB)) storedBytes'), 'Complete header materialization is prohibited in the candidate.');
    return all(sql, ...args);
  };
  try { assert.equal(s.candidate().fileIds.length, 8); } finally { s.store.all = all; }
  s.pass();
});

test('production streamed snapshots preserve late-row corruption, byte/count limits and authorization refusals', async t => {
  const s = await setup(t), last = s.units().at(-1)!;
  const refuse = (code: string) => {
    assert.throws(s.baseline, { code }); assert.throws(s.candidate, { code });
  };
  const mutations = [
    () => s.store.run("UPDATE code_analysis_files SET checkpointHash='broken' WHERE runId=? AND fileId=?", s.run.id, last.fileId),
    () => { s.store.run('UPDATE code_analysis_files SET ordinal=99 WHERE runId=? AND fileId=?', s.run.id, last.fileId); s.rehash(); },
    () => { s.store.run("UPDATE code_analysis_files SET status='pending' WHERE runId=? AND fileId=?", s.run.id, last.fileId); s.rehash(); },
    () => { s.store.run('UPDATE code_analysis_files SET inputBytes=-1 WHERE runId=? AND fileId=?', s.run.id, last.fileId); s.rehash(); },
    () => { s.store.run('UPDATE code_analysis_files SET inputBytes=1.5 WHERE runId=? AND fileId=?', s.run.id, last.fileId); s.rehash(); },
    () => { s.store.run('UPDATE code_analysis_files SET gapCount=-1 WHERE runId=? AND fileId=?', s.run.id, last.fileId); s.rehash(); },
    () => { s.store.run('UPDATE code_analysis_files SET payloadBytes=payloadBytes+1 WHERE runId=? AND fileId=?', s.run.id, last.fileId); s.rehash(); },
    () => { s.store.run("UPDATE code_analysis_files SET status='omitted' WHERE runId=? AND fileId=?", s.run.id, last.fileId); s.rehash(); },
    () => { const payload = 'x'.repeat(s.analysis.limits.filePayloadBytes + 1);
      s.store.run('UPDATE code_analysis_files SET payload=?,payloadBytes=? WHERE runId=? AND fileId=?', payload, payload.length, s.run.id, last.fileId); s.rehash(); s.totals(); },
    () => s.store.run('UPDATE code_analyses SET candidates=candidates+1 WHERE id=?', s.run.id),
    () => s.store.run("UPDATE code_analyses SET manifestHash='broken' WHERE id=?", s.run.id),
    () => s.store.run('UPDATE code_analyses SET textBytes=textBytes+1 WHERE id=?', s.run.id),
    () => s.store.run('UPDATE code_analyses SET payloadBytes=payloadBytes+1 WHERE id=?', s.run.id),
    () => s.store.run("UPDATE code_analyses SET limits='{}' WHERE id=?", s.run.id),
  ];
  for (const mutate of mutations) s.scenario(() => { mutate(); refuse('CORRUPT_CODE_CHECKPOINT'); });
  for (const [sql, code] of [
    ["UPDATE code_analyses SET status='fenced' WHERE id=?", 'ANALYSIS_FENCED'],
    ["UPDATE code_analyses SET fingerprint='other-parser' WHERE id=?", 'PARSER_CHANGED'],
    ['UPDATE code_analyses SET published=0 WHERE id=?', 'NOT_READY'],
  ]) s.scenario(() => { s.store.run(sql!, s.run.id); refuse(code!); });
  for (const column of ['policyVersion', 'sourceSetVersion']) s.scenario(() => {
    s.store.run(`UPDATE project SET ${column}=${column}+1`); refuse('ANALYSIS_FENCED');
  });
  s.scenario(() => { s.store.run('UPDATE builds SET published=0 WHERE id=?', s.build.id); refuse('NOT_READY'); });
  for (const key of ['textBytes', 'payloadBytes'] as const) {
    const previous = s.analysis.limits[key];
    s.scenario(() => {
      try {
        s.analysis.limits[key] = 0; s.store.run('UPDATE code_analyses SET limits=? WHERE id=?', JSON.stringify(s.analysis.limits), s.run.id);
        refuse('CORRUPT_CODE_CHECKPOINT');
      } finally { s.analysis.limits[key] = previous; }
    });
  }
  assert.throws(() => s.analysis.snapshot('missing'), { code: 'NOT_FOUND' });
  assert.throws(() => ReferenceAnalysis.prototype.snapshot.call(s.analysis, 'missing'), { code: 'NOT_FOUND' });
  s.store.revoke(s.store.sources()[0]!.id); refuse('ANALYSIS_FENCED');
  s.pass();
});

test('production streaming preserves the exact document ceiling and rejects one extra saved header', async t => {
  const s = await setup(t), sourceFile = s.units()[0]!.fileId;
  s.scenario(() => {
    s.store.run('DELETE FROM code_analysis_files WHERE runId=?', s.run.id);
    const file = s.store.db.prepare('INSERT INTO files(id,buildId,sourceId,path,mode,blob,size) SELECT ?,buildId,sourceId,?,mode,blob,size FROM files WHERE id=?');
    const unit = s.store.db.prepare("INSERT INTO code_analysis_files(runId,fileId,ordinal,inputHash,status) VALUES (?,?,?,'independent-boundary','excluded')");
    for (let ordinal = 0; ordinal < 10000; ordinal++) {
      const id = 'boundary-' + ordinal;
      file.run(id, 'boundary/' + ordinal + '.ts', sourceFile); unit.run(s.run.id, id, ordinal);
    }
    s.rehash(); s.totals(); assert.deepEqual(s.candidate(), s.baseline());
    assert.equal(s.candidate().summary.candidates, 10000); assert.deepEqual(s.candidate().fileIds, []);
    file.run('boundary-extra', 'boundary/extra.ts', sourceFile); unit.run(s.run.id, 'boundary-extra', 10000);
    s.rehash(); s.totals();
    assert.throws(s.baseline, { code: 'CORRUPT_CODE_CHECKPOINT' });
    assert.throws(s.candidate, { code: 'CORRUPT_CODE_CHECKPOINT' });
  });
  s.pass();
});
