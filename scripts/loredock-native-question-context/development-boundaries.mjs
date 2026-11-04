import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { developmentCorpus, developmentQuestion } from './development.mjs';
import { prepareState, closePrepared } from './setup.mjs';
import { paddingCorpus, saveBoundaryNotes, controlledPadding } from './boundary-inputs.mjs';
import { retrieveAnswerContext } from '../../apps/loredock/dist/answer-context.js';
import { NativeQuestionContext } from './prepare.mjs';
import { revalidateWitness } from './witness.mjs';

export async function developmentBoundaries(directory) {
  assert(path.isAbsolute(directory)); await mkdir(directory);
  const reports = [], raw = (name, value) => writeFile(path.join(directory, name + '.json'), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  await raw('start', { corpus: 'Separate ordinary permit inputs only', reserved: false });
  for (const mode of ['derived-size', 'prompt-size', 'inventory-replaced', ...['policy', 'revoke'].flatMap(kind =>
    ['lexical', 'metadata', 'read', 'resolve', 'admit', 'originals', 'handoff'].map(stage => kind + '.' + stage))]) {
    const prepared = await prepareState(path.join(directory, mode), mode.endsWith('-size') ? paddingCorpus(developmentCorpus(), mode) : developmentCorpus());
    const { state, buildId } = prepared; let candidate, error;
    try {
      const request = { buildId };
      if (mode.endsWith('-size')) {
        await raw(mode + '-notes', saveBoundaryNotes(state.catalog, buildId));
        const baseline = retrieveAnswerContext(state.catalog, developmentQuestion, buildId), controlled = controlledPadding(state.catalog, baseline, mode);
        await raw(mode + '-controlled', controlled);
        candidate = new NativeQuestionContext(state.analysis, { controlledContext: () => structuredClone(controlled.context) });
        const result = await candidate.prepare(developmentQuestion, request); await raw(mode + '-result', result); await raw(mode + '-metrics', candidate.observation);
        assert.equal(result.compact.reason, mode); assert.equal(result.compact.item, null); assert.deepEqual(result.context, controlled.context);
      } else if (mode === 'inventory-replaced') {
        candidate = new NativeQuestionContext(state.analysis); const issued = await candidate.prepare(developmentQuestion, request), original = JSON.stringify(issued);
        await raw(mode + '-issued', issued); assert(issued.compact.item);
        for (let i = 0; i < 2; i++) { state.analysis.start('replace-' + i, buildId); await state.analysis.idle(); }
        assert.throws(() => state.analysis.get(issued.projection.identity.inventoryId), { code: 'NOT_FOUND' });
        const before = state.counters(), legacy = state.legacy(), validated = await revalidateWitness(state.catalog, issued); await raw(mode + '-validated', validated);
        for (const key of ['factReads', 'snapshots', 'pathReads', 'gitCalls', 'writeCalls', 'changedRows']) assert.equal(state.counters()[key], before[key]);
        assert.equal(state.legacy(), legacy); assert.equal(JSON.stringify(issued), original);
        const unavailable = await candidate.prepare(developmentQuestion, { buildId, inventoryId: issued.projection.identity.inventoryId, generationId: issued.projection.generationId });
        assert.equal(unavailable.compact.reason, 'INVENTORY_UNAVAILABLE');
      } else {
        const [kind, stage] = mode.split('.'); let reached = false;
        candidate = new NativeQuestionContext(state.analysis, { checkpoint: info => { if (info.stage !== stage || reached) return; reached = true;
          if (kind === 'policy') state.catalog.updatePolicy(['boundary-private']);
          else state.catalog.revoke(state.catalog.state().sources.find(row => row.name === 'z-independent-notes').id); } });
        await assert.rejects(candidate.prepare(developmentQuestion, request), error => ['RECEIPT_FENCED', 'ANALYSIS_FENCED', 'METADATA_CHANGED', 'POLICY_CHANGED', 'RECEIPT_SCOPE_FENCED'].includes(error.code));
        assert(reached); await raw(mode + '-metrics', candidate.observation);
      }
    } catch (caught) { error = caught; await raw(mode + '-failure', { name: caught.name, message: caught.message, code: caught.code ?? null, stack: caught.stack }); }
    finally { await candidate?.stop(); await raw(mode + '-closed', await closePrepared(prepared)); }
    reports.push({ mode, pass: !error }); await raw(mode + '-assessment', reports.at(-1));
    if (error) throw error;
  }
  await raw('result', { pass: true, reports, sourcesAndCatalogsPreserved: true }); return reports;
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname)
  console.log(JSON.stringify({ pass: true, checks: (await developmentBoundaries(process.env.LOREDOCK_QUESTION_BOUNDARIES_OUTPUT)).length }));
