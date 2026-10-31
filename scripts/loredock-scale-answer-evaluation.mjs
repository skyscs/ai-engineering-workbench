import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createScaleFixture, scaleBaseline, scaleGit } from './loredock-scale-fixture.mjs';
import { digest } from './loredock-fixture.mjs';
import { reviewCases, reviewCanary } from '../fixtures/loredock-scale/review-cases.mjs';

// Runtime and product services are explicit dependencies so automatic tests cannot
// accidentally select a personal connection or dispatch a real model request.
export async function evaluateScaleAnswers({ output, connection, runtime, onProgress = () => {} }, services) {
  const { Catalog, CatalogStore, Answers, Corrections, codeFlows, answerPrompt,
    answerPromptVersion, answerSchemaVersion, retrievalVersion } = services;
  assert.ok(runtime && connection && output);
  await mkdir(output, { recursive: false });
  const fixture = await createScaleFixture();
  const directory = path.join(output, 'catalog');
  let store, catalog, answers, current, calls = 0;
  const report = { schemaVersion: 'loredock-scale-answer-evaluation/1', startedAt: new Date().toISOString(),
    budget: { maximumAttempts: 24, wallMsPerAttempt: 120000, automaticRetries: 0 },
    model: 'gpt-5.6-terra', effort: 'medium', promptVersion: answerPromptVersion,
    answerSchemaVersion, retrievalVersion, baseline: scaleBaseline(fixture),
    reviewCasesHash: digest(JSON.stringify(reviewCases)), results: [],
    semanticReview: 'pending; resolving citations do not prove grounding', independentReview: 'pending',
    cliInternalRequests: 'not exposed by the production adapter; application attempts are counted separately' };
  let saving = Promise.resolve();
  const save = () => {
    const serialized = JSON.stringify(report, null, 2) + '\n';
    saving = saving.then(async () => {
      const temporary = path.join(output, 'answer-result.json.tmp');
      await writeFile(temporary, serialized); await rename(temporary, path.join(output, 'answer-result.json'));
    });
    return saving;
  };
  const wrapped = { prepare: async (...args) => {
    const prepared = await runtime.prepare(...args);
    return { ...prepared, run: async request => {
      assert.ok(current && calls < report.budget.maximumAttempts);
      assert.equal(request.prompt, current.issuedPrompt);
      assert.equal(Buffer.byteLength(request.prompt) <= 96 * 1024, true);
      calls++; current.dispatched = true; await save();
      const result = await prepared.run(request); current.rawOutput = result.text; await save(); return result;
    } };
  } };
  const open = () => { store = new CatalogStore(directory); catalog = new Catalog(store); answers = new Answers(catalog, wrapped); };
  const close = async () => { await answers?.stop(); await catalog?.stop(); store?.close(); answers = catalog = store = undefined; };
  try {
    const frozen = JSON.parse(await readFile(new URL('../fixtures/loredock-scale/baseline.json', import.meta.url), 'utf8'));
    assert.deepEqual(report.baseline, frozen, 'Source/oracle changes require a separate baseline review.');
    open();
    const paths = fixture.manifest.sources.map(source => path.join(fixture.root, 'sources', source.id));
    const preview = await catalog.previewSources(paths);
    await catalog.registerSources({ paths, previewHash: preview.previewHash, requestId: 'evaluation' });
    const state = catalog.state(); catalog.start('evaluation', state.sourceSetVersion, state.policyVersion); await catalog.idle();
    await answers.configure(connection); await save();
    for (const question of [...fixture.oracle.questions, ...reviewCases]) {
      let note = null;
      if (question.action) {
        const projection = codeFlows(catalog), corrections = new Corrections(catalog);
        const nodes = new Map(projection.nodes.map(node => [node.id, node]));
        const edge = projection.edges.find(edge => edge.kind === 'event-delivery'
          && nodes.get(edge.from)?.sourceName === 'order-api' && nodes.get(edge.to)?.sourceName === 'order-worker');
        assert.ok(edge, 'The reviewed producer/consumer link must be present.');
        const previous = corrections.list().corrections.find(item => item.targetId === edge.id);
        note = corrections.save({ requestId: question.id, buildId: projection.buildId, targetKind: 'code-link', targetId: edge.id,
          projectionHash: projection.inputHash, expectedRevision: catalog.state().correctionRevision, expectedPreviousId: previous?.id ?? null,
          action: question.action, statement: question.statement, environment: question.environment });
      }
      // Only the question enters retrieval; expected answers and required uncertainty stay here.
      const context = answers.preview(question.question);
      const expectedNotes = note && question.action !== 'withdraw' ? [note.id] : [];
      assert.deepEqual(context.review.notes.map(item => item.id), expectedNotes);
      const originals = context.spans.map(span => catalog.evidence(span.id));
      const retrieved = fixture.manifest.evidence.filter(expected => originals.some(span => span.sourceName === expected.sourceId
        && span.revision === expected.revision && span.path === expected.path && span.contentHash === expected.contentHash
        && span.blobId === expected.blobId && span.startLine <= expected.startLine && span.endLine >= expected.endLine)).map(ref => ref.id);
      const missingEvidence = (question.evidence ?? []).filter(id => !retrieved.includes(id));
      current = { questionId: question.id, question: question.question, expected: question.expected,
        requiredUncertainty: question.requiredUncertainty, missingEvidence, retrievalComplete: missingEvidence.length === 0,
        note, issuedPrompt: answerPrompt(context), issuedPromptHash: digest(answerPrompt(context)), originals,
        dispatched: false, rawOutput: null, attempt: null, semanticReview: 'pending' };
      report.results.push(current); await save();
      const started = answers.start(question.id, question.question, context.buildId, context.inputHash);
      current.attempt = started; await save();
      await answers.idle(); current.attempt = answers.get(started.id);
      assert.deepEqual(current.attempt.context, context, 'Saved input must equal the preview dispatched.');
      current.resolvedCitations = 0;
      for (const claim of current.attempt.answer?.claims ?? []) for (const id of claim.evidenceIds) {
        assert.ok(context.spans.some(span => span.id === id)); assert.ok(catalog.evidence(id)); current.resolvedCitations++;
      }
      current.instructionCanaryReturned = (current.rawOutput ?? '').includes(reviewCanary);
      await save();
      onProgress({ question: question.id, status: current.attempt.status, resolvedCitations: current.resolvedCitations,
        usage: current.attempt.usage, reason: current.attempt.reason });
      // A failed attempt consumes its slot. No retries, fallback account or hidden model switch.
      if (current.attempt.status !== 'succeeded') break;
    }
    for (const source of fixture.manifest.sources) assert.equal(scaleGit(fixture.root, source.id, ['status', '--porcelain=v1']), '');
    report.sourceCheckoutsUnchanged = true;
    if (report.results.length === 24 && report.results.every(result => result.attempt?.status === 'succeeded')) {
      const snapshot = () => store.all('SELECT id,context,result FROM answer_attempts ORDER BY id');
      const before = snapshot(); await close(); open(); assert.deepEqual(snapshot(), before);
      const previous = report.results.find(result => result.questionId === 'r03');
      assert.equal(answers.get(previous.attempt.id).reviewState, 'changed');
      assert.equal(answers.get(previous.attempt.id).context.review.notes[0].statement, reviewCases[2].statement);
      const last = report.results.at(-1);
      assert.deepEqual(answers.get(last.attempt.id).context.review.notes, []);
      const replay = report.results[0], context = replay.attempt.context;
      assert.equal(answers.start(replay.questionId, context.question, context.buildId, context.inputHash).id, replay.attempt.id);
      assert.equal(calls, 24); assert.deepEqual(snapshot(), before);
      report.history = { persistedAttempts: before.length, exactReplayAdditionalCalls: 0, restartBytesUnchanged: true,
        withdrawnNoteAbsentFromNewInput: true, historicalNotePreserved: true, historicalReviewState: 'changed' };
      catalog.revoke(context.sources.find(source => source.name === 'order-api').sourceId);
      for (const result of report.results) {
        const fenced = answers.get(result.attempt.id);
        assert.equal(fenced.status, 'fenced'); assert.equal(fenced.context, null); assert.equal(fenced.answer, null);
      }
      assert.ok(snapshot().every(row => row.context === null && row.result === null));
      report.revocation = { fencedAttempts: 24, storedContextAndResultPurged: true,
        exportScope: 'This separate synthetic evaluation export retains pre-revocation evidence; external exports are not automatically purged.' };
    }
    report.operationallyComplete = report.results.length === 24 && report.results.every(result => result.attempt?.status === 'succeeded');
    return report;
  } catch (error) {
    report.failure = error instanceof Error ? error.message : String(error); throw error;
  } finally {
    report.applicationAttempts = calls; report.finishedAt = new Date().toISOString();
    try { await close(); } finally { try { await save(); } finally { await rm(fixture.root, { recursive: true, force: true }); } }
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [flag, executable, homeFlag, configHome, outputFlag, output] = process.argv.slice(2);
  if (flag !== '--executable' || homeFlag !== '--config-home' || outputFlag !== '--output' || !output || process.argv.length !== 8) {
    throw new Error('Usage: loredock-scale-answer-evaluation.mjs --executable /path/to/codex --config-home /selected/config --output /new/result/directory');
  }
  const modules = await Promise.all(['catalog', 'store', 'answers', 'corrections', 'code-flows', 'answer-context']
    .map(name => import(`../apps/loredock/dist/${name}.js`)));
  const { CodexTextRuntime } = await import('../packages/ai/dist/text-runtime.js');
  const report = await evaluateScaleAnswers({ output, connection: { executable, configHome, profile: null },
    runtime: new CodexTextRuntime(), onProgress: value => console.log(JSON.stringify(value)) }, Object.assign({}, ...modules));
  if (!report.operationallyComplete) process.exitCode = 1;
}
