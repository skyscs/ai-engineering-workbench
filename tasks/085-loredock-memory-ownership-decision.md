# Task 085 — Remaining memory ownership decision

Status: scoped, 2026-11-03.

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
