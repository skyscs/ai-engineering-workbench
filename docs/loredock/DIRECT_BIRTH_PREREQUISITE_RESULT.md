# First direct-birth prerequisite result

The sole Task 155 attempt is **UNAVAILABLE** and consumed. Candidate `e887022` creates
one fresh delegated service, verifies ownership and enables memory accounting only inside
its owned unit and new run group. It stops at the target's empty-controller check before
the native helper is executed. There are **zero clone3 attempts, sandboxes, payloads or
1-MiB allocations**. No application, browser, model or corporate source runs.

The defect is in the helper: it requires `cgroup.subtree_control` to equal a newline.
The retained target read is the empty string. Type is `domain`, the process list is empty,
events report populated/frozen zero and the memory controller is available. The same
zero-byte format appears in the unit and run group before their owned accounting enable.
Their subsequent reads contain `memory` followed by a newline.

The [upstream v7.0 formatter](https://github.com/torvalds/linux/blob/v7.0/kernel/cgroup/cgroup.c#L3136)
emits a newline only after printing a subsystem name; the subtree-control reader uses that
formatter. This explains the retained zero-byte read. Upstream source is consistent with
the observed host behavior, not binary attestation of the installed distribution kernel.
No namespace, permission or actual clone3 capability failure is established here.

The previous tests cover accounting enable and replacement but omit the complete fresh-leaf
creation path with a real zero-byte controller list. Their passing result therefore did not
catch this defect. The failed first result is not repaired or converted to a pass. A separate
[Task 156](../../tasks/156-loredock-empty-controller-prerequisite.md) must correct admission,
add that regression and qualify a fresh candidate after this retained result is accepted.

## Retained identity and closure

- Manifest SHA-256: `a07c4e37c3d5de934dbf73c23d123fce9a8f5d59fd8a079771979e203c5bc50b`.
- Candidate: `e8870226a66664845d96b305cb1c3d8b4eb97528`.
- Unit: `loredock-task155-79abd43e-3c89-4b24-84c0-acbd0216a8c0.service`.
- Invocation: `c8c0a0c7d16e4509a016446dce0b63ed`.
- Ownership receipt SHA-256: `a47afb9d4f336be22da3ceaf3e9117afb31bd26344d1fa5bb80f72bf6d024d6d`.
- Held device: 30; unit/run/target inodes: 114102 / 114185 / 114224.
- First output: 62 files, 26,563 bytes; outer duration: 267,071,531 ns.

The helper and launcher exit 1 without timeout or forced cleanup. The manager retains
the same failed invocation with MainPID zero and an empty ControlGroup property; the owned
group is absent. A separate read-only terminal review confirms this state. No reset,
restart or cleanup request is issued. The rounded 23.1-M service peak is a helper diagnostic,
not an application measurement or acceptance result. All pinned inputs remain unchanged.

The [evidence archive](../fixtures/loredock-direct-birth-prerequisite/README.md) retains the
sealed owned native executable, source inputs, all first records, build/toolchain receipts,
claims, outer launch evidence and source/terminal reviews. The native build records 163
observed source/header/tool inputs, using the already installed GCC 15.2.0. The complete
operating-system image and system runtime binaries are not copied or sealed.

Local full checks pass 1,206 Node tests, 34 new Python cases, the existing 20/20/16 Python
cases, ten typechecks and ten final builds without failures/cancellations. All 148 emitted
application/package modules remain unchanged. Both complete exact-head CI logs are required
before acceptance. Direct-birth, executor and resource qualification flags remain false.
