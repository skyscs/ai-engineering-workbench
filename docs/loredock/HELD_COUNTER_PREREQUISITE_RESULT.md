# Held-counter prerequisite: consumed initial-admission refusal

The sole Task 159 attempt is consumed and **UNAVAILABLE**. All 24 initial interfaces were
read completely through held descriptors without identity/read errors, but the fresh empty
run group already reported memory.current = **512,000** bytes and memory.peak = **520,192**
bytes. Its populated/frozen values were zero. Empty daemon/browser current/peak/swap values
were zero; all memory/swap event values were zero in all three scopes. The strict initial
zero predicate rejected the run before native invocation. No measured child was created.

This establishes availability of these initial reads in this one owned service. It does
not establish final counter persistence, a normal wait/retention sequence or a passing
memory/resource result. The acquisition and separately pinned outside combined assessment
both remain unavailable. Missing later records are reported, not replaced with initial data.

## Sealed inputs and observed outcome

| Item | Retained value |
| --- | --- |
| Candidate commit | 4d7e72a8983eedb302312f5353f090056f01f7fa |
| Manifest SHA-256 | a855bd9f27397f4d14f2a3138c9197bf1e2209789005beedab0841eb33ace2d2 |
| Unit | loredock-task159-5a774b90-7297-453d-9095-97639f42a743.service |
| Invocation | f5caa29366fc4be88219dfdb7c70b1ab |
| Initial root identity | mount 48, device 0:30, inode 116669, parent inode 116586 |
| Empty role inodes | daemon 116747; browser 116786 |
| Actual service requests | 1 |
| Counter batches | 1 initial; no final batch |
| Native / clone3 / sandbox / payload invocations | 0 / 0 / 0 / 0 |
| Explicit payload allocation | 0; admission stopped before the fixed 1-MiB payload |
| Application/browser/model runs | 0 |
| Outside launch duration | 317,004,196 ns |
| Service runtime | 177 ms, launcher diagnostic |
| Outside offline assessment | 38,328,743 ns; exit 1, no timeout/error, unchanged inputs |
| First output | 78 files, 41,032 bytes, plus exclusive claim |

The native source and compiled binary remain byte-identical to Task 157; neither was
executed here. The fixed runtime sources, sandbox, payload, profile and all existing
deadline/work limits remain unchanged. The existing local Node runtime was independently
pinned for outside postprocessing; it was not added to the service or sandbox.

Both immediate and independent later terminal observations find the same failed loaded
invocation, MainPID zero, empty ControlGroup, and an absent owned cgroup. There was no
forced native/service cleanup, timeout, stop/reset/restart request or second attempt.
The failed unit record is retained. The launcher reports a rounded 23.4M service peak,
which is only a helper diagnostic. Detailed before-return getrusage was not reached;
complete outside-helper cost and workload memory remain unmeasured.

## Explanation and next review

The implementation creates run/probe, run/daemon and run/browser before its first root
counter read. Upstream Linux v7.0
[mem_cgroup_css_alloc](https://github.com/torvalds/linux/blob/v7.0/mm/memcontrol.c#L3823)
temporarily selects the parent memcg while allocating a child. The allocation path uses
accounted allocations for child statistics. This supplies a concrete explanation for
nonzero parent charges caused by group setup before a workload process. Source blob
772bac21d15584ce495cba6ad2eebfa7f693677f and reviewed ranges are retained. This is a
source-supported explanation, not exact attribution of the observed bytes or attestation
of the installed distribution kernel. No additional live counter experiment was performed.

Do not reset the root peak, subtract setup charges, allow an arbitrary initial allowance,
flatten the required accounting hierarchy, alter host policy or replay this candidate.
The immutable v2 contract and existing assessor continue to reject these initial values.
All historical first outcomes remain unchanged.

After result/CI acceptance, [Task 160](../../tasks/160-loredock-initial-counter-order-review.md)
reviews whether an explicitly staged acquisition can retain the root's zero initial state
through held descriptors before descendant setup, then acquire empty role records before
any workload. All setup charges would remain inside the unreset creation-to-terminal root
peak. That is a prospective ordering question, not an accepted correction or authority to
run another candidate. The review must retain immutable predicates, ownership, read bounds,
descriptor continuity, final role-before-root order and all remaining qualification gates.

## Verification and evidence

Full local checks pass 1,221 Node tests, sixteen new Python cases and the prior
28/4/18/34/20/20/16 Python cases, ten typechecks and ten final builds with zero failures,
cancellations or skips. All 148 emitted application/package modules remain unchanged.
The first focused Node run exposed a filename-predicate mismatch; the failed log remains
development history and the corrected focused/full checks pass.

The [evidence inventory](../fixtures/loredock-held-counter-prerequisite/README.md) retains
the complete consumed inputs/first output, outside assessment inputs/reports, independent
terminal review, source review, build provenance and nine closed logs including both
accepted Task 158 CI logs. Both complete exact-final-head CI logs require review before
merge. A reviewed unavailable result is useful engineering evidence, not executor,
resource, prepared-answer or independent semantic/product acceptance.
