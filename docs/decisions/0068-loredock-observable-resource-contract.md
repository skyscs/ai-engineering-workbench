# ADR 0068 — Adopt a prospective charged-memory contract and implement assessment first

Status: accepted for prospective implementation planning. No executor, application
resource result, prepared-answer promotion or independent product acceptance is approved.

Task 149 is accepted through [PR #182](https://github.com/skyscs/ai-engineering-workbench/pull/182),
head `e88d751`, identical-tree merge `799c7a3`. Both complete CI logs pass 1,169 tests,
ten typechecks and ten final builds. The [retained review evidence](../fixtures/loredock-resource-review/README.md)
contains those logs and read-only capability observations.

## Decision and explicit tradeoffs

Adopt `loredock-observable-resources/2` for future, separately sealed work. Its
[machine-readable contract](../loredock/observable-resource-contract-v2.json) binds the
unchanged [Task 149 draft](../loredock/OBSERVABLE_RESOURCE_CONTRACT.md) and original v1
protocol hashes. The draft's substantive requirements apply with the refinements below;
its historical unadopted status and next-task instructions are not active requirements.
The JSON fixes numeric values and recognized event fields; this ADR fixes the review
decision and amendments. A conflict or unspecified mandatory observation is unavailable,
never permission for an assessor to choose a more favorable interpretation.

The engineering objective is useful, responsive twenty-repository behavior within a
declared charged-memory envelope on a sealed Linux environment. It is not a minimum-RAM
recommendation or a claim to account every physical page used by the application.

| Reviewed change | Decision and consequence |
| --- | --- |
| Replace daemon RSS with creation-to-terminal charged peak | Accept 402,653,184 bytes under the new quantity; old RSS remains diagnostic, and no v1 pass follows |
| Replace summed browser RSS with creation-to-terminal charged peak | Accept 1,073,741,824 bytes for the entire owned browser scope; preserve total RSS diagnostics and all browser children |
| Root scope and swap | Accept direct root peak ≤ 1,476,395,008 bytes, the sum of the two inherited targets, including shared control; all three swap peaks must be zero |
| Remove aggregate heap from acceptance | Accept explicitly incomplete per-isolate diagnostics; the 67,108,864-byte historical reference cannot become a per-isolate or complete aggregate pass |
| Shared/cache charges and outside attestor | Accept only the stated charged-memory claim, with uncontrolled cache and separately disclosed bounded attestor cost; no baseline subtraction or total-physical-cost claim |
| Sampling gaps | Keep missing RSS/heap samples as diagnostics; missing required ownership, terminal counters or timing/trace boundaries still prevents acceptance |
| Other requirements | Preserve all 35 remaining numeric v1 predicates, all useful cases and source/work/authority/lifecycle/retention boundaries |

The numbers are inherited engineering targets, not adjusted to failed samples. The
combined target includes control overhead within their sum. Whether the application can
satisfy them is unknown. Old first failures and exhausted families remain failed/exhausted;
this decision cannot rescore them or reopen the reserved semantic continuation.

## Refinements required by review

1. **Delegation must be exclusive.** Writable directories alone do not establish ownership.
   A future executor needs a fresh dedicated delegated service/scope, its manager-issued
   identity and matching delegation receipt. It may manage only descendants it exclusively
   creates. Never reuse the agent's terminal scope or modify the user-manager hierarchy.
   The service manager retains its own boundary; the attestor occupies a sibling outside
   the measured `run` subtree, keeping that subtree empty at acquisition and alive until
   terminal evidence is durable.
2. **Require hierarchical memory events.** Reject `memory_localevents` and unknown
   event-accounting modes for this profile. Initial and final raw event records must have
   the same recognized field set. The required memory keys are `low`, `high`, `max`, `oom`,
   `oom_kill`, `oom_group_kill`; `sock_throttled` is a recognized optional diagnostic.
   Positive `high`, `max`, `oom`, `oom_kill` or `oom_group_kill` fails. `low` and
   `sock_throttled` remain visible diagnostics. Require swap-event `high`, `max`, `fail`;
   a positive value fails. Unknown keys, missing keys or unavailable raw values prevent
   acceptance. No imposed reclaim/limits is the rule; zero ambient host pressure is not
   asserted.
3. **Require existing HugeTLB memory accounting.** Replace the draft's blanket HugeTLB
   exclusion with a required, pre-existing `memory_hugetlb_accounting` mount mode, bound
   before any owned execution and unchanged through close. Keep the documented pool and
   pre-existing-page limitations; no total pool-size claim follows. Absence or ambiguity
   is unavailable. Never remount, configure a pool, change limits or create pressure to
   obtain eligibility. This is a scope clarification, not a changed memory ceiling.
4. **Order the terminal reads.** After all owned applications and collectors have actually
   exited, read final daemon/browser records first and the root peak last. Retain every
   read window on one established monotonic clock domain. A parent peak below a child
   peak, a reversed/overlapping required ordering, reset/decrease, identity change or missing
   final read is unavailable. Do not manufacture a root peak by summing child values.
   A known independent violation remains failed even when other evidence is unavailable.
5. **Separate assessment from qualification.** A pure evaluator can establish consistency
   and predicate outcomes of supplied receipts. It cannot prove that those receipts came
   from a correctly isolated live executor. Its reports must say `offlineOnly: true` and
   `resourceQualification: false`, including on a memory-subassessment pass. Functional,
   timer, browser-trace, work, authority and executor evidence require their own later gates.
   A claimed boolean such as `qualified: true` is not an executor attestation.

The kernel documents local-only event mode and opt-in HugeTLB charge accounting, including
limitations for the preallocated pool and previously used pages. These motivate the fixed
mode checks above, not an assertion about all host memory.
See [cgroup v2 mount and memory interfaces](https://docs.kernel.org/admin-guide/cgroup-v2.html).

## Feasibility review and remaining proof

Read-only observations find kernel `7.0.0-38-generic`, a cgroup v2 mount with
`memory_hugetlb_accounting` and without `memory_localevents`, and a user systemd manager
`259.5-0ubuntu3.4` with memory accounting. Its root has `user.delegate=1` and memory
controller availability. The writable terminal scope has no delegation marker. No
existing memory counter was read and no cgroup or service was created by this review.

Systemd documents explicit delegation for services/scopes, a single-writer boundary and
`DelegateSubgroup=` for placing the supervisor below the delegated root. This supplies a
concrete candidate: a fresh transient **user** service whose attestor owns a new measured
subtree and creates role processes directly with the draft's selected kernel interface.
It does not require a newly installed privileged host service. See
[systemd delegation](https://systemd.io/CGROUP_DELEGATION/) and
[systemd 259 resource control](https://www.freedesktop.org/software/systemd/man/259/systemd.resource-control.html).
The online 259 manual currently identifies itself as 259.6; documented interfaces are
not proof that this installed 259.5 build will execute the proposed configuration.

Existing non-setuid `bwrap` is only a possible confinement building block. Its upstream
documentation makes sandbox policy depend on the supplied arguments; installation alone
establishes no security boundary. See [Bubblewrap's security scope](https://github.com/containers/bubblewrap/blob/main/README.md).
This decision selects no replacement runtime or weaker profile. A future adapter must
prove direct creation, inaccessible control writes/descriptors, default security, actual
descendant cleanup and retained final counters on independent tiny inputs before any
application control. Missing namespace/counter permission ends that path as unavailable;
no host policy change, extra capability, Docker fallback or environment search follows.

The read-only evidence supports investigating this bounded candidate; it does **not**
qualify an executor. Adoption fixes what later evidence must establish. Existing saved
contexts, APIs, emitted application, default model-free flow and experimental switches
are unchanged. Agent review and merge are not independent human semantic acceptance.

## Next implementation and stop boundary

[Task 151](../../tasks/151-loredock-memory-receipt-assessor.md) implements only a pure
offline memory-receipt assessor with hand-authored transcripts. Cover exact thresholds,
initial/final identity and order, missing/replaced/reset counters, unknown event modes/keys,
short-lived-child peaks, observed failures alongside unavailable evidence, and diagnostic
heap/RSS gaps. Preserve the complete draft prerequisite matrix; the smaller module cannot
claim that non-memory cases are implemented merely because its own tests pass.

Then scope an independent executor prerequisite task with fixed tiny allocation, process,
wall, storage and first-output bounds. No resource family or model execution is authorized
by this decision or the assessor task. If the secure candidate cannot be qualified under
the existing environment, retain that unavailable result and return to bounded independent
functional work. Do not restart the environment-tuning loop.
