# Task 085 — Remaining memory ownership decision

Status: decision completed and locally reviewed; exact-head CI pending, 2026-11-03.

## Baseline and scope

Continue the Task 083/084 sequence after offline assessment recovery. Base this
read-only decision on reviewed Task 084 head `a1cdbd1`; verify PR #88's exact-head
push/pull-request CI and identical merge tree before completing the decision.

Review retained Task 079/080/082 evidence and the pinned reader/store/analysis
ownership paths. Distinguish payload/domain lifetime, temporary validation and SQL
allocations, and process residency after replacement analysis and close. Record
what each observation proves, what it cannot attribute, and the smallest useful
next observation or justified implementation. Do not infer native SQLite retained
bytes from statement counts or allocation samples alone.

Produce a concrete decision and update the plan/status. Choose at most one next
bounded experiment or optimization, with explicit observations, artifact retention,
stop conditions and the later fresh complete uninstrumented qualification gate.
This task is documentation/source review only: no new corpus, model, profiler,
heap snapshot, forced collection, resource run, production change or demo work.
All exhausted inputs, original results, measured code and limits remain unchanged.

## Acceptance

- Link exact evidence and implementation ownership boundaries, separating measured
  allocation weights, retained ownership and unexplained heap/RSS observations.
- Explain why the selected next step distinguishes the remaining hypotheses and
  why competing changes are deferred.
- Preserve complete source/typed-path support, same-process and reopened acceptance,
  finite resource limits, history without nested reads and no-write conditions.
- Use Task 084's independent assessor and Task 083's source capability review for
  any later fresh resource protocol; never rerun an exhausted family.
- Review document references and the full diff; both exact-head CI events must pass
  before merge. No runtime tests are needed locally for documentation-only changes.

## Decision and evidence

Scope commit `e620c98`. The [decision](../docs/loredock/MEMORY_OWNERSHIP_DECISION.md)
selects exactly two terminal heap-retainer observations in one future fresh positive
long-lived process, after the normal eight-operation sequence and after explicit
close/reference release. The selected next implementation is the bounded diagnostic
harness/parser with independent tiny regressions; no resource input is authored here.

The source ledger records entries/domain/resolver ownership, original-validation
allocations, analysis worker cleanup, statement preparation and receipt/runner
lifetimes. A separately versioned saved-byte extract verifies Task 079/082 archive
and worker hashes and retains existing close endpoints without rescoring. Immediate
close does not reduce RSS in the inspected records, but proves no native ownership.

Pinned Node documentation and backend source confirm heap snapshot blocking,
additional allocation, version-specific format and backend collection. The design
explicitly treats the snapshots as intrusive terminal observations, with parent
supervision, finite predeclared bounds, unknown-retainer handling, partial artifact
retention and no retry/raised bound. The first snapshot perturbs subsequent close;
the pair cannot estimate normal close savings. SQL reuse and payload compaction
remain deferred. Future complete same/reopened uninstrumented qualification and
all application limits still stand.

Only Markdown and one JSON readback artifact change. No install, build, runtime
execution, generated corpus, profiler, snapshot, model or corporate/demo work occurs.
Source/full-diff, archive/value and reference checks are required before commit;
exact-head push/pull-request CI is required before merge.

PR #88 merged as `b44c9afe8b2d879d2ae55f56148ad0280ddca121` after exact head
`a1cdbd110b7f81a78db8ef7c0857f8e7e1e3dc54` passed push 41733206449 and pull-request
41733233233 CI (529 tests). The merge tree is identical. Reference checks and
archive/worker hashes plus every copied endpoint value pass; the full change is
restricted to documentation and readback JSON. Main is synchronized separately.
