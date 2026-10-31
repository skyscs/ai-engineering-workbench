import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { digest } from '../loredock-fixture.mjs';
import { createScaleFixture, scaleBaseline, scaleGit } from '../loredock-scale-fixture.mjs';

test('scale corpus is reproducible, preserves the pilot and provides twenty distinct source roles', async t => {
  const first = await createScaleFixture(); t.after(() => rm(first.root, { recursive: true, force: true }));
  const second = await createScaleFixture(); t.after(() => rm(second.root, { recursive: true, force: true }));
  assert.deepEqual(first.manifest, second.manifest); assert.deepEqual(first.oracle, second.oracle);
  const frozen = JSON.parse(await readFile(new URL('../../fixtures/loredock-scale/baseline.json', import.meta.url), 'utf8'));
  assert.deepEqual(scaleBaseline(first), frozen, 'Source and oracle changes require a separate baseline review.');
  const pilot = JSON.parse(await readFile(new URL('../../fixtures/loredock/baseline.json', import.meta.url), 'utf8'));
  assert.deepEqual(first.pilotManifest, pilot);
  assert.equal(first.manifest.sources.length, 20); assert.equal(new Set(first.manifest.sources.map(source => source.role)).size, 20);
  assert.equal(first.manifest.coverage.extractedFiles, 0);
  for (const source of first.manifest.sources) {
    assert.equal(scaleGit(first.root, source.id, ['rev-parse', 'HEAD']), source.revision);
    const files = scaleGit(first.root, source.id, ['ls-tree', '-r', '--name-only', 'HEAD']).split('\n');
    assert.deepEqual(files.sort(), [...first.manifest.policy.allowedPaths[source.id], ...source.excluded.map(file => file.path)].sort());
    assert.ok(!files.some(file => file.includes('oracle') || file.includes('baseline')));
    assert.equal(scaleGit(first.root, source.id, ['status', '--porcelain=v1']), '');
    assert.match(scaleGit(first.root, source.id, ['ls-tree', 'HEAD', 'outside-link']), /^120000 /);
  }
});

test('scale oracle references resolving originals while preserving ambiguity and unknown execution', async t => {
  const fixture = await createScaleFixture(); t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const refs = new Map(fixture.manifest.evidence.map(ref => [ref.id, ref]));
  for (const ref of refs.values()) {
    const bytes = scaleGit(fixture.root, ref.sourceId, ['show', `${ref.revision}:${ref.path}`], false);
    assert.equal(digest(bytes), ref.contentHash); assert.equal(bytes.trimEnd().split('\n').length, ref.endLine);
    assert.equal(scaleGit(fixture.root, ref.sourceId, ['rev-parse', `${ref.revision}:${ref.path}`]), ref.blobId);
  }
  assert.equal(fixture.oracle.questions.length, 20); assert.equal(new Set(fixture.oracle.questions.map(q => q.id)).size, 20);
  for (const question of fixture.oracle.questions) {
    assert.ok(question.expected && question.requiredUncertainty); assert.ok(question.evidence.length);
    for (const id of question.evidence) assert.ok(refs.has(id), `${question.id}: missing ${id}`);
  }
  const read = id => { const ref = refs.get(id); return scaleGit(fixture.root, ref.sourceId, ['show', `${ref.revision}:${ref.path}`]); };
  assert.deepEqual(JSON.parse(read('contract-library/contracts/OrderPlaced.json')), JSON.parse(read('producer-contract')));
  assert.equal(JSON.parse(read('notification-worker/config/local.json')).orderTopic, JSON.parse(read('worker-local')).orderTopic);
  assert.notEqual(JSON.parse(read('reporting-api/config/local.json')).mongoDatabase, JSON.parse(read('worker-local')).mongoDatabase);
  assert.equal(JSON.parse(read('reporting-api/config/local.json')).mongoCollection, JSON.parse(read('worker-local')).mongoCollection);
  assert.match(read('deployment-production/config/production.json'), /\$\{ORDER_TOPIC\}/);
  assert.match(read('database-migrations/README.md'), /does not prove it was applied/);
  assert.match(read('inventory-api/README.md'), /two logical applications/);
  assert.match(read('legacy-admin/src/plugin.js'), /'plugins\/' \+ name/);
  assert.match(read('shipping-api/docs/rename.md'), /fulfillment-api to shipping-api/);
  assert.deepEqual(JSON.parse(await readFile(path.join(fixture.root, 'pilot-oracle.json'), 'utf8')), fixture.pilotOracle);
});
