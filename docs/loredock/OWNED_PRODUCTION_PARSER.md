# Owned production parser

Task 140 connects the lossless parser from Task 139 to native code inventories and
legacy graph, context, review and saved-witness consumers. The prospective decision
is [ADR 0064](../decisions/0064-loredock-production-parser-ownership.md), committed
before implementation. Task 139 was accepted through PR #172 at identical-tree merge
`41d70a1b7423ab52a482ba81b9f432d343fa0eb2`; both complete CI logs pass 1,107 tests.

## Runtime behavior

A catalog owns one parser service, one admitted operation and at most one live thread.
The parent retains source authorization, bounded original reads, SQLite, range checks
and deterministic graph composition. TypeScript loads only inside the parser worker.
Native analysis uses an asynchronous factory and streams installed identity bytes.
The daemon completes identity and the worker ready handshake before listening.

A native inventory retains admission for its bounded run. A foreground context owns
admission before its first read epoch, across nested graphs and through its final
synchronous publication. Competing requests fail immediately with `BUSY`; there is no
queue, direct fallback, hidden retry or successful empty context. Pause/Cancel allows
foreground work after the previous parser actually exits. Rejected callers have no
scheduling reservation; admitted work cannot be preempted by another arrival.

Each file uses the original absolute deadline. Identity streaming is cancellable and
bounded too. Actual request/reply bytes are charged to the caller's existing receipt
budget before transfer/decode. SQL/original accounting remains separate and exact.
The original budget exception survives transport cleanup; no work ceiling increases.
Previously unbudgeted graph entry points have an explicit five-second deadline.

Pause/cancel changes durable status before aborting the lease and joining actual exit.
Explicit resume starts a new generation and retries only the unfinished file. Source,
policy, input, current implementation and pending-checkpoint checks run after awaits
and inside publication transactions. In-flight infrastructure failures terminate the
whole inventory; they never become syntax gaps. Exhaustion between files retains the
original explicit unattempted coverage. Unexpected worker failures require daemon
restart. A cleanup failure retains visible ownership instead of permitting replacement.

Shutdown owns initialization, active operations and worker termination. The server
installs signal handlers before asynchronous startup. Source and emitted entry points
are tested with real HTTP readiness and SIGTERM; catalog reopening confirms closure.

The native fingerprint changes honestly. Existing inventories request explicit code
reanalysis; same-build follow does not silently rebuild them. Stored v1/v2 answers
continue to validate independently of those disposable inventories. Application
support requires Node >=22.23.2 and SQLite FTS5; the capability probe runs before catalog
directory creation. Official Linux Node 22.13 supports the standalone parser tests but
lacks FTS5 and is not a supported LoreDock runtime.

## Validation and limits

The [ordinary plan](../../scripts/loredock-owned-parser/plan.mjs) compares eight fresh
retained catalogs and all 21 saved v1/v2 answers, plus three original fact/range/graph
transport cases. Expectations are never rebaselined. Live tests cover admission in both
directions, multi-file generations, pause/resume, cancellation, revocation, initialization,
crashes, malformed replies, budget failure, parser upgrades and actual server shutdown.
[Historical controls](../../apps/loredock/tests/fixtures/owned-parser-reference/README.md)
retain their original bytes and assertions with explicitly pinned old dependencies.

The [first ordinary observation](../fixtures/loredock-owned-parser/README.md), at
`f20dfd27330b32469be03428c160a81a4e0f0788`, preserves all eight projections and all
21 saved answer reads/replays, plus exact facts/ranges/graphs in all three transport
cases. It creates ten threads for eleven catalogs; the README-only catalog starts none.
All 540 requests complete and all ten threads exit. The child exits 0 after 3,625.049 ms,
without timeout or surviving ownership. All 254 copied original transport entries and
262 candidate input files remain exact. No model or corporate input is used.

The 297 parent samples have a maximum interval of 37.670 ms; kernel process high-water
RSS is 248,792 KiB. Parent sampled heap reaches 43,760,592 bytes. These are diagnostics:
worker heap is not sampled, and module evaluation before the observer is not covered.
The record cannot establish simultaneous heap or complete startup acceptance. Final
local and exact-head CI verification is recorded in the development status. Compatibility does not qualify whole-process heap, complete
startup, near-limit or browser resource gates. Parent composition and expanded native
payload allocation remain resource risks even though compiler parsing is isolated.
Those gates require the next prospective observer stage; existing limits and consumed
qualification families stay unchanged.
