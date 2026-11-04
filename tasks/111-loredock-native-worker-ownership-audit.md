# Task 111 — Audit native worker transient ownership after the failed final gate

Status: audit completed and locally verified, 2026-11-04.

The [first diagnostic and ownership review](../docs/loredock/NATIVE_WORKER_OWNERSHIP.md)
identify three repeated write preparations on a fresh 47-file compiled input. All
native history/source checks pass; three focused and 805 full strict tests/builds pass.
No memory cause or resource acceptance is claimed. Next
[Task 112](112-loredock-bounded-analysis-writes.md) scopes bounded reuse with independent
behavior controls, binding/owner limits and unchanged transaction/source validation.

Task 110's sole reserved attempt passes all functional, source, complete-path, history,
accounting and raw-parity checks, but reopened history starts at 399.58984375 MiB RSS,
above the fixed 384 MiB ceiling. The increase precedes history: existing lifecycle
points show 344.33203125 MiB before the first inventory replacement, 398.83203125 MiB
after it and 399.58984375 MiB after the second. Heap used falls during the second
replacement. These endpoints localize the next review; they do not attribute retained
RSS to SQLite, the allocator, a JS owner or any individual statement.

Keep the complete Task 110 family, driver, frozen baseline and raw outcome immutable
and exhausted. Do not replay it, rescore it in place, force GC, change the workload or
relax any resource/output/operation gate. Public consumers and large-scale acceptance
remain blocked by the recorded qualification failure; semantic/L5 gates stay separate.

Review actual compiled/source analysis replacement and store ownership. Inventory
streaming, read-scope lifetime, statement preparation, write calls, transient payloads,
original validation and close/failure behavior must be traced to concrete owners. Count
actual prepare/execute calls by bounded SQL identity on a fresh small owned diagnostic
example if needed, with no captured bindings, model or corporate code. Keep diagnostic
instrumentation explicitly separate from resource qualification. Preserve the first
report and failures; no native-memory ownership claim may be inferred by subtracting
heap or external-byte counters from RSS.

Determine whether a narrowly scoped reuse or ownership change has a defensible target.
For example, verify whether repeated per-unit mutation preparation remains after the
existing read-only reuse, including source writes, transactions and bindings. Do not
assume it causes the failed RSS sample. Document required semantic equivalence checks,
owner isolation, scope expiry, cancellation, rollback and retention limits for any
candidate. Keep source validation and the full work/accounting contract unchanged.

This task produces the evidence and decision, not a production performance switch or
another large qualification. Implement only small generic diagnostic/test helpers if
required. Run appropriate strict checks and exact-head CI. Scope one candidate next
only if the audit supports it, followed by independent compiled regression and a new
future reserved family. Otherwise record the unresolved ownership question explicitly.
