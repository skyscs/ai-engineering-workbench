# Task 086 — Bounded terminal heap observation helpers

Status: scoped, 2026-11-03.

## Baseline and scope

Implement the Task 085 terminal ownership decision on independent tiny inputs.
Start from reviewed head `3b67fae`; verify PR #89's exact-head push/pull-request CI
and identical merge tree before completing this task. No fresh resource corpus,
large diagnostic execution or optimization is authorized here.

Add opt-in offline helpers for exactly two terminal heap exports, a finite owned
child/process/file boundary, and bounded pure snapshot validation/readout. Record
collection/export perturbation explicitly. Keep raw snapshots and process failure
artifacts before interpreting them. Parse outside the observed worker. Never open
user catalogs or execute corpus code. Do not edit any exhausted measured module.

Use pinned Node 22.23.2. Export must occur outside application operation budgets,
with no manual GC flags. The independent child retains a known synthetic owner for
the first snapshot, closes/releases it, returns from the owning stack, and exports
again in a later event-loop turn. The harness must not keep its own strong owner
registry. Recognize only validated version-specific snapshot metadata; reject
invalid node/edge/string indexes, duplicate identities and unsupported shapes.

Report counts/shallow sizes and bounded inspectable retaining paths separately;
weak/conditional/native or unknown ownership cannot become a strong-retainer or
leak claim. Do not sum overlapping subgraphs or infer process RSS from node sizes.
Demonstrate the distinction with independent graph fixtures and real tiny exports.

## Acceptance

- Actual child snapshots distinguish deliberately held and released owned objects;
  no application optimization, forced-collection acceptance or model is involved.
- Finite export size, time/process supervision and regular owned-file boundaries
  fail explicitly on malformed, missing, oversized or partial artifacts. Preserve
  stdout/stderr/exits and first failures; no automatic retry or raised bound.
- Pure readout validates schema and graph indices before traversal, bounds all
  scans/output, distinguishes weak/unknown paths and retains source node/edge IDs
  for human review. Raw graphs remain authoritative and IDs are snapshot-local.
- Cancellation/child error/watchdog/cleanup and parser-limit cases have meaningful
  independent regressions, including the actual process boundary where applicable.
- Scope all diagnostic limits before any large-family authoring. Verify references,
  full diff and frozen-file separation; run relevant tests and pinned full checks,
  then both exact-head CI events before merge.

The next task may separately author/freeze one complete positive near-limit family
and execute the specified terminal diagnostic once. All application resource gates,
old failed families, same/reopened qualification, support/domains/charges/fences and
production/private-pilot boundaries remain unchanged.
