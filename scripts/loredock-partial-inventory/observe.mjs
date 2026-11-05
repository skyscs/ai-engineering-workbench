// This ordinary diagnostic distinguishes terminal processing from coverage; it changes no product or frozen gate.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { launch, client, save, normalized, until } from '../loredock-prepared-flow/io.mjs';
import { prepare } from '../loredock-prepared-flow/flow.mjs';
import { assessPreview } from '../loredock-prepared-flow/assess.mjs';
import { assessDaemonSamples } from '../loredock-prepared-flow/cold-warm-cases.mjs';

export function requireParsedTerminal(value, buildId, control) {
  assert(['completed', 'partial'].includes(value.status), 'This diagnostic requires terminal processing.');
  assert.equal(value.buildId, buildId); assert.equal(value.published, true); assert.equal(value.currentParser, true);
  assert.equal(value.staleIndex, false); assert.equal(value.status, control.status);
  assert.equal(value.candidates, control.codeFiles); assert.equal(value.examined, control.codeFiles);
  assert.deepEqual(value.counts, { parsed: control.codeFiles }, 'Unattempted/failed files are outside these controls.');
  assert.equal(value.gaps, control.gap ? 1 : 0); assert.equal(value.filesWithGaps, control.gap ? 1 : 0);
  return { processing: 'terminal-all-parsed', published: true, currentParser: true, coverage: value.status,
    gaps: value.gaps, nativeUsefulness: 'not-established-by-inventory-status', qualification: false };
}

export async function observe({ directory, control, corpus, sources, expected, references, question }) {
  await mkdir(directory);
  const result = { id: control.id, errors: [], assessmentErrors: [], preparations: 0, functionalPassed: false,
    resourceQualification: false, modelEligibility: false, modelCalls: 0, reservedFamilyReads: 0 };
  let daemon, api;
  try {
    await save(path.join(directory, 'inputs.json'), { control, sources, expected, references, question });
    daemon = await launch({ directory: path.join(directory, 'production'), data: path.join(directory, 'data') });
    api = await client(path.join(directory, 'http'));
    for (const source of sources.paths) await api.request('/sources', 'POST', { path: source });
    const project = (await api.request('/project')).value;
    const build = (await api.request('/builds', 'POST', { requestId: randomUUID(), sourceSetVersion: project.sourceSetVersion, policyVersion: project.policyVersion })).value;
    result.build = await until(async () => {
      const value = (await api.request('/builds/' + build.id)).value;
      if (['preparing', 'running'].includes(value.status)) return false;
      assert.equal(value.status, 'completed'); assert.equal(value.published, true); return value;
    }, 'Ordinary source indexing did not complete.', 300000, 250);
    assert.equal(result.build.sources.length, sources.paths.length);
    assert.equal(result.build.coverage.indexed, control.files);
    for (const key of ['excluded', 'failed', 'pending']) assert.equal(result.build.coverage[key], 0);
    result.analysis = await until(async () => {
      const state = (await api.request('/code-analysis')).value; assert.equal(state.automaticError, null);
      const value = state.inventories.find(row => row.buildId === build.id);
      if (!value || value.status === 'running') return false;
      result.processing = requireParsedTerminal(value, build.id, control); return value;
    }, 'Ordinary analysis did not reach the declared terminal state.', 300000, 25);
    // Exactly one real public preparation, after the explicitly declared terminal processing state.
    result.preparations++;
    result.prepared = await prepare(api, question);
    const review = result.prepared.review;
    const reread = (await api.request('/question-preparations/' + review.id + '/review')).value;
    assert.deepEqual(reread, review, 'Repeated public review changed its immutable content.');
    result.reviewStable = true;
    try { result.assessment = assessPreview(review, { corpus, sources, expected, references }); }
    catch (error) { result.assessmentErrors.push(normalized(error)); }
    result.qualifications = { lexicalIndexPartial: review.context.partial, nativePartial: review.compact.item?.partial ?? null,
      nativeProvenance: review.compact.item?.provenance ?? null, nativeVerification: review.compact.item?.verification ?? null,
      nativeGaps: review.compact.item?.gaps ?? null, omission: review.compact.reason, deploymentCoherence: review.context.deploymentCoherence };
  } catch (error) { result.errors.push(normalized(error)); }
  finally {
    try { if (daemon) result.exit = await daemon.stop(); } catch (error) { result.errors.push(normalized(error)); }
    try { api?.close(); } catch (error) { result.errors.push(normalized(error)); }
    if (result.exit) try {
      assert.equal(result.exit.code, 0); assert.equal(result.exit.signal, null);
      assert.equal(result.exit.spawnError, null); assert.equal(result.exit.alreadyExited, false);
    } catch (error) { result.errors.push(normalized(error)); }
    if (result.exit?.code === 0 && result.analysis) {
      // Only the stopped working catalog is read here; independent retained copies are checked later.
      const database = new DatabaseSync(path.join(directory, 'data/loredock.db'), { readOnly: true });
      try {
        const rows = database.prepare('SELECT status,gapCount,payload FROM code_analysis_files WHERE runId=? ORDER BY ordinal').all(result.analysis.id);
        const gaps = rows.flatMap(row => JSON.parse(row.payload).facts.gaps);
        assert.deepEqual(gaps, control.gap ? [control.gap] : []);
        result.fileCoverage = { files: rows.length, allParsed: rows.every(row => row.status === 'parsed'), gaps };
        assert.equal(database.prepare('SELECT count(*) n FROM answer_attempts').get().n, 0);
        assert.equal(database.prepare('SELECT count(*) n FROM answer_witnesses').get().n, 0);
        result.answerAttempts = 0; result.witnesses = 0;
      } catch (error) { result.errors.push(normalized(error)); } finally { database.close(); }
    }
    try {
      const raw = await readFile(path.join(directory, 'production/memory-timer.jsonl'), 'utf8'); assert(raw.endsWith('\n'));
      result.metrics = assessDaemonSamples(raw.trimEnd().split('\n').map(JSON.parse));
    } catch (error) { result.errors.push(normalized(error)); }
    result.functionalPassed = result.errors.length === 0 && result.assessmentErrors.length === 0 && result.preparations === 1;
    await save(path.join(directory, 'result.json'), result);
  }
  return result;
}
