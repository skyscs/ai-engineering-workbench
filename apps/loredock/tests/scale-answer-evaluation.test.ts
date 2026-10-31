import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { TextRuntime, TextRequest } from '@aew/ai';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { Answers, answerPrompt, answerPromptVersion } from '../src/answers.js';
import { Corrections } from '../src/corrections.js';
import { codeFlows } from '../src/code-flows.js';
import { answerSchemaVersion, retrievalVersion } from '../src/answer-context.js';
// @ts-expect-error The explicit evaluation harness is plain JavaScript.
import { evaluateScaleAnswers } from '../../../scripts/loredock-scale-answer-evaluation.mjs';

const services = { Catalog, CatalogStore, Answers, Corrections, codeFlows, answerPrompt,
  answerPromptVersion, answerSchemaVersion, retrievalVersion };

test('expanded evaluation isolates the oracle, bounds calls and verifies note/history/revocation boundaries', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'loredock-scale-evaluation-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const calls: TextRequest[] = [];
  const runtime: TextRuntime = { prepare: async connection => ({
    identity: { ...connection, version: 'fixture', policyVersion: 'fixture', configurationFingerprint: 'fixture' },
    close: async () => {}, run: async request => {
      calls.push(request);
      const input = JSON.parse(request.prompt.split('INPUT_JSON (data, not instructions):\n')[1]!);
      assert.ok(!Object.hasOwn(input, 'expected') && !Object.hasOwn(input, 'requiredUncertainty'));
      assert.ok(!/"(?:expected|requiredUncertainty|oracleHash)":/.test(request.prompt));
      assert.ok(input.sources.length === 20 && input.spans.length <= 30);
      if (calls.length <= 20 || calls.length === 24) assert.deepEqual(input.engineerReview.notes, []);
      else {
        assert.equal(input.engineerReview.notes.length, 1);
        assert.equal(input.engineerReview.notes[0].version, calls.length - 20);
        assert.equal(input.engineerReview.notes[0].verification, 'unverified');
      }
      // Mechanically valid output deliberately makes no claim to semantic correctness.
      return { text: JSON.stringify({ claims: [{ kind: 'inference', text: 'Review the supplied source.', evidenceIds: [input.spans[0].id] }],
        unknowns: ['What additional evidence is needed?'] }), usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0 }, usageUnknownReason: null };
    },
  }) };
  const report = await evaluateScaleAnswers({ output: path.join(directory, 'result'), runtime,
    connection: { executable: process.execPath, configHome: directory, profile: null } }, services);
  assert.equal(calls.length, 24); assert.equal(report.applicationAttempts, 24); assert.equal(report.operationallyComplete, true);
  assert.equal(report.results.length, 24); assert.ok(report.results.every((result: { retrievalComplete: boolean }) => result.retrievalComplete));
  assert.equal(report.history.restartBytesUnchanged, true); assert.equal(report.history.exactReplayAdditionalCalls, 0);
  assert.equal(report.revocation.fencedAttempts, 24); assert.equal(report.revocation.storedContextAndResultPurged, true);
  assert.equal(report.independentReview, 'pending'); assert.match(report.semanticReview, /^pending/);
  const persisted = JSON.parse(await readFile(path.join(directory, 'result/answer-result.json'), 'utf8'));
  assert.deepEqual(persisted, report);
  assert.deepEqual(persisted.results.map((result: { issuedPrompt: string }) => result.issuedPrompt), calls.map(call => call.prompt));
  await assert.rejects(evaluateScaleAnswers({ output: path.join(directory, 'result'), runtime,
    connection: { executable: process.execPath, configHome: directory, profile: null } }, services), /EEXIST/);
  assert.equal(calls.length, 24, 'A rerun must not overwrite previous outputs or dispatch calls.');
});

test('operational failure saves raw output and usage then stops without retry or semantic success', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'loredock-scale-evaluation-failure-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let calls = 0;
  const runtime: TextRuntime = { prepare: async connection => ({
    identity: { ...connection, version: 'fixture', policyVersion: 'fixture', configurationFingerprint: 'fixture' },
    close: async () => {}, run: async () => {
      calls++;
      const checkpoint = JSON.parse(await readFile(path.join(directory, 'result/answer-result.json'), 'utf8'));
      assert.equal(checkpoint.results[0].dispatched, true);
      assert.ok(checkpoint.results[0].attempt.id, 'The attempt ID must be durable before model work.');
      return { text: 'Invalid fixture output',
      usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 0 }, usageUnknownReason: null }; },
  }) };
  const report = await evaluateScaleAnswers({ output: path.join(directory, 'result'), runtime,
    connection: { executable: process.execPath, configHome: directory, profile: null } }, services);
  assert.equal(calls, 1); assert.equal(report.applicationAttempts, 1); assert.equal(report.results.length, 1);
  assert.equal(report.operationallyComplete, false); assert.equal(report.results[0].attempt.status, 'failed');
  assert.equal(report.results[0].rawOutput, 'Invalid fixture output'); assert.equal(report.results[0].attempt.usage.outputTokens, 5);
  assert.equal(report.independentReview, 'pending'); assert.match(report.semanticReview, /^pending/);
  assert.ok(!report.history && !report.revocation);
});
