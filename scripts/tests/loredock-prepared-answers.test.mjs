import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { services } from '../loredock-native-qualification/services.mjs';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { receiptFixture } from '../loredock-receipt-fixture.mjs';
import { Answers } from '../../apps/loredock/dist/answers.js';
import { QuestionPreparations } from '../../apps/loredock/dist/question-preparation.js';
import { AnswerWitnessStore } from '../../apps/loredock/dist/answer-witness-store.js';
import { validateQuestionWitness } from '../../apps/loredock/dist/question-witness.js';
import { citedAnswerSchema } from '../../apps/loredock/dist/answer-context.js';
import { answerPrompt } from '../../apps/loredock/dist/answer-prompt.js';
import { beforePreparedAnswer, loadPreparedAnswerControl } from '../../apps/loredock/tests/fixtures/prepared-answer-reference/verify.mjs';

const question = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
const code = expected => error => error.code === expected;
const hash = value => createHash('sha256').update(value).digest('hex');
function gate() { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; }
class Runtime {
  prepares = 0; calls = 0; closed = 0; requests = []; connections = [];
  preflight = gate(); dispatch = gate(); holdPrepare = gate(); holdRun = gate();
  async prepare(connection, signal) {
    this.prepares++; this.connections.push(connection); this.onPrepare?.(signal); this.preflight.release();
    if (this.blockPrepare) await this.holdPrepare.promise;
    if (this.failPrepare) throw new Error('Owned preflight failure.');
    return { identity: { ...connection, version: 'owned-cli', policyVersion: 'owned-policy', configurationFingerprint: 'owned-fingerprint' },
      run: async request => {
        this.calls++; this.requests.push(request); this.onRun?.(request); this.dispatch.release();
        if (this.blockRun) await this.holdRun.promise;
        if (this.failRun) throw new Error('Owned runtime failure.');
        return { text: JSON.stringify({ claims: [{ kind: 'fact', text: 'The indexed original describes the permit flow.',
          evidenceIds: [this.citation ?? this.context.spans[0].id] }], unknowns: ['What broker behavior is deployed?'] }),
        usage: { inputTokens: 123, outputTokens: 45, cachedInputTokens: 0 }, usageUnknownReason: null };
      }, close: async () => { this.closed++; if (this.failClose) throw new Error('Owned cleanup failure.'); } };
  }
  release() { this.holdPrepare.release(); this.holdRun.release(); }
}
async function setup(t, native = true) {
  const parent = await mkdtemp(path.join(tmpdir(), 'prepared-answer-')), corpus = corpusFactory();
  for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const fixture = await receiptFixture(parent, corpus, services), runtimes = [], consumers = [], owners = [];
  const owner = new QuestionPreparations(fixture.analysis); owners.push(owner);
  const create = (preparations = owner, Type = Answers) => {
    const runtime = new Runtime(), answers = new Type(fixture.catalog, runtime, preparations);
    runtimes.push(runtime); consumers.push(answers); return { runtime, answers };
  };
  t.after(async () => { for (const runtime of runtimes) runtime.release(); for (const consumer of consumers) await consumer.stop();
    for (const preparation of owners) await preparation.stop(); await fixture.close(); await rm(parent, { recursive: true, force: true }); });
  if (native) await fixture.analyze();
  const { runtime, answers } = create();
  await answers.configure({ executable: process.execPath, configHome: parent, profile: null });
  const prepare = async (id = randomUUID()) => {
    const started = owner.start(id, question); await owner.idle(); const preview = owner.review(started.id); runtime.context = preview.context; return preview;
  };
  const preview = await prepare();
  const start = (requestId = 'answer') => answers.startPrepared(requestId, preview.id, preview.reviewedHash);
  return { fixture, owner, runtime, answers, preview, prepare, start, create, parent, consumers, owners, runtimes };
}
function noNativeReads(before, after) { for (const key of ['gitCalls', 'factReads', 'snapshots', 'pathReads']) assert.equal(after[key], before[key], key); }

