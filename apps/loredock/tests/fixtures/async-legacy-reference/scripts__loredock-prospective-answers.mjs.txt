import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { completenessContract } from '../fixtures/loredock-completeness/cases.mjs';
import { verifyCompletenessBaseline, measureRequirement } from './loredock-completeness.mjs';
import { createScaleFixture, scaleBaseline, scaleGit } from './loredock-scale-fixture.mjs';
import { digest } from './loredock-fixture.mjs';

const pinnedFiles = ['apps/loredock/src/answers.ts', 'apps/loredock/src/answer-context.ts',
  'apps/loredock/src/answer-expansion.ts', 'apps/loredock/src/answer-review.ts',
  'packages/ai/src/text-runtime.ts', 'packages/ai/src/text-policy.ts', 'scripts/loredock-prospective-answers.mjs'];

export async function freezeProspectiveAnswers(identity) {
  const baseline = await verifyCompletenessBaseline(), sourceHashes = {};
  for (const file of pinnedFiles) sourceHashes[file] = digest(await readFile(new URL(`../${file}`, import.meta.url)));
  return { schemaVersion: 'loredock-prospective-answer-contract/1', frozenAt: new Date().toISOString(),
    questionContractHash: baseline.contractHash, baseline: baseline.sourceBaseline, sourceHashes, identity,
    model: 'gpt-5.6-terra', effort: 'medium', promptVersion: 'loredock-answer-v8',
    retrievalVersion: 'fts-question-v7', answerSchemaVersion: 'cited-answer-v3',
    budget: { maximumAttempts: 24, maximumRuns: 1, wallMsPerAttempt: 120000, automaticRetries: 0 },
    scoring: completenessContract.scoring, gate: 'All 24 cases pass; report development and reserved separately.',
    reservation: 'Already inspected for retrieval; same-agent authorship; no prompt tuning or second model run.' };
}

export async function verifyProspectiveContract(contract) {
  const expected = await freezeProspectiveAnswers(contract.identity);
  assert.ok(Number.isFinite(Date.parse(contract.frozenAt)));
  assert.deepEqual(contract, { ...expected, frozenAt: contract.frozenAt }, 'Frozen answer contract changed.');
}

