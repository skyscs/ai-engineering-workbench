# Corrected admission: first result and pre-exec capability failure

The sole Task 156 attempt is **FAIL** and consumed. Corrected empty-controller admission
succeeds. One native invocation makes one successful clone3 call and creates a child
directly in the fresh target. The independent pre-exec guard then rejects a nonzero
inheritable capability. No execution permit, Bubblewrap, payload or explicit 1-MiB
allocation occurs. This is an observed security-predicate failure, not missing evidence
or an unavailable clone3 mechanism. Overall direct-birth/executor/resource qualification
remains false.

## Observed boundary

The native birth record and independent kernel reads agree on PID 3983339, start tick
38719616, UID/GID 1000, target device 30/inode 114646 and exact placement in the new
service's run/probe leaf. The blocked child is its only process. The raw status has
NoNewPrivs 1 and zero permitted, effective and ambient capability sets, but CapInh is
0000000800000000. The installed header names bit 35 CAP_WAKE_ALARM. The observation
does not establish an active effective privilege or the origin of the inherited bit.

[No-new-privileges](https://www.kernel.org/doc/html/v7.0/userspace-api/no_new_privs.html)
constrains privilege gains during exec; it does not request clearing existing inheritable
bits. The [capability sets](https://man7.org/linux/man-pages/man7/capabilities.7.html)
have distinct meanings. The current native helper checks the target and placement but
does not explicitly reduce its own inherited sets before creating the child. The future
candidate can tighten that owned-process boundary using the
[self-only capability interface](https://man7.org/linux/man-pages/man2/capset.2.html),
with zero-valued reduction and readback before clone3. It must preserve the strict guard
and all namespace/profile requirements. No host or user-manager change is justified.

The collector retains the failing raw observation, closes its permit pipe and reports
BIRTH_NOT_ACKNOWLEDGED. The native parent observes EPIPE, kills its unreaped direct child
and actually waits for SIGKILL termination. Its exit record reports forcedKill true,
waited true and a stable target; pidfdReady is false because this is the error path.
The target is subsequently empty and its terminal assessment passes. Forced native-child
cleanup remains a failure even though the outside controller sends no service-stop request.

## Identity and retention

- Candidate: `83d1520bacd6008a24714f78cd934b1d0f248b16`.
- Manifest SHA-256: `7ed1727631a2af9e0ae7b0ab8dc97c0480c2ff90f315ce1b6d571a6fa721057a`.
- Unit: `loredock-task156-53e1fd29-9de1-4d1b-8b55-a0bade4b9be3.service`.
- Invocation: `420803c4a45d4209a93176a65ffebf3e`.
- Ownership receipt SHA-256: `d3ce167dd299e6fb45f7ab6b16208978018c44b0e9bd31585c8657f09f572e11`.
- Native binary SHA-256: `a7beefc865891512a36cef66968a21cf42ca7f095121738fe33f53ae81c60c49`.
- First output: 79 files, 36,057 bytes; outside duration: 317,695,131 ns.

The freshly compiled native binary is byte-identical to Task 155's unexecuted binary.
The build receipt records 177 observed source/header/tool inputs using the actual build
preprocessor flags. System runtime binaries and the complete operating system are not
sealed. All pinned inputs remain unchanged after this attempt.

The manager retains the same failed invocation with MainPID zero and an empty ControlGroup;
the owned group is absent. A separate read-only terminal review confirms it. No timeout,
reset, restart, service-stop request, host policy change, application or model is involved.
The rounded 23-M service peak is a helper diagnostic, not an application measurement.

The [complete evidence](../fixtures/loredock-empty-controller-prerequisite/README.md)
retains the first records, source/executable pins, claims, build and terminal/capability
reviews. Local checks pass 1,207 Node tests, 18 new Python cases plus 34/20/20/16 previous
cases, ten typechecks and ten final builds. All 148 emitted application/package modules
are unchanged. Both complete exact-head CI logs are required before acceptance, followed
by the separately scoped [Task 157](../../tasks/157-loredock-native-capability-prerequisite.md).
