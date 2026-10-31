import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { createApp } from '../src/app.js';
import { questionTerms, type AnswerContext } from '../src/answer-context.js';
import { selectSourceCandidates, sourceCandidatePreview, candidateLimits, type CandidatePreview } from '../src/source-candidates.js';
import { sha256 } from '../src/extract.js';
// @ts-expect-error Frozen adversarial examples are plain JavaScript.
import { candidateCases } from '../../../fixtures/loredock-candidates/cases.mjs';
// @ts-expect-error The owned fixture generator is plain JavaScript.
import { createLoreDockFixture, fixtureGit } from '../../../scripts/loredock-fixture.mjs';

interface Example {
  id: string; question: string; sources: string[]; spans: { source: string; path: string; text: string }[];
  required: string[]; maximum: number; status: string; duplicateDisplayNames?: string[];
  displayNames?: Record<string, string>; omittedMatches?: number; tiedAtLimit?: boolean;
}
function contextFor(item: Example, fresh = false) {
  const ids = new Map(item.sources.map(source => [source, fresh ? randomUUID() : source]));
  const name = (source: string) => item.duplicateDisplayNames?.includes(source) ? 'shared-package' : item.displayNames?.[source] ?? source;
  const context = { terms: questionTerms(item.question), sources: item.sources.map(source => ({ sourceId: ids.get(source)!, name: name(source), revision: 'a'.repeat(40) })),
    spans: item.spans.map((span, index) => ({ id: fresh ? randomUUID() : `span-${index}`, sourceId: ids.get(span.source)!, sourceName: name(span.source),
      revision: 'a'.repeat(40), path: span.path, startLine: 1, endLine: 1, text: span.text, contentHash: sha256(span.text), spanHash: sha256(span.text) })) } as Pick<AnswerContext, 'sources' | 'spans' | 'terms'>;
  return { context, ids };
}

test('frozen candidate cases retain distinct owners and uncertainty without name-only selection', async () => {
  const baseline = JSON.parse(await readFile(new URL('../../../fixtures/loredock-candidates/baseline.json', import.meta.url), 'utf8')) as { sourceHashes: Record<string,string> };
  for (const [file, hash] of Object.entries(baseline.sourceHashes)) assert.equal(sha256(await readFile(new URL('../../../' + file, import.meta.url))), hash);
  for (const item of candidateCases as Example[]) {
    const { context, ids } = contextFor(item), before = JSON.stringify(context), result = selectSourceCandidates(context);
    assert.equal(JSON.stringify(context), before, 'Ranking must not change the original answer context.');
    assert.equal(result.status, item.status, item.id); assert.equal(result.verification, 'unverified');
    assert.ok(result.suggested.length <= item.maximum, item.id);
    for (const source of item.required) assert.ok(result.suggested.some(row => row.sourceId === ids.get(source)), `${item.id}: ${source}`);
    if (item.omittedMatches !== undefined) assert.equal(result.omittedMatches, item.omittedMatches);
    if (item.tiedAtLimit !== undefined) assert.equal(result.tiedAtLimit, item.tiedAtLimit);
    for (const candidate of [...result.suggested, ...result.otherMatches]) {
      assert.ok(candidate.support.length > 0 && candidate.support.length <= candidateLimits.supportPerSource);
      for (const support of candidate.support) assert.equal(context.spans.find(span => span.id === support.id)?.sourceId, candidate.sourceId);
    }
    const fresh = contextFor(item, true), regenerated = selectSourceCandidates(fresh.context);
    assert.deepEqual(regenerated.suggested.map(row => item.sources.find(source => fresh.ids.get(source) === row.sourceId)),
      result.suggested.map(row => item.sources.find(source => ids.get(source) === row.sourceId)));
  }
});

