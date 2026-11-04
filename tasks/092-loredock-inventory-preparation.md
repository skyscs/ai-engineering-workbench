# Task 092 — Audit inventory replacement preparation

Status: scoped before execution, 2026-11-04.

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
