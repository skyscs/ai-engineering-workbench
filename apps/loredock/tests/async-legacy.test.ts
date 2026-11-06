import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import type { TextRuntime } from '@aew/ai';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { CodeAnalysis } from '../src/code-analysis.js';
import { codeFlows } from '../src/code-flows.js';
import { declarationMap } from '../src/system-map.js';
import { Corrections } from '../src/corrections.js';
import { Reconciliation } from '../src/reconciliation.js';
import { Answers } from '../src/answers.js';
import { QuestionPreparations } from '../src/question-preparation.js';
import { retrieveAnswerContext, validateCitedAnswer } from '../src/answer-context.js';
import { sourceCandidatePreview } from '../src/source-candidates.js';
import { LegacyReadOperation } from '../src/legacy-read-operation.js';
import { OperationBudget } from '../src/operation-budget.js';
import { directLegacyFileParser, withLegacyFileParser, type LegacyFileParser } from '../src/legacy-file-parser.js';
// @ts-expect-error The independent synthetic fixture generator is plain JavaScript.
import { createLoreDockFixture } from '../../../scripts/loredock-fixture.mjs';

function gate(when = () => true) {
  let entered!: () => void, release!: () => void, held = false;
  const ready = new Promise<void>(resolve => { entered = resolve; }), wait = new Promise<void>(resolve => { release = resolve; });
  const parser: LegacyFileParser = async input => {
    if (!held && when()) { held = true; entered(); await wait; }
    return directLegacyFileParser(input);
  };
  return { ready, release, run: <T>(action: () => T) => withLegacyFileParser(parser, action) };
}
const observed = <T>(promise: Promise<T>) => { void promise.catch(() => undefined); return promise; };
async function setup(t: TestContext) {
  const fixture = await createLoreDockFixture() as { root: string }, store = new CatalogStore(path.join(fixture.root, 'data'));
  const catalog = new Catalog(store), analysis = new CodeAnalysis(catalog), preparations = new QuestionPreparations(analysis);
  const counts = { prepares: 0, calls: 0, closed: 0 };
  const runtime: TextRuntime = { prepare: async connection => {
    counts.prepares++;
    return { identity: { ...connection, version: 'fixture', policyVersion: 'fixture', configurationFingerprint: 'fixture' },
      close: async () => { counts.closed++; }, run: async () => {
        counts.calls++; return { text: JSON.stringify({ claims: [], unknowns: ['Which runtime evidence is missing?'] }),
          usage: { inputTokens: 7, outputTokens: 3, cachedInputTokens: 0 }, usageUnknownReason: null };
      } };
  } };
  const answers = new Answers(catalog, runtime, preparations);
  t.after(async () => { await answers.stop(); await preparations.stop(); await analysis.stop(); await catalog.stop(); store.close();
    await rm(fixture.root, { recursive: true, force: true }); });
  for (const name of ['portal', 'order-api', 'order-worker']) await catalog.addSource(path.join(fixture.root, 'sources', name));
  const index = async (id: string) => { const state = catalog.state(); catalog.start(id, state.sourceSetVersion, state.policyVersion); await catalog.idle(); };
  await index('first'); await answers.configure({ executable: process.execPath, configHome: fixture.root, profile: null });
  const revoke = () => catalog.revoke(catalog.state().sources[0]!.id);
  return { store, catalog, analysis, preparations, answers, counts, index, revoke };
}
async function note(catalog: Catalog, kind: 'code-link' | 'declaration-link' = 'code-link', requestId = 'note') {
  const graph = kind === 'code-link' ? await codeFlows(catalog) : declarationMap(catalog);
  const edge = graph.edges.find(row => row.kind === (kind === 'code-link' ? 'event-delivery' : 'contract-match'))!;
  return { requestId, buildId: graph.buildId, targetKind: kind, targetId: edge.id, projectionHash: graph.inputHash,
    expectedRevision: catalog.state().correctionRevision, expectedPreviousId: null, action: 'dispute',
    statement: 'Review broker wiring before relying on this delivery.', environment: 'local' };
}

