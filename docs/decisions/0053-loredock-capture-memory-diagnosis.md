# ADR 0053 — Attribute capture memory before selecting an optimization

## Status

Design decision, Task 076, 2026-11-03. Task 075's first scale qualification remains rejected
on seven memory cases; no production runtime or resource threshold changes.

## Decision

Audit source ownership and retained measurements, then execute a separately scoped fresh
diagnostic with same-process, reopened-process and instrumentation controls. Record bounded
phase memory/owner/query observations while preserving useful paths, complete originals,
shared work/deadline checks and all publication/source fences. Separate resource failures
from later semantic outcomes instead of treating skipped assertions as passes.

See the [diagnostic contract](../loredock/CAPTURE_MEMORY_DIAGNOSIS.md). Freeze its fresh
inputs and exact one-run protocol before implementing or observing the instrumented fork.
Do not select statement caching, payload compaction, async changes or another optimization
from static inspection alone. Diagnostic controls cannot retroactively qualify Task 075.

## Reasons and consequences

The failed process includes preparation, reads and replacement analyses. Saved samples
show memory violations but do not attribute retained versus temporary allocations or native
residency. A first small-memory capture, small final JSON or lower RSS after reopening does
not establish acceptable long-lived behavior. Resetting the process or forcing collection
for acceptance would conceal the relevant lifecycle.

Keep all current bounds and frozen evidence. Choose one later optimization from measured
attribution, retain independent correctness regressions, and require a new uninstrumented
qualification before production integration. A diagnostic with unresolved attribution is
an explicit result, not permission to keep rerunning or to weaken evidence validation.
