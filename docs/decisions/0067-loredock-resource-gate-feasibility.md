# ADR 0067 — Design an observable resource contract before further environment trials

Status: development-sequencing decision; the existing resource contract remains unchanged.
This record authorizes design work, not a new measurement, relaxed threshold or acceptance claim.

## Evidence and independent blockers

Task 147 is accepted through [PR #180](https://github.com/skyscs/ai-engineering-workbench/pull/180),
head `6e36976`, identical-tree merge `e673d43`. Both complete CI logs pass 1,169 tests,
ten typechecks and ten final builds. The [retained comparison](../fixtures/loredock-resource-gates/README.md)
verifies archive hashes before reading the original observations. No control is rerun.

| Blank-browser control | Maximum summed RSS, bytes | Complete samples | Other limitation |
| --- | ---: | ---: | --- |
| Task 134, original host browser | 1,311,698,944 | 303 / 304 | One incomplete sample |
| Task 143, pinned standalone Chrome | 1,937,039,360 | 306 / 306 | 103.099-ms maximum gap |
| Task 147, pinned container Chrome | 1,309,532,160 | 603 / 606 | Three incomplete samples |

Each exceeds the existing 1,073,741,824-byte ceiling before loading LoreDock. Task 147's
peak is complete and 596 complete samples exceed that ceiling; its 55.633-ms maximum gap
passes. Directory ownership, non-root readability, default security and actual shutdown
are now verified. Those repairs resolve execution prerequisites, not resource eligibility.
Different controls are not a randomized comparison or proof that a particular environment
change caused a memory difference. Process-role flags do not identify extension origins.

Task 141's [daemon investigation](../loredock/PARSER_OBSERVATION_COVERAGE.md) is separate.
Both small source/emitted application lifetimes complete. Source's maximum parent interval
is 324.833 ms; emitted's is 72.231 ms. Neither observes complete isolate startup/teardown
heap or a simultaneous aggregate heap peak. Passing emitted RSS/timer diagnostics cannot
repair that missing coverage. [ADR 0065](0065-loredock-resource-observation-boundary.md)
already retains the worker architecture and explicitly blocks a new daemon resource gate.

## What the current measurements establish

The [original contract](../loredock/PREPARED_FLOW_QUALIFICATION.md) deliberately sums
per-process RSS, including shared pages more than once. It describes sampled maxima,
retains startup/terminal gaps and fails missing observations. The observed RSS breaches
are failures under that definition. Relabeling a different memory measurement would change
the contract even if its numeric ceiling stayed the same.

Kernel documentation describes asynchronous RSS bookkeeping and the slower per-process
`smaps` view. PSS proportionally divides shared mappings; it is a different quantity, and
sequential process reads do not produce an atomic whole-tree observation.
See the [kernel proc documentation](https://docs.kernel.org/filesystems/proc.html).
Task 147's actual records show identity/parent changes and exiting processes during
sampling. Faster polling does not reconstruct unavailable values. Task 143's complete
sample set also prevents a claim that every future sampled lifetime must be incomplete.

The kernel's `memory.current` and `memory.peak` account a cgroup and its descendants,
including categories such as page cache and kernel charges. A peak can cover the lifetime
of an owned group, but it is neither summed per-process RSS nor V8 heap. Any proposal
would need ownership before child creation, startup/terminal acquisition, access and
retention proofs, explicit observer inclusion and treatment of swap/cache.
See the [cgroup v2 memory interface](https://docs.kernel.org/admin-guide/cgroup-v2.html#memory).
No existing container is restarted and no late cgroup read is presented as its original peak.

The audited Node heap request mechanism has unknown measurement instants and unavailable
initialization/teardown intervals. JavaScript preloads begin after native runtime setup.
These facts limit the mechanisms investigated so far; they do not prove that all possible
native instrumentation is impossible. Moving the parser into another process would add
another bootstrap and would not turn OS memory into heap-used evidence.

## Decision and options

Stop further browser/environment tuning without a testable hypothesis and a fixed
observation boundary. Preserve all v1 numeric limits, coverage requirements, first
failures and consumed families. Do not run the reserved semantic continuation or promote
the experimental prepared-answer flow on the strength of these diagnostics.

| Path | What must be established first | Current disposition |
| --- | --- | --- |
| Retain v1 and change environment/observer | Evidence that the chosen change can address baseline RSS and missing lifetime observations, without changed flags/security/metrics; supported daemon heap coverage | No justified new candidate is available from the retained evidence |
| Design a separately versioned resource contract | Explicit product objective, observable quantity, ownership/lifetime boundary, prospective thresholds and treatment of unavailable data; visible differences from v1 | Recommended next design task; no contract is adopted here |
| Continue independent functional work | A bounded task whose result does not depend on resource acceptance; existing source authority, budgets and failure labels preserved | Permitted within the assigned roadmap; no L5/bridge/full-flow promotion |

The next task is [Task 149](../../tasks/149-loredock-observable-resource-contract-design.md):
prepare a concrete versioned proposal for review. The preferred design direction is
whole-lifetime OS accounting for the cost of owned execution, with separately labeled
application-JavaScript heap diagnostics and explicit missing intervals. Keep total browser
cost visible; a baseline or incremental UI measurement must not silently replace it.
This is a design recommendation, not evidence that a new metric or threshold will pass.

Useful independent work includes existing model-free citation, source-revocation,
saved-context, cancellation and parser-compatibility regressions. New defects in those
boundaries can be fixed without a resource claim. The ordinary user-facing pilot remains
separate from experimental prepared answers. Knowledge quality and private-project
acceptance still need their own evidence; neither resource redesign nor agent merge supplies it.

## Conditions for another experiment

A future task must identify the approved contract version, hypothesis, candidate bytes,
fixed metrics/ceilings, observable start/end boundaries, failure classifications and the
smallest independent prerequisite fixture. Missing/ambiguous ownership or observations
must have a predetermined non-passing outcome. Freeze the complete procedure before
execution and retain its first result. No retrospective rescoring of v1 is allowed.

This task changes documentation and retains accepted CI evidence only. Application/API/
collector bytes, runtime configuration, security and normal checkout remain unchanged.
No browser, daemon, model, corporate source or new resource experiment runs. Validate
document links, retained archive/log hashes and both complete exact-head CI logs before merge.
