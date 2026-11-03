import assert from 'node:assert/strict';
import { validateObservation as validateControl } from '../loredock-memory-attribution/validate.mjs';
export { validateReceipt, validateProjection, resourceFailures } from '../loredock-memory-attribution/validate.mjs';

export function validateObservation(row, arm, oracle) {
  assert.ok(['same-process', 'reopened-process'].includes(arm));
  // Both resource lifecycles have the original control's disabled instrumentation contract.
  validateControl(row, 'instrumentation-control', oracle);
  assert.equal(row.instrumentation.prepareCalls, 0);
}