test('delayed graph reads reject revocation, intervening writes and stop before returning stale originals', async t => {
  for (const event of ['revoke', 'write', 'stop'] as const) await t.test(event, async t => {
    const s = await setup(t), hold = gate(), pending = observed(hold.run(() => codeFlows(s.catalog)));
    await hold.ready;
    if (event === 'revoke') s.revoke();
    else if (event === 'stop') await s.catalog.stop();
    else s.store.run('UPDATE project SET correctionRevision=correctionRevision+1 WHERE id=1');
    hold.release(); await assert.rejects(pending, /changed during legacy|catalog is stopping/);
  });
});

test('retrieval and the second candidate graph retain the original authority epoch across awaits', async t => {
  for (const phase of ['retrieval', 'candidate-links'] as const) await t.test(phase, async t => {
    const s = await setup(t), files = (await codeFlows(s.catalog)).coverage.examinedDocuments;
    let parses = 0; const hold = gate(() => ++parses > (phase === 'retrieval' ? 0 : files));
    const pending = observed<unknown>(hold.run(() => phase === 'retrieval'
      ? retrieveAnswerContext(s.catalog, 'How does portal submit an order?') : sourceCandidatePreview(s.catalog, 'How does portal submit an order?')));
    await hold.ready; s.revoke(); hold.release(); await assert.rejects(pending, /changed during legacy/);
  });
});

test('both correction kinds refuse late writes and a competing correction owns the only new revision', async t => {
  for (const kind of ['code-link', 'declaration-link'] as const) await t.test(kind, async t => {
    const s = await setup(t), input = await note(s.catalog, kind), hold = gate();
    const pending = observed(hold.run(() => new Corrections(s.catalog).save(input)));
    await hold.ready;
    const winner = await new Corrections(s.catalog).save({ ...input, requestId: 'winner' });
    hold.release(); await assert.rejects(pending, /changed during legacy|correction changed/);
    assert.equal(s.catalog.state().correctionRevision, 1);
    assert.deepEqual(new Corrections(s.catalog).list().corrections.map(row => row.id), [winner.id]);
    assert.deepEqual(await new Corrections(s.catalog).save({ ...input, requestId: 'winner' }), winner);
  });
});

test('reconciliation rejects a changed review while reconstructing earlier support', async t => {
  const s = await setup(t); await new Corrections(s.catalog).save(await note(s.catalog)); await s.index('same');
  const hold = gate(), pending = observed(hold.run(() => new Reconciliation(s.catalog).preview()));
  await hold.ready; s.revoke(); hold.release(); await assert.rejects(pending, /changed during legacy/);
  assert.equal(s.store.one<{ count: number }>('SELECT count(*) count FROM correction_reapplications')!.count, 0);
});

test('legacy admission is reserved before parsing and stop joins the rejected admission without dispatch', async t => {
  const s = await setup(t), context = await s.answers.preview('How does portal submit an order?'), hold = gate();
  const pending = observed(hold.run(() => s.answers.start('first', context.question, context.buildId, context.inputHash)));
  await hold.ready;
  await assert.rejects(s.answers.start('first', context.question, context.buildId, context.inputHash), /Another answer/);
  await assert.rejects(s.answers.configure(s.answers.configuration()!), /current question operation/);
  assert.throws(() => s.preparations.start('other', context.question), /current question operation/);
  let stopped = false; const stop = s.answers.stop().then(() => { stopped = true; });
  await Promise.resolve(); assert.equal(stopped, false);
  hold.release(); await assert.rejects(pending, /cancelled|stopping/); await stop;
  assert.equal(s.store.one<{ count: number }>('SELECT count(*) count FROM answer_attempts')!.count, 0);
  assert.deepEqual(s.counts, { prepares: 0, calls: 0, closed: 0 });
});

test('preparation cancellation and parser failure cannot publish Ready or retain the shared reservation', async t => {
  for (const failure of ['cancel', 'parser'] as const) await t.test(failure, async t => {
    const s = await setup(t), hold = gate();
    if (failure === 'cancel') {
      const started = hold.run(() => s.preparations.start('first', 'How does portal submit an order?'));
      await hold.ready; s.preparations.cancel(started.id); hold.release(); await s.preparations.idle();
      assert.equal(s.preparations.get(started.id).status, 'cancelled');
    } else {
      const started = withLegacyFileParser(async () => { throw new Error('Injected parser failure'); },
        () => s.preparations.start('first', 'How does portal submit an order?'));
      await s.preparations.idle(); assert.equal(s.preparations.get(started.id).status, 'failed');
    }
    const next = s.preparations.start('next', 'How does portal submit an order?'); await s.preparations.idle();
    assert.equal(s.preparations.get(next.id).status, 'ready'); assert.equal(s.counts.calls, 0);
  });
});

