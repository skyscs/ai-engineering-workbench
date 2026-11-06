# Namespace prerequisite

The first sealed attempt is consumed and unavailable before sandbox creation. Its required
user-service xattr was an incorrect assumption; this helper is retained as experiment
history, not a reusable qualified executor. See [the result](NAMESPACE_PREREQUISITE_RESULT.md)
and [the planned offline correction](../../tasks/153-loredock-user-service-ownership.md).

Task 152 checks one necessary condition for the prospective resource executor: an
unprivileged process can enter the required namespaces under a fresh delegated user
service and complete a fixed, small confinement probe. It is not a memory measurement,
application benchmark or executor qualification. Ordinary LoreDock startup is unchanged.

The [helper](../../scripts/loredock-namespace-prerequisite/probe.py) has no import-time
execution. Its `--run-first MANIFEST SHA256` entry accepts a separately sealed manifest;
the `--service` entry verifies its actual manager-issued invocation and placement before
creating the sandbox. Input hashes, fixed non-setuid system executable paths, expected
non-root identity and the dedicated unit name are checked first. The launch consumes an
exclusive, fsynced claim even if the service request subsequently fails. The internal
service entry consumes its own exclusive receipt before querying the manager or creating
the sandbox. Repeated internal entry cannot bypass the outside claim. Pinned inputs are
verified again before final assessment.

## Fixed work and boundaries

The fresh transient **user** service requests memory delegation, `DelegateSubgroup=attestor`,
no-new-privileges, no restart, control-group cleanup, a ten-second runtime, five-second
start deadline and two-second stop deadline. The helper reads its own manager properties,
placement, directory identity, delegation marker and available controllers. It writes no
cgroup controller, changes no existing hierarchy and reads no memory peak.

One existing Bubblewrap invocation must establish user, mount, PID, network, IPC, UTS and
cgroup namespaces. Optional `-try` namespace flags and privileged fallback are absent.
Only `/usr` and the two fixed probe inputs are read-only host mounts; proc/dev and the
small temporary paths belong to the sandbox. There is no home directory, user-manager
socket or cgroup filesystem. The sandbox receives a fixed environment, no inherited
nonstandard descriptors, no capabilities and no further user-namespace creation.

The [payload](../../scripts/loredock-namespace-prerequisite/payload.py) reads its own
namespace/security records, checks hidden host paths and read-only access, and attempts
only the expected-denied creation of another user namespace. It then allocates and
touches exactly 1,048,576 bytes in 256 pages, without forking or contacting any network.
Interpreter/runtime allocations are additional, unmeasured costs; this workload bound
is not a process-memory ceiling. No resource limit, pressure, cache manipulation or
application optimization is introduced.

The helper admits one service, one sandbox command and one payload. Bubblewrap may own
its normal monitor/PID-1 helpers; no complete peak process-count claim follows. The
service watchdog bounds their lifetime. The outer launcher has a 25-second deadline;
bounded terminal inspection/cleanup follows. Each captured stream is capped at 64 KiB,
each JSON record at 1 MiB and total retained first output at 2 MiB. Capture always reaps
its direct child, including on interruption. The manager watchdog still owns service
descendants if the outside caller disappears. An interrupted/missing final receipt is
unavailable, and the claim prevents a retry; no recovered record becomes a normal pass.

## Interpretation

`PASS` establishes only the recorded prerequisite checks. A known violated confinement
predicate is `FAIL`; inability to create the service/namespaces or retain required evidence
is `UNAVAILABLE`. Timeout, forced cleanup, an unknown terminal manager state or an unverified
group cannot pass. Cleanup is permitted only when the retained invocation matches the
manager's current invocation. Missing privileges never trigger host reconfiguration.

Every final report says `executorQualified: false` and `resourceQualification: false`.
The probe does not prove direct `clone3(CLONE_INTO_CGROUP)` birth, protected counter
descriptors, stable ancestor controls, creation-to-terminal peaks, orphan handling or
interrupted collector retention. It does not establish a complete sandbox policy for
arbitrary applications: `/usr` remains a shared read-only runtime, and the sealed binary
hashes are not a full operating-system image seal. No application or old resource family
is executed or rescored. Further work depends on the first result, not a retried profile.

Sixteen offline regressions run through one Node test. They cover exclusive claims,
bounded input/output, interruption/reaping, ownership/placement, terminal invocation
identity and confinement outcomes without contacting systemd or running Bubblewrap.

## Primary references

Systemd documents transient services and the synchronous pipe/wait mode in
[systemd-run](https://www.freedesktop.org/software/systemd/man/259/systemd-run.html).
Delegation and supervisor subgroup placement are defined in
[resource control](https://www.freedesktop.org/software/systemd/man/259/systemd.resource-control.html).
These online manuals identify 259.6; the installed 259.5 build must be checked by execution.
Bubblewrap's [security description](https://github.com/containers/bubblewrap/blob/main/README.md)
makes the sandbox policy depend on its arguments. The installed manual and distribution
profile are input observations, not evidence that the requested boundary actually worked.
