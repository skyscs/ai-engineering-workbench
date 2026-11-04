import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { prepareSources, copyStoppedData, hash } from '../loredock-capture-memory/fixture.mjs';
import { observeQueries } from '../loredock-native-worker-audit/queries.mjs';
import { normalized } from '../loredock-native-qualification/io.mjs';

function open(directory, services) {
  const store = new services.CatalogStore(directory), catalog = new services.Catalog(store, new services.SourceGit());
  const analysis = new services.CodeAnalysis(catalog); let closed = false;
  return { store, catalog, analysis, async close() {
    if (closed) return; const errors = [];
    for (const action of [() => analysis.stop(), () => catalog.stop(), () => store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'), () => store.close()])
      try { await action(); } catch (error) { errors.push(error); }
    closed = true; if (errors.length) throw new AggregateError(errors, 'Analysis comparison cleanup failed.');
  } };
}

// Only run IDs and clock fields differ between fresh admissions on identical copies.
// Checkpoint hashes are independently verified before replacing their run ID basis.
function inventoryState(state, names) {
  const id = value => { assert.ok(names.has(value)); return names.get(value); };
  const analyses = state.store.all('SELECT * FROM code_analyses ORDER BY rowid').map(row => {
    assert.ok(Number.isFinite(row.elapsedMs) && row.elapsedMs >= 0 && Number.isFinite(Date.parse(row.createdAt)));
    if (row.published) for (const fileId of state.analysis.snapshot(row.id).fileIds) state.analysis.file(row.id, fileId);
    return { ...row, id: id(row.id), createdAt: '<clock>', elapsedMs: '<clock>' };
  });
  const files = state.store.all('SELECT * FROM code_analysis_files').map(row => {
    const fields = [row.runId, row.fileId, row.ordinal, row.inputHash, row.status, row.reason, row.inputBytes, row.payloadBytes, row.gapCount, row.payloadHash];
    if (row.checkpointHash !== null) assert.equal(row.checkpointHash, hash(JSON.stringify(fields)));
    const runId = id(row.runId); fields[0] = runId;
    return { ...row, runId, checkpointHash: row.checkpointHash === null ? null : hash(JSON.stringify(fields)) };
  }).sort((a, b) => a.runId.localeCompare(b.runId) || a.ordinal - b.ordinal);
  const sources = state.store.all('SELECT * FROM code_analysis_sources').map(row => ({ ...row, runId: id(row.runId) }))
    .sort((a, b) => a.runId.localeCompare(b.runId) || a.sourceId.localeCompare(b.sourceId));
  const sourceRows = ['project', 'sources', 'builds', 'build_sources', 'files', 'spans'].map(table => state.store.all('SELECT * FROM ' + table + ' ORDER BY rowid'));
  return { analyses, files, sources, sourceRowsSha256: hash(JSON.stringify(sourceRows)) };
}

export async function compareAnalysisWrites(output, reference, candidate) {
  assert.ok(path.isAbsolute(output)); await mkdir(output);
  const report = { schemaVersion: 'analysis-write-behavior-comparison/1', node: process.version, resourceQualification: false,
    modelRequests: 0, normalization: ['new inventory ID mapped to request label', 'validated creation/elapsed clocks', 'independently verified checkpoint hash rebased to request label'],
    scenarios: [], errors: [] };
  const save = () => writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  const states = []; let activeAudit;
  try {
    const seedDir = path.join(output, 'seed'), seed = open(seedDir, reference); states.push(seed);
    const corpus = corpusFactory();
    for (const files of Object.values(corpus)) for (let i = 0; i < 2; i++) files[`comparison/unit-${i}.ts`] = `// Independent write comparison unit ${i}.\n`;
    report.input = { sources: 4, files: 23, codeFiles: 16, sha256: hash(JSON.stringify(corpus)) };
    await writeFile(path.join(output, 'input.json'), JSON.stringify(corpus, null, 2));
    await prepareSources(output, corpus, seed);
    const project = seed.catalog.state(), build = seed.catalog.start('comparison-index', project.sourceSetVersion, project.policyVersion);
    await seed.catalog.idle(); await seed.close(); await save();
    for (const scenario of ['normal', 'pause-resume', 'interrupt-resume', 'cancel', 'counter-failure', 'policy', 'revoke']) {
      const pair = { name: scenario, arms: [] }; report.scenarios.push(pair);
      for (const [arm, services] of [['reference', reference], ['candidate', candidate]]) {
        const folder = path.join(output, scenario + '-' + arm); await copyStoppedData(seedDir, folder);
        let state = open(folder, services); states.push(state); const names = new Map(), observed = [];
        const start = label => { const run = state.analysis.start(label, build.id); names.set(run.id, label); return run; };
        const record = label => observed.push({ label, state: inventoryState(state, names) });
        activeAudit = observeQueries(state.store.db); activeAudit.begin('scenario');
        if (scenario === 'normal') {
          for (const label of ['initial', 'replacement-one', 'replacement-two']) {
            const run = start(label); await state.analysis.idle();
            assert.equal(state.analysis.get(run.id).counts.parsed, 16); record(label);
          }
          assert.equal(state.analysis.list().length, 2);
        } else if (scenario === 'counter-failure') {
          const original = state.store.run.bind(state.store); let injected = false;
          state.store.run = (sql, ...args) => {
            if (!injected && sql === 'UPDATE code_analyses SET elapsedMs=?,textBytes=textBytes+?,payloadBytes=payloadBytes+? WHERE id=?') {
              injected = true; throw new Error('Independent cumulative-counter failure.');
            }
            return original(sql, ...args);
          };
          const failed = start('failed'); await state.analysis.idle(); state.store.run = original;
          assert.ok(injected); const summary = state.analysis.get(failed.id);
          assert.equal(summary.status, 'failed'); assert.equal(summary.textBytes, 0); assert.equal(summary.payloadBytes, 0);
          assert.equal(summary.counts.pending, 16); record('rolled-back');
          const recovered = start('recovered'); await state.analysis.idle(); assert.equal(state.analysis.get(recovered.id).counts.parsed, 16); record('recovered');
        } else {
          const run = start('controlled'); await yieldTurn(); assert.equal(state.analysis.get(run.id).counts.parsed, 1);
          if (scenario === 'pause-resume') state.analysis.control(run.id, 'pause');
          else if (scenario === 'interrupt-resume') await state.analysis.stop();
          else if (scenario === 'cancel') state.analysis.control(run.id, 'cancel');
          else if (scenario === 'policy') state.catalog.updatePolicy(['comparison']);
          else state.catalog.revoke(state.store.sources()[0].id);
          await state.analysis.idle(); record('controlled');
          if (scenario.endsWith('resume')) {
            activeAudit.end(); const before = activeAudit.report(); activeAudit.detach(); activeAudit = undefined;
            await state.close(); state = open(folder, services); states.push(state); record('reopened');
            activeAudit = observeQueries(state.store.db); activeAudit.begin('resume');
            state.analysis.control(run.id, 'resume'); await state.analysis.idle(); assert.equal(state.analysis.get(run.id).counts.parsed, 16); record('resumed');
            activeAudit.end(); const after = activeAudit.report(); activeAudit.detach(); activeAudit = undefined;
            const result = { arm, observed, queries: [before, after] }; pair.arms.push(result); await save(); await state.close(); continue;
          }
          assert.equal(state.analysis.get(run.id).status, scenario === 'cancel' ? 'cancelled' : 'fenced');
        }
        activeAudit.end(); const queries = activeAudit.report(); activeAudit.detach(); activeAudit = undefined;
        pair.arms.push({ arm, observed, queries: [queries] }); await save(); await state.close();
      }
      assert.deepEqual(pair.arms[1].observed, pair.arms[0].observed, scenario + ' changes retained behavior');
      const executions = arm => arm.queries.flatMap(report => report.stages.map(stage => stage.queries.map(({ prepare, prepareErrors, ...row }) => row)
        .sort((a, b) => a.sha256.localeCompare(b.sha256))));
      assert.deepEqual(executions(pair.arms[1]), executions(pair.arms[0]), scenario + ' changes actual SQL executions');
      if (scenario === 'normal') {
        const statements = ['INSERT INTO code_analysis_files (runId,fileId,ordinal,inputHash) VALUES (?,?,?,?)',
          "UPDATE code_analysis_files SET status=?,reason=?,inputBytes=?,payloadBytes=?,gapCount=?,payload=?,payloadHash=?,checkpointHash=? WHERE runId=? AND fileId=? AND status='pending'",
          'UPDATE code_analyses SET elapsedMs=?,textBytes=textBytes+?,payloadBytes=payloadBytes+? WHERE id=?'];
        pair.repeatedWrites = statements.map(sql => {
          const counts = pair.arms.map(arm => arm.queries.flatMap(report => report.stages.flatMap(stage => stage.queries))
            .filter(row => row.sha256 === hash(sql)).reduce((sum, row) => ({ prepare: sum.prepare + row.prepare, run: sum.run + row.run }), { prepare: 0, run: 0 }));
          assert.deepEqual(counts, [{ prepare: 48, run: 48 }, { prepare: 3, run: 48 }]);
          return { sql, reference: counts[0], candidate: counts[1] };
        });
      }
      pair.passed = true; await save();
    }
    report.completed = true;
  } catch (error) { report.errors.push(normalized(error)); }
  finally {
    if (activeAudit) { try { activeAudit.end(); report.partialQueries = activeAudit.report(); activeAudit.detach(); } catch (error) { report.errors.push(normalized(error)); } }
    for (const state of states) try { await state.close(); } catch (error) { report.errors.push(normalized(error)); }
    report.failed = !report.completed || report.errors.length > 0; await save();
  }
  return report;
}
