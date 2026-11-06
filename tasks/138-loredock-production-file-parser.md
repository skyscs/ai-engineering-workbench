# Task 138 — Adopt the owned file parser in production

Status: compatibility prerequisite evaluated; production adoption deferred after two
observed transport failures. Result review and exact-head CI acceptance pending.

## Objective and boundaries

Use the Task 136 owned parser through the Task 137 asynchronous boundaries, following
[ADR 0062](../docs/decisions/0062-loredock-owned-file-parser.md). Remove both eager parent
compiler paths and synchronous compiler fingerprint reads without changing facts,
original evidence, graph selection, saved witness meaning or configured resource limits.
No corporate repositories, real model calls, consumed-family/seal replay or default/UI
activation is required. Do not claim resource qualification from responsiveness alone.

## Required implementation and checks

1. Audit current native and legacy imports, fingerprint callers, service startup and
   shutdown. Commit a prospective ordinary compatibility/lifecycle plan before edits.
   Reuse immutable Task 137 expectations through fresh catalog copies; retain first
   observations/failures and exact source/runtime identities without overwriting them.
2. Define one production owner per catalog/service lifetime and explicit admission for
   native analysis and legacy projections. There is no hidden queue, automatic worker
   replacement, synchronous bridge, direct-parser fallback or unbounded file batching.
   Contention must have a bounded, observable outcome. A complete graph operation must
   not silently exchange its worker generation between files.
3. Make implementation identity/fingerprint initialization asynchronous and owned.
   Avoid eager parent imports of compiler modules and synchronous reads of compiler
   bytes. Define startup/admission readiness and failure explicitly; cancellation and
   stop must join initialization and actual worker exit, including the minimum Node.
4. Migrate native analysis as well as all legacy parser calls. Parent code retains
   authority checks, bounded source reads, deterministic composition and SQLite writes.
   After every parser wait, verify status, operation/generation, source/build/policy,
   implementation identity and cancellation before any checkpoint or publication.
   Pause/cancel/stop/replacement win over late replies. Infrastructure failure remains
   an operation failure rather than a syntax gap, silent retry or successful partial run.
5. Version implementation compatibility honestly. Preserve old saved v1/v2 witness and
   prompt reads/replay without requiring current native inventory. If the inventory
   fingerprint changes, reject incompatible resume/reuse and expose explicit reanalysis;
   document same-build follow behavior instead of silently serving old parser inventory.
   Do not rewrite old catalogs or receipts to make their provenance appear current.
6. Verify real source and emitted worker paths on pinned Node 22.23.2 and minimum
   22.13.0. Whole-catalog tests use the pinned runtime: Task 137 independently confirmed
   that official Linux 22.13.0 lacks SQLite FTS5. Correct the declared application runtime
   contract explicitly before claiming minimum-version support; standalone worker support
   alone is insufficient. Test exact parser/graph/context results, native checkpoints and restart,
   competing consumers, pause/cancel during parse, stale reply, crashes, initialization
   failure, idle shutdown and actual child exit. Preserve synchronous transaction and
   lexical-scope contracts and the shared operation budget across every wait.
7. Run strict types, relevant regressions and complete builds. Retain an ordinary
   production observation with explicit coverage limits and zero model calls. Record
   parent/worker lifetimes and whole-process RSS/CPU; do not call parent-only heap,
   delayed statistics, missing startup samples or sums of separate maxima a qualified
   aggregate peak. Do not rerun earlier failed resource families or relax any gate.
8. Review the complete diff and both exact-head CI logs before merge. Scope the next
   observer/ordinary near-limit stage from the actual remaining coverage gaps. Resource
   acceptance requires adequate aggregate coverage and a new prospective family.

Task 136's isolated adapter and Task 137's behavior parity do not repair the recorded
startup, near-limit heap or browser RSS failures by themselves. Browser environment
attribution remains a separate unresolved decision, with its original 1-GiB ceiling.

## Observed prerequisite and revised sequence

The committed [prospective control](../docs/loredock/PRODUCTION_FILE_PARSER.md) runs
before any product edit. Two previously successful direct graphs fail through the
owned adapter because their fact replies exceed 512 KiB, despite sources below 32 KiB.
The ordinary control remains exact and every owner joins actual exit. All original
application source/emission, limits and parser identities remain unchanged.

ADR 0062 requires stopping adoption on this mismatch. This task records that failed
prerequisite; it does **not** claim production adoption is implemented. The concrete
repair is [Task 139](139-loredock-lossless-parser-transport.md), followed by the deferred
integration requirements in [Task 140](140-loredock-production-parser-adoption.md).
Retain the complete first result and earlier accepted Task 137 CI logs before merging
this bounded compatibility finding. No old failed resource family is reopened.
