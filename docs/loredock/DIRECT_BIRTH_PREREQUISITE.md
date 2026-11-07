# Direct process birth prerequisite

Task 155 adds a separate, prospectively sealed prerequisite after the accepted
[user-service namespace check](USER_NAMESPACE_PREREQUISITE_RESULT.md).
The sole first attempt is consumed and unavailable because its empty-controller admission
check is incorrect; no native helper or payload runs. See the [retained result](DIRECT_BIRTH_PREREQUISITE_RESULT.md).
This adapter is frozen experiment history. Do not repair or rerun its first entry.
The consumed Task 152/154 implementations and first evidence remain unchanged.

The new [adapter](../../scripts/loredock-direct-birth-prerequisite/probe.py) uses the
accepted acquisition, ownership validator, fixed sandbox and payload bytes. A minimal
[native helper](../../scripts/loredock-direct-birth-prerequisite/native.c) makes exactly
one `clone3` call with `CLONE_INTO_CGROUP | CLONE_PIDFD`, the system header ABI and
`SIGCHLD`. It has no fork/migrate or runtime fallback. The installed compiler, build
command, source, executable and prerequisite inputs are pinned before execution.
The [Linux clone reference](https://man7.org/linux/man-pages/man2/clone.2.html) describes
the target cgroup-v2 descriptor and placement constraints; availability remains unproven
until the sole actual attempt. Any actual capability failure ends this candidate path.

## Ownership and placement

The same fresh delegated user-service profile is used: attestor subgroup, memory
delegation, no-new-privileges, no restart, control-group cleanup and 10/5/2-second
runtime/start/stop deadlines. Two ownership snapshots and held/named directory identities
must pass before any descendant creation or controller write.

Only that newly owned unit and its fresh `run` descendant may enable `+memory`.
Existing enabled controllers are preserved. The `run/probe` target must be an empty
domain with no enabled subtree controllers. No terminal/user-manager root, existing
service, memory/swap/CPU limit, reclaim setting or pressure generator is modified.
Controller, type, process-list and event reads are retained through held descriptors.
There are no memory-peak measurements or application resource claims in this task.

The collector and native control parent remain in `attestor`, outside `run/probe`.
The direct child is created in `run/probe`; its later Bubblewrap monitors and payload
inherit that membership. The outside launcher remains outside the service. All these
control/monitor roles have real overhead; the 1-MiB allocation describes only explicit
payload work and does not bound total process memory.

## Publication before execution

The native parent checks its exact attestor placement and target descriptor's filesystem,
device, inode and non-root owner. The child closes the target descriptor, observes its
own PID/start time/placement and sends a bounded birth report through a private pipe.
It waits for a permit before entering the fixed sandbox.

The native parent emits the birth record and waits on the collector acknowledgment pipe.
The collector independently reads the blocked child's `/proc` identity, credentials,
no-new-privileges, capability sets and placement, verifies sole target membership and
rechecks held/named directory identities. It exclusively publishes and fsyncs those
records before sending `A`. Missing, changed or failed evidence closes the pipe without
a permit. The native parent forwards the permit only after this durable publication.

The child closes report/control descriptors and restores `/dev/null` input before
executing the unchanged sandbox. Required namespaces, hidden control paths, read-only
inputs, empty capabilities/environment and descriptor restrictions are checked by the
same fixed payload. The native control parent observes pidfd readiness and actually
waits/reaps the original child; a copied PID or process-list disappearance is insufficient.
It retains the target descriptor through that wait. The collector then reads target
terminal events/processes while its held directory chain remains open, and retains
the assessment before service exit.

## Bounds and failures

One service, one `clone3`, one sandbox, one payload and one 1-MiB touched allocation
are admitted. Native control has a four-second deadline, native capture five seconds
and the outside service launcher 25 seconds. Streams stay within 64 KiB each, individual
records within 1 MiB and retained first output within 2 MiB. Native birth/exit lines and
individual kernel reads are at most 4 KiB. The service watchdog covers blocking collector
operations independently; a local deadline does not make filesystem fsync interruptible.

Both external and internal entries are exclusive and durable. Missing syscall support,
permission failure, invalid domain, failed sandbox exec, interruption, timeout, changed
inputs or missing wait/terminal observations cannot pass. A known security violation or
forced cleanup survives separately missing later evidence. A retained exact invocation
and group are necessary for cleanup; a foreign service is never stopped.

The child requests a parent-death signal and checks the parent afterward. Native errors
kill/reap only its unreaped direct child; the service manager owns the remaining subtree.
This is a bounded prerequisite, not qualification of every orphan or interrupted-collector
scenario. Pure record assessment always declines live authority. A complete first result
may establish only this direct-birth prerequisite; executor/resource qualification,
counter lifetime, ancestor controls, terminal peaks, application timing/resources,
semantic quality and the Workbench bridge remain closed.

## Offline verification

Thirty-four Python cases cover malformed records, identity/clock/target bindings,
missing/duplicate records, descriptor-leak evidence, known-failure retention, permit
ordering, stream/deadline bounds, interrupted capture and actual direct-child reaping.
Temporary ordinary directories exercise held/name replacement; cgroup writes and
manager calls are mocked. A positive outer adapter path is supplied-record testing.

The native production helper is compiled but never executed by tests. Its C harness
intercepts every explicit syscall and waitpid call, checks exact flags/ABI/exit signal,
injects ENOSYS/EACCES/EBUSY/unsupported-domain failures and exercises identity, pipe,
deadline and wait errors. No offline test invokes real `clone3`, systemd or Bubblewrap.
The previous 20 acquisition, 20 ownership and 16 transport regressions remain separate.
