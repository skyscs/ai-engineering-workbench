# Corrected namespace prerequisite: first attempt passed

Candidate `0f24bf692fa1b9943e24dd7eed67728822a5b84e` completed one fresh user-service
prerequisite under the unchanged runtimes/profile. The first result is `PASS` for the named
acquisition and confinement checks. It does not qualify an executor or application resources.
The [archive](../fixtures/loredock-user-namespace-prerequisite/README.md) retains the sealed
inputs, all first outputs, exact launcher and separate read-only terminal review.

| Observation | Retained result |
| --- | --- |
| Manifest SHA-256 | `55bdfbc8cbc1081998cbf22ec6ed80ec1c132a0048b79780edef114f70109c90` |
| Dedicated service | `loredock-task154-2e25f8bb-5d26-49cd-89c3-cfca38a5061d.service` |
| Manager-issued invocation | `082100a286444e8ea11e78992bc38b2a` |
| Service / sandbox / payload invocations | 1 / 1 / 1 |
| Outer / launcher / sandbox exit | 0 / 0 / 0; no timeout or forced cleanup |
| Outer elapsed / sandbox capture | 267,177,792 ns / 26,946,630 ns; diagnostic only |
| Required acquisition | Two retained manager/process/directory/mount snapshots, independent invocation binding and available memory controller |
| Optional `user.delegate` | Missing with errno 61 in both snapshots; diagnostic only |
| Namespace separation | All seven required namespace IDs differ from the attestor |
| Payload identity / privileges | UID/GID 1000, no-new-privileges 1, inheritable/permitted/effective/ambient capabilities zero |
| Payload descriptors / environment | Only 0/1/2; only `LANG`, `PATH`, `PWD` |
| Filesystem / nested namespace checks | All four named host paths hidden; canary write-open rejected with `EROFS` (30); further user namespace rejected with `ENOSPC` (28) |
| Explicit allocation | 1,048,576 bytes, 256 touched pages |
| Terminal service | Explicitly unloaded: `not-found`, `inactive`, main PID 0, empty invocation/group |
| Terminal group | Owned group absent; separate read-only review agrees |
| First output | 32 files, 26,468 bytes |

The final empty invocation belongs to the explicitly unloaded-unit observation. It does not
replace the acquired invocation; the initial live records, normal synchronous launcher exit
and terminal absence jointly supply this prerequisite's closure evidence. No reset, stop,
restart or profile change was needed. No first record was rewritten after collection.

The supplied-record assessor still returns `offlineOnly: true`, `ownershipEstablished: false`,
`executorQualified: false` and `resourceQualification: false`. The live adapter independently
retains actual acquisition evidence. Its first result demonstrates the bounded prerequisite,
not authority inferred from an assessor's pass alone. Task 152's unavailable result and consumed
helper are unchanged; this fresh success does not retrospectively repair its missing evidence.

## Limits and next proof

The payload reports `Seccomp: 0`; this probe does not install or qualify a syscall filter.
Its selected namespace/filesystem/capability/no-new-privileges checks passed. It does not
establish a complete sandbox for arbitrary applications, adversarial same-UID isolation or a
sealed operating-system image. The unchanged default profile file and executable hashes are
input evidence, not an independent loaded-policy attestation.

Systemd printed a rounded service memory peak of 21.9M and zero swap. That is a helper/service
diagnostic, not a daemon/browser/run observation under the adopted resource contract. The
fixed payload allocation is also not a total process-memory ceiling. No memory counter was
read or resource ceiling imposed by this adapter; no application, browser, model or corporate
source ran. All historical application failures and exhausted experiment families remain so.

Direct process creation into a measured cgroup, inaccessible control descriptors/writes,
protected terminal counters, ancestor stability, orphan/interrupted-collector lifetimes,
application timing/resources and semantic quality remain unqualified. After this task's
exact-head CI and review, [Task 155](../../tasks/155-loredock-direct-birth-prerequisite.md)
can address one separately sealed direct-birth prerequisite. No prepared-answer promotion,
L5 acceptance or Workbench bridge follows from this result.
