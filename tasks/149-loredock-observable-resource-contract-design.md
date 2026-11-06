# Task 149 — Specify an observable resource contract for explicit review

Status: design and documentation/evidence checks complete; exact-head CI pending.
Task 148 is accepted through PR #181, head `ba4d280`, identical-tree merge `082c119`,
with both full CI logs passing 1,169 tests, ten typechecks and ten final builds.
The [proposal](../docs/loredock/OBSERVABLE_RESOURCE_CONTRACT.md) and
[complete comparison/prerequisites](../docs/fixtures/loredock-resource-contract/README.md)
are unadopted and unexecuted. [Task 150](150-loredock-resource-contract-review.md) supplies
the separate review decision. No runtime, observer or product implementation occurs.
Local review verifies all 38 numeric comparisons, 747 document links, proposal/evidence
hashes, both retained CI logs and unchanged production/frozen inputs/normal checkout.
Twenty prerequisite cases are specified; none has been executed by this design task.

1. Write a concrete versioned proposal beside the unchanged original qualification contract.
   Define the user-facing resource objective, owned scope, measurement quantity, start/end
   boundary and pass/fail/unavailable outcomes. Separate operational cost, responsiveness,
   storage and application heap diagnostics. Include a complete v1-to-proposal comparison;
   retaining a number while changing its quantity must be visible as a semantic change.
2. Specify whole-lifetime OS accounting ownership and acquisition if selected, using primary
   documented interfaces. Address children, startup/exit, observer cost, cache/shared memory,
   swap, missing permissions, stale identity, interrupted collection and retained final peaks.
   Do not infer availability from the presence of Docker or a stopped historical container.
3. Define the exact observable application-JavaScript heap scope and label unavailable
   native intervals and asynchronous timestamps. Never claim a complete aggregate or
   continuous peak from independent maxima. Keep total browser cost visible separately
   from any optional baseline/incremental UI measurement.
4. Preserve existing operation, retention, work, authority, actual-exit and security bounds
   unless the proposal identifies and justifies each explicit change. Choose prospective
   numeric criteria from the product objective, not by adjusting to a failed observation.
   Keep old first failures and the consumed full-flow family unchanged.
5. Specify small deterministic observer/prerequisite tests and acceptance evidence before
   any future application run. Include failure examples that cannot accidentally produce
   a passing report. Mark the proposal unadopted until a separate explicit review decision;
   no new resource or semantic execution follows from this design task alone.
6. Update roadmap/status and retain accepted CI evidence. Validate links, source references,
   unchanged production/frozen inputs and both full exact-head CI logs. Scope the next
   bounded review or implementation task without making resource/full-flow acceptance claims.
