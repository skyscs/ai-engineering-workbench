import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessOwnerRecords } from '../loredock-prepared-flow/resource-assess.mjs';

function fixture() {
  const limits = { wallMs: 2400000, storageBytes: 2147483648, catalogBytes: 536870912, graceMs: 10000, forcedExitWaitMs: 5000 };
  const owner = { schemaVersion: 'prepared-flow-kernel-owner/1', reason: 'completed', subreaper: true, errors: [], survivors: [],
    driverExit: { pid: 42, exit: 0 }, limits, elapsedMs: limits.wallMs, cleanupMs: 10000,
    catalogRoots: ['run/catalog'], observedCatalogRoots: ['run/catalog'], peakSampledCatalogBytes: { 'run/catalog': limits.catalogBytes },
    peakSampledStorageBytes: limits.storageBytes };
  const storage = [0, 1].map(monotonic => ({ monotonic, bytes: limits.storageBytes, entries: 10, racedEntries: 0, complete: true,
    catalogs: { 'run/catalog': { bytes: limits.catalogBytes, observed: true } } }));
  const events = [{ event: 'subreaper-verified', isolated: 1, noSite: 1 }, { event: 'started', limits },
    { event: 'driver-started', pid: 42 }, { event: 'finished', reason: 'completed', survivors: [] }].map((row, index) => ({ ...row, monotonic: index }));
  return { owner, storage, events, finalBytes: limits.storageBytes };
}
test('owner limits are inclusive and final retained bytes count separately from live sampling', () => {
  const input = fixture(); const accepted = assessOwnerRecords(input);
  assert.equal(accepted.status, 'passed'); assert.equal(accepted.resourceQualification, false); assert.equal(accepted.modelEligibility, false);
  input.finalBytes++; assert.equal(assessOwnerRecords(input).status, 'failed');
});
test('each global/catalog/time ceiling retains its failure', () => {
  for (const kind of ['catalog', 'wall', 'cleanup', 'sampled']) {
    const input = fixture();
    if (kind === 'catalog') { input.owner.peakSampledCatalogBytes['run/catalog']++; input.storage[1].catalogs['run/catalog'].bytes++; }
    if (kind === 'wall') input.owner.elapsedMs++;
    if (kind === 'cleanup') input.owner.cleanupMs++;
    if (kind === 'sampled') { input.owner.peakSampledStorageBytes++; input.storage[1].bytes++; }
    assert.equal(assessOwnerRecords(input).status, 'failed', kind);
  }
});
test('missing legacy catalog measurements, unseen roots and raced storage cannot pass', () => {
  const legacy = fixture(); delete legacy.owner.catalogRoots; delete legacy.owner.limits.catalogBytes;
  for (const row of legacy.storage) delete row.catalogs;
  assert.equal(assessOwnerRecords(legacy).status, 'incomplete');
  const unseen = fixture(); unseen.owner.observedCatalogRoots = []; unseen.owner.peakSampledCatalogBytes['run/catalog'] = 0;
  for (const row of unseen.storage) row.catalogs['run/catalog'] = { bytes: 0, observed: false };
  assert.equal(assessOwnerRecords(unseen).status, 'incomplete');
  for (const field of ['complete', 'racedEntries']) {
    const input = fixture(); input.storage[0][field] = field === 'complete' ? false : 1;
    assert.equal(assessOwnerRecords(input).status, 'incomplete');
  }
});
test('owner failures survive and contradictory or missing evidence is rejected', () => {
  const failed = fixture(); failed.owner.reason = failed.events.at(-1).reason = 'driver-failure'; failed.owner.driverExit.exit = 1;
  assert.equal(assessOwnerRecords(failed).status, 'failed');
  const survivors = fixture(); survivors.owner.survivors = [{ pid: 10 }]; assert.equal(assessOwnerRecords(survivors).status, 'incomplete');
  const mismatch = fixture(); mismatch.owner.peakSampledStorageBytes--; assert.throws(() => assessOwnerRecords(mismatch));
  const noFinish = fixture(); noFinish.events.pop(); assert.throws(() => assessOwnerRecords(noFinish));
});