for (const native of [true, false]) test(`prepared ${native ? 'native' : 'source-only'} answers dispatch exact saved input and original-only citations`, async t => {
  const { fixture, owner, runtime, answers, preview, start } = await setup(t, native), before = fixture.counters();
  let evidenceReads = 0; const evidence = fixture.catalog.evidence.bind(fixture.catalog);
  t.mock.method(fixture.catalog, 'evidence', (...args) => { evidenceReads++; return evidence(...args); });
  runtime.onPrepare = () => { assert(evidenceReads >= preview.context.spans.length); assert.throws(() => owner.start('reentrant', question), code('QUESTION_BUSY')); };
  runtime.onRun = () => assert.throws(() => start('reentrant-answer'), code('BUSY'));
  const first = start(); assert.equal(first.status, 'preparing'); assert.equal(runtime.prepares, 0);
  assert.equal(start().id, first.id); assert.equal(owner.get(preview.id).status, 'consumed');
  const storage = new AnswerWitnessStore(fixture.catalog), snapshot = storage.read(first.id), witness = JSON.parse(snapshot.witnessJson);
  await answers.idle(); const result = answers.get(first.id);
  assert.equal(result.status, 'succeeded', result.reason); assert.equal(result.inputKind, 'prepared-question/1');
  assert.equal(JSON.stringify(result.context), snapshot.contextJson); assert.deepEqual(result.nativeContext, witness.compact);
  assert.equal(runtime.requests[0].prompt, witness.prompt); assert.deepEqual(runtime.requests[0].schema, citedAnswerSchema(preview.context));
  assert.equal(runtime.requests[0].model, 'gpt-5.6-terra'); assert.equal(runtime.requests[0].effort, 'medium');
  assert.equal(runtime.calls, 1); assert.equal(runtime.closed, 1); assert.equal(result.usage.outputTokens, 45);
  assert.equal(answers.state().publishedAnswerId, first.id); assert.equal(answers.get(first.id, false).nativeContext, null);
  assert.deepEqual(storage.read(first.id), snapshot); noNativeReads(before, fixture.counters());
  if (!native) { assert.equal(witness.compact.reason, 'INVENTORY_UNAVAILABLE'); assert.equal(witness.prompt, answerPrompt(preview.context)); }
  else assert(witness.compact.item);
});

test('durable retries precede changed configuration, transient replacement, stop and restart without dispatch', async t => {
  const s = await setup(t), first = s.start(); await s.answers.idle();
  await s.answers.configure({ ...s.answers.configuration(), profile: 'changed' });
  await s.prepare('replacement'); assert.equal(s.start().id, first.id);
  assert.throws(() => s.answers.startPrepared('answer', randomUUID(), s.preview.reviewedHash), code('CONFLICT'));
  assert.throws(() => s.answers.startPrepared('answer', s.preview.id, '0'.repeat(64)), code('CONFLICT'));
  await s.answers.stop(); await s.owner.stop(); assert.equal(s.start().id, first.id);
  await s.fixture.restart(); const replay = s.create(null); s.fixture.store.run('DELETE FROM answer_settings');
  assert.equal(replay.answers.startPrepared('answer', s.preview.id, s.preview.reviewedHash).id, first.id);
  assert.equal(replay.runtime.prepares, 0); assert.equal(s.runtime.calls, 1);
  assert.equal(s.fixture.store.one('SELECT connection FROM answer_attempts WHERE id=?', first.id).connection, JSON.stringify(s.runtime.connections[0]));
});

test('shared ownership covers all Answers instances, asynchronous configuration and shutdown', async t => {
  const s = await setup(t), other = s.create(null), connection = s.answers.configuration();
  const configuring = other.answers.configure(connection);
  assert.throws(() => s.start(), code('QUESTION_BUSY'));
  await assert.rejects(s.answers.configure(connection), code('QUESTION_BUSY')); await configuring;
  s.runtime.blockPrepare = true; const first = s.start(); await s.runtime.preflight.promise;
  const context = other.answers.preview(question);
  assert.throws(() => other.answers.start('legacy', question, context.buildId, context.inputHash), code('QUESTION_BUSY'));
  await assert.rejects(other.answers.configure(connection), code('QUESTION_BUSY'));
  s.answers.cancel(first.id); assert.throws(() => other.answers.start('legacy', question, context.buildId, context.inputHash), code('QUESTION_BUSY'));
  s.runtime.release(); await s.answers.idle(); assert.equal(s.runtime.calls, 0); assert.equal(s.runtime.closed, 1);
  const pending = other.answers.configure(connection); const stopped = other.answers.stop();
  await assert.rejects(pending, code('SERVICE_STOPPED')); await stopped;
  const fresh = s.create(null), leased = fresh.answers.configure(connection); await s.owner.stop();
  await assert.rejects(leased, code('QUESTION_LEASE_EXPIRED'));
  const otherFixture = await setup(t, false);
  assert.throws(() => new Answers(s.fixture.catalog, s.runtime, otherFixture.owner), code('INVALID_PREPARATION_OWNER'));
});

