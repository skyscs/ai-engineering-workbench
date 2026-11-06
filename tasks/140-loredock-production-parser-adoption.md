# Task 140 — Adopt the compatible owned parser in production

Status: accepted through PR #173, head `a8c7b44`, identical-tree merge `410e9ac`.
Both complete final CI logs pass 1,125 tests, ten typechecks and ten final builds;
the [next-stage archive](../docs/fixtures/loredock-parser-coverage/README.md) retains them.
Base: accepted Task 139 merge `41d70a1b7423ab52a482ba81b9f432d343fa0eb2`.

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

## Implementation record

Production ownership, readiness, cancellation and accounting are implemented; see
[the result and limits](../docs/loredock/OWNED_PRODUCTION_PARSER.md). The first ordinary
comparison preserves all eleven catalogs and 21 saved answers without a model call.
The first full check passes 1,124 tests after retained regression fixes. Final review
adds a late-readiness fence and regression. The final full check passes 1,125 tests,
ten typechecks and all builds; exact-head CI review remains pending. Continue with [Task 141](141-loredock-parser-observer-coverage.md) after merge.

The first CI attempts exposed a source-only historical-loader dependency on daemon
emission. Both failed logs are retained. The corrected helper passes all 1,125 tests,
ten typechecks and ten final builds in a fresh detached checkout at `cffcd1d` before
new exact-head CI. No application source changes in that correction.