// Explicit injected services/runtime keep ordinary tests and imports model-free.
export async function evaluateProspectiveAnswers({ output, contract, runtime, onProgress = () => {} }, services) {
  await verifyProspectiveContract(contract);
  const { Catalog, CatalogStore, Answers, answerPrompt, answerPromptVersion, answerSchemaVersion, retrievalVersion } = services;
  assert.equal(answerPromptVersion, contract.promptVersion); assert.equal(answerSchemaVersion, contract.answerSchemaVersion);
  assert.equal(retrievalVersion, contract.retrievalVersion); assert.ok(output && runtime);
  await mkdir(output, { recursive: false });
  const directory = path.join(output, 'catalog');
  let fixture, store, catalog, answers, current, calls = 0;
  const report = { schemaVersion: 'loredock-prospective-answers/1', startedAt: new Date().toISOString(),
    contract, contractHash: digest(JSON.stringify(contract)), applicationAttempts: 0, results: [],
    operationallyComplete: false, semanticReview: 'pending', independentReview: 'pending',
    cliInternalRequests: 'Not exposed by the adapter; application dispatches are counted separately.',
    historicalGate: completenessContract.scoring.historicalGate };
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
    try { assert.deepEqual(prepared.identity, contract.identity, 'Selected runtime changed after the frozen preflight.'); }
    catch (error) { await prepared.close(); throw error; }
    return { ...prepared, run: async request => {
      assert.ok(current && calls < contract.budget.maximumAttempts);
      assert.equal(request.model, contract.model); assert.equal(request.effort, contract.effort);
      assert.equal(request.prompt, current.issuedPrompt); assert.ok(Buffer.byteLength(request.prompt) <= 96 * 1024);
      report.applicationAttempts = ++calls; current.dispatched = true; await save();
      const result = await prepared.run(request); current.rawOutput = result.text; await save(); return result;
    } };
  } };
  const open = () => { store = new CatalogStore(directory); catalog = new Catalog(store); answers = new Answers(catalog, wrapped); };
  const close = async () => { await answers?.stop(); await catalog?.stop(); store?.close(); answers = catalog = store = undefined; };
  try {
    await save(); fixture = await createScaleFixture(); assert.deepEqual(scaleBaseline(fixture), contract.baseline);
    open();
    const paths = fixture.manifest.sources.map(source => path.join(fixture.root, 'sources', source.id));
    const preview = await catalog.previewSources(paths);
    await catalog.registerSources({ paths, previewHash: preview.previewHash, requestId: 'prospective' });
    const state = catalog.state(); catalog.start('prospective', state.sourceSetVersion, state.policyVersion); await catalog.idle();
    const { executable, configHome, profile } = contract.identity; await answers.configure({ executable, configHome, profile });
    for (const question of completenessContract.cases) {
      const context = answers.preview(question.question), originals = context.spans.map(span => catalog.evidence(span.id));
      assert.deepEqual(context.review.notes, []);
      const intent = completenessContract.intents.find(intent => intent.id === question.intentId);
      const requirements = intent.requirements.map(requirement => measureRequirement(requirement, originals, fixture.manifest));
      const prompt = answerPrompt(context);
      current = { questionId: question.id, split: question.split, intentId: question.intentId, question: question.question,
        requirements, issuedPrompt: prompt, issuedPromptHash: digest(prompt), originals,
        dispatched: false, rawOutput: null, attempt: null };
      report.results.push(current); await save();
      const started = answers.start(question.id, question.question, context.buildId, context.inputHash);
      current.attempt = started; await save();
      await answers.idle(); current.attempt = answers.get(started.id);
      assert.deepEqual(current.attempt.context, context);
      current.resolvedCitations = 0;
      for (const claim of current.attempt.answer?.claims ?? []) for (const id of claim.evidenceIds) {
        assert.ok(context.spans.some(span => span.id === id)); assert.ok(catalog.evidence(id)); current.resolvedCitations++;
      }
      await save(); onProgress({ question: question.id, status: current.attempt.status, usage: current.attempt.usage, reason: current.attempt.reason });
      if (current.attempt.status !== 'succeeded') break;
    }
    for (const source of fixture.manifest.sources) assert.equal(scaleGit(fixture.root, source.id, ['status', '--porcelain=v1']), '');
    report.sourceCheckoutsUnchanged = true;
    if (report.results.length === 24 && report.results.every(result => result.attempt.status === 'succeeded')) {
      const snapshot = () => store.all('SELECT id,context,result FROM answer_attempts ORDER BY id');
      const before = snapshot(); await close(); open(); assert.deepEqual(snapshot(), before);
      const replay = report.results[0], context = replay.attempt.context;
      assert.equal(answers.start(replay.questionId, context.question, context.buildId, context.inputHash).id, replay.attempt.id);
      assert.equal(calls, 24); assert.deepEqual(snapshot(), before);
      report.history = { persistedAttempts: before.length, restartBytesUnchanged: true, exactReplayAdditionalCalls: 0 };
      catalog.revoke(context.sources[0].sourceId);
      for (const result of report.results) {
        const fenced = answers.get(result.attempt.id);
        assert.equal(fenced.status, 'fenced'); assert.equal(fenced.context, null); assert.equal(fenced.answer, null);
      }
      assert.ok(snapshot().every(row => row.context === null && row.result === null));
      report.revocation = { fencedAttempts: 24, storedContextAndResultPurged: true,
        exportScope: 'This synthetic export retains pre-revocation evidence; external exports are not automatically purged.' };
      report.operationallyComplete = true;
    }
    return report;
  } catch (error) { report.failure = error instanceof Error ? error.message : String(error); throw error; }
  finally {
    report.finishedAt = new Date().toISOString();
    try { await close(); } finally { try { await save(); } finally { if (fixture) await rm(fixture.root, { recursive: true, force: true }); } }
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [flag, contractFile, outputFlag, output] = process.argv.slice(2);
  if (flag !== '--contract' || outputFlag !== '--output' || !output || process.argv.length !== 6) {
    throw new Error('Usage: loredock-prospective-answers.mjs --contract /frozen/contract.json --output /new/result/directory');
  }
  const contract = JSON.parse(await readFile(contractFile, 'utf8'));
  const modules = await Promise.all(['catalog', 'store', 'answers', 'answer-context'].map(name => import(`../apps/loredock/dist/${name}.js`)));
  const { CodexTextRuntime } = await import('../packages/ai/dist/text-runtime.js');
  const report = await evaluateProspectiveAnswers({ output, contract, runtime: new CodexTextRuntime(),
    onProgress: value => console.log(JSON.stringify(value)) }, Object.assign({}, ...modules));
  if (!report.operationallyComplete) process.exitCode = 1;
}
