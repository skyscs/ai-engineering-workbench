import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { selectCandidateLinks, type CandidateLink } from '../src/candidate-links.js';
import { retrieveAnswerContext, type AnswerContext } from '../src/answer-context.js';
import { selectSourceCandidates, sourceCandidatePreview, type CandidateSelection } from '../src/source-candidates.js';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { Corrections } from '../src/corrections.js';
import { sha256 } from '../src/extract.js';
// @ts-expect-error Frozen cases are plain JavaScript.
import { linkCases } from '../../../fixtures/loredock-candidate-links/cases.mjs';
// @ts-expect-error The independent synthetic generator is plain JavaScript.
import { createScaleFixture } from '../../../scripts/loredock-scale-fixture.mjs';

interface Example { id: string; seeds: string[]; anchors: string[]; links: [string, string, CandidateLink['kind']][];
  expected: string[]; difference?: boolean; duplicateNames?: boolean; omittedSources?: number; omittedLinks?: number }
function example(item: Example, fresh = false) {
  const names = ['a', 'b', 'c', 'd', 'e', 'f'], ids = new Map(names.map(name => [name, fresh ? randomUUID() : name]));
  const sources = names.map(name => ({ sourceId: ids.get(name)!, name: item.duplicateNames ? 'shared' : name, revision: 'a'.repeat(40) }));
  const spans = sources.map((source, index) => ({ id: fresh ? randomUUID() : `span-${index}`, sourceId: source.sourceId, sourceName: source.name,
    revision: source.revision, path: `src/${names[index]}.ts`, startLine: 1, endLine: 1,
    text: item.anchors.includes(names[index]!) ? 'QuietBeacon' : 'unrelated', contentHash: 'content', spanHash: 'span' }));
  const context = { sources, spans } as Pick<AnswerContext, 'sources' | 'spans'>;
  const selection = { suggested: item.seeds.map(name => ({ sourceId: ids.get(name)! })), distinctiveTerms: ['beacon'] } as Pick<CandidateSelection, 'suggested' | 'distinctiveTerms'>;
  const endpoint = (name: string) => { const ref = spans[names.indexOf(name)]!;
    return { sourceId: ref.sourceId, sourceName: ref.sourceName, revision: ref.revision, label: `Endpoint ${name}`, evidenceIds: [ref.id] }; };
  const links: CandidateLink[] = item.links.map(([from, to, kind], index) => ({ id: fresh ? randomUUID() : `edge-${index}`, origin: kind.startsWith('http') || kind === 'event-delivery' ? 'code' : 'declaration',
    kind, status: kind.endsWith('difference') ? 'difference' : 'candidate', environment: null, from: endpoint(from), to: endpoint(to),
    reason: 'Static clue only.', gaps: ['Runtime binding is unknown.'], evidence: [spans[names.indexOf(from)]!, spans[names.indexOf(to)]!] }));
  return { context, selection, links, name: (id: string) => names.find(name => ids.get(name) === id) };
}

test('frozen candidate links preserve anchors, direction, identity, limits and one-hop scope', async () => {
  const baseline = JSON.parse(await readFile(new URL('../../../fixtures/loredock-candidate-links/baseline.json', import.meta.url), 'utf8')) as { sourceHashes: Record<string,string> };
  for (const [file, hash] of Object.entries(baseline.sourceHashes)) assert.equal(sha256(await readFile(new URL('../../../' + file, import.meta.url))), hash);
  for (const item of linkCases as Example[]) {
    const input = example(item), before = JSON.stringify(input), result = selectCandidateLinks(input.context, input.selection, input.links);
    assert.equal(JSON.stringify(input), before); assert.deepEqual(result.sources.map(source => input.name(source.sourceId)), item.expected, item.id);
    assert.equal(result.verification, 'unverified');
    if (item.difference) { const link = result.sources[0]!.links[0]!; assert.equal(link.status, 'difference'); assert.equal(input.name(link.from.sourceId), 'a'); }
    if (item.omittedSources !== undefined) assert.equal(result.omittedSources, item.omittedSources);
    if (item.omittedLinks !== undefined) assert.equal(result.omittedLinks, item.omittedLinks);
    const fresh = example(item, true); fresh.links.reverse();
    const second = selectCandidateLinks(fresh.context, fresh.selection, fresh.links);
    assert.deepEqual(second.sources.map(source => [fresh.name(source.sourceId), source.links.map(link => link.kind)]),
      result.sources.map(source => [input.name(source.sourceId), source.links.map(link => link.kind)]));
  }
});

