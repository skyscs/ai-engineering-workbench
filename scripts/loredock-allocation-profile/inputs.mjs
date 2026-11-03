import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function loadProfileOracle() {
  const oracle = JSON.parse(await readFile(new URL('../../fixtures/loredock-allocation-profile/oracle.json', import.meta.url)));
  const policy = JSON.parse(await readFile(new URL('../../fixtures/loredock-allocation-profile/profile-policy.json', import.meta.url)));
  assert.equal(policy.schemaVersion, 'task080-profile-policy/2');
  const keys = ['allowUnmappedSamples', 'backendStopForcesGC', 'backendExportAllocationsIncluded'];
  assert.deepEqual(Object.keys(policy).sort(), ['schemaVersion', ...keys].sort());
  for (const key of keys) assert.equal(policy[key], true);
  return { ...oracle, profile: { ...oracle.profile, ...Object.fromEntries(keys.map(key => [key, policy[key]])) } };
}
