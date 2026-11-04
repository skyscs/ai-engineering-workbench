import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { services } from '../loredock-native-qualification/services.mjs';
import { corpusFactory } from '../loredock-native-assessment/fixture.mjs';
import { receiptFixture } from '../loredock-receipt-fixture.mjs';
import { QuestionPreparations } from '../../apps/loredock/dist/question-preparation.js';
import { validateQuestionWitness, readQuestionSnapshot, questionSnapshot } from '../../apps/loredock/dist/question-witness.js';
import { compactQuestionPath, preparedQuestionPrompt } from '../../apps/loredock/dist/question-context.js';
import { questionPreparationLimits, questionCompactVersion, questionPreparationVersion } from '../../apps/loredock/dist/question-preparation-types.js';
import { retrieveAnswerContext } from '../../apps/loredock/dist/answer-context.js';
import { answerPrompt } from '../../apps/loredock/dist/answer-prompt.js';
import { decodeNativeReceipt } from '../../apps/loredock/dist/native-receipt.js';
import { compactPath as controlCompact, experimentalPrompt } from '../loredock-native-question-context/compact.mjs';

const hash = value => createHash('sha256').update(value).digest('hex'), code = expected => error => error.code === expected;
const question = 'How does apply reach PermitWriter.onMessage through permit.granted.v3?';
async function setup(t, variant = 'complete') {
  const parent = await mkdtemp(path.join(tmpdir(), 'prepared-question-')), corpus = corpusFactory(variant === 'partial');
  if (variant !== 'ambiguous') for (const name of ['BBRenew', 'CCRetry', 'DDConfirm']) delete corpus['a-permit-ui'][`ui/${name}.vue`];
  const fixture = await receiptFixture(parent, corpus, services), owners = [];
  t.after(async () => { for (const owner of owners) await owner.stop(); await fixture.close(); await rm(parent, { recursive: true, force: true }); });
  if (variant !== 'no-inventory') await fixture.analyze();
  const owner = options => { const result = new QuestionPreparations(fixture.analysis, options); owners.push(result); return result; };
  return { fixture, owner };
}
async function ready(owner, request = 'prepare', text = question) {
  const start = owner.start(request, text); assert.equal(start.status, 'preparing'); await owner.idle();
  const state = owner.get(start.id); assert.equal(state.status, 'ready', JSON.stringify(state)); return owner.review(start.id);
}
function snapshot(owner, preview) {
  const admitted = owner.promote(preview.id, preview.reviewedHash, value => value); admitted.release(); return admitted.value;
}

test('prepared context preserves legacy bytes, compact semantics and owned no-write behavior', async t => {
  const { fixture, owner: create } = await setup(t), owner = create();
  const baseline = retrieveAnswerContext(fixture.catalog, question, fixture.buildId), before = fixture.counters(), legacy = fixture.legacyRows();
  const preview = await ready(owner);
  assert.equal(JSON.stringify(preview.context), JSON.stringify(baseline)); assert(preview.compact.item);
  assert.equal(preview.compact.item.schemaVersion, questionCompactVersion);
  assert.equal(preview.compact.item.originals.every(id => baseline.spans.some(row => row.id === id)), true);
  preview.context.question = 'Caller mutation'; preview.compact.item.nodes.length = 0;
  const fresh = owner.review(preview.id); assert.equal(fresh.context.question, question); assert(fresh.compact.item.nodes.length > 0);
  const held = snapshot(owner, fresh), { context, witness } = readQuestionSnapshot(held);
  const budget = new services.OperationBudget(), encoded = decodeNativeReceipt(Buffer.from(witness.receipt), fixture.store.receipts.catalogId, budget);
  const old = controlCompact(context, encoded, budget), current = compactQuestionPath(context, encoded, budget); budget.close();
  assert.deepEqual(current.item, { ...old.item, schemaVersion: questionCompactVersion });
  assert.equal(witness.prompt, experimentalPrompt(context, old.item).replace('offline-native-question-item/1', questionCompactVersion));
  assert.equal(witness.prompt, preparedQuestionPrompt(context, current.item));
  assert(held.retainedBytes <= questionPreparationLimits.retainedBytes);
  assert(Buffer.byteLength(held.witnessJson) <= questionPreparationLimits.witnessBytes);
  assert.equal(owner.get(preview.id).status, 'consumed'); assert.throws(() => owner.review(preview.id), code('QUESTION_NOT_READY'));
  const after = fixture.counters(); for (const key of ['gitCalls', 'writeCalls', 'changedRows']) assert.equal(after[key], before[key]);
  assert.equal(fixture.legacyRows(), legacy); assert.deepEqual(fixture.store.receipts.ids(), []);
  const metrics = owner.metrics(); assert.equal(metrics.nativeReads, 1); assert.equal(metrics.lexical.rejectedUnits, 0);
  assert(metrics.budget.totalWork >= metrics.lexical.acceptedUnits); t.diagnostic(JSON.stringify(metrics));
  assert.equal((await validateQuestionWitness(fixture.catalog, held)).status, 'revalidated');
});

