# ADR 0069 — Acquire initial root counters before accounted descendants

Status: accepted for prospective offline implementation planning. No new live attempt,
executor/resource qualification, application gate or independent semantic acceptance.

## Evidence and decision

Task 159 is accepted through [PR #192](https://github.com/skyscs/ai-engineering-workbench/pull/192),
head 06ddef0, identical-tree merge 55fe1eb. Both complete exact-head CI logs pass 1,221 Node
tests, sixteen new and the prior Python cases, ten typechecks and ten final builds.
Its sole [actual result](../loredock/HELD_COUNTER_PREREQUISITE_RESULT.md) is consumed and
UNAVAILABLE: after creating three descendants, the empty root has current/peak values
512,000/520,192 bytes, despite complete reads and no admitted workload process.

Adopt a prospective **collection-order correction**: acquire and durably retain the
root's zero initial observations before creating accounted descendants, then acquire
empty role observations before any measured process. Keep the same root/counter handles
through final retention, so all subsequent group-setup charges remain in the direct
creation-to-terminal root peak. Do not change the immutable v2 contract, its ceilings,
zero-start requirement, existing memory assessor or any consumed result.

This decision is compatible with the existing observation semantics. Initial records
already have separate read windows; the assessor requires each to fall after acquiredAtNs
and before firstChildAtNs. It does not require initial role reads before initial root.
Its original valid fixture already uses root-first initial windows. Final role-before-root
ordering remains mandatory. The earliest acquisition boundary must cover the root read;
using the later daemon boundary would invalidate the receipt.

## Why empty membership did not imply zero charges

In upstream Linux v7.0,
[mem_cgroup_css_alloc](https://github.com/torvalds/linux/blob/v7.0/mm/memcontrol.c#L3823)
selects the parent memcg while creating a child and allocates child statistics with
accounted flags. The [charging-scope declaration](https://github.com/torvalds/linux/blob/v7.0/include/linux/sched/mm.h#L477)
explains that accounted allocations in that scope charge the selected memcg. Thus
constructing an empty child can charge its parent before any process enters the child.
The retained blobs are 772bac21d15584ce495cba6ad2eebfa7f693677f and
95d0040df58413fc5d436c0c12cde664532c1a28 respectively.

This mechanism is consistent with Task 159's observation. It is not exact attribution of
the observed bytes or proof of the installed distribution kernel's entire behavior.
The actual root-zero state before descendants, permitted staged acquisition and later
terminal persistence remain untested. If zero starting evidence is still unavailable at
the corrected boundary, the candidate must refuse admission under the unchanged rules.

## Prospective sequence and ownership

| Stage | Required action and retained evidence |
| --- | --- |
| Owned service | Establish the unchanged exclusive service/attestor boundary and existing mount mode; enable only owned accounting needed to expose run counters |
| Root created | Exclusively create run with no descendants; retain its parent/mount/device/inode and read-only counter descriptors |
| Root initial retained | Read all eight root interfaces once; require complete, stable, zero/empty domain data and fsync raw bytes plus admission evidence before descendant construction |
| Descendants prepared | Enable memory below that held root as needed; create the fixed probe target and empty daemon/browser siblings under it; preserve all resulting root charges |
| Role initials retained | Attach distinct held role descriptors once, read complete zero/empty role records and durably retain them; recheck root/role/target identities and empty process membership |
| Complete admission | Bind the earliest acquisition boundary and each original initial window before native creation; admit no measured process on a partial stage, lost durability or changed identity |
| Actual normal wait | Use the unchanged native capability/clone3/permit/sandbox path and retain actual wait/empty-target evidence |
| Final retained | Read final daemon/browser then root through their original held descriptors; fsync raw data, inventory and receipt before service return/removal |

The root is not reread as a new zero baseline after setup. Its initial zero observation
remains the original one, while its final unreset global peak includes setup and workload.
Retaining an earlier initial record is required provenance, not substituting it for a
missing final record. No extra checkpoint or pressure injection is needed to measure setup.
Final residual charged cache may remain nonzero; all current/peak/event predicates still apply.

Construction stage records must bind the root initial publication before descendant setup
and complete role publication before native admission. A caller-supplied retained=true flag,
path name or standalone receipt cannot prove those actions. The eventual live owner must
perform actual exclusive construction, file/directory fsync, identity checks and ordered
admission. The generic reader remains without ownership, lifetime or durability authority.

## Required implementation change and boundaries

Task 158's constructor requires all three directories before opening any counters. Task
156's create method enables the root and creates probe before returning. Neither API can
express the new sequence truthfully. Keep both accepted implementations and all sealed
copies frozen. A separate staged reader must open root counters first, attach role handles
later and retain the original root FDs. Do not reopen root counters behind a continuity
claim, supply placeholder roles, monkey-patch the old reader or relabel a later root read.

The reader must preserve exact bytes, bounded windows, latched identity/open failures,
partial acquisition, same-clock ordering and closure of all owned descriptors. Root and
role initial observations are separate phases of the same initial set, not extra sampling
or a new queue. There are still 24 initial and 24 final interface reads in the complete
tiny candidate, with each complete interface at most 4 KiB, each receipt at most 1 MiB
and one pending receipt. The fixed three counter scopes and 2-MiB first-output cap remain.
The eventual helper must split root construction from descendant construction and bind
durable publication between them; that integration is a separate task after offline work.

Reject alternative interpretations that reset peaks, subtract setup memory, permit an
arbitrary nonzero initial allowance, flatten roles, move measured setup outside the root,
alter security or tune the host/runtime. Such changes are not this decision. No existing
family or sealed entry is reopened. Missing actual capability still ends the candidate path.

## Validation and next task

Eight [hand-authored review receipts](../fixtures/loredock-initial-counter-order/README.md)
exercise the unchanged assessor: one compatible root-first sequence, six unavailable
integrity/order cases, and one direct-root breach with another missing final record that
remains FAIL. Lifecycle, ownership and fsync are supplied synthetic assumptions. These
checks establish representation/predicate compatibility only; the assessor cannot attest
descriptor continuity, stage publication, real group construction or installed-kernel behavior.

[Task 161](../../tasks/161-loredock-staged-counter-reader.md) implements only the separate
staged reader with temporary-file fixtures. A later explicit task must integrate the owned
creation/fsync sequence, retain all current native/security bounds, complete full checks,
commit/seal and declare its sole attempt before any live execution. Ancestor controls,
orphan/interrupted-collector handling, complete executor lifetime, application resources,
responsiveness, semantic readiness and the Workbench bridge remain independent gates.
If the required semantics cannot be established under the existing environment/contract,
retain the unavailable path and resume bounded independent functional work without promotion.
