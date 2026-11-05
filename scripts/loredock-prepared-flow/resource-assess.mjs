// Global owner/storage assessment only; no app imports, candidate execution or inferred missing measurements.
import assert from 'node:assert/strict';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { hash, inventory } from './io.mjs';

const { thresholds } = JSON.parse(await readFile(new URL('../../fixtures/loredock-prepared-flow/protocol.json', import.meta.url)));
const finite = value => assert(Number.isFinite(value) && value >= 0);

export function assessOwnerRecords({ owner, storage, events, finalBytes }) {
  assert.equal(owner.schemaVersion, 'prepared-flow-kernel-owner/1');
  assert(Array.isArray(storage) && storage.length >= 2 && Array.isArray(events));
  const result = { status: 'incomplete', checks: [], incomplete: [], failures: [], resourceQualification: false, modelEligibility: false };
  const check = (metric, value, limit) => { finite(value); result.checks.push({ metric, value, limit, passed: value <= limit }); };
  assert.equal(events[0].event, 'subreaper-verified'); assert.equal(events[0].isolated, 1); assert.equal(events[0].noSite, 1);
  const starts = events.filter(row => row.event === 'started'), drivers = events.filter(row => row.event === 'driver-started');
  assert.equal(starts.length, 1); assert.equal(drivers.length, 1); assert.equal(events.at(-1).event, 'finished');
  for (const [index, row] of events.entries()) { finite(row.monotonic); if (index) assert(row.monotonic >= events[index - 1].monotonic); }
  assert.equal(owner.driverExit?.pid, drivers[0].pid);
  assert.equal(events.at(-1).reason, owner.reason);
  assert.equal(owner.subreaper, true);
  if (owner.reason !== 'completed' || owner.driverExit?.exit !== 0) result.failures.push('The owned driver did not complete successfully.');
  if (owner.errors.length || owner.survivors.length || events.at(-1).survivors.length) result.incomplete.push('Owner errors or surviving descendants.');
  assert.deepEqual(starts[0].limits, owner.limits);
  for (const [key, value] of Object.entries({ wallMs: thresholds.suiteWallMs, storageBytes: thresholds.ownedEvaluationDirectoryBytes,
    catalogBytes: thresholds.catalogAndNativeHistoryBytes, graceMs: thresholds.shutdownMsExcludingDeclaredHold, forcedExitWaitMs: 5000 })) {
    if (owner.limits[key] !== value) result.incomplete.push('Owner limit differs from the frozen execution limit: ' + key);
  }
  const roots = owner.catalogRoots ?? [];
  if (!roots.length) result.incomplete.push('No declared live catalog storage measurement.');
  assert(roots.length <= 64 && new Set(roots).size === roots.length);
  for (const root of roots) {
    assert(root.startsWith('run/') && path.normalize(root) === root && !root.split('/').includes('..'));
    assert(!roots.some(other => root !== other && root.startsWith(other + '/')));
  }
  const peaks = Object.fromEntries(roots.map(root => [root, 0])), observed = new Set();
  let peak = 0, maxSampleGapMs = 0;
  for (const [index, row] of storage.entries()) {
    finite(row.bytes); finite(row.monotonic); finite(row.entries); finite(row.racedEntries);
    if (index) { assert(row.monotonic >= storage[index - 1].monotonic); maxSampleGapMs = Math.max(maxSampleGapMs, (row.monotonic - storage[index - 1].monotonic) * 1000); }
    if (row.complete !== true || row.racedEntries) result.incomplete.push('Incomplete or raced storage sample: ' + index);
    peak = Math.max(peak, row.bytes);
    if (!row.catalogs) { result.incomplete.push('Missing per-catalog sample: ' + index); continue; }
    assert.deepEqual(Object.keys(row.catalogs).sort(), [...roots].sort());
    let selected = 0;
    for (const root of roots) {
      const value = row.catalogs[root]; finite(value.bytes); assert.equal(typeof value.observed, 'boolean');
      if (!value.observed) assert.equal(value.bytes, 0); else observed.add(root);
      selected += value.bytes; peaks[root] = Math.max(peaks[root], value.bytes);
    }
    assert(selected <= row.bytes);
  }
  assert.equal(peak, owner.peakSampledStorageBytes);
  if (roots.length) {
    assert.deepEqual(peaks, owner.peakSampledCatalogBytes);
    assert.deepEqual([...observed].sort(), [...owner.observedCatalogRoots].sort());
    for (const root of roots) {
      if (!observed.has(root)) result.incomplete.push('Declared catalog was never observed: ' + root);
      check('catalogAndNativeHistoryBytes:' + root, peaks[root], thresholds.catalogAndNativeHistoryBytes);
    }
  }
  check('suiteWallMs', owner.elapsedMs, thresholds.suiteWallMs);
  check('ownerCleanupMs', owner.cleanupMs, thresholds.shutdownMsExcludingDeclaredHold);
  check('sampledOwnedEvaluationDirectoryBytes', peak, thresholds.ownedEvaluationDirectoryBytes);
  check('finalOwnedEvaluationDirectoryBytes', finalBytes, thresholds.ownedEvaluationDirectoryBytes);
  result.observed = { samples: storage.length, maxSampleGapMs, cleanupMs: owner.cleanupMs, catalogRoots: roots.length };
  result.status = result.incomplete.length ? 'incomplete' : result.failures.length || result.checks.some(row => !row.passed) ? 'failed' : 'passed';
  return result;
}

export async function assessRecordedOwner(directory) {
  assert(path.isAbsolute(directory) && await realpath(directory) === directory);
  const read = async name => readFile(path.join(directory, name), 'utf8');
  const [ownerRaw, storageRaw, eventsRaw] = await Promise.all([read('result.json'), read('storage.jsonl'), read('owner.jsonl')]);
  for (const raw of [storageRaw, eventsRaw]) assert(raw.endsWith('\n'), 'Truncated owner evidence.');
  const files = await inventory(directory, { recordSymlinks: true });
  const finalBytes = Object.values(files).reduce((sum, row) => sum + (row.bytes ?? Buffer.byteLength(row.target)), 0);
  const result = assessOwnerRecords({ owner: JSON.parse(ownerRaw), storage: storageRaw.trimEnd().split('\n').map(JSON.parse),
    events: eventsRaw.trimEnd().split('\n').map(JSON.parse), finalBytes });
  return { ...result, finalInventory: files, evidenceHashes: { owner: hash(ownerRaw), storage: hash(storageRaw), events: hash(eventsRaw) } };
}
