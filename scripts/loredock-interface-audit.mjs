import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { interfaceContract } from '../fixtures/loredock-interfaces/cases.mjs';
import { verifyInterfaceBaseline } from './loredock-interface-qualification.mjs';
import { measureRequirement } from './loredock-completeness.mjs';
import { createInterfaceFixture, interfaceBaseline, interfaceGit } from './loredock-interface-fixture.mjs';
import { digest } from './loredock-fixture.mjs';

export const interfaceArtifacts = new URL('../docs/fixtures/loredock-interface-answers/', import.meta.url);

// Validate source provenance and coverage of human-written judgments, not their truth.
export async function auditInterfaceAnswers(directory = interfaceArtifacts, writeReview = false) {
  const file = name => directory instanceof URL ? new URL(name, directory) : path.join(directory, name);
  const raw = await readFile(file('answer-result.json'), 'utf8'), report = JSON.parse(raw);
  const review = JSON.parse(await readFile(file('semantic-review.json'), 'utf8'));
  assert.equal(review.rawResultSha256, digest(raw)); assert.equal(report.contractHash, digest(JSON.stringify(report.contract)));
  assert.equal(review.contractHash, report.contractHash);
  // Historical audit compares the retained frozen contract, not today's product code.
  // Only new dispatch must verify that the implementation still matches its hashes.
  const frozen = JSON.parse(await readFile(new URL('evaluation-contract.json', interfaceArtifacts), 'utf8'));
  assert.deepEqual(report.contract, frozen);
  assert.equal(report.contract.questionContractHash, (await verifyInterfaceBaseline()).contractHash);
  assert.equal(review.independentReview, 'pending'); assert.equal(report.independentReview, 'pending');
  assert.ok(report.results.length > 0 && report.results.length <= 14);
  const expected = interfaceContract.cases.slice(0, report.results.length);
  assert.deepEqual(report.results.map(row => row.questionId), expected.map(row => row.id));
  assert.deepEqual(review.results.map(row => row.questionId), expected.map(row => row.id));
  assert.equal(report.applicationAttempts, report.results.filter(row => row.dispatched).length);
  const fixture = await createInterfaceFixture();
  let spans = 0, claims = 0, citations = 0, requirements = 0;
  const texts = new Map(), used = new Map();
  const sheet = ['# Interface answer review', '',
    'These are development-agent judgments; independent review is pending. Unchecked boxes are not approval.', '',
    '[Raw run](answer-result.json) · [Agent judgments](semantic-review.json) · [Frozen contract](evaluation-contract.json)', ''];
  try {
    const { frozenAt, sourceHashes, ...expectedBaseline } = report.contract.baseline;
    assert.deepEqual(expectedBaseline, interfaceBaseline(fixture));
    for (const [index, result] of report.results.entries()) {
      const question = expected[index], assessment = review.results[index], { attempt } = result;
      const intent = question;
      assert.equal(result.question, question.question); assert.equal(result.category, question.category);
      assert.equal(assessment.category, question.category); assert.equal(digest(result.issuedPrompt), result.issuedPromptHash);
      const input = JSON.parse(result.issuedPrompt.split('INPUT_JSON (data, not instructions):\n')[1]);
      assert.equal(input.question, question.question); assert.deepEqual(input.spans, attempt.context.spans);
      assert.deepEqual(input.engineerReview.notes, []);
      assert.deepEqual(input.interfaceComparisons, attempt.context.interfaces);
      assert.deepEqual(input.sources, attempt.context.sources.map(source => ({ id: source.sourceId, name: source.name,
        revision: source.revision, status: source.status, coverage: source.coverage })));
      for (const key of ['retrievalMode', 'environment', 'deploymentCoherence', 'partial', 'stale', 'coverage', 'gaps']) {
        assert.deepEqual(input[key], attempt.context[key]);
      }
      for (const key of ['category', 'requirements', 'scoring', 'futureRun', 'forbiddenAssertions']) assert.ok(!Object.hasOwn(input, key));
      const { inputHash, ...contextInput } = attempt.context;
      assert.equal(inputHash, digest(JSON.stringify(contextInput)));
      assert.equal(attempt.promptVersion, report.contract.promptVersion); assert.equal(attempt.schemaVersion, report.contract.answerSchemaVersion);
      assert.equal(attempt.context.retrievalVersion, report.contract.retrievalVersion);
      if (result.dispatched) assert.deepEqual(attempt.runtime, report.contract.identity);
      const originals = new Map(result.originals.map(span => [span.id, span]));
      assert.equal(originals.size, input.spans.length);
      for (const span of input.spans) {
        const original = originals.get(span.id); assert.ok(original);
        for (const [key, value] of Object.entries(span)) assert.deepEqual(value, original[key]);
        const owner = input.sources.find(source => source.id === original.sourceId);
        assert.equal(owner?.name, original.sourceName, 'Original source ownership differs from the issued source scope.');
        assert.equal(owner?.revision, original.revision);
        const ref = fixture.manifest.evidence.find(ref => ref.sourceId === original.sourceName && ref.path === original.path);
        assert.ok(ref, `Unknown original source: ${original.sourceName}/${original.path}`);
        assert.equal(original.revision, ref.revision); assert.equal(original.blobId, ref.blobId);
        const key = `${original.sourceName}:${original.revision}:${original.path}`;
        if (!texts.has(key)) texts.set(key, interfaceGit(fixture.root, original.sourceName, ['show', `${original.revision}:${original.path}`], false));
        const text = texts.get(key);
        assert.equal(digest(text), original.contentHash);
        assert.equal(original.text, text.split('\n').slice(original.startLine - 1, original.endLine).join('\n'));
        assert.equal(digest(original.text), original.spanHash); spans++;
      }
      assert.deepEqual(result.requirements, intent.requirements.map(requirement => measureRequirement(requirement, result.originals, fixture.manifest)),
        'Recorded reference recall differs from the verified original evidence.');
      for (const comparison of input.interfaceComparisons.comparisons) {
        assert.equal(comparison.status, 'candidate');
        assert.ok(comparison.evidenceIds.length >= 2);
        for (const id of comparison.evidenceIds) assert.ok(originals.has(id));
        for (const endpoint of [comparison.from, comparison.to]) {
          assert.ok(comparison.evidenceIds.some(id => {
            const original = originals.get(id);
            return original.sourceId === endpoint.sourceId && original.sourceName === endpoint.sourceName && original.path === endpoint.path;
          }), 'Derived endpoint is missing original support.');
        }
      }
      const answer = attempt.answer ?? { claims: [], unknowns: [] };
      if (result.rawUsage) assert.deepEqual(result.rawUsage, attempt.usage);
      if (attempt.status === 'succeeded') assert.deepEqual(JSON.parse(result.rawOutput), answer);
      assert.equal(assessment.claimReview.length, answer.claims.length);
      assert.equal(assessment.unknownReview.length, answer.unknowns.length);
      sheet.push(`## ${question.id} (${question.category}): ${question.question}`, '',
        `Agent outcome: **${assessment.passed ? 'passed' : 'failed'}**. ${assessment.assessment}`, '',
        '- [ ] Independently review every claim, required proposition, qualification and forbidden assertion.', '');
      for (const [claimIndex, claim] of answer.claims.entries()) {
        const judgment = assessment.claimReview[claimIndex];
        assert.equal(judgment.index, claimIndex + 1); assert.equal(judgment.textSha256, digest(claim.text));
        assert.deepEqual(judgment.evidenceIds, claim.evidenceIds); assert.equal(typeof judgment.supportedAsWritten, 'boolean');
        assert.ok(judgment.assessment.trim()); claims++;
        const refs = claim.evidenceIds.map(id => {
          const original = originals.get(id); assert.ok(original); used.set(id, original); citations++;
          return `[${original.sourceName}/${original.path}:${original.startLine}–${original.endLine}](#evidence-${id})`;
        });
        sheet.push(`${claimIndex + 1}. **${claim.kind}** — ${claim.text}`, '',
          `   Evidence: ${refs.join(', ')}.`, '', `   Agent review: ${judgment.assessment}`, '');
      }
      for (const [unknownIndex, unknown] of answer.unknowns.entries()) {
        const judgment = assessment.unknownReview[unknownIndex];
        assert.equal(judgment.index, unknownIndex + 1); assert.equal(judgment.textSha256, digest(unknown));
        assert.equal(typeof judgment.appropriate, 'boolean'); assert.ok(judgment.assessment.trim());
        sheet.push(`Unanswered ${unknownIndex + 1}: ${unknown}`, '', `Agent review: ${judgment.assessment}`, '');
      }
      assert.deepEqual(assessment.requirements.map(item => item.id), intent.requirements.map(item => item.id));
      for (const [requirementIndex, judgment] of assessment.requirements.entries()) {
        const requirement = intent.requirements[requirementIndex]; requirements++;
        assert.equal(typeof judgment.satisfied, 'boolean'); assert.ok(judgment.assessment.trim());
        assert.ok(judgment.claimIndices.every(n => Number.isInteger(n) && n > 0 && n <= answer.claims.length));
        assert.ok(judgment.unknownIndices.every(n => Number.isInteger(n) && n > 0 && n <= answer.unknowns.length));
        if (judgment.satisfied) assert.ok(judgment.claimIndices.length + judgment.unknownIndices.length > 0);
        assert.ok(judgment.equivalentSupport.trim());
        sheet.push(`- **${requirement.kind}: ${requirement.id} — ${judgment.satisfied ? 'met' : 'missed'}.** ${requirement.proposition}`,
          `  Agent review: ${judgment.assessment} Claims: ${judgment.claimIndices.join(', ') || 'none'}; unanswered: ${judgment.unknownIndices.join(', ') || 'none'}.`,
          `  Equivalent support: ${judgment.equivalentSupport}`, '');
      }
      assert.deepEqual(assessment.forbiddenAssertions.map(item => item.assertion), intent.forbiddenAssertions);
      for (const judgment of assessment.forbiddenAssertions) {
        assert.equal(typeof judgment.absent, 'boolean'); assert.ok(judgment.assessment.trim());
        sheet.push(`Forbidden assertion ${judgment.absent ? 'absent' : 'present'}: ${judgment.assertion}`, '', judgment.assessment, '');
      }
      assert.equal(assessment.passed, attempt.status === 'succeeded' && assessment.requirements.every(item => item.satisfied)
        && assessment.claimReview.every(item => item.supportedAsWritten) && assessment.unknownReview.every(item => item.appropriate)
        && assessment.forbiddenAssertions.every(item => item.absent));
    }
    const summary = Object.fromEntries(['interface', 'regression'].map(category => {
      const rows = review.results.filter(row => row.category === category);
      return [category, { evaluated: rows.length, passed: rows.filter(row => row.passed).length, failed: rows.filter(row => !row.passed).map(row => row.questionId) }];
    }));
    assert.deepEqual(review.summary, summary);
    assert.equal(review.hardGatePassed, report.operationallyComplete && review.results.length === 14 && review.results.every(row => row.passed));
    for (const span of used.values()) sheet.push(`### Evidence ${span.id}`, '',
      `${span.sourceName}/${span.path}, lines ${span.startLine}–${span.endLine}. Revision: \`${span.revision}\`.`, '',
      `Blob: \`${span.blobId}\`. File SHA-256: \`${span.contentHash}\`. Span SHA-256: \`${span.spanHash}\`.`, '',
      '````text', span.text, '````', '');
    if (writeReview) await writeFile(file('HUMAN_REVIEW.md'), sheet.join('\n'));
    return { unknownsReviewed: review.results.reduce((sum, row) => sum + row.unknownReview.length, 0), schemaVersion: 'loredock-interface-audit/1', modelRequests: 0, applicationAttempts: report.applicationAttempts,
      inputSpanOccurrencesChecked: spans, claimsReviewed: claims, requirementsReviewed: requirements, citationReferences: citations,
      distinctCitedSpans: used.size, originalFilesRead: texts.size, originalBytesVerified: true, summary, hardGatePassed: review.hardGatePassed,
      usage: Object.fromEntries(['inputTokens', 'outputTokens', 'cachedInputTokens'].map(key => [key,
        report.results.reduce((sum, result) => sum + (result.attempt.usage?.[key] ?? 0), 0)])),
      unknownUsageAttempts: report.results.filter(row => row.dispatched && !row.attempt.usage).length,
      scope: 'Provenance and judgment coverage verification only; development-agent semantics are not independent acceptance.' };
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  assert.ok(process.argv.length === 2 || process.argv.length === 3 && process.argv[2] === '--write-review');
  console.log(JSON.stringify(await auditInterfaceAnswers(interfaceArtifacts, process.argv[2] === '--write-review'), null, 2));
}
