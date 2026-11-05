import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assertFailedFreshEvidence, matrixSourceInput, oracleSetup, oraclePreparationOutcome, runMatrixStep } from '../loredock-prepared-flow/matrix-adapter.mjs';
import { matrixFreshSetups } from '../loredock-prepared-flow/matrix-layout.mjs';
import { definition } from '../loredock-prepared-flow/matrix-development-inputs.mjs';

const zero = { prepares: 0, calls: 0, closed: 0 };
function failed(kind = 'history') {
  return { errors: [{ code: 'INCOMPLETE_CODE_ANALYSIS', message: 'Retained partial inventory.' }],
    ...(kind === 'history' ? { returnResultOnFailure: true, admissions: [], lists: [], checkpoints: [], runtimeSegments: [{ ...zero }] } : {}),
    ...(kind === 'oracle' ? { preparations: 0, assessmentErrors: [], passed: false } : {}) };
}
function evidence(kind = 'history') {
  return { value: failed(kind), kind, process: { controlled: kind === 'history', accounting: false, fault: false },
    exit: { code: 0, signal: null, spawnError: null, alreadyExited: false, shutdownMs: 10 }, runtime: kind === 'history' ? { ...zero } : null,
    requests: [{ event: 'request', method: 'GET', route: '/code-analysis' }], attempts: 0, witnesses: 0 };
}

test('frozen prose setups map by exact identity without rewriting the oracle or accepting a tag shortcut', async () => {
  const oracle = JSON.parse(await readFile(new URL('../../fixtures/loredock-prepared-flow/oracle.json', import.meta.url)));
  const before = JSON.stringify(oracle);
  assert.equal(oracleSetup(oracle.cases[6]), 'catalog-only'); assert.equal(oracleSetup(oracle.cases[8]), 'engineer-note');
  assert.equal(JSON.stringify(oracle), before);
  for (const index of [6, 8]) {
    const expected = oracle.cases[index];
    assert.throws(() => oracleSetup({ ...expected, setup: expected.setup + ' Changed.' }));
    assert.throws(() => oracleSetup({ ...expected, setup: index === 6 ? 'catalog-only' : 'engineer-note' }));
    assert.throws(() => oracleSetup({ ...expected, id: 'S11-unknown' }));
  }
  assert.equal(oracleSetup({ id: 'D07-ordinary', setup: 'catalog-only' }), 'catalog-only');
});
test('required-original input cannot start with a missing or incompatible reference map', () => {
  const input = { corpus: { source: { 'README.md': 'Exact supported quote.' } }, question: 'Question?', expected: { requiredOriginals: ['required'] } };
  const references = { required: { source: 'source', path: 'README.md', quote: 'supported quote' } };
  const common = matrixSourceInput(input, {}, references, { text: 'Unverified note.' });
  assert.equal(common.assessment.references, references); assert.equal(common.assessment.expected, input.expected);
  assert.throws(() => matrixSourceInput(input, {}, undefined));
  assert.throws(() => matrixSourceInput(input, {}, { required: { ...references.required, quote: 'Absent quote.' } }));
});
test('only an empty stopped fresh setup with no dispatched work can carry the known failure', () => {
  for (const kind of ['cold', 'history', 'expiry', 'oracle']) assert.doesNotThrow(() => assertFailedFreshEvidence(evidence(kind)));
});
test('mixed failures, later activity, nonempty catalogs and abnormal exits cannot use zero-row expectations', () => {
  for (const mutate of [
    value => value.value.errors.push({ code: 'ERR_ASSERTION' }),
    value => value.value.index = {}, value => value.value.admissions.push({ id: 'unexpected' }),
    value => value.value.runtimeSegments[0].calls = 1, value => value.runtime.prepares = 1,
    value => value.attempts = 1, value => value.witnesses = 1, value => value.kind = 'reopened-history',
    value => value.exit.code = 1, value => value.exit.alreadyExited = true, value => value.process.fault = true,
    value => value.requests.push({ event: 'request', method: 'POST', route: '/question-preparations' }),
    value => value.requests.push({ event: 'request', method: 'POST', route: '/prepared-answers' }),
  ]) { const input = evidence(); mutate(input); assert.throws(() => assertFailedFreshEvidence(input)); }
});
test('failed analysis leaves oracle preparation not run and does not relax a successful one-attempt assertion', () => {
  assert.deepEqual(oraclePreparationOutcome(failed('oracle')), { status: 'not-run', reason: 'Required analysis did not complete.' });
  assert.equal(oraclePreparationOutcome({ errors: [], preparations: 1 }).status, 'completed');
  assert.throws(() => oraclePreparationOutcome({ errors: [], preparations: 0 }));
  assert.throws(() => oraclePreparationOutcome({ ...failed('oracle'), preparations: 1 }));
});
test('the fresh-setup declaration never includes warm, replay, fault or retained checkpoint catalogs', () => {
  const roots = matrixFreshSetups(definition.oracles.map(row => row.id)); assert.equal(Object.keys(roots).length, 15);
  assert.equal(roots['run/matrix/R04-history-capacity/capacity/data'], 'history');
  assert(!Object.keys(roots).some(root => /checkpoint|history-20|history-64|fixed-warm|revocation|restart/.test(root)));
});
test('an arbitrary helper exception remains the original exception and cannot be recovered from a result file', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'loredock-adapter-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const error = Object.assign(new Error('Unexpected assertion.'), { code: 'ERR_ASSERTION' });
  await assert.rejects(runMatrixStep({ directory: path.join(directory, 'case'), freshKind: 'history', operation: async () => { throw error; } }), observed => observed === error);
  await assert.rejects(runMatrixStep({ directory, freshKind: 'history', operation: async () => ({ errors: [] }) }), /fresh output/);
});