test('missing inventory, ambiguity and insufficient anchors preserve source-only prompt bytes; partial wiring stays partial', async t => {
  for (const [variant, text, reason] of [
    ['no-inventory', question, 'INVENTORY_UNAVAILABLE'], ['ambiguous', question, 'QUESTION_AMBIGUOUS'],
    ['complete', 'What production broker retention is deployed?', 'QUESTION_INSUFFICIENT_CONTEXT'], ['partial', question, null],
  ]) {
    const { fixture, owner: create } = await setup(t, variant), owner = create(), preview = await ready(owner, 'case', text);
    if (reason) { assert.equal(preview.compact.reason, reason); assert.equal(preview.compact.item, null); }
    else { assert(preview.compact.item); assert(preview.compact.item.omissions['unresolved-consumer-method'] > 0); }
    const held = snapshot(owner, preview), { context, witness } = readQuestionSnapshot(held);
    if (reason) assert.equal(witness.prompt, answerPrompt(context));
    assert.equal((await validateQuestionWitness(fixture.catalog, held)).status, 'revalidated');
  }
});

test('duplicates, conflicting requests, cross-instance ownership, cancellation and stopped owners remain explicit', async t => {
  const { owner: create } = await setup(t); let enter, release;
  const entered = new Promise(resolve => { enter = resolve; }), gate = new Promise(resolve => { release = resolve; });
  const owner = create({ checkpoint: async info => { if (info.stage === 'lexical') { enter(); await gate; } } }), second = create();
  const start = owner.start('same', question); await entered;
  assert.equal(second.start('same', question).id, start.id);
  assert.throws(() => second.start('same', question + '?'), code('CONFLICT'));
  assert.throws(() => second.start('different', question), code('QUESTION_BUSY'));
  assert.equal(second.cancel(start.id).status, 'cancelled'); assert.throws(() => second.start('different', question), code('QUESTION_BUSY'));
  release(); await owner.idle(); assert.equal(owner.get(start.id).status, 'cancelled');
  await second.stop(); assert.throws(() => owner.start('after-stop', question), code('SERVICE_STOPPED'));
});

test('promotion preserves Ready on rollback, consumes on success and coordinates answer/configuration reservations', async t => {
  const { owner: create } = await setup(t), owner = create(), second = create();
  const lease = owner.reserveConfiguration(); assert.throws(() => second.start('busy', question), code('QUESTION_BUSY'));
  lease.check(); lease.release(); assert.throws(() => lease.check(), code('QUESTION_LEASE_EXPIRED'));
  const preview = await ready(owner), failure = new Error('Deliberate transaction rollback.');
  assert.throws(() => second.promote(preview.id, '0'.repeat(64), () => 0), code('QUESTION_REVIEW_CHANGED'));
  assert.equal(owner.get(preview.id).status, 'ready');
  assert.throws(() => owner.promote(preview.id, preview.reviewedHash, () => { throw failure; }), error => error === failure);
  assert.equal(owner.get(preview.id).status, 'ready');
  assert.throws(() => owner.promote(preview.id, preview.reviewedHash, async () => 0), code('ASYNC_QUESTION_PROMOTION'));
  assert.equal(owner.get(preview.id).status, 'ready');
  const promoted = second.promote(preview.id, preview.reviewedHash, value => value.reviewedHash);
  assert.equal(promoted.value, preview.reviewedHash);
  assert.throws(() => owner.start('next', question), code('QUESTION_BUSY'));
  assert.throws(() => owner.reserveConfiguration(), code('QUESTION_BUSY')); promoted.release();
  const next = await ready(owner, 'next'); assert.notEqual(next.id, preview.id);
});

test('source callbacks discard immediately; review and source-build changes fence before ready access', async t => {
  for (const mutation of ['source', 'review', 'build']) {
    const { fixture, owner: create } = await setup(t), owner = create(), preview = await ready(owner);
    if (mutation === 'source') fixture.catalog.revoke(fixture.store.sources()[0].id);
    if (mutation === 'review') fixture.store.run('UPDATE project SET correctionRevision=correctionRevision+1');
    if (mutation === 'build') await fixture.index('replacement-source-index');
    assert.equal(owner.get(preview.id).status, 'fenced'); assert.throws(() => owner.review(preview.id), code('QUESTION_NOT_READY'));
  }
});

