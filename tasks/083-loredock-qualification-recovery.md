# Task 083 — Qualification preparation and evaluation recovery contract

Status: design completed and locally reviewed, 2026-11-03.

## Scope

Design only. Task 082 is rejected and exhausted: its authored `onIssued` expectation
is outside the preserved `onMessage` consumer profile, dependent evaluator checks
lose their first receipt, and two same-process memory limits independently fail.
Start from reviewed result head `f2ae5e9`; record PR #86's exact-head CI and identical
merge before completing this task. Preserve every measured input, implementation,
output, score and resource limit.

Define a concrete source/adapter compatibility review before freezing future
resource inputs. Separate hash-valid raw artifacts, shape/canonical validity,
source support, useful-path expectations, history consistency, byte parity and
resources in a subsequent evaluator. Define each dependency and explicit blocked
state so a failed useful-path expectation never becomes an undefined-reference
exception or erases independently checkable evidence.

Specify independent regressions and the order of remaining work. Keep the current
consumer profile and production application unchanged. Snapshot streaming remains
unqualified. Existing allocation evidence may guide the next targeted memory
decision, but neither incomplete useful paths nor fresh-process success may waive
the unresolved same-process heap/RSS failures.

## Acceptance

Trace the concrete failed precondition and evaluator control flow against source
and retained bytes. Produce the minimal recovery contract, ADR and status/plan
update. Review references and the complete diff, then require both exact-head CI
events before merge. No new fixture generation, parser/candidate execution,
measurement, implementation, model call, corporate source or demo operation.

The next implementation is limited to the offline evaluator/preflight workflow
and independent tiny regressions. A subsequent separately scoped memory decision
must precede another fresh complete resource qualification or production review.

## Design checkpoint

Scope `7c77142`. Source review traces the explicit `onMessage` consumer index and
the coordinator's late first-receipt insertion. The retained saved-byte readback
supports raw parity/history consistency only; useful-path and memory failures stay.

The [recovery contract](../docs/loredock/QUALIFICATION_RECOVERY.md) defines a concrete
capability table before input freeze, independent evaluation dimensions and explicit
dependency states. [ADR 0054](../docs/decisions/0054-loredock-qualification-recovery.md)
records the decision. The next implementation uses independent tiny positive and
negative cases; remaining memory attribution/selection precedes another qualification.
No new corpus, candidate execution or production change is included.

PR #86 merged as `c1acf124e0465d46534896fa059896a1a2bc1922` after exact head
`f2ae5e9badc84e2d2694a95de3800614b7ae2204` passed push 41634388668 and pull-request
41634604737 CI (521 tests). Its merge tree is identical and included here. Main
is clean and synchronized. Source/control-flow, artifact-readback, reference and
full-diff review cover this documentation-only decision; no local runtime rerun
is necessary. Both exact-head CI events remain required before this branch merges.
