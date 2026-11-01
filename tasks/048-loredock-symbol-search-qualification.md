# Task 048 — Larger synthetic exact-symbol qualification

Status: scoped before implementation and measurement, 2026-11-01. Follows PR #51 / main `9b0a118`.

Qualify the Task 047 query path on the unchanged Task 041 volume shape before broader
retrieval uses durable facts. Owned synthetic sources only; no corporate sources, real
model calls, parser changes, graph widening or production tuning in this task.

## Frozen protocol

Commit the design, exact queries/expected source-file-symbol sets and hashes before
implementing the measurement. Preserve Task 041/044 inputs and reports. Use one fresh
twenty-source generation with 3,679 eligible originals and 3,621 code candidates. Start
one index and, only if published, one durable analysis. Never resume, retry, refresh or
silently regenerate a failed measurement. A published partial inventory remains measurable
with its gaps; unpublished stages cause explicit skipped results.

Run nine frozen exact queries in fixed order twice over that one pinned inventory:
first/middle/last-source tail probes, qualified Java method, simple Java method across
four sources, Java class, unsupported Vue component, wrong-case name and nonexistent name.
Keep production limits. Record all raw results, independent original checks, coverage,
response bytes, elapsed time and sampled process RSS. Include implementation/build/parser
identity and Node/TypeScript versions; commit the harness before the full measurement.

Measure only the lookup call, separately from source creation/indexing/analysis, graph
comparison and independent Git verification. The second pass is a warm process/filesystem
measurement, not evidence of a query or parser cache. Compare normalized identities,
support and coverage across passes; retain failures instead of rewriting outputs.

Mechanical success requires all expected symbol sets with no extras, all 3,621 retained
files checked per query, validated original support, explicit unsupported/no-match limits,
unchanged source checkouts and zero answer attempts. Report each elapsed time, median,
maximum and whether every query meets a prospective 5,500 ms local target. Production
uses a five-second cooperative budget, not a hard deadline. Shared-host timing and simple
synthetic functions do not establish private-project performance or semantic readiness.

## Verification and delivery

Test protocol gating and normalized comparison without a full-volume CI run. Run a small
shape smoke with production services, strict checks, full tests and builds. Freeze hashes
and commit the harness before the single full measurement, then retain its raw artifacts
and an honest summary. Any code optimization or changed threshold requires a new task;
do not tune and replay this protocol. Open a PR, review it, merge after both CI events
pass for the exact head, and continue the next planned slice.