test('stopping the shared preparation service invalidates an answer admission already awaiting parsing', async t => {
  const s = await setup(t), context = await s.answers.preview('How does portal submit an order?'), hold = gate();
  const pending = observed(hold.run(() => s.answers.start('answer', context.question, context.buildId, context.inputHash)));
  await hold.ready; await s.preparations.stop(); hold.release();
  await assert.rejects(pending, /reservation ended|stopping/);
  assert.equal(s.store.one<{ count: number }>('SELECT count(*) count FROM answer_attempts')!.count, 0);
  assert.deepEqual(s.counts, { prepares: 0, calls: 0, closed: 0 });
});

test('prepared answer awaits witness validation before preflight, dispatch and publication', async t => {
  for (const phase of ['preflight', 'dispatch', 'publication'] as const) await t.test(phase, async t => {
    const s = await setup(t), started = s.preparations.start('ready', 'How does portal submit an order?');
    await s.preparations.idle(); const review = s.preparations.review(started.id);
    const hold = gate(() => phase === 'preflight' || phase === 'dispatch' && s.counts.prepares === 1
      || phase === 'publication' && s.counts.calls === 1);
    const answer = hold.run(() => s.answers.startPrepared('answer', review.id, review.reviewedHash!));
    await hold.ready; s.answers.cancel(answer.id); hold.release(); await s.answers.idle();
    const saved = s.answers.get(answer.id); assert.equal(saved.status, 'cancelled'); assert.equal(saved.answer, null);
    assert.equal(s.counts.prepares, phase === 'preflight' ? 0 : 1);
    assert.equal(s.counts.calls, phase === 'publication' ? 1 : 0);
    assert.equal(s.counts.closed, s.counts.prepares);
    if (phase === 'publication') assert.equal(saved.usage!.outputTokens, 3);
  });
});

test('legacy publication rejects cancellation during reconstruction and retains provider usage', async t => {
  const s = await setup(t), context = await s.answers.preview('How does portal submit an order?');
  const hold = gate(() => s.counts.calls === 1);
  const answer = await hold.run(() => s.answers.start('answer', context.question, context.buildId, context.inputHash));
  await hold.ready; s.answers.cancel(answer.id); hold.release(); await s.answers.idle();
  const saved = s.answers.get(answer.id); assert.equal(saved.status, 'cancelled'); assert.equal(saved.answer, null);
  assert.equal(saved.usage!.outputTokens, 3); assert.equal(s.counts.closed, 1);
});

test('all lexical phases charge one original budget and a closed budget rejects before another SQL read', async t => {
  const s = await setup(t), budget = new OperationBudget(); budget.charge('receipt', 37);
  const operation = new LegacyReadOperation(s.catalog, budget);
  await retrieveAnswerContext(s.catalog, 'How does portal submit an order?', undefined, operation);
  const stats = operation.stats(); assert(stats.originalReads > 0 && stats.sqlRows > 0);
  assert.equal(stats.acceptedUnits, stats.sqlRows + stats.originalBytes); assert.equal(stats.rejectedUnits, 0);
  assert.equal(budget.stats().receiptWork, 37 + stats.acceptedUnits);
  const hold = gate(), pending = observed(hold.run(() => codeFlows(s.catalog, undefined, operation)));
  await hold.ready; budget.close(); const before = operation.stats(); hold.release();
  await assert.rejects(pending, /completed operation budget/); assert.deepEqual(operation.stats(), before);
});

test('mutating issued answer input during interface reconstruction cannot validate it', async t => {
  const s = await setup(t), context = await s.answers.preview('How does portal submit an order?'), hold = gate();
  const pending = observed(hold.run(() => validateCitedAnswer(s.catalog, context, JSON.stringify({ claims: [], unknowns: ['Which runtime?'] }))));
  await hold.ready; context.question = 'A different question'; hold.release();
  await assert.rejects(pending, /issued answer context changed/);
});
