# Task 048 — Larger synthetic exact-symbol qualification

Status: implemented and locally verified, 2026-11-01. Follows PR #51 / main `9b0a118`.

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

## Outcome

Original design/cases were frozen in `13c907e`. The first small smoke exposed three
missing package prefixes in the s05 expected Java names. Those original inputs remain
unchanged; prospective amendment `6caaaa7` records the exact corrected labels before
any full-size generation. Both original and amended scores are retained separately.

Harness `1ab42d7` preceded the single full measurement. All 3,679 eligible files were
indexed, and all 3,621 code candidates retained with six affected syntax files / seven
gap messages. Each of eighteen queries scanned all candidates. Exact-set checks pass
18/18 under the amended oracle; the original oracle remains 16/18 solely for s05's names.
Every returned original was verified, repeats agree, and no time/output omission occurred.
Median lookup time is 818.061 ms; maximum 865.328 ms, below the 5,500 ms local target.
Indexing took 64.422 seconds and durable analysis 4.342 seconds. No source checkout changed.

Strict types, 391 tests and production builds pass. Five new pure tests cover frozen
inputs/amendment, stage gating, raw-result reassessment and repeat comparisons; the owned
121-file smoke verifies the compiled harness. See the [complete report](../docs/fixtures/loredock-symbol-qualification/README.md).
No model, corporate input, production change or hidden rerun. The full-attempt receipt
remains consumed. Next: short Java name lookup with complete qualified identity and
explicit ambiguity, before broader retrieval changes.
