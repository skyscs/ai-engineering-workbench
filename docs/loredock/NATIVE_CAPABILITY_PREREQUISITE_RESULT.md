# Native capability reduction: first prerequisite result

The sole Task 157 attempt is **PASS** and consumed. One fresh owned service invokes
the separately sealed native helper once. After self-only capability reduction, one
successful clone3 call creates the child directly in the held target. Independent
kernel reads verify its identity, placement, zero inheritable/permitted/effective/ambient
sets and no-new-privileges before the collector permits sandbox execution.

One fixed Bubblewrap invocation and one 1-MiB payload complete normally. All seven
namespaces differ from the host observation. Payload UID/GID are 1000; capability sets
remain zero and no-new-privileges is one. Only descriptors 0/1/2 and the expected three
environment keys remain. Home, user runtime sockets and cgroup paths are hidden; the
canary is read-only and nested user-namespace creation is denied. Seccomp zero remains
a diagnostic of this fixed profile, not an additional security claim.

The parent observes its child's pidfd and actually waits for exit zero, with signal zero,
a stable target, no collector error and no forced kill. Held target observations then
show no processes or populated descendants. The manager unloads the successful unit;
its owned group is absent. A separate read-only terminal review confirms that state.
No timeout, service-stop, reset, restart, host-policy change or fallback occurs.

## Identity and retained evidence

- Candidate: `be2ebff6f99d6a9398cb7f78fafdd9c83af1b686`.
- Manifest SHA-256: `b1d84e57c0129918e0ba092ec5f6f3084cfe178e6bb04466a76d2f286312b827`.
- Unit: `loredock-task157-f11aba3e-9e8c-4a12-8a98-5c1b40c09849.service`.
- Invocation: `a7f3802641fd4deb8c175cb89e4c6582`.
- Ownership receipt SHA-256: `a9b470ea9361ef7dec967ac4a61dc6eb3e2933c702b9877ecae1c3a4d71b1524`.
- Native binary SHA-256: `0604c465eb6a6397c411f30c0d53ca95e368a573a6cc49339cb4657d730ee3a3`.
- Child: PID 4100601, start tick 38955529, target device 30/inode 115590.
- First output: 79 files, 36,441 bytes; outside duration: 367,520,549 ns.

Native capture takes 33,381,192 ns; the service reports 226 ms. Its rounded 22.8-M peak
is a service-helper diagnostic, not a measured application or target-memory result.
The build record pins 178 observed source/header/tool inputs and the final native binary.
The complete operating system is not sealed. All pinned inputs remain unchanged.

The [106-member archive](../fixtures/loredock-native-capability-prerequisite/README.md)
retains twelve sealed inputs, every first record and fifteen outside records. Nine closed
logs include accepted Task 156 push/PR CI, installation, the initial failed test harness,
diagnostic/separated/final focused checks, full local verification and native compilation.
The initial test failure remains history; compiling wrappers separately resolves its
optimization-sensitive linkage boundary without changing the production flags.

Local checks pass 1,208 Node tests, four Python cases including 26 intercepted C scenarios,
the previous 18/34/20/20/16 Python cases, ten typechecks and ten final builds. A subsequent
diff check removes one redundant trailing newline from the test wrapper only; every C
token and the tested production source remain unchanged, with both hashes recorded.
All 148 emitted application/package modules and consumed previous evidence are unchanged.
Both complete CI logs for the final PR head remain required before acceptance.

This pass establishes the direct-birth/fixed-namespace prerequisite only. Counter lifetime,
ancestor controls, orphan/interrupted-collector behavior, application resources/timing and
semantic/product gates remain unqualified. No application, model or corporate source ran.
The separately scoped [Task 158](../../tasks/158-loredock-held-counter-reader.md) next
implements bounded held-counter acquisition offline before another live integration.
