# Task 112 — Bound repeated analysis write-statement ownership

Status: implemented and locally verified, 2026-11-04.

The [candidate and evidence](../docs/loredock/BOUNDED_ANALYSIS_WRITES.md) retain prior
controls before implementation, three exact scoped write statements and bounded
binding eligibility. Nineteen focused cases/subcases and 813 full strict tests/builds
pass. Actual compiled comparison passes all seven lifecycle/failure scenarios and all
sixteen native operations/seven raw comparisons; each repeated SQL template falls from
48 to 3 preparations with all 48 executions preserved. No memory qualification claim.
Next [Task 113](113-loredock-native-compiled-upgrade.md) verifies native history across
the actual older/current compiled fingerprints before a different resource family.

The [Task 111 audit](../docs/loredock/NATIVE_WORKER_OWNERSHIP.md) observes repeated
preparation of three exact writes: pending-unit INSERT, checkpoint UPDATE and cumulative
analysis counters UPDATE. Implement the smallest internal candidate that reuses these
statements in explicit per-store scopes. This is a repeated-work reduction hypothesis,
not an established diagnosis of Task 110 RSS. Do not replay any exhausted family.

Before changing production behavior, preserve an independently reviewable prior-write
control and the accepted analysis implementation for regression. Use current legitimate
fingerprint computation in a behavioral control only; do not claim old installed-runtime
identity or reuse stale production inventories. Record control bytes/hashes/provenance.

Keep read reuse strictly read-only. Use a separate owner with a fixed exact SQL allowlist,
at most three statements and 4 KiB SQL; cache eligibility is not SQL authorization.
Cap admitted variable-size bindings at 144 KiB per statement, including the existing
128 KiB payload and bounded metadata. Oversize/unsupported bindings and unrelated SQL
use the original fresh path. Never retain argument arrays or results in the helper;
disclose native last-binding retention and lack of immediate native finalization.
Do not retry/execute a write to clear bindings. Prefer scalar metadata plus bounded
statement references. Reduced limits may only decrease retention.

Synchronous admission and asynchronous worker scopes have separate lifetimes. Nested,
overlapping, detached or expired contexts cannot borrow another scope's statements.
Busy statement use falls back fresh. Release references on completion, thrown/rejected
actions, pause/cancel/failure and store close; evict a statement after an execution error.
Preserve return values, thrown errors, every binding, SQL order and per-file transactions.
Do not batch commits or change ownership of transaction rollback/recovery.

Integrate only the repeated admission INSERT and worker checkpoint/counter UPDATEs.
Keep publication, purge, indexing, receipt/history and all other write paths unchanged.
Do not alter source validation, fact semantics, full original support, shared charges,
SQL schema, deadlines or any operation/output/resource limit. An analysis source change
must produce the normal new fingerprint and require explicit reanalysis.

Verify native SQLite behavior with changing/null/blob/omitted bindings, statement errors,
rollback, cap fallback, close, async isolation, reentrancy and detached work. Compare
ordinary fresh versus scoped SQL traces/results on a small input. Independently compare
accepted and candidate analysis outputs/checkpoints after initial/replacement work,
pause/resume, interruption/restart, cancellation, source/policy fences and a failure
between checkpoint and cumulative counters. Expected identities/timing differences
must be explicit, not broad normalization that hides semantic differences.

Run relevant strict/full checks and a compiled small native capture/history smoke.
Preserve first failures and raw results; report prepare reduction separately from
execution counts and resource acceptance. Review the complete changed runtime closure,
then scope independent compiled regression before a different frozen final family.
No public-consumer migration, corporate/model input, new resource attempt or L5 claim.
