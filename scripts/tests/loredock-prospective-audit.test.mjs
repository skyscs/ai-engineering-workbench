import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { digest } from '../loredock-fixture.mjs';
import { auditProspectiveAnswers, prospectiveArtifacts } from '../loredock-prospective-audit.mjs';

test('prospective audit reconstructs originals and preserves the failed semantic outcome', async () => {
  const audit = await auditProspectiveAnswers();
  assert.equal(audit.modelRequests, 0); assert.equal(audit.applicationAttempts, 24);
  assert.equal(audit.originalBytesVerified, true); assert.equal(audit.hardGatePassed, false);
  assert.equal(audit.summary.development.passed, 11); assert.equal(audit.summary.reserved.passed, 12);
  assert.deepEqual(audit.summary.development.failed, ['d10']);
  assert.ok(audit.inputSpanOccurrencesChecked > 0 && audit.claimsReviewed > 0 && audit.requirementsReviewed > 0);
});

test('prospective audit rejects missing judgments, wrong ownership and altered recall despite consistent hashes', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'loredock-prospective-audit-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const raw = await readFile(new URL('answer-result.json', prospectiveArtifacts), 'utf8');
  const originalReview = JSON.parse(await readFile(new URL('semantic-review.json', prospectiveArtifacts), 'utf8'));
  const review = structuredClone(originalReview); review.results[0].requirements.pop();
  await writeFile(path.join(directory, 'answer-result.json'), raw);
  await writeFile(path.join(directory, 'semantic-review.json'), JSON.stringify(review));
  await assert.rejects(auditProspectiveAnswers(directory));
  const report = JSON.parse(raw), row = report.results[0], marker = 'INPUT_JSON (data, not instructions):\n';
  const [prefix, serialized] = row.issuedPrompt.split(marker), input = JSON.parse(serialized);
  const spanId = input.spans[0].id;
  input.spans[0].sourceName = 'wrong-owner'; row.attempt.context.spans[0].sourceName = 'wrong-owner';
  row.originals.find(span => span.id === spanId).sourceName = 'wrong-owner';
  const { inputHash: _oldHash, ...contextInput } = row.attempt.context;
  row.attempt.context.inputHash = digest(JSON.stringify(contextInput));
  row.issuedPrompt = prefix + marker + JSON.stringify(input); row.issuedPromptHash = digest(row.issuedPrompt);
  const changed = JSON.stringify(report); originalReview.rawResultSha256 = digest(changed);
  await writeFile(path.join(directory, 'answer-result.json'), changed);
  await writeFile(path.join(directory, 'semantic-review.json'), JSON.stringify(originalReview));
  await assert.rejects(auditProspectiveAnswers(directory), /Original source ownership/);
  const changedRecall = JSON.parse(raw); changedRecall.results[0].requirements[0].available = false;
  const recallRaw = JSON.stringify(changedRecall); originalReview.rawResultSha256 = digest(recallRaw);
  await writeFile(path.join(directory, 'answer-result.json'), recallRaw);
  await writeFile(path.join(directory, 'semantic-review.json'), JSON.stringify(originalReview));
  await assert.rejects(auditProspectiveAnswers(directory), /Recorded reference recall/);
});
