# Prepared answer admission controls

Task 125 preserves accepted source and emitted modules from merge `c1f6c37` before
implementation. The manifest limits changes to five application modules and one new
prepared runner. All original control bytes and hashes are immutable. Explicit reviewed
source deltas will compose with the Task 123/124 regression proofs; older expected hashes
and raw histories remain intact.

Legacy response/context/result/hash/prompt bytes and the existing legacy worker remain
comparison controls. Prepared dispatch is a separate internal branch. The new pipeline
must share one actual load/validation budget per phase and finalize synchronously at the
last authority check. It must not use current native facts or replace the reviewed input.

Shared per-store reservations apply even to separate Answers instances. Configuration
checks its lease after awaits, and shutdown drains consumers before dependencies. No
prepared HTTP route or default browser/model input is enabled by this task. Only ordinary
owned sources and controlled runtime doubles may be used for this implementation.
