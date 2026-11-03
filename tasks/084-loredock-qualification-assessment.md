# Task 084 — Independent offline qualification assessment

Status: completed and merged as PR #88, 2026-11-03.

## Baseline and scope

Implement the [Task 083 recovery contract](../docs/loredock/QUALIFICATION_RECOVERY.md)
in new offline helpers and independent tiny regressions. Start from reviewed head
`3deb58e`; verify PR #87's exact-head push/pull-request CI and identical merge tree
before completing this task. Preserve all exhausted coordinators, inputs, original
scores and measured code. No new resource family is authorized here.

Separate artifact integrity, shape/canonical identity, original support/scope,
useful-path expectations, history consistency, raw parity and resources. Retain
intact raw comparison bytes and a structurally valid first receipt before useful-
path assertions. Keep explicit pass/fail/blocked/not-applicable states and strict
overall acceptance. Missing or malformed prerequisites must produce specific
blocked reasons, not undefined-reference errors or fabricated first values.

Use existing frozen helpers read-only where their boundary is suitable. Any new
pure codec split must live separately; do not edit measured receipt producers or
readers. Preserve bounds, encoding/schema/canonical/hash rules and original/scope
validation. Assessment must not reopen a catalog, call a path/fact service or
execute corpus code. A trusted fixture factory supplied by the coordinator may
construct expected source text outside measured child intervals, as before.

Record a concrete capability table for the independent fixture, including positive
`onMessage` support and an explicitly negative unsupported-name case. Link actual
source constructs to the documented adapter prerequisites. Do not widen Java
consumer matching, change product settings or introduce a generic test framework.

## Acceptance

- A false useful-path oracle still permits independently valid support, repeats,
  raw parity, history and resource assessment; overall acceptance remains failed.
- Source-support failure does not erase raw byte or structural history comparison.
- Missing/hash-invalid/malformed/unsupported first receipts retain explicit reasons
  and blocked dependencies without uncaught undefined-reference errors.
- Altered history projection/originals/dependencies fail consistency without nested
  reads. Invalid metrics, child errors, watchdogs and cleanup errors remain failures.
- The actual owned child/artifact boundary works on tiny inputs; old frozen families
  are never imported or rerun by ordinary tests. Retain first failures and logs.
- Run relevant regressions, strict checks/builds, source/reference/full-diff review
  and both exact-head CI events before merge.

After this recovery, separately decide remaining same-process allocation/residency
work from retained evidence. Snapshot streaming remains unqualified and all time,
work/output/heap/RSS limits stay. No production, corporate source, model or demo work.

## Initial source review

The measured receipt module exports capture/read operations, while canonical and
shape validation are private and coupled to current-catalog work. The measured
qualification validator combines source checks and useful-path assertions in one
function. Reusing either wholesale would retain the dependency problem or reopen
application state. The next implementation should isolate bounded pure validation
in new helpers and leave all frozen modules unchanged. No implementation, fixture
generation, candidate execution or resource measurement has occurred in this task.

The pure boundary must retain fatal UTF-8 decoding, duplicate-key rejection through
canonical round trips, receipt/projection/topic/accounting versions, depth/output
bounds, graph endpoint/support membership and original metadata/hash checks. The
existing full receipt reader also reopens originals and current authorization;
those live operations must not be imitated by an offline assessment. Compare only
the frozen metadata/source vector and label current applicability as unevaluated.
Artifact references must stay within the owned output root and retain byte/hash
checks before parsing; malformed references must not become arbitrary file reads.

PR #87 merged as `f3f45d002ced2112a4945b57a18a1d4adb3942ca` after exact head
`3deb58e54d231c6a7cf1ca0c3ac84a962de7e1f1` passed push 41635586123 and pull-request
41635677777 CI (521 tests). The merge tree is identical and included in this
branch. Main is clean and synchronized; the implementation boundary and source
review are committed for the next coding step. No runtime code has changed here.

## Implementation and review

New `scripts/loredock-qualification-assessment/` helpers implement the pure codec,
bounded artifact reader, separate frozen-source/usefulness validators, per-operation
assessment and two-arm aggregation. They retain raw receipt bytes before decoding,
structural values before support/usefulness checks, explicit dependency states and
strict required-condition gates. The page schema explicitly permits only its null
graph. Current applicability remains unevaluated; no catalog or source code executes.

The independent [capability table](../scripts/loredock-qualification-assessment/README.md)
links actual locker syntax to supported rules. Real children run positive `onMessage`
and negative `onReserved` cases, each with eight operations in both lifecycles.
The negative case never satisfies the positive complete-path oracle. Additional
saved-artifact regressions cover opaque-byte parity, missing/corrupt first records,
source mismatch, altered history, malformed wrappers, finite resource/counter
requirements, process/watchdog/cleanup errors, absent operations and confined reads.

The first focused run exposed the root-page null-graph extraction error. The first
typecheck also caught a test-only assertion overload. Both are corrected and
[retained](../docs/fixtures/loredock-qualification-assessment/README.md), including
the first child's twenty raw artifact/report/exit frames. A later review keeps
history's usefulness denominator stable when absent, exposes independent content
and wrapper shapes, and labels missing content prerequisites as blocked. No old
family, measured module, original score, product source or runtime setting changes.

Review covers the complete diff, frozen-file separation, imports, reference links,
actual child boundaries, canonical/hash and source validation, independent failure
propagation and unchanged strict acceptance. The remaining memory decision follows
separately; this task does not authorize another resource matrix or establish
streaming resource acceptance.

Final pinned-toolchain `pnpm check` passes all 529 tests, strict typechecks and
builds. First and final full checks exit 0; the final run covers the review changes.
Reference links, archive/log hashes, frozen-file separation and staged whitespace
checks pass. Exact-head push/pull-request CI remains required before merge.

PR #88 merged as `b44c9afe8b2d879d2ae55f56148ad0280ddca121` after final head
`a1cdbd110b7f81a78db8ef7c0857f8e7e1e3dc54` passed push 41733206449 and pull-request
41733233233 CI. The merge tree is identical; all 529 tests, typechecks and builds
pass. Task 085 continues the remaining ownership decision without rerunning any
exhausted experiment.