test('actual admission rolls back SQL failures and capacity refusal without consuming Ready', async t => {
  const s = await setup(t, false);
  s.fixture.store.db.exec("CREATE TRIGGER owned_failure AFTER INSERT ON answer_witnesses BEGIN SELECT RAISE(ABORT,'Owned admission failure.'); END;");
  assert.throws(() => s.start(), /Owned admission failure/); assert.equal(s.owner.get(s.preview.id).status, 'ready');
  for (const table of ['answer_attempts', 'answer_sources', 'answer_witnesses']) assert.equal(s.fixture.store.one('SELECT count(*) n FROM ' + table).n, 0);
  s.fixture.store.db.exec('DROP TRIGGER owned_failure');
  let snapshot; assert.throws(() => s.owner.promote(s.preview.id, s.preview.reviewedHash, value => { snapshot = value; throw new Error('Retain Ready.'); }), /Retain Ready/);
  const storage = new AnswerWitnessStore(s.fixture.catalog);
  for (let i = 0; i < 64; i++) {
    const id = randomUUID(); storage.create({ id, requestId: id, preparationId: s.preview.id, connection: s.answers.configuration(), model: 'gpt-5.6-terra', effort: 'medium' }, snapshot);
    s.fixture.store.run("UPDATE answer_attempts SET status='failed' WHERE id=?", id);
  }
  assert.throws(() => s.start(), code('ANSWER_WITNESS_LIMIT')); assert.equal(s.owner.get(s.preview.id).status, 'ready'); assert.equal(s.runtime.prepares, 0);
});

for (const boundary of ['prepare', 'dispatch', 'publish']) test(`source, policy, review and source-build changes fence before ${boundary}`, async t => {
  for (const mutation of ['source', 'policy', 'review', 'build']) {
    const s = await setup(t); s.runtime.blockPrepare = boundary === 'dispatch'; s.runtime.blockRun = boundary === 'publish';
    const admitted = gate();
    if (boundary === 'prepare') {
      const run = s.answers.run.bind(s.answers);
      // Hold the scheduled worker, not validation: an index rebuild is asynchronous
      // and must finish before this case can claim a pre-preflight boundary change.
      t.mock.method(s.answers, 'run', async (...args) => { await admitted.promise; return run(...args); });
    }
    const first = s.start();
    if (boundary === 'dispatch') await s.runtime.preflight.promise;
    if (boundary === 'publish') await s.runtime.dispatch.promise;
    if (mutation === 'source') {
      const selected = new Set(s.preview.context.spans.map(row => row.sourceId));
      const dependency = s.fixture.store.all('SELECT sourceId FROM answer_sources WHERE answerId=?', first.id).find(row => !selected.has(row.sourceId));
      assert(dependency); s.fixture.catalog.revoke(dependency.sourceId);
    }
    if (mutation === 'policy') s.fixture.catalog.updatePolicy(['private']);
    if (mutation === 'review') s.fixture.store.run('UPDATE project SET correctionRevision=correctionRevision+1');
    if (mutation === 'build') { try { await s.fixture.index('replacement-build'); } finally { admitted.release(); } }
    else admitted.release();
    s.runtime.release(); await s.answers.idle(); const result = s.answers.get(first.id);
    assert.notEqual(result.status, 'succeeded', mutation); assert.equal(result.answer, null);
    assert.equal(s.runtime.prepares, boundary === 'prepare' ? 0 : 1, mutation);
    assert.equal(s.runtime.calls, boundary === 'publish' ? 1 : 0, mutation);
    if (boundary === 'publish') assert.equal(result.usage.outputTokens, 45);
    if (mutation === 'source') { assert.equal(result.context, null); assert.equal(result.nativeContext, null);
      assert.equal(s.fixture.store.one('SELECT witness FROM answer_witnesses WHERE answerId=?', first.id).witness, null); }
  }
});

test('corrupt, missing and unknown witnesses and changed originals cannot fall back to legacy', async t => {
  for (const mutation of ['missing', 'version', 'bytes', 'original']) {
    const s = await setup(t), first = s.start();
    if (mutation === 'missing') { s.fixture.store.db.exec('DROP TRIGGER answer_witness_delete'); s.fixture.store.run('DELETE FROM answer_witnesses'); }
    if (mutation === 'version') { s.fixture.store.db.exec('DROP TRIGGER answer_witness_identity'); s.fixture.store.run("UPDATE answer_witnesses SET schemaVersion='unknown'"); }
    if (mutation === 'bytes') { s.fixture.store.db.exec('DROP TRIGGER answer_witness_purge'); s.fixture.store.run("UPDATE answer_witnesses SET witness='{}',witnessBytes=2"); }
    if (mutation === 'original') { const evidence = s.fixture.catalog.evidence.bind(s.fixture.catalog);
      t.mock.method(s.fixture.catalog, 'evidence', id => ({ ...evidence(id), text: 'Changed original.' })); }
    await s.answers.idle(); assert.equal(s.runtime.prepares, 0); assert.equal(s.runtime.calls, 0);
    assert.equal(s.fixture.store.one('SELECT status FROM answer_attempts WHERE id=?', first.id).status, 'failed');
    if (mutation !== 'original') assert.throws(() => s.answers.get(first.id));
  }
});

