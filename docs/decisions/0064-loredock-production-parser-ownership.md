# ADR 0064 — Production parser ownership and admission

Status: implemented and locally verified in Task 140; exact-head CI acceptance pending.

## Ownership and contention

Each catalog owns one parser service, at most one live worker generation and one
admitted operation. A native inventory owns admission until its bounded run ends,
pauses or is cancelled. A foreground operation owns admission before its first read
epoch and through its last synchronous publication. Nested graphs share that lease.
This includes retrieval, both candidate graphs and complete saved-witness validation.
SQLite transactions and lexical read accounts remain synchronous.

There is no waiting queue: a competitor receives `BUSY` immediately, before retaining
source text or changing an inventory. Admitted operations cannot be preempted by later
arrivals or starved in a queue. Rejected callers receive no scheduling reservation or
fairness promise. The inventory has its existing 300-second bound and Pause/Cancel;
foreground parsing uses the caller's original five-second deadline. Unbudgeted graph
entry points receive an explicit five-second operation deadline, not a new work limit.
An operation never exchanges generations between files. No empty-success response,
direct fallback, parse retry, worker pool or automatic replacement follows a failure.
The existing follower may retry rejected admission for its one pending build; it never
retries a started failed inventory or resumes paused/interrupted work.

## Initialization, cancellation and failure

Construction does not import a compiler or spawn a thread. Native implementation
fingerprinting is explicitly asynchronous and cached for the installed process;
installed files are streamed, including the worker/protocol identity. An asynchronous
analysis factory completes identity readiness before exposing synchronous metadata.
The daemon awaits an owned ready handshake before listening. Standalone catalog
operations may initialize on first parse, within their existing absolute deadline.
Read-only operations without any code need not start a worker.

Pause/cancel first fences the inventory, aborts its lease and joins the old operation
and actual worker exit. Explicit subsequent work may initialize a new generation only
after successful cleanup. A crash, malformed reply, identity mismatch or other parser
infrastructure failure terminates the whole operation; it is never a syntax gap or a
successful partial inventory. Unexpected terminal failures require daemon restart.
Shutdown owns initialization, all admitted operations and actual thread exit. A cleanup
timeout remains an error with visible ownership, not permission to replace the worker.

After every parser wait and immediately before checkpoint publication, native analysis
checks the active run/lease, running status, pending unit, source/build/policy identity,
input hash and current implementation fingerprint. Late completion cannot override
pause, cancellation, revocation, replacement or shutdown. Existing checkpoints stay
durable; a changed fingerprint requires explicit reanalysis. Same-build startup does
not silently trigger follow analysis. Old saved v1/v2 witness validation continues to
use its original provenance independently of the current native inventory.

## Accounting and runtime

The original `OperationBudget`, where present, pays actual request and reply frame
bytes in its receipt phase. This supplements existing SQL/original accounting; it
does not replace or reset it. Request charging precedes transfer; bounded response
charging precedes decoding. A rejected charge retains its original budget error.
Hashing, readiness, transfer, validation and cleanup remain within recorded operation
time. Installed-code initialization is not counted as project evidence bytes.
Existing limits stay unchanged. A newly exposed work-limit failure in a previously
successful control blocks adoption and must be retained, not hidden by a larger cap.

The full application requires Node >=22.23.2 and SQLite FTS5. The pinned official
22.23.2 build is verified. A capability check reports missing FTS5 before catalog
migration. Official Linux 22.13.0 remains a standalone-worker compatibility check;
its missing FTS5 prevents claiming full LoreDock support.

## Prospective validation

The [ordinary plan](../../scripts/loredock-owned-parser/plan.mjs) fixes comparison and
lifecycle controls before implementation. Fresh copies of Task 137's eight catalogs
must preserve exact graphs, contexts, reviews, prompts and all 21 saved v1/v2 reads
and idempotent replays. Task 138's three original fact/graph controls remain exact.
New native inventories use their honest new fingerprint; old inventories reject
resume and remain visibly incompatible without changing saved witness bytes.

Exercise real source and emitted workers, competing admission in both directions,
multi-file ownership, pause/resume/cancel, source/policy change, stop during readiness,
worker failure, stale completion, idle shutdown and actual server shutdown. Controlled
test seams may hold/fail a worker; at most one synthetic fake-model answer may test
dispatch/publication. There are zero real model calls and no corporate inputs.

Keep first observations and failures in new exclusive directories, exact candidate
bytes, worker lifetime/exit metadata and whole-process CPU/RSS diagnostics. Do not
rerun consumed families or rewrite historical fixtures. Current-byte integrity changes
need a new explicit delta layer preserving older reference bytes. Aggregate heap,
complete startup, near-limit and browser qualification remain separate unresolved
gates; no diagnostic here certifies those resource bounds.

## Verification record

The [first ordinary comparison](../fixtures/loredock-owned-parser/README.md) preserves
all eleven catalog cases and 21 saved answers. Ten worker lifetimes all reach actual
exit. The final full check passes 1,125 tests, all typechecks and builds. Source/emitted
server tests cover real readiness and SIGTERM; late startup readiness cannot open the
listener. Initial failure logs remain retained. No resource qualification follows from
these compatibility results; [Task 141](../../tasks/141-loredock-parser-observer-coverage.md)
addresses the remaining observer coverage.
