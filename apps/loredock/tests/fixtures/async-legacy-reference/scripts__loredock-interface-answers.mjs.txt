import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rename, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { interfaceContract } from '../fixtures/loredock-interfaces/cases.mjs';
import { verifyInterfaceBaseline } from './loredock-interface-qualification.mjs';
import { measureRequirement } from './loredock-completeness.mjs';
import { createInterfaceFixture, interfaceBaseline, interfaceGit } from './loredock-interface-fixture.mjs';
import { digest } from './loredock-fixture.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const defaultRunLedger = path.join(repository, '.loredock-evaluations');

async function implementationHashes() {
  const files = ['pnpm-lock.yaml', 'apps/loredock/package.json', 'packages/ai/package.json', 'packages/core/package.json',
    'scripts/loredock-interface-answers.mjs', 'scripts/loredock-interface-qualification.mjs',
    'scripts/loredock-completeness.mjs', 'scripts/loredock-fixture.mjs'];
  // The CLI loads daemon TypeScript through tsx; workspace package exports load built JS.
  // Pin both source and the package bytes actually consumed, including adapter dependencies.
  for (const folder of ['apps/loredock/src', 'packages/ai/src', 'packages/core/src', 'packages/ai/dist', 'packages/core/dist']) {
    for (const entry of await readdir(path.join(repository, folder), { recursive: true })) {
      if (folder.endsWith('/dist') ? entry.endsWith('.js') : entry.endsWith('.ts')) files.push(`${folder}/${entry}`);
    }
  }
  const hashes = {};
  for (const file of files.sort()) hashes[file] = digest(await readFile(path.join(repository, file)));
  return hashes;
}

export async function freezeInterfaceAnswers(identity) {
  const baseline = await verifyInterfaceBaseline();
  const { maximumAttempts, maximumRuns, wallMsPerAttempt, automaticRetries, model, effort,
    promptVersion, retrievalVersion, answerSchemaVersion } = interfaceContract.futureRun;
  return { schemaVersion: 'loredock-interface-answer-contract/1', frozenAt: new Date().toISOString(),
    questionContractHash: baseline.contractHash, baseline, sourceHashes: await implementationHashes(), identity,
    nodeVersion: process.version, model, effort, promptVersion, retrievalVersion, answerSchemaVersion,
    budget: { maximumAttempts, maximumRuns, wallMsPerAttempt, automaticRetries },
    scoring: interfaceContract.scoring, reservation: interfaceContract.reservation };
}

export async function verifyInterfaceAnswerContract(contract) {
  const expected = await freezeInterfaceAnswers(contract.identity);
  assert.ok(Number.isFinite(Date.parse(contract.frozenAt)));
  assert.deepEqual(contract, { ...expected, frozenAt: contract.frozenAt }, 'Frozen interface answer contract changed.');
}

