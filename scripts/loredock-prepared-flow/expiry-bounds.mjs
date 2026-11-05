import assert from 'node:assert/strict';

// A public observation brackets snapshot publication; it does not expose the daemon clock.
export function assessExpiryBounds({ findStarted, readyObserved, clearedObserved }) {
  for (const value of [findStarted, readyObserved, clearedObserved]) assert(Number.isFinite(value) && value >= 0);
  assert(readyObserved >= findStarted && clearedObserved >= readyObserved);
  const earliestExpiry = findStarted + 600000, latestExpiry = readyObserved + 600000;
  const conservativeClearDeadline = earliestExpiry + 2000;
  assert(clearedObserved >= earliestExpiry, 'The observed wait did not span the real ten-minute lifetime.');
  assert(clearedObserved <= conservativeClearDeadline, 'The conservative bound cannot prove clearing within two poll intervals.');
  return { earliestExpiry, latestExpiry, conservativeClearDeadline, clearedObserved,
    interpretation: 'Clearing before the earliest possible expiry plus two seconds proves the upper bound; failure of this conservative test is not an exact server-expiry measurement.',
    resourceQualification: false };
}
