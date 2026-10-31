import assert from 'node:assert/strict';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
import { retrieveAnswerContext } from '../src/answer-context.js';
import { expansionTerms, interleaveCandidates } from '../src/answer-expansion.js';
// @ts-expect-error The independent source fixture is plain JavaScript.
import { createLoreDockFixture, fixtureGit } from '../../../scripts/loredock-fixture.mjs';

test('a quoted handler reference discovers a single-word type in another source without a repository hint', async t => {
  const fixture = await createLoreDockFixture() as { root: string };
  const store = new CatalogStore(path.join(fixture.root, 'data')), catalog = new Catalog(store);
  t.after(async () => { await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  await writeFile(path.join(fixture.root, 'sources/order-api/config/ingress.json'), JSON.stringify({
    description: 'Receipt upload endpoint dispatch configuration.', handler: 'Journal.append',
    headerBindings: 'tenantId', payloadEnvelope: 'requestEnvelope', transportOptions: 'connectionOptions',
  }) + '\n');
  await writeFile(path.join(fixture.root, 'sources/order-worker/src/main/java/Journal.java'),
    'final class Journal { interface Sink { void append(Object value); } void append(Sink sink, Object value) { sink.append(value); } }\n');
  for (const id of ['order-api', 'order-worker']) {
    fixtureGit(fixture.root, id, ['add', '--all']); fixtureGit(fixture.root, id, ['commit', '-qm', 'Add independent literal dispatch reference']);
    await catalog.addSource(path.join(fixture.root, 'sources', id));
  }
  const state = catalog.state(); catalog.start('literal-reference', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  const context = retrieveAnswerContext(catalog, 'Which component receives receipt uploads?');
  assert.ok(context.expansionTerms.includes('Journal'));
  assert.ok(context.spans.some(span => span.sourceName === 'order-worker' && span.path.endsWith('/Journal.java')));
  assert.ok(context.expansionTerms.length <= 12 && context.spans.length <= 30 && context.textBytes <= 64 * 1024);
  for (const id of ['order-api', 'order-worker']) assert.equal(fixtureGit(fixture.root, id, ['status', '--porcelain=v1']), '');
});

test('query affinity and source turns retain a rare relevant identifier amid frequent field distractors', () => {
  const noisy = 'tenantId headerBindings requestEnvelope responseEnvelope connectionOptions transportOptions '
    + 'requestHeaders responseHeaders messageEnvelope payloadEnvelope retryOptions clientOptions';
  const seeds = [{ sourceId: 'a', text: noisy }, { sourceId: 'a', text: noisy },
    { sourceId: 'b', text: 'UnrelatedType ReceiptAccepted ReceiptAccepted' }];
  const terms = expansionTerms(seeds, ['receipt']);
  assert.equal(terms[1], 'ReceiptAccepted'); assert.ok(terms.length <= 12);
  assert.equal(new Set(terms).size, terms.length);
  assert.deepEqual(expansionTerms(seeds.map(seed => ({ ...seed, sourceId: `fresh-${seed.sourceId}` })), ['receipt']), terms);
  assert.deepEqual(expansionTerms(seeds.map(seed => ({ ...seed, text: (seed.text + ' ').repeat(5) })), ['receipt']), terms,
    'Repeating an identifier within one passage must not buy more source opportunities.');
});

test('qualified hints require complete quoted references and obey seed/name limits', () => {
  const terms = expansionTerms([{ sourceId: 'source', text:
    '"Journal.append" \'Ledger.commit.field\' `Processor.apply` System.getenv("HOME"); JSON.stringify(value);' }], []);
  assert.ok(['Journal', 'Ledger', 'Processor'].every(name => terms.includes(name)));
  assert.ok(!terms.includes('System') && !terms.includes('JSON'));
  const longOwner = 'J' + 'a'.repeat(80);
  assert.deepEqual(expansionTerms([{ sourceId: 'source', text: `"${longOwner}.append"` }], []), []);
  const seeds = Array.from({ length: 6 }, (_, index) => ({ sourceId: String(index), text: `"Handler${index}.apply"` }));
  assert.ok(!expansionTerms([...seeds, { sourceId: 'seventh', text: '"Hidden.apply"' }], ['hidden']).includes('Hidden'));
});

test('direct matches get two opportunities per expanded hint after a fixed prefix without duplicate starvation or input mutation', () => {
  const prefix = [{ id: 'a' }, { id: 'b' }], direct = ['a', 'b', 'c', 'e', 'f'].map(id => ({ id }));
  const expanded = ['a', 'c', 'd', 'g'].map(id => ({ id }));
  assert.deepEqual(interleaveCandidates(prefix, direct, expanded).map(item => item.id), ['a', 'b', 'c', 'e', 'd', 'f', 'g']);
  assert.deepEqual(direct.map(item => item.id), ['a', 'b', 'c', 'e', 'f']);
  const lexical = Array.from({ length: 121 }, (_, index) => ({ id: `direct-${index}` }));
  const hints = Array.from({ length: 121 }, (_, index) => ({ id: `expanded-${index}` }));
  const admitted = interleaveCandidates([], lexical, hints).slice(0, 30);
  assert.equal(admitted.filter(item => item.id.startsWith('direct-')).length, 20);
  assert.equal(admitted.filter(item => item.id.startsWith('expanded-')).length, 10);
  assert.deepEqual(interleaveCandidates([], lexical, []).map(item => item.id), lexical.map(item => item.id));
  assert.deepEqual(interleaveCandidates([], [], [{ id: 'a' }, { id: 'a' }, { id: 'b' }]).map(item => item.id), ['a', 'b']);
});
