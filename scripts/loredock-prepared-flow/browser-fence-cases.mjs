// Later review and scope fences consume independent stopped copies, never a live R08 session.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { until } from './io.mjs';
import { networkCase } from './network-cases.mjs';
import { witnessStorage } from './history-cases.mjs';

async function reviewChange(api) {
  const projection = (await api.request('/code-flows')).value, overlay = (await api.request('/corrections')).value;
  assert(projection.edges.length > 0);
  return (await api.request('/corrections', 'POST', { requestId: randomUUID(), buildId: projection.buildId,
    targetKind: 'code-link', targetId: projection.edges[0].id, projectionHash: projection.inputHash,
    expectedRevision: overlay.revision, expectedPreviousId: overlay.corrections.find(row => row.targetId === projection.edges[0].id)?.id ?? null,
    action: 'clarify', statement: 'Owned browser race note; deployment remains unverified.', environment: 'owned-development' })).value;
}
async function observeReviewRevision(c, revision) {
  await until(() => c.page.evaluate(`document.querySelector('.answer-panel')?.dataset.reviewRevision===${JSON.stringify(String(revision))}`),
    'The browser did not observe the real review revision.');
}
async function releaseAndObserve(c, held, name) {
  const captured = JSON.parse(await readFile(path.join(c.directory, name + '-request.json'), 'utf8'));
  assert(typeof captured.networkId === 'string');
  let completed = false;
  const remove = c.page.listen(event => {
    if (event.method === 'Network.loadingFinished' && event.params.requestId === captured.networkId) completed = true;
  });
  try {
    await held.release(); await c.clearHold();
    await until(() => completed, 'The held obsolete response did not complete delivery.');
    await c.page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    c.report.lateResponseCompleted = true; c.report.networkId = captured.networkId;
  } finally { remove(); }
}
async function noRuntime(c) {
  c.report.runtime = await c.daemon.command('stats');
  assert.deepEqual(c.report.runtime, { prepares: 0, calls: 0, closed: 0 });
}

export function latePreparationAfterReview(args) {
  return networkCase(args, async c => {
    await c.input(args.question);
    const held = await c.hold('question-preparations/*/review', 'late-preparation-review');
    await c.click('Find context'); const old = await held.wait();
    assert.equal(old.status, 200); assert(old.value.compact.item);
    c.report.correction = await reviewChange(c.api); await observeReviewRevision(c, c.report.correction.revision);
    await c.page.evaluate(`(()=>{window.reviewFenceObservation={contextInsertions:0};
      new MutationObserver(()=>{if(document.querySelector('.question-context'))window.reviewFenceObservation.contextInsertions++;})
        .observe(document.querySelector('.answer-panel'),{childList:true,subtree:true});})()`);
    await releaseAndObserve(c, held, 'late-preparation-review');
    await c.enabled('Find context');
    c.report.dom = await c.page.evaluate(`({contextPresent:document.querySelector('.question-context')!==null,
      generatePresent:[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Generate answer'),
      contextInsertions:window.reviewFenceObservation.contextInsertions})`);
    assert.deepEqual(c.report.dom, { contextPresent: false, generatePresent: false, contextInsertions: 0 });
    c.report.preparation = await c.api.request('/question-preparations/' + old.value.id);
    // Browser cleanup can cancel the already obsolete preparation; neither state is usable.
    assert(['fenced', 'cancelled'].includes(c.report.preparation.value.status));
    assert.equal((await c.api.request('/answers')).value.attempts.length, 0);
    await noRuntime(c); await c.page.snapshot('review-context-hidden');
  });
}

export function lateHistoryAfterReview(args) {
  return networkCase(args, async c => {
    const id = args.checkpoint.saved.value.id;
    await c.text('Saved prepared context');
    const held = await c.hold('answers/' + id, 'late-history-review');
    await c.page.protocol.send('Page.reload'); const old = await held.wait();
    assert.equal(old.status, 200); assert.equal(old.value.reviewState, 'current');
    c.report.correction = await reviewChange(c.api); await observeReviewRevision(c, c.report.correction.revision);
    await releaseAndObserve(c, held, 'late-history-review');
    await c.text("Engineer review changed after this answer's context was prepared.");
    assert(await c.page.evaluate("document.querySelector('.answer-result .review-changed')!==null"));
    c.report.saved = await c.api.request('/answers/' + id);
    assert.equal(c.report.saved.value.reviewState, 'changed'); assert.equal(c.report.saved.value.status, 'succeeded');
    for (const field of ['context', 'nativeContext', 'answer', 'usage']) assert.deepEqual(c.report.saved.value[field], old.value[field]);
    assert.equal((await c.api.request('/answers')).value.attempts.length, 1);
    await noRuntime(c);
    await c.page.evaluate("document.querySelector('.answer-result').scrollIntoView()");
    await c.page.snapshot('historical-review-labelled');
  }, { history: true });
}

export function lateHistoryAfterRevocation(args) {
  assert(typeof args.sourceName === 'string' && args.sourceName);
  return networkCase(args, async c => {
    const original = args.checkpoint.saved.value;
    assert(!original.context.spans.some(span => span.sourceName === args.sourceName), 'The declared revoked dependency must be uncited.');
    await c.text('Saved prepared context');
    const held = await c.hold('answers/' + original.id, 'late-history-revoke');
    await c.page.protocol.send('Page.reload'); const old = await held.wait();
    assert.equal(old.status, 200); assert(old.value.answer && old.value.nativeContext);
    const source = (await c.api.request('/project')).value.sources.find(row => row.name === args.sourceName); assert(source);
    c.report.sourceId = source.id;
    c.report.revocation = await c.api.request('/sources/' + source.id + '/revoke', 'POST', {});
    await c.text('Latest attempt: fenced.');
    await c.page.evaluate(`(()=>{window.revocationFenceObservation={contentInsertions:0};
      new MutationObserver(()=>{if(document.querySelector('.answer-result .claim,.answer-result .native-question-context'))window.revocationFenceObservation.contentInsertions++;})
        .observe(document.querySelector('.answer-panel'),{childList:true,subtree:true});})()`);
    await releaseAndObserve(c, held, 'late-history-revoke');
    c.report.dom = await c.page.evaluate(`({contentPresent:document.querySelector('.answer-result .claim,.answer-result .native-question-context')!==null,
      contentInsertions:window.revocationFenceObservation.contentInsertions})`);
    assert.deepEqual(c.report.dom, { contentPresent: false, contentInsertions: 0 });
    c.report.saved = await c.api.request('/answers/' + original.id);
    assert.equal(c.report.saved.value.status, 'fenced');
    for (const field of ['context', 'nativeContext', 'answer']) assert.equal(c.report.saved.value[field], null);
    c.report.storage = witnessStorage(c.data); assert.deepEqual(c.report.storage, { rows: 1, purged: 1, bytes: 0 });
    assert.equal((await c.api.request('/answers')).value.attempts.length, 1);
    await noRuntime(c);
    await c.page.evaluate("document.querySelector('.answer-panel').scrollIntoView()");
    await c.page.snapshot('revoked-content-hidden');
  }, { history: true });
}
