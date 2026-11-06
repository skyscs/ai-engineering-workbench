# Observable resource contract design evidence

Task 149 specifies [`loredock-observable-resources/2-draft1`](../../loredock/OBSERVABLE_RESOURCE_CONTRACT.md)
for separate review. It is unadopted and unexecuted. No cgroup, daemon, browser, model,
corporate source or historical resource family is run by this task.

- [Threshold comparison](threshold-comparison.json) binds the untouched original protocol
  hash and every numeric key. Three memory predicates change meaning; the remaining values
  retain their quantities. Proposed root and zero-swap predicates are explicit additions.
- [Prerequisite cases](prerequisite-cases.json) specify twenty independent failure/success
  expectations and later executor controls. These are requirements, not passing test results.
- [Source references](sources.json) identify the primary interfaces and retained Node audit.
- [Records](records.json) bind the proposal/evidence files and complete accepted Task 148 CI
  logs. PR #181 head `ba4d280` merged with an identical tree at `082c119`; both CI runs pass
  1,169 tests, zero failures/cancellations, ten typechecks and ten final builds.

The proposal keeps charged memory, responsiveness, storage and application-heap diagnostics
separate. Kernel charge ownership limits its physical-memory claim. Missing mandatory
evidence cannot pass, and no v1 result is rescored. [Task 150](../../../tasks/150-loredock-resource-contract-review.md)
must decide adoption and executor feasibility before implementation is scoped.
