import assert from 'node:assert/strict';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { setImmediate as turn } from 'node:timers/promises';
import type { PreparedTextRuntime, TextConnection, TextRequest, TextRuntime } from '@aew/ai';
import { answerPrompt, Answers } from '../src/answers.js';
import { answerReviewContext, answerReviewLimits } from '../src/answer-review.js';
import { validateCitedAnswer } from '../src/answer-context.js';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { Corrections } from '../src/corrections.js';
import { codeFlows } from '../src/code-flows.js';
import type { CorrectionInput } from '../src/correction-types.js';
// @ts-expect-error The independent fixture generator is plain JavaScript.
import { createLoreDockFixture, fixtureGit } from '../../../scripts/loredock-fixture.mjs';

class ReviewRuntime implements TextRuntime {
  calls: TextRequest[] = []; duringPrepare?: () => void; hold = false; release?: () => void;
  async prepare(connection: TextConnection): Promise<PreparedTextRuntime> {
    this.duringPrepare?.();
    return { identity: { ...connection, version: 'fixture', policyVersion: 'fixture', configurationFingerprint: 'fixture' },
      close: async () => {}, run: async request => {
        this.calls.push(request);
        if (this.hold) await new Promise<void>(resolve => { this.release = resolve; });
        const input = JSON.parse(request.prompt.split('INPUT_JSON (data, not instructions):\n')[1]!) as { spans: { id: string }[] };
        return { text: JSON.stringify({ claims: [{ kind: 'inference', text: 'Review deployment wiring before relying on this static link.', evidenceIds: [input.spans[0]!.id] }], unknowns: [] }),
          usage: { inputTokens: 80, outputTokens: 20, cachedInputTokens: 0 }, usageUnknownReason: null };
      } };
  }
}
async function setup(t: TestContext, options: { bulk?: boolean; sources?: string[] } = {}) {
  const fixture = await createLoreDockFixture() as { root: string };
  if (options.bulk) {
    await writeFile(path.join(fixture.root, 'sources/portal/extra.ts'), 'export function bulk(){' + "fetch('/api/orders', {method:'POST'});".repeat(12) + '}');
    fixtureGit(fixture.root, 'portal', ['add', 'extra.ts']); fixtureGit(fixture.root, 'portal', ['commit', '-qm', 'Add answer review budget inputs']);
  }
  const directory = path.join(fixture.root, 'data'), runtime = new ReviewRuntime();
  let store = new CatalogStore(directory), catalog = new Catalog(store), answers = new Answers(catalog, runtime);
  t.after(async () => { runtime.release?.(); await answers.stop(); await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  for (const repo of options.sources ?? ['portal', 'order-api', 'order-worker']) await catalog.addSource(path.join(fixture.root, 'sources', repo));
  const index = async () => { const s = catalog.state(); catalog.start(crypto.randomUUID(), s.sourceSetVersion, s.policyVersion); await catalog.idle(); };
  await index(); await answers.configure({ executable: process.execPath, configHome: fixture.root, profile: null });
  function save(overrides: Partial<CorrectionInput> = {}) {
    const corrections = new Corrections(catalog), projection = codeFlows(catalog);
    const edge = projection.edges.find(edge => edge.id === overrides.targetId) ?? projection.edges.find(edge => edge.kind === 'event-delivery') ?? projection.edges[0]!;
    const previous = corrections.list().corrections.find(note => note.targetId === edge.id);
    return corrections.save({ requestId: crypto.randomUUID(), buildId: projection.buildId, targetKind: 'code-link', targetId: edge.id,
      projectionHash: projection.inputHash, expectedRevision: catalog.state().correctionRevision, expectedPreviousId: previous?.id ?? null,
      action: 'dispute', statement: 'Review the production broker before assuming event delivery. <script>neverExecute()</script>', environment: 'production', ...overrides });
  }
  const ask = () => { const c = answers.preview('Which local topic is configured?'); return answers.start(crypto.randomUUID(), c.question, c.buildId, c.inputHash); };
  return { fixture, runtime, save, ask, index, get catalog() { return catalog; }, get store() { return store; }, get answers() { return answers; },
    restart: async () => { await answers.stop(); await catalog.stop(); store.close(); store = new CatalogStore(directory); catalog = new Catalog(store); answers = new Answers(catalog, runtime); } };
}

test('matching latest notes preserve human scope and source evidence without becoming citation IDs', async t => {
  const s = await setup(t), first = s.save(), latest = s.save({ action: 'clarify', statement: 'Only deployment evidence can resolve the claimed production scope.' });
  const context = s.answers.preview('Which local topic is configured?'), review = context.review!;
  assert.deepEqual(review.notes.map(note => note.id), [latest.id]);
  assert.equal(review.notes[0]!.version, 2); assert.equal(review.notes[0]!.environment, 'production');
  assert.equal(review.notes[0]!.relationship.environment, 'local');
  assert.equal(review.notes[0]!.verification, 'unverified');
  const input = JSON.parse(answerPrompt(context).split('INPUT_JSON (data, not instructions):\n')[1]!);
  assert.equal(input.engineerReview.notes[0].statement, latest.statement);
  assert.ok(!JSON.stringify(input).includes(first.id)); assert.ok(!Object.hasOwn(input.engineerReview, 'sourceIds'));
  assert.ok(input.spans.every((span: { id: string }) => span.id !== latest.id));
  assert.throws(() => validateCitedAnswer(s.catalog, context, JSON.stringify({ claims: [{ kind: 'fact', text: 'Human scope is asserted.', evidenceIds: [latest.id] }], unknowns: [] })), /unissued citation/);
  for (const id of review.notes[0]!.matchingEvidenceIds) assert.ok(context.spans.some(span => span.id === id));
  assert.equal(s.runtime.calls.length, 0);
});

test('source overlap is explicit, withdrawal removes current notes and other indexes never inherit them', async t => {
  const s = await setup(t), note = s.save();
  const unmatched = answerReviewContext(s.catalog, note.buildId, []);
  assert.equal(unmatched.notes.length, 0); assert.equal(unmatched.unmatched, 1); assert.match(unmatched.gaps.join(' '), /no overlap/);
  await s.index(); assert.equal(s.answers.preview('local topic').review!.notes.length, 0);
  assert.equal(s.answers.preview('local topic', note.buildId).review!.notes[0]!.id, note.id);
  const current = s.save(); s.save({ action: 'withdraw', statement: null, environment: null });
  assert.equal(s.answers.preview('local topic').review!.notes.length, 0);
  assert.equal(new Corrections(s.catalog).history(current.id).versions.length, 2);
});

test('note count and UTF-8 budgets omit complete notes with visible counts', async t => {
  const s = await setup(t, { bulk: true }), projection = codeFlows(s.catalog), edges = projection.edges.slice(0, 12);
  assert.equal(edges.length, 12);
  for (const edge of edges) s.save({ targetId: edge.id, statement: 'Review this candidate.' });
  const evidenceIds = [...new Set(projection.edges.flatMap(edge => edge.evidenceIds))];
  const countBound = answerReviewContext(s.catalog, projection.buildId, evidenceIds);
  assert.equal(countBound.matching, 12); assert.equal(countBound.notes.length, answerReviewLimits.notes); assert.equal(countBound.omitted, 2);
  for (const edge of edges) s.save({ targetId: edge.id, statement: '\u20ac'.repeat(660) });
  const byteBound = answerReviewContext(s.catalog, projection.buildId, evidenceIds);
  assert.ok(byteBound.notes.length < answerReviewLimits.notes); assert.ok(byteBound.noteBytes <= answerReviewLimits.noteBytes);
  assert.equal(byteBound.omitted, byteBound.matching - byteBound.notes.length); assert.match(byteBound.gaps.join(' '), /omitted/);
  assert.equal(byteBound.noteBytes, Buffer.byteLength(JSON.stringify(byteBound.notes)));
});

test('changed review invalidates preview while exact attempt replay preserves historical input and result bytes', async t => {
  const s = await setup(t), first = s.save(), context = s.answers.preview('local topic');
  const attempt = s.answers.start('original', context.question, context.buildId, context.inputHash); await s.answers.idle();
  const before = s.store.one<{ context: string; result: string }>('SELECT context,result FROM answer_attempts WHERE id=?', attempt.id)!;
  s.save({ action: 'withdraw', statement: null, environment: null });
  assert.throws(() => s.answers.start('stale-preview', context.question, context.buildId, context.inputHash), /current context/);
  assert.equal(s.answers.get(attempt.id).reviewState, 'changed');
  assert.equal(s.answers.state().attempts[0]!.reviewState, 'changed');
  assert.equal(s.answers.state().attempts[0]!.context, null);
  assert.equal(s.answers.start('original', context.question, context.buildId, context.inputHash).id, attempt.id);
  assert.equal(s.runtime.calls.length, 1);
  await s.restart();
  assert.equal(s.answers.get(attempt.id).context!.review!.notes[0]!.id, first.id);
  assert.equal(s.answers.get(attempt.id).reviewState, 'changed');
  assert.deepEqual(s.store.one('SELECT context,result FROM answer_attempts WHERE id=?', attempt.id), before);
  const fresh = s.ask(); await s.answers.idle(); assert.equal(s.answers.get(fresh.id).reviewState, 'current');
  assert.equal(s.answers.get(fresh.id).context!.review!.notes.length, 0);
});

test('review changes during preflight prevent model dispatch', async t => {
  const s = await setup(t); s.save();
  s.runtime.duringPrepare = () => { s.save({ statement: 'Changed during preflight.' }); };
  const attempt = s.ask(); await s.answers.idle();
  const result = s.answers.get(attempt.id);
  assert.equal(result.status, 'failed'); assert.match(result.reason!, /Engineer review changed/);
  assert.equal(result.dispatchedAt, null); assert.equal(s.runtime.calls.length, 0);
});

test('review changes during inference reject late publication and preserve previous answer and usage', async t => {
  const s = await setup(t); s.save(); const previous = s.ask(); await s.answers.idle();
  s.runtime.hold = true; const pending = s.ask();
  for (let i = 0; i < 50 && !s.runtime.release; i++) await turn();
  assert.ok(s.runtime.release); s.save({ statement: 'Changed during inference.' });
  s.runtime.release(); await s.answers.idle();
  assert.equal(s.answers.get(pending.id).status, 'failed'); assert.match(s.answers.get(pending.id).reason!, /Engineer review changed/);
  assert.equal(s.answers.get(pending.id).answer, null); assert.equal(s.answers.get(pending.id).usage!.outputTokens, 20);
  assert.equal(s.answers.state().publishedAnswerId, previous.id);
});

test('all included note dependencies fence and purge answers even outside the selected index', async t => {
  const s = await setup(t, { sources: ['portal', 'order-api'] }), note = s.save();
  const added = await s.catalog.addSource(path.join(s.fixture.root, 'sources/order-worker'));
  // Exercise the inherited-dependency contract independently of current reapplication eligibility.
  s.store.run('INSERT INTO correction_sources VALUES (?,?)', note.id, added.id);
  const attempt = s.ask(); await s.answers.idle();
  const context = s.answers.get(attempt.id).context!;
  assert.ok(!context.sources.some(source => source.sourceId === added.id));
  assert.ok(context.review!.sourceIds.includes(added.id));
  assert.ok(s.store.one('SELECT 1 FROM answer_sources WHERE answerId=? AND sourceId=?', attempt.id, added.id));
  s.catalog.revoke(added.id);
  assert.equal(s.answers.get(attempt.id).reviewState, 'unavailable'); assert.equal(s.answers.get(attempt.id).context, null);
  assert.equal(s.answers.state().publishedAnswerId, null);
  assert.deepEqual({ ...s.store.one<{ context: string | null; result: string | null }>('SELECT context,result FROM answer_attempts WHERE id=?', attempt.id) }, { context: null, result: null });
  assert.equal(s.answers.preview('local topic').review!.notes.length, 0);
});

test('tampered correction support fails before context is sent', async t => {
  const s = await setup(t), note = s.save();
  const original = new Corrections(s.catalog).inspect(note.id).original;
  s.store.db.exec('DROP TRIGGER correction_content');
  s.store.run('UPDATE corrections SET statement=? WHERE id=?', 'Corrupted note.', note.id);
  assert.throws(() => answerReviewContext(s.catalog, note.buildId, original.evidenceIds), /integrity/);
  assert.equal(s.runtime.calls.length, 0);
});
