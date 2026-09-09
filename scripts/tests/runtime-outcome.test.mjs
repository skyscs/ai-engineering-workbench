import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { classifyFailure, parseInvestigation } from '../runtime-outcome.mjs';

const complete = [{ type: 'turn.completed' }];
const report = JSON.stringify({ summary: 'Unit mismatch', clientEvidence: 'client/request.mjs',
  serviceEvidence: 'service/config.mjs', artifactEvidence: 'artifacts/request.log', unresolvedQuestions: [] });

test('captured account failure cannot publish an introductory agent message', async () => {
  const events = (await readFile(new URL('../../docs/fixtures/runtime/usage-limit.events.jsonl', import.meta.url), 'utf8'))
    .trim().split('\n').map(JSON.parse);
  assert.equal(classifyFailure({ events, exitCode: 1 }), 'usage_limit');
  assert.equal(parseInvestigation(report, events, 1), null);
  assert.equal(parseInvestigation(report, events, 0), null);
});

test('recoverable connection events do not override a completed valid result', () => {
  const events = [{ type: 'error', message: 'Reconnecting after 503 Service Unavailable' }, ...complete];
  assert.equal(classifyFailure({ events, exitCode: 0 }), null);
  assert.deepEqual(parseInvestigation(report, events, 0), JSON.parse(report));
});

test('exit zero without completed turn, cancellation or invalid output is insufficient', () => {
  assert.equal(parseInvestigation(report, [], 0), null);
  assert.equal(parseInvestigation(report, complete, 0, 'cancelled'), null);
  assert.equal(parseInvestigation(report, complete, 1), null);
  for (const invalid of ['null', '{}', 'not JSON', report.replace('client/request.mjs', '')]) {
    assert.equal(parseInvestigation(invalid, complete, 0), null);
  }
});

test('synthetic auth, profile, CLI and policy failures remain distinct', () => {
  for (const [message, expected] of [
    ['Authentication required. Run codex login.', 'authentication_required'],
    ['config profile missing-fixture not found', 'missing_profile'],
    ["unexpected argument '--invalid' found", 'unsupported_option'],
    ['Permission denied', 'permission_denied']
  ]) {
    assert.equal(classifyFailure({ events: [{ type: 'turn.failed', error: { message } }], exitCode: 1 }), expected);
  }
});

test('explicit process control wins even if CLI reports exit zero', () => {
  for (const stopped of ['cancelled', 'timeout']) {
    assert.equal(classifyFailure({ events: complete, exitCode: 0, stopped }), stopped);
  }
  assert.equal(classifyFailure({ events: [], exitCode: null, spawnError: 'ENOENT' }), 'spawn_failed');
});