test('candidate links reject foreign support and auxiliary evidence cannot anchor an endpoint', () => {
  const input = example(linkCases[0] as Example), foreign = structuredClone(input.links);
  foreign[0]!.evidence[0]!.sourceId = 'b';
  assert.throws(() => selectCandidateLinks(input.context, input.selection, foreign), /original source evidence/);
  const missing = structuredClone(input.links); missing[0]!.evidence.pop();
  assert.throws(() => selectCandidateLinks(input.context, input.selection, missing), /original source evidence/);
  const changed = structuredClone(input.links); changed[0]!.evidence[0]!.spanHash = 'changed';
  assert.throws(() => selectCandidateLinks(input.context, input.selection, changed), /original source evidence/);
  const auxiliary = structuredClone(input.links), original = input.context.spans[0]!;
  auxiliary[0]!.from.evidenceIds = ['unrelated']; auxiliary[0]!.evidence.push({ ...original, id: 'unrelated' });
  assert.equal(selectCandidateLinks(input.context, input.selection, auxiliary).sources.length, 0);
});

test('symmetric declaration side order does not change bounded link selection or original directions', () => {
  const input = example({ id: 'stable-order', seeds: ['a', 'c', 'd'], anchors: ['a', 'c', 'd'], expected: ['b'],
    links: [['a', 'b', 'contract-match'], ['c', 'b', 'contract-match'], ['d', 'b', 'contract-match']] });
  const first = selectCandidateLinks(input.context, input.selection, input.links);
  const swapped = structuredClone(input.links).reverse();
  for (const link of swapped) [link.from, link.to] = [link.to, link.from];
  const second = selectCandidateLinks(input.context, input.selection, swapped);
  assert.deepEqual(second.sources[0]!.links.map(link => link.id), first.sources[0]!.links.map(link => link.id));
  assert.ok(second.sources[0]!.links.every(link => link.from.sourceId === 'b'));
});

test('linked original evidence, review and scope remain separate from immutable lexical context', async t => {
  const fixture = await createScaleFixture() as { root: string; manifest: { sources: { id: string }[] } };
  const store = new CatalogStore(path.join(fixture.root, 'links-data')), catalog = new Catalog(store);
  t.after(async () => { await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  const paths = fixture.manifest.sources.map(source => path.join(fixture.root, 'sources', source.id));
  const preview = await catalog.previewSources(paths); await catalog.registerSources({ paths, previewHash: preview.previewHash, requestId: 'links' });
  const state = catalog.state(); catalog.start('links', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  const question = 'OrderPlaced tenantId', context = retrieveAnswerContext(catalog, question), selection = selectSourceCandidates(context);
  const result = sourceCandidatePreview(catalog, question);
  assert.deepEqual(result.suggested, selection.suggested); assert.equal(result.inputHash, context.inputHash);
  assert.ok(result.related.sources.length > 0);
  for (const source of result.related.sources) for (const link of source.links) for (const ref of link.evidence) {
    const original = catalog.evidence(ref.id);
    for (const key of ['sourceId', 'sourceName', 'revision', 'path', 'startLine', 'endLine', 'contentHash', 'spanHash'] as const) assert.equal(ref[key], original[key]);
    assert.equal(original.buildId, result.buildId); assert.equal('text' in ref, false);
  }
  const link = result.related.sources[0]!.links[0]!, corrections = new Corrections(catalog);
  const note = corrections.save({ requestId: 'linked-review', buildId: result.buildId, targetKind: link.origin === 'code' ? 'code-link' : 'declaration-link',
    targetId: link.id, projectionHash: link.origin === 'code' ? result.related.projections.code.inputHash : result.related.projections.declarations.inputHash,
    expectedRevision: state.correctionRevision, expectedPreviousId: null, action: 'dispute', statement: 'This static link requires deployment evidence.', environment: null });
  const reviewed = sourceCandidatePreview(catalog, question);
  assert.ok(reviewed.review!.notes.some(item => item.id === note.id && item.verification === 'unverified'));
  assert.deepEqual(reviewed.related.sources, result.related.sources);
  assert.notEqual(reviewed.previewHash, result.previewHash);
  const removed = result.related.sources[0]!; catalog.revoke(removed.sourceId);
  const revoked = sourceCandidatePreview(catalog, question, result.buildId);
  assert.ok(revoked.related.sources.every(source => source.sourceId !== removed.sourceId));
  for (const source of revoked.related.sources) for (const link of source.links) assert.ok(link.evidence.every(ref => ref.sourceId !== removed.sourceId));
  catalog.updatePolicy(['config']); assert.throws(() => sourceCandidatePreview(catalog, question, result.buildId), /policy/);
  assert.equal(store.all('SELECT id FROM answer_attempts').length, 0);
});
