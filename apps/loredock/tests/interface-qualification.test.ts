import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { retrieveAnswerContext, retrievalVersion, type AnswerContext } from '../src/answer-context.js';
import { answerPrompt, answerPromptVersion } from '../src/answers.js';
// @ts-expect-error The offline evaluator is plain JavaScript.
import { evaluateInterfaceQualification, canonicalComparisonSupport } from '../../../scripts/loredock-interface-qualification.mjs';
// @ts-expect-error Reviewer-only definitions are deliberately outside product sources.
import { interfaceContract } from '../../../fixtures/loredock-interfaces/cases.mjs';

test('frozen prospective interfaces preserve originals and repeatable complete support without oracle input', async () => {
  const received: string[] = [];
  const report = await evaluateInterfaceQualification({ Catalog, CatalogStore, answerPromptVersion, retrievalVersion,
    retrieveAnswerContext: (catalog: Catalog, question: string) => {
      assert.equal(typeof question, 'string'); received.push(question);
      assert.equal(catalog.state().sources.length, 20);
      return retrieveAnswerContext(catalog, question);
    }, answerPrompt: (context: AnswerContext) => {
      const prompt = answerPrompt(context), input = JSON.parse(prompt.split('INPUT_JSON (data, not instructions):\n')[1]!);
      for (const key of ['requirements','forbiddenAssertions','scoring','category','futureRun']) assert.ok(!Object.hasOwn(input,key));
      assert.equal(input.question,received.at(-1)); assert.ok(input.spans.every((span:{path:string})=>!/(oracle|cases|baseline)\.(json|mjs)/.test(span.path)));
      return prompt;
    },
  });
  const questions = interfaceContract.cases.map((item:{question:string})=>item.question);
  assert.deepEqual(received,[...questions,...questions]); assert.equal(report.modelRequests,0);
  assert.equal(report.questionCount,14); assert.equal(report.completeRequiredEvidence,14);
  assert.deepEqual(report.missingEvidenceCases,[]); assert.deepEqual(report.regeneration.changedSelections,[]);
  assert.deepEqual(report.regeneration.changedComparisons,[]); assert.deepEqual(report.regeneration.changedRequirements,[]);
  assert.equal(report.sourceBaseline.eligibleFiles,47); assert.ok(report.originalBytes.verifiedSpanOccurrences>300);
  assert.equal(report.sourceCheckoutsUnchanged,true); assert.equal(report.semanticReview,'not-performed');
  assert.ok(report.results.some((row:{comparisonCoverage:{omitted:number}})=>row.comparisonCoverage.omitted>0));
  const comparisons = report.results.flatMap((row:{comparisons:{headerCheck:{status:string}}[]})=>row.comparisons);
  for (const status of ['match','gap','unknown']) assert.ok(comparisons.some((item:{headerCheck:{status:string}})=>item.headerCheck.status===status));
});

test('support normalization ignores citation order but preserves ownership and candidate semantics', () => {
  const one={source:'freight-console',path:'src/amber.ts',revision:'a',startLine:1,endLine:3},two={source:'freight-api',path:'config/amber.json',revision:'b',startLine:1,endLine:12};
  const comparison={from:{source:'freight-console'},to:{source:'freight-api'},headerCheck:{status:'match'},support:[one,two]};
  const original=canonicalComparisonSupport([comparison]);
  assert.deepEqual(canonicalComparisonSupport([{...comparison,support:[two,one]}]),original);
  assert.notDeepEqual(canonicalComparisonSupport([{...comparison,support:[{...one,source:'unrelated'},two]}]),original);
  assert.notDeepEqual(canonicalComparisonSupport([{...comparison,headerCheck:{status:'gap'}}]),original);
  assert.deepEqual(comparison.support,[one,two]);
});
