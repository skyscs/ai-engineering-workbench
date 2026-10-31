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
import { evaluateInterfaceAnswers, freezeInterfaceAnswers } from '../../../scripts/loredock-interface-answers.mjs';
// @ts-expect-error Reviewer-only definitions never enter the product input.
import { interfaceCases } from '../../../fixtures/loredock-interfaces/cases.mjs';

const services = { Catalog, CatalogStore, Answers, answerPrompt, answerPromptVersion, answerSchemaVersion, retrievalVersion };
const identity = (directory: string): TextRuntimeIdentity => ({ executable: process.execPath, configHome: directory, profile: null,
  version: 'fixture', policyVersion: 'fixture', configurationFingerprint: 'fixture' });

test('interface evaluation fixes all 14 questions, checkpoints dispatch and preserves history without oracle input', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'loredock-interface-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'result'), selected = identity(directory), contract = await freezeInterfaceAnswers(selected);
  const questions: string[] = [];
  const runtime: TextRuntime = { prepare: async () => ({ identity: selected, close: async () => {}, run: async request => {
    const input = JSON.parse(request.prompt.split('INPUT_JSON (data, not instructions):\n')[1]!);
    questions.push(input.question);
    for (const key of ['requirements', 'intentId', 'split', 'scoring', 'optionalContext', 'forbiddenAssertions']) assert.ok(!Object.hasOwn(input, key));
    assert.equal(input.sources.length, 20); assert.ok(input.spans.length <= 30);
    assert.ok(input.spans.every((span: { path: string }) => !/oracle|completeness|baseline/.test(span.path)));
    assert.ok(input.interfaceComparisons.comparisons.every((item: { evidenceIds: string[] }) => item.evidenceIds.every(id => input.spans.some((span: { id: string }) => span.id === id))));
    assert.deepEqual(input.engineerReview.notes, []); assert.equal(request.model, 'gpt-5.6-terra'); assert.equal(request.effort, 'medium');
    const checkpoint = JSON.parse(await readFile(path.join(output, 'answer-result.json'), 'utf8'));
    assert.equal(checkpoint.applicationAttempts, questions.length); assert.equal(checkpoint.results.at(-1).dispatched, true);
    assert.ok(checkpoint.results.at(-1).attempt.id); assert.equal(checkpoint.results.at(-1).rawOutput, null);
    assert.equal(checkpoint.results.at(-1).issuedPrompt, request.prompt);
    return { text: JSON.stringify({ claims: [{ kind: 'inference', text: 'Review the supplied source.', evidenceIds: [input.spans[0].id] }],
      unknowns: ['What additional evidence is needed?'] }), usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0 }, usageUnknownReason: null };
  } }) };
  const report = await evaluateInterfaceAnswers({ output, contract, runtime, runLedger: directory }, services);
  assert.deepEqual(questions, interfaceCases.map((item: { question: string }) => item.question));
  assert.equal(report.applicationAttempts, 14); assert.equal(report.operationallyComplete, true);
  assert.ok(report.results.every((row: { requirements: { available: boolean }[] }) => row.requirements.every(item => item.available)));
  assert.equal(report.history.restartBytesUnchanged, true); assert.equal(report.history.exactReplayAdditionalCalls, 0);
  assert.equal(report.revocation.fencedAttempts, 14); assert.equal(report.sourceCheckoutsUnchanged, true);
  assert.equal(report.semanticReview, 'pending'); assert.equal(report.independentReview, 'pending');
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'answer-result.json'), 'utf8')), report);
  await assert.rejects(evaluateInterfaceAnswers({ output, contract, runtime, runLedger: directory }, services), /EEXIST/);
  await assert.rejects(evaluateInterfaceAnswers({ output:path.join(directory,'different-output'), contract, runtime, runLedger:directory }, services), /EEXIST/);
  assert.equal(questions.length, 14);
});

test('a failed interface attempt retains raw output and usage and never retries', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'loredock-interface-failure-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const selected = identity(directory), contract = await freezeInterfaceAnswers(selected); let calls = 0;
  const runtime: TextRuntime = { prepare: async () => ({ identity: selected, close: async () => {}, run: async () => {
    calls++; return { text: 'Invalid fixture output', usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0 }, usageUnknownReason: null };
  } }) };
  const report = await evaluateInterfaceAnswers({ output: path.join(directory, 'result'), contract, runtime, runLedger: directory }, services);
  assert.equal(calls, 1); assert.equal(report.applicationAttempts, 1); assert.equal(report.operationallyComplete, false);
  assert.equal(report.results.length, 1); assert.equal(report.results[0].attempt.status, 'failed');
  assert.equal(report.results[0].rawOutput, 'Invalid fixture output'); assert.equal(report.results[0].attempt.usage.outputTokens, 5);
  assert.equal(report.results[0].rawUsage.outputTokens, 5);
  await assert.rejects(evaluateInterfaceAnswers({ output:path.join(directory,'retry'), contract, runtime, runLedger:directory }, services), /EEXIST/);
  assert.equal(calls, 1);
  assert.equal(report.semanticReview, 'pending'); assert.ok(!report.history && !report.revocation);
});

test('changed contracts and runtime identities cannot dispatch an interface model call', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'loredock-interface-contract-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const selected = identity(directory), contract = await freezeInterfaceAnswers(selected); let prepared = 0, closed = 0;
  const runtime: TextRuntime = { prepare: async () => { prepared++; return {
    identity: { ...selected, configurationFingerprint: 'changed' }, close: async () => { closed++; },
    run: async () => { throw new Error('Changed identities must never dispatch.'); },
  }; } };
  const output = path.join(directory, 'result');
  await assert.rejects(evaluateInterfaceAnswers({ output, contract: { ...contract, budget: { ...contract.budget, maximumAttempts: 15 } }, runtime, runLedger: directory }, services), /Frozen interface answer contract changed/);
  assert.equal(prepared, 0);
  const report = await evaluateInterfaceAnswers({ output, contract, runtime, runLedger: directory }, services);
  assert.equal(prepared, 1); assert.equal(closed, 1); assert.equal(report.applicationAttempts, 0);
  assert.equal(report.results[0].attempt.status, 'failed'); assert.equal(report.results[0].dispatched, false);
  assert.equal(report.operationallyComplete, false);
});
