import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessExpiryBounds } from '../loredock-prepared-flow/expiry-bounds.mjs';

test('the earliest possible expiry proves the two-poll ceiling without hiding preparation delay', () => {
  const exact = assessExpiryBounds({ findStarted: 1000, readyObserved: 1500, clearedObserved: 603000 });
  assert.equal(exact.conservativeClearDeadline, 603000); assert.equal(exact.resourceQualification, false);
  // A latest-publication bound would accept this clear despite not proving the two-second ceiling.
  assert.throws(() => assessExpiryBounds({ findStarted: 1000, readyObserved: 6000, clearedObserved: 605000 }), /conservative bound cannot prove/);
});

test('an early, unordered or invalid expiry observation cannot be accepted', () => {
  for (const row of [
    { findStarted: 1000, readyObserved: 1500, clearedObserved: 600999 },
    { findStarted: 1000, readyObserved: 500, clearedObserved: 601000 },
    { findStarted: 1000, readyObserved: 1500, clearedObserved: NaN },
  ]) assert.throws(() => assessExpiryBounds(row));
});
