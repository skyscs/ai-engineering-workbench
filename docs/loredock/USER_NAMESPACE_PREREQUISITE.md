# Corrected user-service namespace prerequisite

Task 154 integrates the accepted [ownership-record validator](USER_SERVICE_OWNERSHIP.md)
into a separate [adapter](../../scripts/loredock-user-namespace-prerequisite/probe.py).
The Task 152 helper, inputs, claim and unavailable first result remain unchanged and consumed.
This is a correction to evidence acquisition on the same host, not another runtime/profile
trial. No application, browser, model, resource ceiling or cgroup controller write is involved.

## Sealed execution

Before the sole attempt, commit the candidate and seal a fresh manifest, dedicated unit,
first-output destination, helper/accepted support/validator/payload/canary/runtime hashes,
exact commands and independent expected outcomes. The adapter verifies fixed paths, non-root
identity, accepted dependency hashes, canonical manifest encoding and unchanged work bounds.
Dependencies are imported only after validation. The support copy is exactly the frozen
Task 152 module: only its bounded process capture, manager queries, fixed commands and payload
assessment are used. Its old ownership check and first-run entry are never invoked.

An exclusive, fsynced outside claim precedes the fresh-unit check and service request. A unit
must be explicitly absent with empty invocation/group and zero main PID. The service consumes
a second exclusive entry before collection and retains its manager-provided `INVOCATION_ID`
independently of the later receipt. No repeat, restart, failed-unit reset or profile fallback
belongs to this attempt. Missing capability ends the candidate path.

The unchanged service profile uses memory delegation, the attestor subgroup, no-new-privileges,
no restart, control-group cleanup and 10/5/2-second runtime/start/stop deadlines. The outside
launcher has 25 seconds before bounded terminal inspection. One fixed Bubblewrap command and
one fixed payload can run: required user/mount/PID/network/IPC/UTS/cgroup namespaces, read-only
`/usr` and probe inputs, private proc/dev/tmp, no home/manager socket/cgroup filesystem,
cleared environment, no capabilities or inherited nonstandard descriptors, and disabled
further user-namespace creation. The payload touches exactly 1 MiB in 256 pages. Interpreter
allocations are additional unmeasured costs; this is not a memory ceiling or measurement.

## Acquisition and retention

The adapter opens the exact hierarchy from the cgroup mount to the owned attestor with
read-only, close-on-exec, no-follow directory descriptors. It holds the chain through both
ordered acquisition snapshots and sandbox completion, and closes it on normal/error/interrupted
paths. Each snapshot rechecks every named ancestor against its held object, reads directory
and parent identities, retains fdinfo mount IDs and verifies the corresponding cgroup2 mount.
It reads available controllers through the held unit descriptor; memory must actually be
present. These reads change neither controller configuration nor memory counters.

Each snapshot separately retains the user-manager root query, exact unit properties, self
placement, own PID/start/UID/GID/boot identity, directory/mount records and controller text.
The complete required observation is durable **before** the optional delegation xattr read.
Missing/unreadable markers follow the accepted validator's diagnostic rules. Unexpected
errors retain earlier records, prevent sandbox admission and cannot erase a known applied
profile violation. A partial observation may support an offline assessment but never live
admission after a collector error.

Expected run/unit/UID/GID bindings come from the sealed manifest; the invocation comes from
the separately retained service entry. The monotonic clock identity binds `CLOCK_MONOTONIC`
to the observed boot UUID. Two consistent supplied snapshots alone grant no authority: the
adapter also owns the acquisition path and held descriptors, verifies actual fresh creation,
and preserves raw observations. This is a local trusted-helper observation, not protection
against a hostile same-UID process or a cryptographic attestation of systemd/kernel behavior.

Captured streams stay within 64 KiB each, individual JSON records within 1 MiB and total first
output within 2 MiB. Existing output entries must be regular files; publication is exclusive
and fsynced. Captured direct children are reaped even on interruption. The manager watchdog
continues to own service descendants independently of the outside process.

## Closure and interpretation

Retain terminal manager/invocation state and group absence or matching-identity empty events.
An explicitly unloaded unit has stricter zero-PID/empty-invocation/group requirements than a
loaded, stopped unit. Cleanup requires the retained invocation and exact current owned group;
a foreign or ambiguous service is never stopped. Forced cleanup fails. Timeout, missing final
observations, changed inputs or collector interruption cannot pass. No late read rewrites an
earlier unavailable assessment.

Every final report explicitly declines executor and application resource qualification.
Even a passing namespace prerequisite does not prove direct measured process birth, protected
counter ownership, terminal peaks, ancestor stability, orphan/interrupted-collector lifetime,
application timing/resources, semantic quality or the Workbench bridge. `/usr` remains a shared
read-only runtime; executable hashes do not seal the complete operating-system image.

Twenty offline adapter regressions cover the prospective boundaries and a successful mocked
admission. They contact no service manager or sandbox. One tiny ordinary Python child checks
descriptor inheritance through the accepted capture helper; temporary directory descriptors
exercise replacement and closure. The old sixteen transport/payload tests and twenty pure
ownership cases remain separate checks.

The versioned [systemd-run source](https://github.com/systemd/systemd/blob/v259.5/src/run/run.c#L113)
uses the fail job mode. The manager's
[transient creation path](https://github.com/systemd/systemd/blob/v259.5/src/core/dbus-manager.c#L1046)
requires a pristine unit before conversion. This supports the fresh-service design; upstream
v259.5 is not a byte-for-byte attestation of the installed distribution build.
