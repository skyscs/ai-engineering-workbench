// Actual cold entry and fixed warm lifetimes; independent of source-family names.
import assert from 'node:assert/strict';
import { mkdir, cp, readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { launch, client, save, inventory, normalized, until, journal, hash } from './io.mjs';
import { indexSources, prepare, generate } from './flow.mjs';
import { assessPreview } from './assess.mjs';
import { stoppedHistoryCheckpoint } from './history-cases.mjs';

const { thresholds } = JSON.parse(await readFile(new URL('../../fixtures/loredock-prepared-flow/protocol.json', import.meta.url)));
export function assessDaemonSamples(samples) {
  assert(samples.length >= 2 && samples[0].event === 'start' && samples.at(-1).event === 'exit-0', 'A complete normal process lifetime is required.');
  for (const [index, row] of samples.entries()) {
    for (const key of ['now', 'gapMs', 'rss', 'heapUsed', 'processHighWaterRssBytes']) assert(Number.isFinite(row[key]) && row[key] >= 0, 'Invalid daemon sample: ' + key);
    if (index) assert(row.now >= samples[index - 1].now, 'Daemon sample order changed.');
    if (index > 0 && index < samples.length - 1) assert.equal(row.event, 'sample');
  }
  const maximum = key => samples.reduce((value, row) => Math.max(value, row[key]), 0);
  const measured = { sampledRssBytes: maximum('rss'), osHighWaterRssBytes: maximum('processHighWaterRssBytes'),
    heapUsedBytes: maximum('heapUsed'), rawIntervalGapMs: maximum('gapMs'), samples: samples.length };
  const checks = [
    ['sampledRssBytes', 'daemonRssBytes'], ['osHighWaterRssBytes', 'daemonRssBytes'],
    ['heapUsedBytes', 'daemonHeapUsedBytes'], ['rawIntervalGapMs', 'daemonIntervalDelayMs'],
  ].map(([metric, limit]) => ({ metric, value: measured[metric], limit: thresholds[limit], passed: measured[metric] <= thresholds[limit] }));
  return { measured, checks, passed: checks.every(row => row.passed), resourceQualification: false };
}
async function metrics(directory) {
  const raw = await readFile(path.join(directory, 'memory-timer.jsonl'), 'utf8');
  assert(raw.endsWith('\n'), 'Truncated daemon sample journal.');
  return assessDaemonSamples(raw.trimEnd().split('\n').map(JSON.parse));
}

export async function coldCatalog({ directory, sources, question, assessment, expectedFiles, expectedCodeFiles }) {
  await mkdir(directory);
  const data = path.join(directory, 'data'), report = { errors: [], resourceQualification: false };
  let daemon, api;
  try {
    daemon = await launch({ directory: path.join(directory, 'production'), data });
    api = await client(path.join(directory, 'http'));
    report.listenMs = daemon.readyMs;
    report.index = await indexSources(api, sources.paths);
    const { build, analysis } = report.index;
    assert.equal(build.sources.length, sources.paths.length);
    assert.equal(build.coverage.indexed, expectedFiles);
    for (const key of ['excluded', 'failed', 'pending']) assert.equal(build.coverage[key], 0);
    assert.equal(analysis.candidates, expectedCodeFiles); assert.equal(analysis.examined, expectedCodeFiles);
    assert.equal(analysis.counts.parsed, expectedCodeFiles);
    report.prepared = await prepare(api, question);
    report.assessment = assessPreview(report.prepared.review, assessment);
    assert.equal((await api.request('/answers')).value.attempts.length, 0);
  } catch (error) { report.errors.push(normalized(error)); }
  finally {
    api?.close();
    try {
      if (daemon) { report.exit = await daemon.stop(); assert.equal(report.exit.code, 0); report.daemon = await metrics(daemon.directory); }
    } catch (error) { report.errors.push(normalized(error)); }
    try {
      if (report.errors.length === 0) {
        const snapshot = path.join(directory, 'checkpoint');
        const retained = await stoppedHistoryCheckpoint(data, snapshot);
        assert.equal(retained.storage.rows, 0);
        report.checkpoint = { data: snapshot, ...retained, kind: 'cold-catalog', lane: 'resource' };
      }
    } catch (error) { report.errors.push(normalized(error)); }
    await save(path.join(directory, 'result.json'), report);
  }
  return report;
}

export async function warmCatalog({ directory, checkpoint, question, assessment }) {
  await mkdir(directory);
  const data = path.join(directory, 'data'), log = journal(path.join(directory, 'journal.jsonl'));
  const report = { errors: [], repetitions: [], declaredRepetitions: 3, resourceQualification: false };
  let daemon, api;
  try {
    assert.deepEqual(await inventory(checkpoint.data), checkpoint.files);
    await cp(checkpoint.data, data, { recursive: true, force: false, errorOnExist: true });
    assert.deepEqual(await inventory(data), checkpoint.files);
    await save(path.join(directory, 'input-checkpoint.json'), checkpoint);
    daemon = await launch({ directory: path.join(directory, 'controlled'), data, controlled: true });
    api = await client(path.join(directory, 'http'));
    await api.request('/answers/configuration', 'PUT', { executable: process.execPath, configHome: directory, profile: null });
    assert.deepEqual(await daemon.command('stats'), { prepares: 0, calls: 0, closed: 0 });
    for (let repetition = 1; repetition <= 3; repetition++) {
      log.append({ event: 'repetition-started', repetition });
      const began = performance.now(), prepared = await prepare(api, question);
      // Assess after the measured HTTP lifetime; retain the exact reviewed bytes now.
      const published = await generate(api, prepared.review);
      const saved = await api.request('/answers/' + published.answer.id), list = await api.request('/answers');
      const elapsedMs = performance.now() - began;
      await until(async () => (await daemon.command('stats')).closed === repetition, 'Warm worker did not drain.');
      const runtime = await daemon.command('stats');
      assert.deepEqual(runtime, { prepares: repetition, calls: repetition, closed: repetition });
      const drainedElapsedMs = performance.now() - began;
      assert.deepEqual(saved.value, published.answer); assert.equal(list.value.attempts.length, repetition);
      const sourceAssessment = assessPreview(prepared.review, assessment);
      const request = JSON.parse(await readFile(path.join(daemon.directory, 'request-' + repetition + '.json'), 'utf8'));
      const issued = prepared.review.context.spans.map(span => span.id);
      assert.deepEqual(request.schema.properties.claims.items.properties.evidenceIds.items.enum, issued);
      assert.equal(request.model, 'gpt-5.6-terra'); assert.equal(request.effort, 'medium');
      for (const claim of saved.value.answer.claims) for (const id of claim.evidenceIds) assert(issued.includes(id));
      const observation = { repetition, elapsedMs, drainedElapsedMs, scopeEnd: 'history-and-runtime-closed',
        prepared, published, saved, list, sourceAssessment, request, runtime };
      report.repetitions.push(observation);
      await save(path.join(directory, 'repetition-' + repetition + '.json'), observation);
      log.append({ event: 'repetition-finished', repetition, elapsedMs, drainedElapsedMs });
    }
  } catch (error) { report.errors.push(normalized(error)); }
  finally {
    api?.close();
    try {
      if (daemon) { report.exit = await daemon.stop(); assert.equal(report.exit.code, 0); report.daemon = await metrics(daemon.directory); }
      if (report.repetitions.length) {
        // Inspect only the stopped working copy; never open the sealed source checkpoint.
        const database = new DatabaseSync(path.join(data, 'loredock.db'), { readOnly: true });
        try {
          for (const row of report.repetitions) {
            const stored = database.prepare('SELECT a.context,w.witness,w.reviewedHash FROM answer_attempts a JOIN answer_witnesses w ON w.answerId=a.id WHERE a.id=?').get(row.published.answer.id);
            assert.equal(stored.context, JSON.stringify(row.prepared.review.context));
            assert.equal(stored.reviewedHash, row.prepared.review.reviewedHash);
            assert.equal(JSON.parse(stored.witness).prompt, row.request.prompt);
            // Bind stopped bytes for the later diagnostic replay; no extra reference generation.
            row.stored = { contextSha256: hash(stored.context), witnessSha256: hash(stored.witness),
              witnessBytes: Buffer.byteLength(stored.witness), reviewedHash: stored.reviewedHash };
          }
        } finally { database.close(); }
        report.exactWitnessPromptParity = true;
      }
      assert.deepEqual(await inventory(checkpoint.data), checkpoint.files);
    } catch (error) { report.errors.push(normalized(error)); }
    await save(path.join(directory, 'result.json'), report);
    log.append({ event: 'finished', repetitions: report.repetitions.length, errors: report.errors }); log.close();
  }
  return report;
}
