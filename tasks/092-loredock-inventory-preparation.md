# Task 092 — Audit inventory replacement preparation

Status: audit completed and locally verified, 2026-11-04; merge requires both exact-head CI events.

Task 091 passes complete content but fails reopened-history RSS. The failing worker
already exceeds RSS before history, after its two inventory replacements. Endpoints
also show growing used/capacity heap; they do not identify an allocation owner.

Perform one focused source/query-count audit on independent tiny owned inputs.
Reuse the tested bounded preparation observer and existing supported tiny services;
add only a bounded set of fact-free markers. Record input/implementation identities.
Separate synchronous `CodeAnalysis.start`, asynchronous `idle` work for each of two
replacements, a reference capture and evicted history. Retain first reports, stdout/
stderr and process exit. Count queries by exact SQL identity, never bound values.

Trace full original/build validation, manifest construction, per-file parsing and
checkpoint updates, publication/eviction and the scheduler's start/pause/resume/stop
ownership. Explain what the observations support and cannot establish. Select at
most one prospective candidate only after the audit, with separate semantic/lifecycle
proof and fresh uninstrumented qualification required before any promotion.

## Bounds and acceptance

- At most four sources, 64 files and 64 KiB total source text. The observer retains
  at most 128 SQL identities / 64 phase records; require at most 64 KiB template text
  and 256 KiB report bytes. An outer 60-second watchdog bounds this tiny audit.
- Every stage preserves its first counts and errors. Query sums and template hashes
  must agree; no parameters or application objects enter the report. Instrumented
  timing/memory endpoints are not resource acceptance or large-input extrapolation.
- Both replacements publish and evict the initial inventory. History preserves
  the original projection/support/scope with zero path/fact/snapshot calls. No model,
  corporate source or demo access. No frozen resource family or old measured module
  is run or edited. No forced GC, heap snapshot or profiler is used.
- Source/diff/hash/reference review, appropriate/full checks and both final-head CI
  events precede an identical-tree merge. Do not implement an optimization here.

## Outcome

Scope `6540991` precedes entry `db76965`. The first invocation fails preflight on a
four-source assumption; the independent fixture has three. No database/preparation
or query stage runs. Its report/stdout/stderr/exit are retained. Correction `ea5dc16`
uses the actual three-source expectation without changing the input hash or bounds.

The complete tiny audit exits zero: 38 files / 32 code files / 4,338 bytes, six
stages, 2,060 preparations across 42 identities / 7,504 SQL bytes. Each replacement
worker performs 520 SELECT preparations across ten identities and 65 UPDATEs across
three. Both replacements publish, evict initial facts and preserve exact history
with zero nested path/fact/snapshot work. Instrumented endpoints are not resources.

The [source audit](../docs/loredock/INVENTORY_PREPARATION_AUDIT.md) clarifies that
start validates build/coverage; complete original validation belongs to per-file
worker processing. It selects one next candidate: scope prepared reads to one
asynchronous inventory worker invocation, preserving fresh execution and every
authorization/original/checkpoint/lifecycle boundary. No optimization is implemented.

Full checks pass 569 tests, strict typechecks and builds; the corrected actual audit
passes. All first outcomes and exact inputs/receipt/counts are
[retained](../docs/fixtures/loredock-inventory-preparation/README.md). Complete source,
diff, reference and hash review precedes exact-head CI and merge.

PR #95 subsequently merged as identical-tree `70f6100` after corrected exact head
`d97db4e` passed push 41749820794 and pull-request 41749828294 CI (569 tests).
Its tiny CI test now separates functional success from resource rejection; no
measured implementation or frozen resource outcome changed. This branch includes
that accepted merge, and all 410 baseline files still match the audit's inputs.