// Explicit injected services/runtime keep ordinary tests and imports model-free.
export async function evaluateInterfaceAnswers({ output, contract, runtime, runLedger = defaultRunLedger, onProgress = () => {} }, services) {
  await verifyInterfaceAnswerContract(contract);
  const { Catalog, CatalogStore, Answers, answerPrompt, answerPromptVersion, answerSchemaVersion, retrievalVersion } = services;
  assert.equal(answerPromptVersion, contract.promptVersion); assert.equal(answerSchemaVersion, contract.answerSchemaVersion);
  assert.equal(retrievalVersion, contract.retrievalVersion); assert.ok(output && runtime);
  await mkdir(output, { recursive: false });
  await mkdir(runLedger, { recursive: true });
  // One task-level claim, not one per output path or newly generated contract hash.
  // Tests inject an isolated ledger. CLI execution always uses the repository ledger.
  await writeFile(path.join(runLedger, 'task034-interface.json'), JSON.stringify({
    claimedAt: new Date().toISOString(), contractHash: digest(JSON.stringify(contract)), output: path.resolve(output),
  }) + '\n', { flag: 'wx' });
  const directory = path.join(output, 'catalog');
  let fixture, store, catalog, answers, current, calls = 0;
  const report = { schemaVersion: 'loredock-interface-answers/1', startedAt: new Date().toISOString(),
    contract, contractHash: digest(JSON.stringify(contract)), applicationAttempts: 0, results: [],
    operationallyComplete: false, semanticReview: 'pending', independentReview: 'pending',
    cliInternalRequests: 'Not exposed by the adapter; application dispatches are counted separately.',
    historicalGate: interfaceContract.scoring.historicalGate };
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
      const result = await prepared.run(request);
      current.rawOutput = result.text; current.rawUsage = result.usage; current.rawUsageUnknownReason = result.usageUnknownReason;
      await save(); return result;
    } };
  } };
  const open = () => { store = new CatalogStore(directory); catalog = new Catalog(store); answers = new Answers(catalog, wrapped); };
  const close = async () => { await answers?.stop(); await catalog?.stop(); store?.close(); answers = catalog = store = undefined; };
  try {
    await save(); fixture = await createInterfaceFixture();
    const { frozenAt, sourceHashes, ...expectedBaseline } = contract.baseline;
    assert.deepEqual(interfaceBaseline(fixture), expectedBaseline);
    open();
    const paths = fixture.manifest.sources.map(source => path.join(fixture.root, 'sources', source.id));
    const preview = await catalog.previewSources(paths);
    await catalog.registerSources({ paths, previewHash: preview.previewHash, requestId: 'interface-answers' });
    const state = catalog.state(); catalog.start('interface-answers', state.sourceSetVersion, state.policyVersion); await catalog.idle();
    const { executable, configHome, profile } = contract.identity; await answers.configure({ executable, configHome, profile });
    for (const question of interfaceContract.cases) {
      const context = answers.preview(question.question), originals = context.spans.map(span => catalog.evidence(span.id));
      assert.deepEqual(context.review.notes, []);
      const requirements = question.requirements.map(requirement => measureRequirement(requirement, originals, fixture.manifest));
      const prompt = answerPrompt(context);
      current = { questionId: question.id, category: question.category, question: question.question,
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
    for (const source of fixture.manifest.sources) assert.equal(interfaceGit(fixture.root, source.id, ['status', '--porcelain=v1']), '');
    report.sourceCheckoutsUnchanged = true;
    if (report.results.length === 14 && report.results.every(result => result.attempt.status === 'succeeded')) {
      const snapshot = () => store.all('SELECT id,context,result FROM answer_attempts ORDER BY id');
      const before = snapshot(); await close(); open(); assert.deepEqual(snapshot(), before);
      const replay = report.results[0], context = replay.attempt.context;
      assert.equal(answers.start(replay.questionId, context.question, context.buildId, context.inputHash).id, replay.attempt.id);
      assert.equal(calls, 14); assert.deepEqual(snapshot(), before);
      report.history = { persistedAttempts: before.length, restartBytesUnchanged: true, exactReplayAdditionalCalls: 0 };
      catalog.revoke(context.sources[0].sourceId);
      for (const result of report.results) {
        const fenced = answers.get(result.attempt.id);
        assert.equal(fenced.status, 'fenced'); assert.equal(fenced.context, null); assert.equal(fenced.answer, null);
      }
      assert.ok(snapshot().every(row => row.context === null && row.result === null));
      report.revocation = { fencedAttempts: 14, storedContextAndResultPurged: true,
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
    throw new Error('Usage: loredock-interface-answers.mjs --contract /frozen/contract.json --output /new/result/directory');
  }
  const contract = JSON.parse(await readFile(contractFile, 'utf8'));
  const modules = await Promise.all(['catalog', 'store', 'answers', 'answer-context'].map(name => import(`../apps/loredock/src/${name}.ts`)));
  const { CodexTextRuntime } = await import('../packages/ai/dist/text-runtime.js');
  const report = await evaluateInterfaceAnswers({ output, contract, runtime: new CodexTextRuntime(),
    onProgress: value => console.log(JSON.stringify(value)) }, Object.assign({}, ...modules));
  if (!report.operationallyComplete) process.exitCode = 1;
}
