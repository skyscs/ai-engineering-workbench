# Observable resource contract proposal

Status: **proposed, not adopted or executed**. Proposal identity:
`loredock-observable-resources/2-draft1`. Task 149 supplies a reviewable replacement
measurement boundary, following [ADR 0067](../decisions/0067-loredock-resource-gate-feasibility.md).
Only a separate decision can adopt it. The [v1 protocol](../../fixtures/loredock-prepared-flow/protocol.json),
its collectors, failed results and exhausted `kiln-prepared-flow-127` family stay unchanged.

## Objective and claim

On a declared Linux test environment, the complete local daemon and browser must deliver
the twenty-repository positive cases within bounded charged memory, response time, work
and storage. A fast refusal is still a failed positive case. This proposal measures the
kernel memory charged to a prospectively owned execution hierarchy. It does **not** measure
all physical memory attributable to the product, recommend minimum machine RAM, or qualify
every developer environment. No such hardware target has been established.

Keep the daemon and browser's existing numerical envelopes: 384 MiB and 1,024 MiB. These
remain prospective engineering targets, now applied to a different quantity. Their values
are inherited from the earlier product budget, not fitted to Tasks 134/143/147. Add a
1,408-MiB hierarchy envelope, exactly their sum, so shared test control cannot silently add
unlimited overhead. No observation establishes that the application will satisfy these
criteria. If they prove unsuitable, retain the failure and review a new version.

The mandatory acceptance axes are useful behavior, operational memory, responsiveness,
work, storage, authority and actual shutdown. Heap and process RSS become explicitly
limited diagnostics. Removing the whole-isolate 64-MiB heap acceptance predicate and
changing both RSS predicates are substantive changes requiring separate review.

## Proposed memory quantities

| Scope | Mandatory quantity and ceiling | Included execution |
| --- | --- | --- |
| `run/daemon` | Creation-to-terminal `memory.peak` ≤ 402,653,184 bytes | Emitted production daemon, parser threads, Git/other owned children, passive in-process timer and daemon-specific observer helpers |
| `run/browser` | Creation-to-terminal `memory.peak` ≤ 1,073,741,824 bytes | Entire fresh browser, every child, browser collector and browser-specific helpers; no renderer or extension exclusion |
| `run` | Creation-to-terminal `memory.peak` ≤ 1,476,395,008 bytes | Both scopes plus the `control` leaf containing request drivers, trace/storage collectors and test orchestration |
| All three scopes | Creation-to-terminal `memory.swap.peak` = 0 | Swap cannot make a resident-charge result appear small; absent support is unavailable, not zero |

These are assessment ceilings, **not** requests to set `memory.max`, `memory.high`, swap
limits, CPU throttling or OOM behavior. No new pressure, forced reclaim, cache eviction,
heap-size override, profiler or forced GC is allowed. Keep the ordinary runtime security.
An application run must not manipulate the measurement hierarchy or inherit writable
control descriptors. HugeTLB allocation is outside the proposed accounting scope and must
be prohibited for owned execution; otherwise this profile is unavailable.

