import assert from 'node:assert/strict';
import { config as candidate } from './streaming-snapshot-config.js';
import { config as supported } from './allocation-profile-config.js';

const size = { ...candidate.size, pathsPerSource: 0,
  bytes: Object.values(candidate.corpusFactory()).flatMap(files => Object.values(files)).reduce((sum, text) => sum + Buffer.byteLength(text), 0) };
export const oracle = { ...supported.oracle, arms: ['same-process', 'reopened-process'], sizes: [size],
  operations: ['first', 'repeat-1', 'repeat-2', 'repeat-3', 'selected', 'page-4', 'isolated', 'history'],
  selectedFlows: 1, selectedRequiredNodes: supported.oracle.requiredNodes,
  isolatedOriginals: 5, isolated: { reason: 'unresolved-import' },
  limits: { ...supported.oracle.limits, wallMs: 5000 },
  resources: { sampleIntervalMs: 5, maxSliceMs: 150, sampledRssMiB: 384, sampledHeapGrowthMiB: 64 },
  diagnostic: { preparerWatchdogMs: 60000, readerWatchdogMs: 60000, overallWatchdogMs: 180000 },
  instrumentation: { profiler: false, phaseHooks: false, queryHooks: false, ownerHooks: false,
    ordinaryCounters: true, aggregateCharges: true, outerResourceSampler: true },
};
export async function configuration(pathsPerSource: number) {
  assert.equal(pathsPerSource, 0);
  return { ...candidate, oracle, size };
}
