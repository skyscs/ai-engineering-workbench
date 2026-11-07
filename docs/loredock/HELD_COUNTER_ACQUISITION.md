# Bounded counter acquisition through retained descriptors

Task 158 adds a standalone [reader](../../scripts/loredock-held-counters/reader.py) for
already supplied parent/run/daemon/browser directory handles. It does not create a
hierarchy, contact systemd, launch a workload or establish ownership. The existing
[memory assessor](MEMORY_RECEIPT_ASSESSMENT.md) remains unchanged.

The caller supplies a boot identity and clock identity established by its own ownership
protocol. The reader validates their encoding and actual handle/name/mount consistency;
it cannot attest that the caller's declarations describe a trusted cgroup service.
Temporary regular-file fixtures are deliberately usable. A future live adapter must
independently establish the cgroup v2 mount, delegation, ancestor controls, process
lifetime and durable retention. Every observation keeps ownership, terminal, executor
and resource qualification false and declares itself offline-only.

## Handle and read boundaries

The reader requires exactly three scopes. It duplicates the four caller directory handles
with close-on-exec, requires read-only/non-inheritable descriptors, distinct identities,
matching directory owner/mount and the exact parent/run/{daemon,browser} topology.
Named entries are compared with held device/inode/type/owner identities; actual parent
entries and descriptor mount IDs are checked. The caller's handles and flags are unchanged.
Counter ownership need not equal directory ownership; this is not an invented permission
requirement for kernel interfaces.

Eight fixed interfaces per scope are opened read-only, no-follow, close-on-exec and
nonblocking: memory current/peak, swap current/peak, memory/swap events, cgroup events
and cgroup type. Pre-open, held and named identities must agree. Regular-file checks
reject symlinks, directories, devices and FIFOs without following or blocking. Open
failures remain explicit for this reader; a later appearing file is never reopened.
Identity conflicts are latched even if the old name is subsequently restored.

The [kernel documentation](https://www.kernel.org/doc/html/v7.0/admin-guide/cgroup-v2.html)
defines memory and swap peaks since group creation or the most recent reset through that
descriptor. The reader never writes or resets them. Descriptors stay open until explicit
close/context exit, but an open descriptor does not guarantee a removed group stays
readable. Name loss or a failed read remains unavailable evidence.

Each [pread](https://man7.org/linux/man-pages/man2/pread.2.html) request is at most 4 KiB.
A complete interface value is at most 4 KiB; one additional byte may be retained only
as an explicit overflow diagnostic, never as a complete raw value. Short reads are joined
without whitespace normalization. Errors retain a bounded exact prefix, errno, stage
and message. Invalid UTF-8 remains available as bytes, without fabricating a text scalar.
The observation has a 1-MiB serialized ceiling and no queue or cached final result.

## Observations and assessment

Each capture reads daemon, browser and then the direct root. It records interface windows
and encompassing scope windows on the supplied monotonic clock. Invalid/reversed clocks
invalidate the scope window while preserving independently read bytes. These are bounded
read windows, not simultaneous atomic snapshots. A `complete` interface flag means its
bytes/identity/encoding were complete; separate clock errors can still invalidate timing.

Each scope exposes a `snapshot` with the existing assessor's identity/window/raw shape,
plus independent per-interface byte records and errors. Only complete, unchanged interface
values enter raw fields. Missing/oversized/replaced reads are absent, never zero-filled or
copied from a previous capture. Successful fields survive a different failed read, allowing
the unchanged assessor to retain a known excess alongside missing evidence.

Returned metadata/errors are copies. Mutating a returned observation cannot change internal
identity checks. Closure attempts every owned descriptor even after one close error, reports
that error and leaves caller handles open. Construction failure/context exceptions also
close acquired handles. The API rejects capture after close or during another capture.

The reader does not label a capture as terminal, assert actual exits, fsync data or build
a full qualification receipt. A future adapter must persist the raw observation while
the same hierarchy exists, supply actual wait/empty-group evidence and read final roles
before the root. Ancestor controls and interrupted-collector/orphan qualification remain
separate obligations; ordinary startup and the product UI do not gain counter inputs.

## Verification

Twenty-eight Python regressions use temporary files, descriptor metadata and controlled
clocks/errors. They cover exact/short/oversized/invalid bytes, missing/denied reads, replaced
names during open/read, restored-name rejection, topology/mount identity, descriptor flags,
normal/exceptional/interrupted construction closure, partial close errors and returned-object
mutation. No actual cgroup counters or live service are read or created.

Four Node tests run those checks and pass compatible snapshots through the unchanged
assessor: a complete supplied receipt, a known excess alongside another unavailable final
counter, and a lost final peak despite an earlier complete value. Lifecycle, environment,
fsync and ownership declarations in those integration fixtures are explicitly synthetic.
A consistency pass supplies no live kernel/executor/resource acceptance.

Full local verification passes 1,212 Node tests, ten typechecks and ten final builds without
failures/cancellations/skips. All 148 emitted application/package modules and previous
consumed inputs/first evidence remain unchanged. The [retained verification](../fixtures/loredock-held-counters/README.md)
includes source hashes and seven closed logs. After exact-head CI acceptance,
[Task 159](../../tasks/159-loredock-held-counter-prerequisite.md) scopes one separate tiny
counter-lifetime integration; this reader is not connected to an application runtime.
