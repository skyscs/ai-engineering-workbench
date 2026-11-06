# Task 148 — Decide a feasible resource qualification path from retained evidence

Status: scoped after Task 147's first readable container control. Begin after Task 147
passes exact-head CI and merges. This is a read-only assessment and planning task;
it authorizes no new resource control or product implementation.

The standalone container browser completes but exceeds the unchanged 1-GiB summed-RSS
ceiling in 596 samples and has three incomplete samples. Daemon aggregate-heap/startup
observation is separately unresolved. Repeating environment changes without addressing
those independent constraints would not establish application readiness.

1. Compare retained Tasks 134, 143 and 147 browser controls, and Tasks 141–142 daemon
   evidence. Verify hashes and distinguish input/runtime compatibility, baseline resource
   use, sample completeness, cadence, ownership and application behavior. Preserve every
   first failure; do not rerun any consumed control, inspect host profiles/policies or
   infer extension identities/causes from process-role flags.
2. Review the original purpose and feasibility of each blocked measurement boundary.
   Use primary documentation/source for any proposed observation mechanism. Separate a
   measured RSS breach from unavailable samples and unobservable startup heap intervals.
   Do not substitute PSS, omit startup/exit, sum asynchronous maxima or reinterpret
   unavailable values as successful coverage.
3. Produce a concise decision record with concrete options and their evidence requirements:
   retain the existing contract with a justified eligible environment/observer, or propose
   a separately versioned prospective product resource contract for explicit review.
   Explain what would make another experiment informative. No limit/metric change is
   adopted automatically, and no old result can be converted into a pass.
4. Stop the environment-tuning loop until the next experiment has an evidence-backed
   hypothesis and acceptance boundary. Identify useful development that can proceed
   independently without claiming blocked resource/full-flow acceptance. Scope the smallest
   next task; keep corporate input and real-model execution excluded unless separately needed.
5. Update status/roadmap and retain the exact accepted Task 147 CI logs. Validate document
   links/evidence, review the full diff and both complete exact-head CI logs before merge.
   Keep the normal user checkout and all frozen product/API/collector artifacts untouched.
