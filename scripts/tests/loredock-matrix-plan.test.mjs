import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requireCompletedAnalysis } from '../loredock-prepared-flow/flow.mjs';
import { catalogRoots, workingRows, inputFor, definition } from '../loredock-prepared-flow/matrix-development-inputs.mjs';

test('the full matrix declares separate working and immutable catalog roots with fixed row expectations', () => {
  assert.equal(catalogRoots.length, 63); assert.equal(new Set(catalogRoots).size, 63);
  assert(!catalogRoots.some(root => catalogRoots.some(other => root !== other && root.startsWith(other + '/'))));
  assert(Object.keys(workingRows).every(root => root.endsWith('/data') && catalogRoots.includes(root)));
  assert(catalogRoots.some(root => root.endsWith('/catalog-only-checkpoint')));
  assert(catalogRoots.some(root => root.endsWith('/interrupted-checkpoint')));
  assert(catalogRoots.some(root => root.endsWith('/pending-checkpoint')));
  const rows = Object.entries(workingRows).filter(([root]) => root.includes('-list-'));
  assert.equal(rows.length, 4); assert.deepEqual(rows.map(([, count]) => count), [20, 64, 20, 64]);
});
test('ordinary rehearsal shapes remain explicit and never substitute a small corpus for near-limit input', () => {
  const small = inputFor('representative'), near = inputFor('near-limit');
  assert.equal(Object.keys(small.corpus).length, 4); assert.equal(small.expectedFiles, 12);
  assert.equal(Object.keys(near.corpus).length, 20); assert.equal(near.expectedFiles, 10000);
  assert.equal(near.expectedCodeFiles, 9977); assert.equal(small.expectedCodeFiles, 5);
  assert.equal(definition.oracles.length, 10); assert.equal(definition.oracles[6].setup, 'catalog-only');
  assert.throws(() => inputFor('kiln-prepared-flow-127'));
});
test('known partial analysis remains a failed prerequisite while unknown states stay unclassified', () => {
  const complete = { status: 'completed', published: true, currentParser: true };
  assert.equal(requireCompletedAnalysis(complete), complete);
  assert.throws(() => requireCompletedAnalysis({ ...complete, status: 'partial' }), error => error.code === 'INCOMPLETE_CODE_ANALYSIS');
  for (const value of [{ ...complete, status: 'failed' }, { ...complete, status: 'partial', published: false },
    { ...complete, status: 'partial', currentParser: false }])
    assert.throws(() => requireCompletedAnalysis(value), error => error.code === 'ERR_ASSERTION');
});
