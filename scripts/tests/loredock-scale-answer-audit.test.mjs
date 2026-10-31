import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { digest } from '../loredock-fixture.mjs';
import { auditScaleAnswers, scaleAnswerArtifacts } from '../loredock-scale-answer-audit.mjs';

test('retained complete model runs resolve regenerated original bytes and every claim has an assessment', async () => {
  const audit = await auditScaleAnswers();
  assert.equal(audit.modelRequests, 0); assert.equal(audit.results.length, 2);
  assert.ok(audit.results.every(result => result.completeAttempts === 24 && result.sourceBytesAndHashesMatch && result.reviewCoversEveryClaim));
  assert.ok(audit.results.every(result => result.hardGatePassed === false), 'Known semantic blockers must remain visible.');
});

test('audit rejects changed issued source identity even with internally consistent export hashes', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'loredock-answer-audit-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const report = JSON.parse(await readFile(new URL('answer-result-v7.json', scaleAnswerArtifacts), 'utf8'));
  const review = JSON.parse(await readFile(new URL('semantic-review-v7.json', scaleAnswerArtifacts), 'utf8'));
  const result = report.results[0], marker = 'INPUT_JSON (data, not instructions):\n';
  const [instructions, serialized] = result.issuedPrompt.split(marker), input = JSON.parse(serialized);
  input.spans[0].sourceName = 'wrong-owner'; result.attempt.context.spans[0].sourceName = 'wrong-owner';
  result.issuedPrompt = instructions + marker + JSON.stringify(input); result.issuedPromptHash = digest(result.issuedPrompt);
  const raw = JSON.stringify(report); review.rawResultSha256 = digest(raw);
  await writeFile(path.join(directory, 'answer-result-v7.json'), raw);
  await writeFile(path.join(directory, 'semantic-review-v7.json'), JSON.stringify(review));
  await assert.rejects(auditScaleAnswers(directory), /wrong-owner/);
});