The kernel defines hierarchical memory and swap peaks. Charges include categories beyond
anonymous process memory, including page cache and kernel allocations. Shared memory can
be charged outside the consuming group; moving a process does not move its old charges.
See [cgroup v2 memory and ownership](https://docs.kernel.org/admin-guide/cgroup-v2.html#memory).
Accordingly, this proposal calls the result **charged memory**, never deduplicated RSS,
total mapped memory or a cache-independent physical footprint.

Record input verification/build/cache activity before execution, shared image/library
inputs, mount identities and the cache condition as `uncontrolled`. A fresh process,
profile and catalog do not imply cold page cache. Do not subtract a blank-browser baseline,
page-cache category, shared mapping, collector or idle phase. Show complete browser peaks
alongside any separately labeled blank/UI comparison. No causal or incremental peak can
be inferred by subtracting independently timed maxima. A new environment requires its own
sealed evidence; v1 samples cannot be converted into these quantities.

## Acquisition and lifetime ownership

The proposed executor owns a fresh delegated cgroup v2 subtree **before** any measured
child exists. It retains the subtree independently of application/container lifetime.
The root is an empty domain with three leaves: `daemon`, `browser`, `control`. All nested
groups remain descendants of their assigned role. This is test infrastructure only.
Neither ordinary LoreDock startup nor users' project onboarding gains a cgroup input.

The candidate direct-launch interface is `clone3(CLONE_INTO_CGROUP)` with a held directory
descriptor. It places the new child in its destination at creation, subject to permissions;
see [Linux clone(2)](https://man7.org/linux/man-pages/man2/clone.2.html).
This is an interface selection for feasibility review, **not an implemented executor**.
Existing Docker availability or late inspection of a stopped container proves none of
these properties. A container adapter is eligible only with a separately demonstrated
birth/exec boundary, preserved default security and retained parent counters. Do not
silently fall back to spawning and then migrating an already-running process.

An external minimal attestor creates/holds the groups, owns the watchdog, reads terminal
counters and persists the final receipt after measured collectors exit. Its executable,
bounded protocol, process RSS, CPU, wall time and storage are reported separately. It may
not import LoreDock, parse sources, drive HTTP, collect browser traces or perform work
excluded from `control`. Its cost is outside the charged-memory claim, as are the existing
host kernel, service manager and container control plane. All emitted evidence, including
attestor logs, remains inside the unchanged 2-GiB storage allowance. This unavoidable
outside observer is an explicit scope limit, not zero-cost accounting.
Limit that attestor to the three fixed scope records, at most 4 KiB per counter/interface
read and a 1-MiB ownership or terminal receipt, one pending receipt at a time. These are
prospective input/retention caps for small kernel records, not measured memory claims.
Periodic detailed telemetry belongs to `control`; the outside attestor only acquires
ownership, supervises exit and retains terminal evidence within the suite watchdog.

Required ordered states:

1. **Prepared:** freeze candidate/runtime/helper hashes, commands, all output paths,
   environment allowlist, hierarchy layout, bounds and independent expectations. Verify
   existing delegation and required interfaces without changing host configuration. Missing
   delegation, namespace confinement, permissions, swap-peak support or safe ownership
   yields `UNAVAILABLE` before application creation. No elevated runtime, host policy edit,
   extra capability or unrestricted fallback is allowed.
2. **Acquired:** exclusively create the fresh hierarchy. Retain boot/mount identity,
   parent identity, directory device/inode and open directory/counter descriptors. Reject
   existing names, symlink/path replacement, unexpected members or nonempty starting
   counters. Record effective ancestor controls and kernel/runtime identity. Open peaks
   read-only and never reset them. Fsync the ownership/first-attempt receipt before launch.
3. **Running:** create each role directly in its held scope, verify the creation receipt
   before application exec and retain actual process ownership. No child may move out or
   acquire hierarchy-write access. An inherited shared mapping is still charged according
   to the kernel's rule; the proposal does not claim to recover its prior allocation.
   Retain monotonic read windows, current/peak/event diagnostics and all exits. Periodic
   readings aid diagnosis; a missed periodic RSS read does not erase a retained kernel
   peak. A missing mandatory time/trace record still blocks the complete gate.
4. **Draining:** stop admission and join actual owned application, worker, browser and
   collector exits. Keep directory/counter ownership. Reparenting inside the hierarchy
   does not end ownership. Empty `cgroup.procs` alone is insufficient: require no populated
   descendants and the kernel-owner wait/exit ledger. Watchdog cleanup targets only the
   verified hierarchy/owned handles; a timeout or forced cleanup remains a failed normal
   positive case even when cleanup succeeds.
5. **Retained:** while the same hierarchy still exists, record `cgroup.events`, final
   peaks, current values, memory/swap events and exit ledger with bounded read windows.
   Require `populated=0`, stable identities and no peak decrease/reset. Fsync raw terminal
   evidence and its inventory before any owned empty-group removal. Residual charged cache
   need not be zero. No removal/recreation, final-zero substitution or cross-run reuse is
   allowed. Counter loss or recorder interruption yields an unavailable terminal result;
   a last live sample is not a final peak. Cleanup/recovery never upgrades a failed run.

Read `memory.events` by keys and retain the whole value, including unknown fields.
An owned high/max/oom/oom-kill event or nonzero swap peak fails this pressure-free profile.
Missing required event fields/read access is unavailable. Record ancestor controls and
available pressure/event diagnostics; a changed ancestor control or ambiguous placement
is unavailable, while ordinary unrelated host load remains an environmental limitation.
Do not sum parent and child counters, independent maxima, or memory and swap peaks into
a claimed simultaneous maximum. The root peak is read directly.

## Responsiveness and heap evidence

Retain the v1 responsiveness contract: nominal 10-ms daemon callbacks, raw maximum
100-ms intervals, explicit process-start/first-observer and last-observer/actual-exit
gaps, ten-second cold listen, browser task/paint/polling limits, and every HTTP/operation
deadline. A missing boundary or clock mapping is unavailable; a measured excess fails.
Kernel accounting fixes no timer failure. Build/verification work before application
creation must be listed; it cannot be described as application cold-start time. Use the
emitted production entry for qualification, with the same audited constructor injection
only in the controlled-runtime lane. Source-loader observations remain diagnostic.

Keep sampled process RSS, process high water and per-process identities as diagnostic
series, with the existing nominal schedules and every missing/read-race/exit marker.
The old 384-MiB/1-GiB reference breaches remain visible. Under this proposal those
diagnostics do not replace or invalidate an otherwise complete charged-memory sub-result;
lost identity/ownership evidence still prevents a pass. This explicitly changes v1's
RSS sample-completeness acceptance rule. Browser trace coverage is a separate requirement.

Heap evidence is limited to the daemon main isolate after observer entry and separately
identified public worker handles that a declared diagnostic observer can actually see.
Record each handle's creation/online/ready/exit events, request/completion windows,
fulfilled values, rejections, pending requests and late replies. Native bootstrap,
teardown and undiscovered nested/internal isolates are `unavailable`. No worker
instrumentation or production preload is introduced by this proposal. A separate
instrumented lane must disclose its intervention and cannot supply uninstrumented timing.

The retained [Node API/source audit](PARSER_OBSERVATION_COVERAGE.md) establishes that worker
results have no measurement timestamp. Keep that field null; request/completion times
bound a successful observation, not a simultaneous snapshot. Show per-isolate sampled
maxima only. `aggregateHeapPeakBytes` and `completeIsolateCoverage` remain null/false unless
a separately reviewed mechanism establishes them. Preserve 67,108,864 bytes as a historical
reference, **not** a per-isolate replacement ceiling or an asserted aggregate pass.
No samples means unavailable diagnostics. A complete, honest unavailable ledger is allowed
alongside an operational-memory pass; fabricated values or an omitted ledger fail evidence
integrity. This removes an acceptance condition and therefore needs explicit adoption.

## Complete compatibility comparison

The [machine-readable comparison](../fixtures/loredock-resource-contract/threshold-comparison.json)
enumerates every numeric v1 key, its exact value and disposition. Only the three memory
predicates change; all remaining numeric keys retain their quantities and meanings.
The new root/swap predicates and the following nonnumeric changes are additional:

| Boundary | v1 | Proposed v2 |
| --- | --- | --- |
| Daemon/browser memory | Sampled process/tree RSS ceilings | Hierarchical charged-memory peaks with unchanged per-role numbers; old RSS remains diagnostic |
| Heap | Complete observed aggregate heap acceptance, 64 MiB | Mandatory honest diagnostic ledger; no aggregate-heap acceptance claim |
| Memory startup/exit | Process sampling, high water and missing-sample failure | Counters acquired before child creation and retained after actual exit; missing mandatory counters fail availability |
| Periodic process races | Missing RSS sample fails qualification | Retained diagnostic gap; cannot excuse lost ownership or missing timing evidence |
| Combined memory and swap | No combined cgroup predicate | Root peak ≤ 1,408 MiB and each required swap peak zero |
| Cache and shared pages | Shared RSS may count multiple times | Kernel charge ownership; uncontrolled cache and externally charged shared pages explicitly limit the claim |
| Observation overhead | Included in owned process/tree measurements | In-scope collectors/control included; bounded external final attestor separately disclosed |
| Environment | Pinned original execution seal | New prospective Linux accounting/security prerequisite; no inference from old containers |
| Outcome labels | Any failed/missing requirement is no-go | Separate `FAIL` and `UNAVAILABLE`, both no-go; all reasons retained |

Retain all fifteen useful resource/lifecycle case intents, representative/near-limit
sizes, three fixed warm repetitions, 64-row history, actual ten-minute expiry and controlled
runtime separation. Retain response/prompt/original/derived/witness caps; per-operation and
aggregate work; catalog and whole-run storage; authority/revocation/three validation fences;
durable replay; single active work owner; original-only citations; actual cancellation and
shutdown. Fault holds can be excluded only from their already named drain timings.
The original no-retry, first-attempt retention, 40-minute resource watchdog and no-evidence-
deletion rules remain. Source input is synthetic and never executed.

No model setting/budget is changed here. Any eventual semantic run needs its own current
runtime/account seal and a fresh family with original-source expectations before observation.
The consumed v1 family and reserved continuation cannot reopen. A resource pass alone
cannot promote prepared answers, establish semantic correctness, meet independent L5
acceptance or enable the Workbench bridge.

## Outcomes and required tests before application execution

Assess every axis separately. `PASS` requires all mandatory evidence and predicates;
`FAIL` records an observed violation; `UNAVAILABLE` records an unestablished prerequisite
or missing required observation; `NOT_RUN` records a stage never started. Known failures
take precedence in the overall result while missing-evidence reasons remain. No mean,
best repetition, bounded refusal, recovered cleanup or diagnostic-only result grants a pass.
An unadopted proposal cannot produce an accepted qualification result at all.

The [prerequisite matrix](../fixtures/loredock-resource-contract/prerequisite-cases.json)
defines expected outcomes before implementation. First test an offline assessor using
hand-authored counter/event transcripts and controlled clocks, with no application or OS
mutation. Then, under a separately sealed task, prove one small independent executor
lifetime covering creation, a short-lived allocating child, natural exit, orphan cleanup
and interrupted collection. These are observer controls, not product/resource acceptance.
Pin their input, memory/work/wall/storage bounds and first-output destination before running;
do not enlarge a failed allocation or keep trying environments until one passes.

Required retained evidence includes the accepted contract digest, complete comparison,
prerequisite results, candidate/runtime/security manifest, exclusive ownership receipt,
hierarchy/counter identities, raw reads with monotonic windows, all process waits/exits,
unavailable diagnostics, complete functional outputs, first assessment and both exact-head
CI logs. A capability failure ends this proposed execution path without host reconfiguration.
Independent bounded functional work can continue under the existing roadmap.

Next: [Task 150](../../tasks/150-loredock-resource-contract-review.md) reviews the metric,
threshold derivation, exclusions and executor feasibility as a separate decision. This
document supplies no runtime implementation, delegated hierarchy, browser launch, daemon
run, new resource family or contract adoption.
