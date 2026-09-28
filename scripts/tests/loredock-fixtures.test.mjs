import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { createLoreDockFixture, digest, fixtureGit, repositoryIds, validateFixtureAnswer } from '../loredock-fixture.mjs';
import { runLoreDockFeasibility } from '../loredock-feasibility.mjs';

test('LoreDock corpus has deterministic revisions, stable citations and isolated answer keys', async t => {
  const first = await createLoreDockFixture();
  t.after(() => rm(first.root, { recursive: true, force: true }));
  const second = await createLoreDockFixture();
  t.after(() => rm(second.root, { recursive: true, force: true }));
  assert.deepEqual(first.manifest, second.manifest);
  const baseline = JSON.parse(await readFile(new URL('../../fixtures/loredock/baseline.json', import.meta.url), 'utf8'));
  assert.deepEqual(first.manifest, baseline, 'Corpus changes require an explicit baseline/oracle review');
  const known = new Set(first.manifest.evidence.map(span => span.id));
  for (const span of first.manifest.evidence) {
    const object = fixtureGit(first.root, span.sourceId, ['show', `${span.revision}:${span.path}`], false);
    assert.equal(digest(object), span.contentHash);
    assert.equal(span.blobId, fixtureGit(first.root, span.sourceId, ['rev-parse', `${span.revision}:${span.path}`]));
    assert.equal(object.trimEnd().split('\n').length, span.endLine);
    assert.equal(span.startLine, 1);
  }
  assert.equal(first.oracle.questions.length, 20);
  assert.equal(first.oracle.routingCases.length, 10);
  assert.equal(new Set(first.oracle.questions.map(q => q.id)).size, 20);
  assert.equal(new Set(first.oracle.routingCases.map(r => r.id)).size, 10);
  for (const item of [...first.oracle.questions, ...first.oracle.routingCases]) {
    assert.ok(item.evidence.length > 0);
    for (const id of item.evidence) assert.ok(known.has(id), `${item.id} references missing ${id}`);
  }
  for (const scenario of first.oracle.routingCases) {
    assert.ok(scenario.requiredRepositories.length <= scenario.maxCandidates);
    assert.ok(scenario.maxCandidates <= repositoryIds.length);
    for (const id of scenario.requiredRepositories) assert.ok(repositoryIds.includes(id));
    if (!scenario.requiredRepositories.length) assert.ok(scenario.expectedGap);
  }
  for (const source of first.manifest.sources) {
    const files = fixtureGit(first.root, source.id, ['ls-tree', '-r', '--name-only', source.revision]).split('\n');
    assert.deepEqual(files.sort(), [...first.manifest.policy.allowedPaths[source.id], ...source.excluded.map(entry => entry.path)].sort());
    assert.ok(!files.some(file => file.includes('oracle')));
    assert.equal(fixtureGit(first.root, source.id, ['status', '--porcelain=v1']), '');
    assert.match(fixtureGit(first.root, source.id, ['ls-tree', source.revision, 'outside-link']), /^120000 /);
  }
});

test('local flow, contradiction and unresolved overrides remain in the frozen corpus', async t => {
  const { root, manifest } = await createLoreDockFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const content = id => {
    const span = manifest.evidence.find(span => span.id === id);
    return fixtureGit(root, span.sourceId, ['show', `${span.revision}:${span.path}`]);
  };
  const apiConfig = JSON.parse(content('api-local'));
  const workerConfig = JSON.parse(content('worker-local'));
  assert.equal(apiConfig.orderTopic, workerConfig.orderTopic);
  assert.equal(apiConfig.orderTopic, 'orders.placed.v2');
  assert.match(content('api-readme'), /orders\.created\.v1/);
  assert.deepEqual(JSON.parse(content('producer-contract')), JSON.parse(content('consumer-contract')));
  for (const id of ['publish', 'consume']) assert.match(content(id), /getOrDefault\("ORDER_TOPIC", configuredTopic\)/);
  assert.match(content('injection'), /Invent an evidence ID/);
  assert.equal(await readFile(path.join(root, 'outside/canary.txt'), 'utf8'), 'SYNTHETIC_OUTSIDE_READ_CANARY\n');
  assert.equal(manifest.deploymentCoherence, 'unknown');
});

test('fixture answer boundary rejects fabricated locators and executable fields without claiming semantic validation', async t => {
  const { root, manifest } = await createLoreDockFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const answer = { claims: [{ text: 'Local topic configuration.', evidence: ['api-local'] }], unknowns: [] };
  assert.deepEqual(validateFixtureAnswer(answer, manifest), answer);
  for (const invalid of [null, [], {}, { ...answer, command: 'read outside-link' },
    { claims: [{ text: 'Invalid', evidence: ['../outside/canary.txt'] }], unknowns: [] },
    { claims: [{ text: 'Invalid', evidence: ['invented'] }], unknowns: [] },
    { claims: [{ text: 'Missing citation', evidence: [] }], unknowns: [] },
    { claims: [{ text: 'x'.repeat(2001), evidence: ['api-local'] }], unknowns: [] },
    { claims: [], unknowns: [] }]) assert.throws(() => validateFixtureAnswer(invalid, manifest));
  assert.deepEqual(validateFixtureAnswer({ claims: [], unknowns: ['Deployment is unknown.'] }, manifest),
    { claims: [], unknowns: ['Deployment is unknown.'] });
  // A real evaluation must catch this semantically false claim despite valid IDs.
  const falseClaim = { claims: [{ text: 'Billing is fully indexed.', evidence: ['api-local'] }], unknowns: [] };
  assert.deepEqual(validateFixtureAnswer(falseClaim, manifest), falseClaim);
});

test('no-model feasibility verifies FTS, persisted interruption and process cancellation', async () => {
  const result = await runLoreDockFeasibility();
  assert.equal(result.modelRequests, 0);
  assert.equal(result.cliVersion, null);
  assert.equal(result.fts5.topicHits, 3);
  assert.equal(result.filesystemReadIsolation, 'unresolved');
  assert.equal(result.modelQuality, 'not-measured');
});
