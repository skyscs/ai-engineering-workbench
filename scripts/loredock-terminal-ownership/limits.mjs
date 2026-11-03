import assert from 'node:assert/strict';

// Diagnostic bounds only; application resource limits are unchanged.
export const maximums = Object.freeze({ fileBytes: 128 * 1024 * 1024, nodes: 1000000, edges: 4000000,
  strings: 1000000, selectors: 8, matches: 8, pathSteps: 64, summaryBytes: 256 * 1024,
  watchdogMs: 900000, sampledRssBytes: 1024 * 1024 * 1024 });
export function limitsFor(reduced = {}) {
  assert.ok(reduced && typeof reduced === 'object' && !Array.isArray(reduced));
  const limits = { ...maximums, ...reduced };
  for (const [key, value] of Object.entries(limits)) assert.ok(Object.hasOwn(maximums, key)
    && Number.isSafeInteger(value) && value > 0 && value <= maximums[key], 'Diagnostic bounds may only be reduced.');
  return limits;
}
export function pinnedRuntime() {
  assert.equal(process.version, 'v22.23.2'); assert.equal(process.versions.v8, '12.4.254.21-node.56');
}
