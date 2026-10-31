import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createScaleFixture, scaleBaseline, scaleGit } from './loredock-scale-fixture.mjs';
import { digest } from './loredock-fixture.mjs';
import { reviewCases } from '../fixtures/loredock-scale/review-cases.mjs';

export const scaleAnswerArtifacts = new URL('../docs/fixtures/loredock-scale-answer-quality/', import.meta.url);

// Reconstruct original source bytes without trusting the product's saved text. This
// verifies provenance and review completeness, never the semantic verdict itself.
export async function auditScaleAnswers(directory = scaleAnswerArtifacts, writeReview = false) {
  const fixture = await createScaleFixture(), results = [];
  const file = name => directory instanceof URL ? new URL(name, directory) : path.join(directory, name);
  try {
    for (const version of ['v7', 'v8']) {
      const raw = await readFile(file(`answer-result-${version}.json`), 'utf8'), report = JSON.parse(raw);
      const review = JSON.parse(await readFile(file(`semantic-review-${version}.json`), 'utf8'));
      assert.equal(review.rawResultSha256, digest(raw)); assert.deepEqual(report.baseline, scaleBaseline(fixture));
      assert.equal(report.reviewCasesHash, digest(JSON.stringify(reviewCases)));
      const questions = [...fixture.oracle.questions, ...reviewCases];
      assert.deepEqual(report.results.map(result => result.questionId), questions.map(question => question.id));
      assert.deepEqual(review.results.map(result => result.questionId), questions.map(question => question.id));
      let spans = 0, claims = 0, citations = 0;
      const texts = new Map(), used = new Map(), sheet = [
        `# Expanded answer review — ${version}`, '',
        'All judgments below are development-agent assessments. Independent human review is pending.', '',
        `Raw results: [complete run](answer-result-${version}.json). Assessment: [JSON](semantic-review-${version}.json).`, '',
        `Score: ${review.expandedUsefulCorrect}/20 expanded answers; ${review.reviewCasesPassed}/4 engineer-review cases. Hard gate: **${review.hardGatePassed ? 'passed' : 'failed'}**.`, '',
        'The original evidence appendix contains every cited passage, revision and hash. Unchecked boxes do not record approval.', '',
      ];
      for (const [index, result] of report.results.entries()) {
        const assessment = review.results[index], question = questions[index], { attempt } = result;
        assert.equal(result.question, question.question); assert.equal(result.expected, question.expected);
        assert.equal(result.requiredUncertainty, question.requiredUncertainty);
        assert.equal(attempt.status, 'succeeded'); assert.equal(digest(result.issuedPrompt), result.issuedPromptHash);
        const input = JSON.parse(result.issuedPrompt.split('INPUT_JSON (data, not instructions):\n')[1]);
        assert.deepEqual(input.spans, attempt.context.spans); assert.deepEqual(input.engineerReview.notes, attempt.context.review.notes);
        assert.equal(input.question, question.question); assert.ok(!Object.hasOwn(input, 'expected'));
        assert.deepEqual(JSON.parse(result.rawOutput), attempt.answer);
        assert.equal(assessment.claimReview.length, attempt.answer.claims.length);
        const originals = new Map(result.originals.map(span => [span.id, span]));
        for (const span of input.spans) {
          const original = originals.get(span.id); assert.ok(original);
          for (const [key, value] of Object.entries(span)) assert.deepEqual(value, original[key]);
          const key = `${original.sourceName}:${original.revision}:${original.path}`;
          if (!texts.has(key)) texts.set(key, scaleGit(fixture.root, original.sourceName, ['show', `${original.revision}:${original.path}`], false));
          const text = texts.get(key), ref = fixture.manifest.evidence.find(ref => ref.sourceId === original.sourceName && ref.path === original.path);
          assert.ok(ref); assert.equal(original.revision, ref.revision); assert.equal(original.blobId, ref.blobId);
          assert.equal(digest(text), original.contentHash);
          assert.equal(original.text, text.split('\n').slice(original.startLine - 1, original.endLine).join('\n'));
          assert.equal(digest(original.text), original.spanHash); spans++;
        }
        sheet.push(`## ${question.id}: ${question.question}`, '', `Expected: ${question.expected}`, '',
          `Required uncertainty: ${question.requiredUncertainty}`, '', `Agent assessment: ${assessment.assessment}`, '',
          '- [ ] Independently review every claim, citation and required limitation.', '');
        if (result.note) sheet.push(`Engineer action: **${result.note.action}**, version ${result.note.version}.`, '',
          `Statement: ${result.note.statement ?? '(withdrawn; no statement supplied)'}`, '');
        for (const [claimIndex, claim] of attempt.answer.claims.entries()) {
          const judgment = assessment.claimReview[claimIndex];
          assert.equal(judgment.index, claimIndex + 1); assert.equal(judgment.textSha256, digest(claim.text));
          assert.deepEqual(judgment.evidenceIds, claim.evidenceIds);
          const refs = claim.evidenceIds.map(id => {
            const span = originals.get(id); assert.ok(span); assert.ok(input.spans.some(span => span.id === id));
            used.set(id, span); citations++;
            return `[${span.sourceName}/${span.path}:${span.startLine}–${span.endLine}](#evidence-${id})`;
          });
          sheet.push(`${claimIndex + 1}. **${claim.kind}** — ${claim.text}`, '', `   Evidence: ${refs.join(', ')}.`, '');
          if (!judgment.supportedAsWritten) sheet.push(`   **Rejected:** ${judgment.assessment}`, '');
          claims++;
        }
        sheet.push('Unanswered questions:', '', ...attempt.answer.unknowns.map(text => `- ${text}`), '');
        assert.deepEqual(assessment.materialUnsupportedClaimIndices,
          assessment.claimReview.filter(claim => !claim.supportedAsWritten).map(claim => claim.index));
      }
      assert.equal(review.expandedUsefulCorrect, review.results.slice(0, 20).filter(result => result.usefulCorrect).length);
      assert.equal(review.reviewCasesPassed, review.results.slice(20).filter(result => result.usefulCorrect).length);
      assert.equal(review.materialUnsupportedClaims, review.results.reduce((sum, result) => sum + result.materialUnsupportedClaimIndices.length, 0));
      assert.deepEqual(review.missingRequiredUncertaintyQuestions, review.results.filter(result => !result.requiredUncertaintyPreserved).map(result => result.questionId));
      assert.equal(review.hardGatePassed, review.expandedUsefulCorrect >= 18 && review.reviewCasesPassed === 4
        && review.materialUnsupportedClaims === 0 && review.missingRequiredUncertaintyQuestions.length === 0);
      for (const span of used.values()) sheet.push(`### Evidence ${span.id}`, '',
        `${span.sourceName}/${span.path}, lines ${span.startLine}–${span.endLine}. Revision: \`${span.revision}\`.`, '',
        `Blob: \`${span.blobId}\`. File SHA-256: \`${span.contentHash}\`. Span SHA-256: \`${span.spanHash}\`.`, '',
        '````text', span.text, '````', '');
      if (writeReview) await writeFile(file(`HUMAN_REVIEW-${version}.md`), sheet.join('\n'));
      results.push({ version, completeAttempts: report.results.length, inputSpanOccurrencesChecked: spans,
        claimsReviewed: claims, citationReferences: citations, distinctCitedSpans: used.size, originalFilesRead: texts.size,
        sourceBytesAndHashesMatch: true, reviewCoversEveryClaim: true, hardGatePassed: review.hardGatePassed,
        usage: Object.fromEntries(['inputTokens', 'outputTokens', 'cachedInputTokens'].map(key => [key,
          report.results.reduce((sum, result) => sum + (result.attempt.usage?.[key] ?? 0), 0)])),
        unknownUsageAttempts: report.results.filter(result => !result.attempt.usage).length });
    }
    return { schemaVersion: 'loredock-scale-answer-audit/1', modelRequests: 0, results,
      semanticReviewScope: 'Verifies original bytes and completeness/integrity of separately recorded agent judgments, not independent semantic acceptance.' };
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  assert.ok(process.argv.length === 2 || process.argv.length === 3 && process.argv[2] === '--write-review');
  console.log(JSON.stringify(await auditScaleAnswers(scaleAnswerArtifacts, process.argv[2] === '--write-review'), null, 2));
}
