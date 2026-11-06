# Task 140 — Adopt the compatible owned parser in production

Status: in progress after accepted Task 139 merge `41d70a1b7423ab52a482ba81b9f432d343fa0eb2`.

The prospective admission/readiness/accounting decisions are recorded in
[ADR 0064](../docs/decisions/0064-loredock-production-parser-ownership.md) before product edits.

Implement the production-adoption requirements originally scoped in
[Task 138](138-loredock-production-file-parser.md), after
[Task 139](139-loredock-lossless-parser-transport.md) repairs the observed transport
incompatibility. Task 138's first failed observation remains immutable.

Before product edits, commit explicit owner admission/contention and initialization
decisions, plus fresh ordinary compatibility/lifecycle controls. Adopt the parser in both
native analysis and legacy graph consumers, remove every eager parent compiler import
and synchronous compiler-byte fingerprint read, and preserve exact successful graph,
context, correction, prompt and saved v1/v2 witness meaning.

Keep source authority, bounded originals, deterministic composition and SQLite in the
parent. Preserve synchronous read accounts and transactions, one original work/time budget,
status/generation/cancellation fences, explicit parser-upgrade reanalysis and honest
same-build follow behavior. Declare bounded foreground/background contention without
hidden queues, starvation, retries, direct fallback or empty derived context on busy.
Shutdown must join initialization, active operations and actual worker exit.

Correct the application runtime contract explicitly: standalone parser tests on Node
22.13 do not establish LoreDock support because official Linux 22.13 lacks SQLite FTS5.
Pinned 22.23.2 is the verified full-application runtime. Test source and emitted workers,
native checkpoints/restart, all interleavings, old saved reads/replay and real shutdown.

Retain first ordinary observations and failures with explicit parent/worker lifetime
coverage. Aggregate heap, complete startup, ordinary near-limit and browser RSS gates
remain separate; no existing limit or consumed family changes. Run strict types,
regressions and full builds, inspect both complete CI logs for the final head, merge,
then scope the observer/near-limit stage from the actual remaining gaps.
