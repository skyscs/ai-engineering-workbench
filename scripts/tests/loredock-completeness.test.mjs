import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { test } from 'node:test';
import { completenessContract } from '../../fixtures/loredock-completeness/cases.mjs';
import { createScaleFixture, scaleBaseline, scaleGit } from '../loredock-scale-fixture.mjs';
import { digest } from '../loredock-fixture.mjs';
import { measureRequirement, verifyCompletenessBaseline } from '../loredock-completeness.mjs';

test('prospective paired questions preserve their frozen contract, original evidence and earlier failed runs', async t => {
  const baseline = await verifyCompletenessBaseline(), fixture = await createScaleFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  assert.deepEqual(scaleBaseline(fixture), baseline.sourceBaseline);
  const { intents, cases } = completenessContract;
  assert.equal(intents.length, 12); assert.equal(cases.length, 24);
  assert.equal(new Set(cases.map(item => item.question)).size, 24);
  for (const intent of intents) {
    assert.deepEqual(cases.filter(item => item.intentId === intent.id).map(item => item.split), ['development', 'reserved']);
    assert.ok(intent.rationale && intent.optionalContext.length && intent.forbiddenAssertions.length);
    assert.ok(intent.requirements.some(item => item.kind === 'answer') && intent.requirements.some(item => item.kind === 'qualification'));
    assert.equal(new Set(intent.requirements.map(item => item.id)).size, intent.requirements.length);
    for (const requirement of intent.requirements) {
      assert.ok(requirement.proposition && requirement.evidence.length && ['all', 'any'].includes(requirement.mode));
      for (const id of requirement.evidence) {
        const ref = fixture.manifest.evidence.find(ref => ref.id === id); assert.ok(ref, id);
        const text = scaleGit(fixture.root, ref.sourceId, ['show', `${ref.revision}:${ref.path}`], false);
        assert.equal(digest(text), ref.contentHash);
      }
    }
  }
  for (const source of fixture.manifest.sources) {
    const tree = scaleGit(fixture.root, source.id, ['ls-tree', '-r', '--name-only', 'HEAD']);
    assert.doesNotMatch(tree, /completeness|oracle|baseline/);
  }
  assert.equal(completenessContract.modelBudget, 0);
  assert.match(completenessContract.scoring.historicalGate, /does not replace or rescore/);
});

test('evidence alternatives are explicit and wrong ownership, revision, bytes or ranges cannot satisfy a requirement', () => {
  const ref = { id: 'local-a', sourceId: 'a', revision: 'rev-a', path: 'config/local.json', contentHash: 'sha-a', blobId: 'blob-a', startLine: 1, endLine: 5 };
  const manifest = { evidence: [ref, { ...ref, id: 'local-b', sourceId: 'b' }] };
  const original = { sourceName: ref.sourceId, revision: ref.revision, path: ref.path, contentHash: ref.contentHash,
    blobId: ref.blobId, startLine: ref.startLine, endLine: ref.endLine };
  const requirement = { id: 'local-value', kind: 'answer', mode: 'any', evidence: ['local-a', 'local-b'] };
  assert.equal(measureRequirement(requirement, [original], manifest).available, true);
  assert.equal(measureRequirement({ ...requirement, mode: 'all' }, [original], manifest).available, false);
  assert.equal(measureRequirement(requirement, [], manifest).available, false);
  for (const replacement of [{ sourceName: 'wrong' }, { revision: 'wrong' }, { path: 'config/production.json' },
    { contentHash: 'wrong' }, { blobId: 'wrong' }, { startLine: 2 }, { endLine: 4 }]) {
    assert.equal(measureRequirement(requirement, [{ ...original, ...replacement }], manifest).available, false);
  }
  assert.throws(() => measureRequirement({ ...requirement, evidence: ['missing'] }, [], manifest), /Unknown evidence/);
  assert.throws(() => measureRequirement({ ...requirement, mode: 'unknown' }, [], manifest));
});