test('inventory eviction preserves exact dispatch and historical context without native rereads', async t => {
  const s = await setup(t); s.runtime.blockPrepare = true; const first = s.start(); await s.runtime.preflight.promise;
  const snapshot = new AnswerWitnessStore(s.fixture.catalog).read(first.id), receipt = JSON.parse(JSON.parse(snapshot.witnessJson).receipt);
  const inventoryId = JSON.parse(receipt.projectionJson).identity.inventoryId;
  await s.fixture.analyze('replacement-one'); await s.fixture.analyze('replacement-two');
  assert.throws(() => s.fixture.analysis.get(inventoryId), code('NOT_FOUND')); const before = s.fixture.counters();
  s.runtime.release(); await s.answers.idle(); assert.equal(s.answers.get(first.id).status, 'succeeded'); noNativeReads(before, s.fixture.counters());
  await s.fixture.index('new-build'); const historical = s.answers.get(first.id);
  assert.equal(historical.status, 'succeeded'); assert.equal(historical.stale, true); assert.deepEqual(historical.nativeContext, JSON.parse(snapshot.witnessJson).compact);
});

test('cancellation and shutdown retain late usage and drain cleanup before releasing ownership', async t => {
  for (const action of ['cancel', 'stop']) {
    const s = await setup(t); s.runtime.blockRun = true; const first = s.start(); await s.runtime.dispatch.promise;
    let stopping; if (action === 'cancel') s.answers.cancel(first.id); else stopping = s.answers.stop();
    assert(s.runtime.requests[0].signal.aborted); assert.throws(() => s.owner.start('too-soon', question), code('QUESTION_BUSY'));
    s.runtime.release(); await s.answers.idle(); await stopping;
    const result = s.answers.get(first.id); assert.equal(result.status, action === 'cancel' ? 'cancelled' : 'interrupted');
    assert.equal(result.usage.outputTokens, 45); assert.equal(result.answer, null); assert.equal(s.runtime.closed, 1);
  }
});

test('provider failures, invalid native citations and cleanup errors retain honest history', async t => {
  for (const failure of ['prepare', 'run', 'citation', 'cleanup']) {
    const s = await setup(t); s.runtime.failPrepare = failure === 'prepare'; s.runtime.failRun = failure === 'run'; s.runtime.failClose = failure === 'cleanup';
    if (failure === 'citation') s.runtime.citation = s.preview.compact.item.nodes[0][0];
    const first = s.start(); await s.answers.idle(); const result = s.answers.get(first.id);
    assert.equal(result.status, failure === 'cleanup' ? 'succeeded' : 'failed', result.reason);
    if (failure === 'citation' || failure === 'cleanup') assert.equal(result.usage.outputTokens, 45);
    else { assert.equal(result.usage, null); assert(result.usageUnknownReason); }
    assert.equal(s.runtime.closed, failure === 'prepare' ? 0 : 1); if (failure === 'cleanup') assert.match(result.reason, /cleanup failed/);
    assert.equal(s.start().id, first.id); assert.equal(s.runtime.prepares, 1);
  }
});

test('original revalidation fences both post-preflight and publication changes', async t => {
  for (const boundary of ['dispatch', 'publish']) {
    const s = await setup(t); s.runtime.blockPrepare = boundary === 'dispatch'; s.runtime.blockRun = boundary === 'publish';
    const first = s.start(); await (boundary === 'dispatch' ? s.runtime.preflight.promise : s.runtime.dispatch.promise);
    const evidence = s.fixture.catalog.evidence.bind(s.fixture.catalog);
    t.mock.method(s.fixture.catalog, 'evidence', id => ({ ...evidence(id), text: 'Changed indexed original.' }));
    s.runtime.release(); await s.answers.idle(); const result = s.answers.get(first.id);
    assert.equal(result.status, 'failed'); assert.equal(result.answer, null);
    assert.equal(s.runtime.calls, boundary === 'publish' ? 1 : 0); if (boundary === 'publish') assert.equal(result.usage.outputTokens, 45);
  }
});

