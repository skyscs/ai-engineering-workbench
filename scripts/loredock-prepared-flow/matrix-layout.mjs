// Fixed ordinary assembly metadata. No application imports or source execution.
import assert from 'node:assert/strict';
import { resourceCaseOrder } from './coordinator.mjs';

export const boundaries = ['first-preflight', 'before-dispatch', 'before-publication'];
export const mutations = ['review', 'policy', 'published-build'];
export function matrixCatalogRoots(oracleIds) {
  assert(Array.isArray(oracleIds) && oracleIds.length === 10 && new Set(oracleIds).size === 10);
  for (const id of oracleIds) assert(/^[A-Za-z0-9-]+$/.test(id));
  const groups = [
    ['cold/data', 'cold/checkpoint'], ['cold/data', 'cold/checkpoint'],
    ['representative/data', 'near-limit/data'],
    ['capacity/data', 'capacity/checkpoint-20', 'capacity/checkpoint-64'],
    ['history-20/data', 'history-64/data'], ['expiry/data'],
    ['preparation/data', 'provider/data', 'shutdown/data', 'shutdown/interrupted-checkpoint'],
    ['lost/data', 'lost/history-checkpoint', 'edit/data'],
    ['history-20/data', 'history-64/data', 'interrupted/data'],
    ['eviction/data', 'eviction/before-reopen'],
    ['alternative/data', 'alternative/checkpoint', ...boundaries.flatMap(boundary => mutations.map(kind => boundary + '-' + kind + '/data')),
      'browser-preparation/data', 'browser-history/data'],
    ['revocation/data', 'pending/data', 'pending/pending-checkpoint', 'browser/data'],
    ['missing/data', 'corrupt/data'],
    [...oracleIds.map(id => id + '/case/data'), oracleIds[6] + '/case/catalog-only-checkpoint'],
    ['representative-worker/data', 'near-limit-worker/data', 'near-history/data', 'near-history/checkpoint-20', 'near-history/checkpoint-64',
      'representative-list-20/data', 'representative-list-64/data', 'near-limit-list-20/data', 'near-limit-list-64/data'],
  ];
  assert.equal(groups.length, resourceCaseOrder.length);
  const roots = groups.flatMap((group, index) => group.map(relative => 'run/matrix/' + resourceCaseOrder[index] + '/' + relative));
  assert.equal(roots.length, 63); assert.equal(new Set(roots).size, roots.length);
  assert(!roots.some(root => roots.some(other => root !== other && root.startsWith(other + '/'))));
  return roots;
}

export function matrixWorkingRows(oracleIds) {
  const counts = [[0], [0], [3, 3], [64], [20, 64], [0], [0, 1, 1], [1, 0], [20, 64, 1], [1],
    [0, ...Array(9).fill(1), 0, 1], [64, 64, 1], [1, 1], Array(10).fill(0), [1, 1, 64, 20, 64, 20, 64]];
  const roots = matrixCatalogRoots(oracleIds), result = {};
  for (const [index, id] of resourceCaseOrder.entries()) {
    const working = roots.filter(root => root.startsWith('run/matrix/' + id + '/') && root.endsWith('/data'));
    assert.equal(working.length, counts[index].length);
    working.forEach((root, position) => { result[root] = counts[index][position]; });
  }
  return result;
}

export const matrixCoverageGaps = {
  0: ['Unadmitted transient content needs an exact durable identity binding.', 'Cold preparation work requires the separate accounting reference.'],
  1: ['Unadmitted transient content needs an exact durable identity binding.', 'Cold preparation work requires the separate accounting reference.'],
  2: ['Complete operation/content binding is finalized with the later R15 diagnostic; this case result is immutable.'],
  3: ['Each capacity lifetime still needs complete per-operation closure and work binding.'],
  4: [],
  5: ['The browser assessor requires a declared idle window; expiry is a separate ten-minute observation.', 'Unadmitted expiry preparation has no durable witness.'],
  6: ['Active-work cancellation is a diagnostic observation, not uninstrumented per-operation timing.'],
  7: ['Declared transport holds/dropped responses do not qualify normal resource HTTP or browser timing.'],
  8: ['Restart/history operation work and complete retained content need case-specific binding.'],
  9: ['Eviction operation work and transient content need case-specific binding.'],
  10: ['Public policy fencing can precede a private validator; counters do not prove every requested private boundary.'],
  11: ['Fault recovery and late browser observations do not qualify normal resource timing.'],
  12: ['Original-fault observations do not qualify normal resource timing.'],
  13: ['Unadmitted oracle previews need explicit transient content/operation coverage.'],
  14: [],
};