test('candidate support rejects foreign ownership and repeated mentions do not multiply a source term', () => {
  const { context } = contextFor(candidateCases[1] as Example), original = selectSourceCandidates(context);
  const repeated = structuredClone(context); repeated.spans.push({ ...repeated.spans[1]!, id: 'repeated', text: repeated.spans[1]!.text.repeat(8) });
  assert.deepEqual(selectSourceCandidates(repeated).suggested.map(row => [row.sourceId, row.score]), original.suggested.map(row => [row.sourceId, row.score]));
  const foreign = structuredClone(context); foreign.spans[0]!.sourceName = 'another-owner';
  assert.throws(() => selectSourceCandidates(foreign), /does not match its recorded source/);
});

async function setup(t: TestContext) {
  const fixture = await createLoreDockFixture() as { root: string };
  await writeFile(path.join(fixture.root, 'sources/portal/src/ZincBadge.vue'), '<template><span>ZincBadge label</span></template>\n');
  fixtureGit(fixture.root, 'portal', ['add', '--all']); fixtureGit(fixture.root, 'portal', ['commit', '-qm', 'Add independent ZincBadge example']);
  const store = new CatalogStore(path.join(fixture.root, 'candidate-data')), catalog = new Catalog(store);
  t.after(async () => { await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  for (const source of ['portal', 'order-api']) await catalog.addSource(path.join(fixture.root, 'sources', source));
  const state = catalog.state(); catalog.start('candidate-initial', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  return { fixture, store, catalog };
}

test('candidate preview is available without AI and fences HTTP input, source removal and old policies', async t => {
  const { fixture, catalog, store } = await setup(t), app = createApp(catalog), url = 'http://127.0.0.1:4244';
  const request = (route: string, options: RequestInit = {}) => app.request(url + route, { ...options, headers: { host: '127.0.0.1:4244', ...options.headers } });
  const route = '/api/candidates/preview';
  assert.equal((await request(route, { method: 'POST' })).status, 401);
  const session = await request('/api/session', { method: 'POST', headers: { origin: url, 'x-loredock-client': 'web' } });
  const { token } = await session.json() as { token: string }, cookie = session.headers.get('set-cookie')!.split(';')[0]!;
  assert.equal((await request(route, { method: 'POST', headers: { cookie }, body: '{}' })).status, 403);
  const headers = { cookie, origin: url, 'x-loredock-csrf': token, 'content-type': 'application/json' };
  const preview = (input: unknown) => request(route, { method: 'POST', headers, body: JSON.stringify(input) });
  for (const input of [{}, { question: 1 }, { question: ' ' }, { question: '€'.repeat(700) }, { question: 'ZincBadge', requiredRepositories: ['portal'] }, { question: 'ZincBadge', buildId: 1 }]) {
    assert.equal((await preview(input)).status, 400);
  }
  const initial = await preview({ question: 'ZincBadge label' }); assert.equal(initial.status, 200);
  const result = await initial.json() as CandidatePreview;
  assert.equal(result.status, 'suggestions'); assert.equal(result.suggested.length, 1);
  const chosen = result.suggested[0]!; assert.equal(chosen.sourceName, 'portal');
  for (const support of chosen.support) {
    const original = catalog.evidence(support.id); assert.equal(original.sourceId, chosen.sourceId); assert.equal(original.revision, chosen.revision);
  }
  assert.equal(result.historical, false); assert.deepEqual(result.coverage, catalog.readBuild().coverage);
  await catalog.addSource(path.join(fixture.root, 'sources/order-worker'));
  assert.equal(sourceCandidatePreview(catalog, 'ZincBadge', result.buildId).stale, true);
  const state = catalog.state(); catalog.start('candidate-refresh', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  assert.equal(sourceCandidatePreview(catalog, 'ZincBadge', result.buildId).historical, true);
  catalog.revoke(chosen.sourceId);
  const removed = sourceCandidatePreview(catalog, 'ZincBadge', result.buildId);
  assert.ok([...removed.suggested, ...removed.otherMatches].every(row => row.sourceId !== chosen.sourceId));
  assert.throws(() => catalog.evidence(chosen.support[0]!.id));
  catalog.updatePolicy(['src']);
  assert.equal((await preview({ question: 'ZincBadge', buildId: result.buildId })).status, 409);
  assert.equal(store.all('SELECT id FROM answer_attempts').length, 0);
});