test('restart preserves interrupted admission and cannot restart its external work', async t => {
  const s = await setup(t), first = s.start(); await s.answers.stop(); await s.owner.stop();
  assert.equal(s.answers.get(first.id).status, 'interrupted'); assert.equal(s.runtime.prepares, 0);
  await s.fixture.restart(); const replay = s.create(null);
  const saved = replay.answers.startPrepared('answer', s.preview.id, s.preview.reviewedHash);
  assert.equal(saved.id, first.id); assert.equal(saved.status, 'interrupted'); assert.equal(replay.runtime.prepares, 0);
  assert.throws(() => replay.answers.startPrepared('new-answer', s.preview.id, s.preview.reviewedHash), code('ANSWER_PREPARATION_UNAVAILABLE'));
});

test('loading and revalidation share an actual bounded lifetime and synchronous final publication fence', async t => {
  const s = await setup(t), first = s.start(); await s.answers.idle(); const storage = new AnswerWitnessStore(s.fixture.catalog);
  const budget = new services.OperationBudget(), snapshot = storage.read(first.id, budget), loaded = budget.stats().totalWork;
  assert(loaded > 0); let finalized = false;
  const result = await validateQuestionWitness(s.fixture.catalog, snapshot, undefined, { budget, finalize: ({ budget: actual, check }) => {
    assert.equal(actual, budget); check(); finalized = true;
    s.fixture.store.run("UPDATE answer_attempts SET reason='Owned publication write.' WHERE id=?", first.id);
  } });
  assert(finalized); assert(result.budget.totalWork > loaded); budget.check(); budget.close();
  t.diagnostic(JSON.stringify({ loadedWork: loaded, combinedValidationWork: result.budget.totalWork, qualification: false }));
  assert.throws(() => storage.read(first.id, budget), code('CLOSED_CAPTURE_BUDGET'));
  const limited = new services.OperationBudget({ limits: { work: loaded } }); storage.read(first.id, limited);
  await assert.rejects(validateQuestionWitness(s.fixture.catalog, snapshot, undefined, { budget: limited }), code('CAPTURE_WORK_LIMIT')); limited.close();
  assert.throws(() => storage.read(first.id, {}), code('INVALID_CAPTURE_BUDGET'));
  await assert.rejects(validateQuestionWitness(s.fixture.catalog, snapshot, undefined, { budget: {} }), code('INVALID_CAPTURE_BUDGET'));
  await assert.rejects(validateQuestionWitness(s.fixture.catalog, snapshot, undefined, { finalize: async () => {} }), code('ASYNC_WITNESS_FINALIZER'));
  const abort = new AbortController(); abort.abort(); await assert.rejects(validateQuestionWitness(s.fixture.catalog, snapshot, abort.signal), code('CANCELLED'));
});

test('accepted legacy execution retains prompt, context, optional fields and response bytes', async t => {
  const s = await setup(t, false), { Answers: Accepted } = await loadPreparedAnswerControl(s.parent), old = s.create(null, Accepted);
  const current = s.create(null), context = current.answers.preview(question); old.runtime.context = context; current.runtime.context = context;
  const baseline = old.answers.start('accepted-legacy', question, context.buildId, context.inputHash); await old.answers.idle();
  const changed = current.answers.start('current-legacy', question, context.buildId, context.inputHash); await current.answers.idle();
  const normalize = answer => { const { id, createdAt, dispatchedAt, ...rest } = answer; return rest; };
  assert.equal(JSON.stringify(normalize(current.answers.get(changed.id))), JSON.stringify(normalize(old.answers.get(baseline.id))));
  assert.equal(current.runtime.requests[0].prompt, old.runtime.requests[0].prompt);
  assert.deepEqual(current.runtime.requests[0].schema, old.runtime.requests[0].schema);
  assert.equal(Object.hasOwn(current.answers.get(changed.id), 'inputKind'), false);
  assert.equal(Object.hasOwn(current.answers.get(changed.id), 'nativeContext'), false);
  const rows = s.fixture.store.all('SELECT context FROM answer_attempts ORDER BY rowid'); assert.equal(rows[0].context, rows[1].context);
});

test('all accepted application sources and emitted files retain their independently proven deltas', async () => {
  const root = new URL('../../', import.meta.url), manifest = JSON.parse(await readFile(new URL('apps/loredock/tests/fixtures/prepared-answer-reference/manifest.json', root), 'utf8'));
  for (const [file, expected] of Object.entries(manifest.existingFiles)) {
    const raw = await beforePreparedAnswer(file, await readFile(new URL(file, root))); assert.equal(raw.length, expected.bytes, file); assert.equal(hash(raw), expected.sha256, file);
  }
});
