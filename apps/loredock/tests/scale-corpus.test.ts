import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { Catalog } from '../src/catalog.js';
import { CatalogStore } from '../src/store.js';
// @ts-expect-error The independent fixture generator is plain JavaScript.
import { createScaleFixture, scaleGit } from '../../../scripts/loredock-scale-fixture.mjs';

test('the scale corpus exposes the production fourth-source blocker without bypassing the pilot boundary', async t => {
  const fixture = await createScaleFixture() as { root: string; manifest: { sources: { id: string }[] } };
  const store = new CatalogStore(path.join(fixture.root, 'data')), catalog = new Catalog(store);
  t.after(async () => { await catalog.stop(); store.close(); await rm(fixture.root, { recursive: true, force: true }); });
  assert.equal(fixture.manifest.sources.length, 20);
  for (const source of fixture.manifest.sources.slice(0, 3)) await catalog.addSource(path.join(fixture.root, 'sources', source.id));
  await assert.rejects(catalog.addSource(path.join(fixture.root, 'sources', 'checkout-bff')), { code: 'SOURCE_LIMIT' });
  assert.equal(catalog.state().sources.length, 3);
  const state = catalog.state(); catalog.start('supported-pilot-only', state.sourceSetVersion, state.policyVersion); await catalog.idle();
  assert.equal(catalog.state().builds[0]!.coverage.indexed, 18);
  assert.equal(catalog.state().builds[0]!.sources.length, 3);
  for (const source of fixture.manifest.sources) assert.equal(scaleGit(fixture.root, source.id, ['status', '--porcelain=v1']), '');
});
