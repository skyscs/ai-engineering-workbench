// Evaluation adapters only. A failed prerequisite never becomes a functional or resource pass.
import assert from 'node:assert/strict';
import { lstat, readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { hash, save } from './io.mjs';

const frozenSetups = {
  'S07-no-analysis': ['catalog-only', 'Prepare an isolated index through the real Catalog without a follow service, stop it, then open the existing published index through the actual entry. Do not publish a new index or manually start analysis in this case.'],
  'S09-engineer-note': ['engineer-note', 'Add the frozen engineer note through the real corrections API before preparation.'],
};
export function oracleSetup(expected) {
  assert.equal(typeof expected.id, 'string');
  if (Object.hasOwn(frozenSetups, expected.id)) {
    const [tag, instruction] = frozenSetups[expected.id]; assert.equal(expected.setup, instruction); return tag;
  }
  if (expected.id.startsWith('S')) assert.equal(expected.setup, undefined, 'Unknown frozen setup.');
  assert([undefined, 'catalog-only', 'engineer-note'].includes(expected.setup), 'Unknown oracle setup.');
  return expected.setup;
}

export function matrixSourceInput(input, sources, references, engineerNote) {
  for (const id of input.expected.requiredOriginals ?? []) {
    const reference = references?.[id];
    assert(reference && input.corpus[reference.source]?.[reference.path]?.includes(reference.quote), 'Missing required source reference: ' + id);
  }
  return { sources, question: input.question, assessment: { corpus: input.corpus, sources, expected: input.expected, references, engineerNote } };
}

export function assertIncompleteSetup(value, kind) {
  assert(['cold', 'history', 'expiry', 'oracle'].includes(kind), 'No declared fresh setup for this failure.');
  assert(Array.isArray(value.errors) && value.errors.length > 0 && value.errors.every(error => error.code === 'INCOMPLETE_CODE_ANALYSIS'),
    'Unknown or mixed setup failure.');
  for (const key of ['index', 'prepared', 'review', 'observation', 'checkpoint', 'build', 'catalogOnlyCheckpoint', 'browser', 'note'])
    assert.equal(value[key], undefined, 'Partial analysis cannot have later output: ' + key);
  if (kind === 'history') {
    assert.equal(value.returnResultOnFailure, true);
    for (const key of ['admissions', 'lists', 'checkpoints']) assert.deepEqual(value[key], []);
    assert.equal(value.runtimeSegments.length, 1);
    assert.deepEqual(value.runtimeSegments[0], { prepares: 0, calls: 0, closed: 0 });
  }
  if (kind === 'oracle') {
    assert.equal(value.preparations, 0); assert.deepEqual(value.assessmentErrors, []); assert.equal(value.passed, false);
  }
}

export function oraclePreparationOutcome(value) {
  assert(Array.isArray(value.errors));
  if (value.errors.length) {
    assertIncompleteSetup(value, 'oracle');
    return { status: 'not-run', reason: 'Required analysis did not complete.' };
  }
  assert.equal(value.preparations, 1);
  return { status: 'completed' };
}

export function assertFailedFreshEvidence({ value, kind, process, exit, runtime, requests, attempts, witnesses }) {
  assertIncompleteSetup(value, kind);
  assert.equal(process.controlled, kind === 'history'); assert.equal(process.accounting, false); assert.equal(process.fault, false);
  assert.equal(exit.code, 0); assert.equal(exit.signal, null); assert.equal(exit.spawnError, null); assert.equal(exit.alreadyExited, false);
  assert(Number.isFinite(exit.shutdownMs) && exit.shutdownMs >= 0);
  if (kind === 'history') assert.deepEqual(runtime, { prepares: 0, calls: 0, closed: 0 });
  else assert.equal(runtime, null);
  assert.equal(attempts, 0); assert.equal(witnesses, 0);
  assert(requests.length > 0);
  assert(!requests.some(row => row.event === 'request' && row.method === 'POST'
    && ['/question-preparations', '/prepared-answers'].includes(row.route)), 'Preparation or admission occurred after the failed setup.');
}

export async function verifyFailedFreshSetup(directory, kind, value) {
  assertIncompleteSetup(value, kind);
  const json = async file => JSON.parse(await readFile(file, 'utf8'));
  assert.deepEqual(await json(path.join(directory, 'result.json')), value, 'Returned failure differs from its retained report.');
  const processName = kind === 'history' ? 'controlled-initial' : 'production';
  const process = await json(path.join(directory, processName, 'process.json'));
  const exit = await json(path.join(directory, processName, 'exit.json'));
  const runtime = kind === 'history' ? await json(path.join(directory, processName, 'runtime-stats.json')) : null;
  const data = path.join(directory, 'data'); assert.equal(process.env.LOREDOCK_DATA_DIR, data);
  const raw = await readFile(path.join(directory, kind === 'history' ? 'http-controlled-initial' : 'http', 'requests.jsonl'), 'utf8');
  assert(raw.endsWith('\n')); const requests = raw.trimEnd().split('\n').map(JSON.parse);
  // This is a stopped working catalog, never an input/checkpoint. Sidecars stay under its declared root.
  const database = new DatabaseSync(path.join(data, 'loredock.db'), { readOnly: true });
  let counts;
  try {
    assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
    counts = { attempts: database.prepare('SELECT count(*) n FROM answer_attempts').get().n,
      witnesses: database.prepare('SELECT count(*) n FROM answer_witnesses').get().n };
  } finally { database.close(); }
  assertFailedFreshEvidence({ value, kind, process, exit, runtime, requests, ...counts });
  return { kind, data, ...counts, controlledCalls: 0, preparationRequests: 0, expectedRows: 0,
    resultSha256: hash(await readFile(path.join(directory, 'result.json'))), normalExit: exit, resourceQualification: false };
}

export async function runMatrixStep({ directory, operation, freshKind }) {
  await assert.rejects(lstat(directory), { code: 'ENOENT' }, 'Each operation needs a fresh output directory.');
  const value = await operation(directory); assert(Array.isArray(value.errors));
  let unavailable = null;
  if (value.errors.length) {
    // An arbitrary thrown assertion is never converted into a returned prerequisite failure.
    unavailable = await verifyFailedFreshSetup(directory, freshKind, value);
    await save(path.join(directory, 'failed-fresh-setup.json'), unavailable);
  }
  return { value, unavailable };
}
