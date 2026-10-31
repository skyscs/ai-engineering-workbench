import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { digest } from '../loredock-fixture.mjs';
import { auditInterfaceAnswers, interfaceArtifacts } from '../loredock-interface-audit.mjs';

test('interface audit reconstructs originals and preserves the failed semantic outcome', async () => {
  const audit = await auditInterfaceAnswers();
  assert.equal(audit.modelRequests, 0); assert.equal(audit.applicationAttempts, 14);
  assert.equal(audit.originalBytesVerified, true); assert.equal(audit.hardGatePassed, false);
  assert.equal(audit.summary.interface.passed, 5); assert.equal(audit.summary.regression.passed, 3);
  assert.deepEqual(audit.summary.interface.failed, ['i01', 'i02', 'i05', 'i06', 'i08']);
  assert.equal(audit.requirementsReviewed,38); assert.equal(audit.claimsReviewed,63); assert.equal(audit.unknownsReviewed,49);
  assert.ok(audit.inputSpanOccurrencesChecked > 0 && audit.claimsReviewed > 0 && audit.requirementsReviewed > 0);
});

test('interface audit rejects missing judgments, wrong ownership and altered recall despite consistent hashes', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'loredock-interface-audit-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const raw = await readFile(new URL('answer-result.json', interfaceArtifacts), 'utf8');
  const originalReview = JSON.parse(await readFile(new URL('semantic-review.json', interfaceArtifacts), 'utf8'));
  const review = structuredClone(originalReview); review.results[0].requirements.pop();
  await writeFile(path.join(directory, 'answer-result.json'), raw);
  await writeFile(path.join(directory, 'semantic-review.json'), JSON.stringify(review));
  await assert.rejects(auditInterfaceAnswers(directory));
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
  await assert.rejects(auditInterfaceAnswers(directory), /Original source ownership/);
  const changedRecall = JSON.parse(raw); changedRecall.results[0].requirements[0].available = false;
  const recallRaw = JSON.stringify(changedRecall); originalReview.rawResultSha256 = digest(recallRaw);
  await writeFile(path.join(directory, 'answer-result.json'), recallRaw);
  await writeFile(path.join(directory, 'semantic-review.json'), JSON.stringify(originalReview));
  await assert.rejects(auditInterfaceAnswers(directory), /Recorded reference recall/);
  const changedComparison = JSON.parse(raw), comparisonRow = changedComparison.results[0];
  const [comparisonPrefix, comparisonSerialized] = comparisonRow.issuedPrompt.split(marker);
  const comparisonInput = JSON.parse(comparisonSerialized);
  comparisonInput.interfaceComparisons.comparisons[0].from.path = 'src/absent.ts';
  comparisonRow.attempt.context.interfaces = comparisonInput.interfaceComparisons;
  const { inputHash: _comparisonHash, ...comparisonContext } = comparisonRow.attempt.context;
  comparisonRow.attempt.context.inputHash = digest(JSON.stringify(comparisonContext));
  comparisonRow.issuedPrompt = comparisonPrefix + marker + JSON.stringify(comparisonInput);
  comparisonRow.issuedPromptHash = digest(comparisonRow.issuedPrompt);
  const comparisonRaw = JSON.stringify(changedComparison); originalReview.rawResultSha256 = digest(comparisonRaw);
  await writeFile(path.join(directory, 'answer-result.json'), comparisonRaw);
  await writeFile(path.join(directory, 'semantic-review.json'), JSON.stringify(originalReview));
  await assert.rejects(auditInterfaceAnswers(directory), /Derived endpoint is missing original support/);

});
