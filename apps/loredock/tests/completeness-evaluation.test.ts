import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { answerLimits, retrieveAnswerContext, retrievalVersion, type AnswerContext } from '../src/answer-context.js';
import { answerPrompt, answerPromptVersion } from '../src/answers.js';
// @ts-expect-error The independent evaluator is plain JavaScript.
import { evaluateCompleteness } from '../../../scripts/loredock-completeness.mjs';
// @ts-expect-error Reviewer-only fixture definitions are plain JavaScript.
import { completenessCases } from '../../../fixtures/loredock-completeness/cases.mjs';

test('prospective retrieval admits only question strings and records repeatable missing support without model calls', async () => {
  const received: string[] = [];
  const report = await evaluateCompleteness({ Catalog, CatalogStore, answerLimits, answerPromptVersion, retrievalVersion,
    retrieveAnswerContext: (catalog: Catalog, question: string) => {
      assert.equal(typeof question, 'string'); received.push(question);
      assert.equal(catalog.state().sources.length, 20);
      return retrieveAnswerContext(catalog, question);
    },
    answerPrompt: (context: AnswerContext) => {
      const prompt = answerPrompt(context), input = JSON.parse(prompt.split('INPUT_JSON (data, not instructions):\n')[1]!);
      assert.equal(input.question, received.at(-1));
      for (const key of ['intentId', 'requirements', 'proposition', 'optionalContext', 'forbiddenAssertions']) assert.ok(!Object.hasOwn(input, key));
      assert.ok(input.spans.every((span: { path: string }) => !/completeness|oracle|baseline/.test(span.path)));
      return prompt;
    },
  });
  const questions = completenessCases.map((item: { question: string }) => item.question);
  assert.deepEqual(received, [...questions, ...questions]);
  assert.equal(report.modelRequests, 0); assert.equal(report.modelUsage, null);
  assert.equal(report.summary.development.completeRequiredEvidence, 12);
  assert.deepEqual(report.summary.reserved.missingEvidenceCases, ['h02', 'h04']);
  assert.deepEqual(report.regeneration.summary, report.summary);
  assert.deepEqual(report.regeneration.changedSelections, []); assert.deepEqual(report.regeneration.changedRequirements, []);
  assert.equal(report.sourceCheckoutsUnchanged, true); assert.match(report.historicalGate, /remains failed/);
  const historical = report.historical.find((row: { run: string; questionId: string }) => row.run === 'v8' && row.questionId === 's04');
  assert.ok(historical.supportingPassages.every((ref: { rank: number | null }) => ref.rank !== null));
  assert.equal(historical.supportingPassages.find((ref: { id: string }) => ref.id === 'contract-library/contracts/StockReserved.json').cited, false);
});
