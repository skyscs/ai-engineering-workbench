import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { Catalog } from '../apps/loredock/dist/catalog.js';
import { CatalogStore } from '../apps/loredock/dist/store.js';
import { Answers, answerPromptVersion } from '../apps/loredock/dist/answers.js';
import { CodexTextRuntime } from '../packages/ai/dist/text-runtime.js';
import { answerSchemaVersion, retrievalVersion } from '../apps/loredock/dist/answer-context.js';
import { createLoreDockFixture, fixtureGit, repositoryIds } from './loredock-fixture.mjs';

// Explicit, paid acceptance runner. Never imported by the product or automatic tests.
// Only frozen question strings enter Answers; oracle comparison occurs afterward.
const [flag, executable, homeFlag, configHome, outputFlag, output] = process.argv.slice(2);
if (flag !== '--executable' || homeFlag !== '--config-home' || outputFlag !== '--output' || !output || process.argv.length !== 8) {
  throw new Error('Usage: loredock-answer-evaluation.mjs --executable /path/to/codex --config-home /selected/config --output /new/result/directory');
}
await mkdir(output, { recursive: false });
const fixture = await createLoreDockFixture();
const store = new CatalogStore(path.join(output, 'catalog')), catalog = new Catalog(store);
const runtime = new CodexTextRuntime(); let rawOutput = null;
const answers = new Answers(catalog, { prepare: async (...args) => {
  const prepared = await runtime.prepare(...args);
  return { ...prepared, run: async request => { const result = await prepared.run(request); rawOutput = result.text; return result; } };
} });
const report = { schemaVersion: 'loredock-answer-evaluation/1', startedAt: new Date().toISOString(),
  budget: { maximumAttempts: 20, wallMsPerAttempt: 120000, automaticRetries: 0 },
  model: 'gpt-5.6-terra', effort: 'medium', promptVersion: answerPromptVersion, schema: answerSchemaVersion, retrievalVersion,
  revisionVector: fixture.manifest.revisionVector, results: [], semanticReview: 'pending; mechanical resolution is not grounding' };
const save = () => writeFile(path.join(output, 'answer-result.json'), JSON.stringify(report, null, 2) + '\n');
try {
  for (const id of repositoryIds) await catalog.addSource(path.join(fixture.root, 'sources', id));
  const state = catalog.state(); catalog.start('evaluation-index', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  await answers.configure({ executable, configHome, profile: null });
  await save();
  for (const question of fixture.oracle.questions) {
    rawOutput = null;
    const context = answers.preview(question.question);
    const started = answers.start(question.id, question.question, context.buildId, context.inputHash);
    await answers.idle();
    const attempt = answers.get(started.id);
    const retrieved = fixture.manifest.evidence.filter(expected => context.spans.some(span =>
      span.sourceName === expected.sourceId && span.revision === expected.revision && span.path === expected.path
      && span.startLine <= expected.startLine && span.endLine >= expected.endLine)).map(span => span.id);
    const missingEvidence = question.evidence.filter(id => !retrieved.includes(id));
    let resolvedCitations = 0;
    for (const claim of attempt.answer?.claims ?? []) for (const id of claim.evidenceIds) {
      assert.ok(catalog.evidence(id)); resolvedCitations++;
    }
    report.results.push({ questionId: question.id, missingEvidence, retrievalComplete: missingEvidence.length === 0,
      resolvedCitations, semanticReview: 'pending', rawOutput, attempt });
    await save();
    console.log(JSON.stringify({ question: question.id, status: attempt.status, resolvedCitations, usage: attempt.usage, reason: attempt.reason }));
    // Stop on operational failure. Never retry or spend the remaining budget blindly.
    if (attempt.status !== 'succeeded') break;
  }
  for (const id of repositoryIds) assert.equal(fixtureGit(fixture.root, id, ['status', '--porcelain=v1']), '');
  report.sourceCheckoutsUnchanged = true;
} finally {
  report.finishedAt = new Date().toISOString(); await save();
  await answers.stop(); await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true });
}
