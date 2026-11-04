# Task 094 — Qualify worker-local prepared reads

Status: scoped before implementation, 2026-11-04.

Task 093 proves independent semantic/lifecycle equivalence for prepared reads scoped
to one inventory worker. Qualify its composition with the existing path read scope,
compact payloads and streaming snapshot using the unchanged Task 089 coordinator
and Task 082 uninstrumented worker. Keep every earlier family and failed score.

## Sequence and bounds

1. Prove both actual process lifecycles on independent tiny inputs, with complete
   paths/originals/dependencies, receipt/history/repeat/parity and no-write/work gates.
   Separate CI functional acceptance from finite resource observations and require
   any observed resource failure to propagate to the coordinator's overall result.
2. After full strict checks, freeze a fresh supported twenty-source near-limit
   family before any application parser/candidate observation. Fix exact bytes,
   per-source counts/hashes, source/built implementation identities, ordered typed
   paths, source ranges, source scope, process sequence, runtime and watchdogs.
3. Require Task 093's final head to pass both CI events and merge with an identical
   tree before resource execution. Commit a clean measured entry and execute once.
4. Retain first raw artifacts, metadata, reports, stdout/stderr, normalized process
   exits and every failed/blocked dimension. Never retry or repair this frozen score.

Use unchanged 5,000 ms / 1,000,000 work / 150 ms sampled interval / 384 MiB RSS /
64 MiB heap-growth limits, 5 ms sampler and existing output/source bounds. Both
preparer and separately reopened processes perform eight operations: first, three
repeats, selected, page, isolated and evicted history after two replacement analyses.
Require all sixteen applicable independent dimensions and seven raw cross-process
comparisons; missing work prevents acceptance. Preserve dependency-aware blocked
states and first failures. Watchdogs remain 900/600/1,800 seconds with an outer
1,830-second bound and five-second TERM/KILL grace.

No profiler, heap snapshot, manual GC, new measurement hooks, corporate code, model
request, demo mutation or production consumer change. This tests fixed limits;
without a matched baseline it cannot establish a causal percentage improvement.
If all gates pass, scope a separate production integration review. Otherwise select
at most one next action supported by the retained evidence. Independent/private
pilot and L5 acceptance remain separate from synthetic agent verification.

Review the complete diff and verify local strict checks plus both final-head CI
events before an identical-tree merge of this task.
