# ADR 0040 — Bounded durable per-file code inventory

## Status

Accepted for the Task 045 service foundation, 2026-11-01. HTTP/UI, automatic indexing
integration and use in query context are separate follow-up work. The daemon does not
start this service automatically in this task.

## Context

The interactive graph samples at most 100 code files. Task 044's frozen synthetic volume
contains 3,621 candidates: all can be examined with current bounded parsers, yielding
741,496 raw fact bytes and seven explicit unsupported-syntax gaps. The first pass spends
0.852 seconds parsing; most experiment overhead is its independent Git validation.
Persistent per-file results can make wider source syntax available without making every
interactive graph request parse the corpus. This does not establish complete understanding.

## Decision

Add a disposable `CodeAnalysis` service over authorized published catalog originals.
It pins one index, policy and registry version and enumerates the existing code extensions
in saved source/path order. It never reads Git again, loads project configuration, executes
source/imports or calls a model. Existing projections, answer inputs and correction
identities remain unchanged; they do not consume this new inventory yet.

Schema 8 adds run, source-dependency and file-unit tables. A start transaction fixes all
candidate identities before scheduling one worker. Each file's complete payload and
cumulative byte/time counters commit together. Pending, parsed, excluded, failed,
unattempted and omitted units are distinct. An unsupported parser gap can coexist with a
parsed unit; it is not silently counted as complete language support. Publication requires
all units terminal and records partial source/syntax coverage explicitly.

Bounds are 10,000 candidates, 32 KiB/file, eight spans/file, 50 MiB examined bytes,
128 KiB serialized payload/file, 16 MiB payload/run and five minutes cumulative active
time. Payload budgets include provenance/ranges, not only parser facts. Time checks are
cooperative between bounded files, not OS deadlines. The last uncommitted unit may be
repeated after a process loss; no transaction can retain its unrecorded CPU time.

Fingerprint actual installed parser, TypeScript dependency, extraction/validation/service
bytes and Node version. Source and compiled builds intentionally have different identities.
A mismatch refuses fact reads/resume rather than relabeling historical results. The
file envelope binds build/file/source identity, revision/blob/content hashes and complete
original references. Its hash and a separate unit checkpoint cover payload and progress.
UTF-16 ranges, operation/call owners and literal fact shapes are validated. Reads/resume
revalidate complete original documents and ranges; a hash is an integrity check within
the trusted local installation, not an independent semantic proof or signature.

Pause/cancel are explicit between-file transitions. Shutdown/restart interrupts, without
automatic restart. Resume verifies the complete saved unit manifest, every checkpoint,
completed originals, counters, limits and parser identity before continuing the same index.
Validation time contributes to the remaining active-time budget. Failed checkpoints are
visible errors requiring a new inventory. A new run reparses files; cross-index/revision
reuse is deferred because measured parsing is cheap and safe equivalence needs its own
contract. Retained request IDs replay exactly; changed inputs conflict.

Keep at most two inventories: the newest published inventory and one predecessor or new
attempt. Starting another attempt evicts the replaceable inventory in the same transaction;
active work must first finish, pause or cancel. A failed attempt preserves the previous
published one. Paused/interrupted attempts are replaceable by an explicit new start.
Evicted results return unavailable and evicted request IDs have no lifetime replay promise.
No immutable answer or correction depends on this disposable storage. Two per-run payload
budgets bound derived JSON to 32 MiB; metadata, SQLite/WAL overhead and the separately
retained original index generations are outside this payload bound.

A database trigger on policy/registry version changes atomically fences every inventory
and clears its file derivatives, including old and interrupted results. This deliberately
includes registering a source: a new inventory must describe the changed project scope.
The existing source-purge transaction also clears all dependent derivatives, including
recovery of pending purges. Original evidence remains the citation authority. The service
rechecks authorization before each unit and fact read, independently of the trigger.
Backups, previous external copies and physical WAL retention remain outside logical purge.

## Consequences

This creates a bounded, restartable foundation for wider code coverage without expanding
the interactive graph or model context. It adds no user input or newly enabled background
work in Task 045. The next slice should expose simple coverage/progress and protected
controls in the existing indexing workflow, followed by separately bounded query use.
Framework limitations, real-project cost, independent review, failed semantic gates and
Workbench integration prerequisites remain open.