test('ready expiry and replacement retain at most one terminal record and discard old payload access', async t => {
  const { owner: create } = await setup(t), owner = create(), first = await ready(owner);
  const second = await ready(owner, 'second'); assert.equal(owner.get(first.id).status, 'expired');
  const third = await ready(owner, 'third'); assert.throws(() => owner.get(first.id), code('QUESTION_NOT_FOUND'));
  assert.equal(owner.get(second.id).status, 'expired');
  const now = performance.now.bind(performance); t.mock.method(performance, 'now', () => now() + questionPreparationLimits.readyMs + 1);
  assert.equal(owner.get(third.id).status, 'expired'); assert.throws(() => owner.review(third.id), code('QUESTION_NOT_READY')); t.mock.restoreAll();
});

test('actual inventory eviction keeps the issued witness valid without any new native reads', async t => {
  const { fixture, owner: create } = await setup(t), owner = create(), preview = await ready(owner), held = snapshot(owner, preview);
  const { witness } = readQuestionSnapshot(held), original = JSON.parse(witness.receipt);
  const inventoryId = JSON.parse(original.projectionJson).identity.inventoryId;
  await fixture.analyze('second'); await fixture.analyze('third');
  assert.throws(() => fixture.analysis.get(inventoryId), code('NOT_FOUND'));
  const before = fixture.counters(), verified = await validateQuestionWitness(fixture.catalog, held), after = fixture.counters();
  assert.equal(verified.reviewedHash, held.reviewedHash);
  for (const key of ['factReads', 'snapshots', 'pathReads', 'gitCalls', 'writeCalls', 'changedRows']) assert.equal(after[key], before[key]);
});

test('busy analysis, cancelled phases, reduced work and late SQL writes cannot publish Ready', async t => {
  const { fixture, owner: create } = await setup(t);
  const run = fixture.analysis.start('active', fixture.buildId);
  assert.throws(() => create().start('blocked', question), code('QUESTION_ANALYSIS_BUSY'));
  fixture.analysis.control(run.id, 'pause'); await fixture.analysis.idle();
  for (const stage of ['lexical', 'metadata', 'read', 'resolve', 'admit', 'projection', 'originals', 'handoff']) {
    let owner, id, reached = false;
    owner = create({ checkpoint: info => { if (info.stage === stage && !reached) { reached = true; owner.cancel(id); } } });
    id = owner.start('cancel-' + stage, question).id; await owner.idle(); assert(reached, stage); assert.equal(owner.get(id).status, 'cancelled');
  }
  const zero = create({ budget: { limits: { work: 0 } } }), start = zero.start('zero', question); await zero.idle();
  assert.equal(zero.get(start.id).reason, 'CAPTURE_WORK_LIMIT');
  const changed = create({ checkpoint: info => { if (info.stage === 'handoff') fixture.store.run('UPDATE project SET correctionRevision=correctionRevision+1'); } });
  const late = changed.start('late', question); await changed.idle(); assert.equal(changed.get(late.id).status, 'failed');
  assert.equal(changed.get(late.id).reason, 'RECEIPT_FENCED');
});

test('stored hashes, versions, prompt and compact corruption refuse validation without a legacy fallback', async t => {
  const { fixture, owner: create } = await setup(t), owner = create(), preview = await ready(owner), original = snapshot(owner, preview);
  for (const mutate of [w => { w.schemaVersion = 'unknown'; }, w => { w.prompt += 'Invented'; }, w => { w.compact.item.nodes[0][1] = 'Invented'; }]) {
    const witness = JSON.parse(original.witnessJson); mutate(witness); const witnessJson = JSON.stringify(witness);
    const altered = { ...original, witnessJson, reviewedHash: hash(JSON.stringify([questionPreparationVersion, original.contextJson, witnessJson])) };
    await assert.rejects(validateQuestionWitness(fixture.catalog, altered));
  }
  await assert.rejects(validateQuestionWitness(fixture.catalog, { ...original, reviewedHash: '0'.repeat(64) }), code('QUESTION_SNAPSHOT_HASH'));
  const { context, witness } = readQuestionSnapshot(original), budget = new services.OperationBudget();
  assert.throws(() => questionSnapshot(context, { ...witness, prompt: 'x'.repeat(questionPreparationLimits.witnessBytes) }, budget), code('QUESTION_WITNESS_LIMIT')); budget.close();
});

test('all preexisting source and emitted application modules stay byte-identical to the accepted controls', async () => {
  const root = new URL('../../', import.meta.url), manifest = JSON.parse(await readFile(new URL('apps/loredock/tests/fixtures/prepared-question-reference/manifest.json', root), 'utf8'));
  for (const [file, value] of Object.entries(manifest.existingFiles)) {
    const raw = await readFile(new URL(file, root)); assert.equal(raw.length, value.bytes, file); assert.equal(hash(raw), value.sha256, file);
  }
});
