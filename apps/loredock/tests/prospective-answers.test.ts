import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { TextRuntime, TextRuntimeIdentity } from '@aew/ai';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { Answers, answerPrompt, answerPromptVersion } from '../src/answers.js';
import { answerSchemaVersion, retrievalVersion } from '../src/answer-context.js';
// @ts-expect-error The explicit evaluator is plain JavaScript.
import { evaluateProspectiveAnswers, freezeProspectiveAnswers } from '../../../scripts/loredock-prospective-answers.mjs';
// @ts-expect-error Reviewer-only definitions never enter the product input.
import { completenessCases } from '../../../fixtures/loredock-completeness/cases.mjs';

const productionServices = { Catalog, CatalogStore, Answers, answerPrompt, answerPromptVersion, answerSchemaVersion, retrievalVersion };
// Runner orchestration fixtures advertise the frozen protocol solely to exercise its
// checkpoint/failure lifecycle with a fake runtime. This is not v8 product qualification.
// Unmodified production services must reject that protocol, verified below.
const services = { ...productionServices, answerPromptVersion: 'loredock-answer-v8' };
const identity = (directory: string): TextRuntimeIdentity => ({ executable: process.execPath, configHome: directory, profile: null,
  version: 'fixture', policyVersion: 'fixture', configurationFingerprint: 'fixture' });

test('the exhausted v8 evaluation protocol rejects current production services before runtime preparation', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'loredock-obsolete-protocol-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const contract = await freezeProspectiveAnswers(identity(directory)); let prepared = 0;
  const runtime = { prepare: async () => { prepared++; throw new Error('Obsolete protocol must not prepare a runtime.'); } };
  await assert.rejects(evaluateProspectiveAnswers({ output:path.join(directory,'result'), contract, runtime }, productionServices), /loredock-answer-v9/);
  const original = JSON.parse(await readFile(new URL('../../../docs/fixtures/loredock-prospective-answers/evaluation-contract.json', import.meta.url), 'utf8'));
  await assert.rejects(evaluateProspectiveAnswers({ output:path.join(directory,'original'), contract:original, runtime }, productionServices), /Frozen answer contract changed/);
  assert.equal(prepared, 0);
});

test('prospective evaluation fixes all 24 questions, checkpoints dispatch and preserves history without oracle input', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'loredock-prospective-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'result'), selected = identity(directory), contract = await freezeProspectiveAnswers(selected);
  const questions: string[] = [];
  const runtime: TextRuntime = { prepare: async () => ({ identity: selected, close: async () => {}, run: async request => {
    const input = JSON.parse(request.prompt.split('INPUT_JSON (data, not instructions):\n')[1]!);
    questions.push(input.question);
    for (const key of ['requirements', 'intentId', 'split', 'scoring', 'optionalContext', 'forbiddenAssertions']) assert.ok(!Object.hasOwn(input, key));
    assert.equal(input.sources.length, 20); assert.ok(input.spans.length <= 30);
    assert.ok(input.spans.every((span: { path: string }) => !/oracle|completeness|baseline/.test(span.path)));
    assert.deepEqual(input.engineerReview.notes, []); assert.equal(request.model, 'gpt-5.6-terra'); assert.equal(request.effort, 'medium');
    const checkpoint = JSON.parse(await readFile(path.join(output, 'answer-result.json'), 'utf8'));
    assert.equal(checkpoint.applicationAttempts, questions.length); assert.equal(checkpoint.results.at(-1).dispatched, true);
    assert.ok(checkpoint.results.at(-1).attempt.id); assert.equal(checkpoint.results.at(-1).rawOutput, null);
    assert.equal(checkpoint.results.at(-1).issuedPrompt, request.prompt);
    return { text: JSON.stringify({ claims: [{ kind: 'inference', text: 'Review the supplied source.', evidenceIds: [input.spans[0].id] }],
      unknowns: ['What additional evidence is needed?'] }), usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0 }, usageUnknownReason: null };
  } }) };
  const report = await evaluateProspectiveAnswers({ output, contract, runtime }, services);
  assert.deepEqual(questions, completenessCases.map((item: { question: string }) => item.question));
  assert.equal(report.applicationAttempts, 24); assert.equal(report.operationallyComplete, true);
  assert.ok(report.results.every((row: { requirements: { available: boolean }[] }) => row.requirements.every(item => item.available)));
  assert.equal(report.history.restartBytesUnchanged, true); assert.equal(report.history.exactReplayAdditionalCalls, 0);
  assert.equal(report.revocation.fencedAttempts, 24); assert.equal(report.sourceCheckoutsUnchanged, true);
  assert.equal(report.semanticReview, 'pending'); assert.equal(report.independentReview, 'pending');
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'answer-result.json'), 'utf8')), report);
  await assert.rejects(evaluateProspectiveAnswers({ output, contract, runtime }, services), /EEXIST/);
  assert.equal(questions.length, 24);
});

test('a failed prospective attempt retains raw output and usage and never retries', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'loredock-prospective-failure-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const selected = identity(directory), contract = await freezeProspectiveAnswers(selected); let calls = 0;
  const runtime: TextRuntime = { prepare: async () => ({ identity: selected, close: async () => {}, run: async () => {
    calls++; return { text: 'Invalid fixture output', usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0 }, usageUnknownReason: null };
  } }) };
  const report = await evaluateProspectiveAnswers({ output: path.join(directory, 'result'), contract, runtime }, services);
  assert.equal(calls, 1); assert.equal(report.applicationAttempts, 1); assert.equal(report.operationallyComplete, false);
  assert.equal(report.results.length, 1); assert.equal(report.results[0].attempt.status, 'failed');
  assert.equal(report.results[0].rawOutput, 'Invalid fixture output'); assert.equal(report.results[0].attempt.usage.outputTokens, 5);
  assert.equal(report.semanticReview, 'pending'); assert.ok(!report.history && !report.revocation);
});

test('changed contracts and runtime identities cannot dispatch a prospective model call', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'loredock-prospective-contract-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const selected = identity(directory), contract = await freezeProspectiveAnswers(selected); let prepared = 0, closed = 0;
  const runtime: TextRuntime = { prepare: async () => { prepared++; return {
    identity: { ...selected, configurationFingerprint: 'changed' }, close: async () => { closed++; },
    run: async () => { throw new Error('Changed identities must never dispatch.'); },
  }; } };
  const output = path.join(directory, 'result');
  await assert.rejects(evaluateProspectiveAnswers({ output, contract: { ...contract, budget: { ...contract.budget, maximumAttempts: 25 } }, runtime }, services), /Frozen answer contract changed/);
  assert.equal(prepared, 0);
  const report = await evaluateProspectiveAnswers({ output, contract, runtime }, services);
  assert.equal(prepared, 1); assert.equal(closed, 1); assert.equal(report.applicationAttempts, 0);
  assert.equal(report.results[0].attempt.status, 'failed'); assert.equal(report.results[0].dispatched, false);
  assert.equal(report.operationallyComplete, false);
});
