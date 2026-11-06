# Offline user-service ownership records

The [pure Python validator](../../scripts/loredock-user-service-ownership/assess.py)
corrects the evidence model after the [Task 152 first result](NAMESPACE_PREREQUISITE_RESULT.md).
A user-manager service does not require a `user.delegate` xattr to have internally
consistent delegation records. A marker, a writable path or a matching service name
alone cannot establish ownership. The consumed Task 152 helper remains unchanged.

`assess_ownership_receipt(serialized, expected)` validates supplied records only. It
imports `json` and `re`; there is no filesystem, manager, process, network or cgroup access,
CLI or application integration. Even a `PASS` always returns `offlineOnly: true`,
`ownershipEstablished: false`, `executorQualified: false` and `resourceQualification: false`.
It returns no descriptor, capability or permission to change the hierarchy.

## Representation and bounds

The representation is `loredock-user-service-ownership/1`, bound to the unchanged adopted
[resource contract](observable-resource-contract-v2.json). Input is at most 1 MiB of UTF-8
in the producer encoding `json.dumps(value, separators=(",", ":"), ensure_ascii=True,
allow_nan=False)`. This is not RFC 8785. Duplicate keys, alternate encodings, NaN/infinity,
invalid Unicode and excessively deep/malformed data are unavailable. Raw unit properties
are bounded to 4 KiB. Numeric kernel identities and monotonic values use canonical unsigned
64-bit decimal strings; PIDs additionally fit positive signed 32-bit values. Unix IDs are
exact integers, with nonzero expected UID/GID; booleans/floats are not integer substitutes.

The caller's separate expected binding contains `runId`, `candidateSha256`, `unit`, `uid`,
`gid`, `invocationId`, `bootId` and `clockId`. The UUID-bearing dedicated service name must
end in the expected run UUID and `.service`. A dynamic invocation binding must come from
an independently retained launch/manager observation, not a field selected by the supplied
receipt. The pure module cannot authenticate how its caller obtained that binding.

| Record | Required contents |
| --- | --- |
| Top level | `schemaVersion`, `contractSha256`, exact `subject`, `acquisition`, `before`, `after` |
| Acquisition | `unitAbsentBeforeRequest`, `exclusiveClaim`, `attempt: 1`, decimal `openedAtNs`/`retainedAtNs`, `recordsRetained`, `descriptorsHeld` |
| Observation | `window`, `manager`, `unitRaw`, `placementRaw`, `process`, `directories`; optional `marker` |
| Window | Decimal `fromNs`/`toNs` and the expected `clockId`; ordered and inside acquisition/retention |
| Manager | `kind: "user"`, exact UID and `/user.slice/user-UID.slice/user@UID.service` |
| Process | Positive decimal PID/start ticks, exact UID/GID, boot UUID and invocation ID |
| Directories | `parent` (`app.slice`), dedicated `unit`, and its `attestor` child |
| Directory identity | Exact `path`, `device`, positive decimal `mountId`/`inode`/`parentInode`, UID/GID and `held: true` |

The [invented fixtures](../../scripts/loredock-user-service-ownership/test_assess.py)
show complete examples. They are not actual manager or kernel observations.

Unit properties retain exact newline-terminated `key=value` text. Require `Id`,
`LoadState`, `ActiveState`, `SubState`, `Result`, `InvocationID`, `MainPID`, `ControlGroup`,
`Delegate`, `DelegateControllers`, `DelegateSubgroup`, `NoNewPrivileges`, `RuntimeMaxUSec`,
`TimeoutStartUSec`, `TimeoutStopUSec`, `KillMode` and `Restart`, without duplicate/unknown keys.
The profile requires a loaded, active/running service with a successful current state,
matching main/self PID, memory delegation, the attestor subgroup, no-new-privileges,
no restart, control-group cleanup and the same 10/5/2-second runtime/start/stop deadlines.
Supported duration renderings use descending, nonduplicated integer `w`, `d`, `h`, `min`,
`s`, `ms`, `us` components, `0`, or `infinity`; compare exact microseconds. Unknown value
formats are unavailable, not invented setting violations or zero. These are the already
declared prerequisite deadlines, not revised application resource limits.

Self placement must be exactly the owned attestor path in one unified cgroup line.
Parent/child directory links must agree without cycles or reused identities. All three
directories share device/mount identity; the owned unit and attestor belong to the expected
UID/GID. Before/after process, property and directory records must remain stable. Read
windows do not assert an atomic sampling instant or continuous OS observation.

## Optional markers and outcomes

An omitted marker becomes an explicit `not-read` diagnostic. Supported records are
`{"state":"not-read"}`, `{"state":"missing","errno":61}`,
an `unreadable` record with errno 1, 13 or 95, or `{"state":"value","value":"1"}`.
Known absence/access/unsupported errors do not invalidate the required manager evidence.
An explicit `"0"` conflict or unexpected marker/error representation remains unavailable
and visible. A positive marker never substitutes for any required record.

`PASS` means the supplied consistency/profile predicates hold. `UNAVAILABLE` means missing,
ambiguous or inconsistent evidence. `FAIL` retains a recognized applied security/watchdog/
cleanup/restart violation attributed to matching supplied unit/process identities. Unknown
setting syntax is unavailable. Known failures survive separately missing later records;
all reasons remain visible. None of these labels authenticates the manager/kernel source,
actual exclusive claim, held-descriptor lifetime, permissions or executor confinement.

## Required future collection order

A future live adapter must retain its first request/claim before asking for the service.
Collect and durably retain manager invocation/properties, process placement/start identity
and held directory metadata **before** reading optional xattrs. Save every available record
even if a later read fails. Do not delay the complete acquisition record until an optional
observation succeeds. Retain a second ordered identity snapshot and the acquisition receipt
before admitting any measured application. Descriptor continuity and actual exclusive
ownership still need an independently verified live implementation; asserted booleans and
matching copied text cannot supply that proof.

Task 153 runs twenty prospective offline scenarios, including absent markers, conflicting
manager/process/directory identities, cycles, unknown values, strict bindings and bounded
malformed input. It creates no service or namespace and does not reassess Task 152's missing
acquisition evidence. Integration into a new sealed tiny prerequisite is a later task.
The [retained logs and case mapping](../fixtures/loredock-user-service-ownership/README.md)
separate prospective expectations, final verification and superseded development history.
