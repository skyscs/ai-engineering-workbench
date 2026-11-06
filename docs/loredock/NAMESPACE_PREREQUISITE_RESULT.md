# First namespace prerequisite: unavailable before sandbox creation

The Task 152 candidate `b1ac7b1c092e73c20a31dc5e3ea6f5ebe78b04b3` requested exactly one
dedicated user service. It stopped on `getxattr(user.delegate)` with `ENODATA` (61),
before creating a sandbox or running the payload. The first result remains `UNAVAILABLE`.
This is not a namespace failure, a memory result or evidence that user delegation is absent.

The [retained first evidence](../fixtures/loredock-namespace-prerequisite/README.md)
includes the prospective seal, exact helper/payload copies, first outputs, closed launcher
and subsequent read-only terminal review. The first manifest SHA-256 is
`a40c05afe1a5716662e472dbc2c8cd71c9d4b66df0cfdef8101c32921c29f9e6`.

| Observation | First result |
| --- | --- |
| Service | `loredock-task152-ce509e4b-9abc-4c4e-b8be-c780dfb67e52.service` |
| Manager invocation | `6bed74c3015c40148ee518843f77ab3c` |
| Launcher / service exit | 1 / 1; no timeout or forced cleanup |
| Outer elapsed time | 2,069,718,275 ns; diagnostic only |
| Applied terminal properties | `Delegate=yes`, memory controller, attestor subgroup, no-new-privileges, fixed watchdogs, no restart, control-group cleanup |
| Ownership marker | Missing `user.delegate`; initial ownership receipt not established |
| Sandbox / payload invocations | 0 / 0; explicit 1-MiB payload allocation not reached |
| Retained first output | Six files, 4,020 bytes |
| Final service state | Same invocation, `failed`, `MainPID=0`, empty `ControlGroup`; claimed group path absent |

The original `ownedGroupEmpty: false` means the helper had not established initial
ownership and could not complete that proof. It is not a positive survivor observation.
The separate terminal review confirms the same closed manager invocation and absent
claimed path, without rewriting the first assessment or granting executor qualification.
The failed unit is retained; no reset, restart, profile change or fallback occurs.

## Cause and evidence limit

The probe made an incorrect assumption about marker availability for user services.
In upstream systemd v259.5, `cgroup_xattr_apply` returns for a non-system manager before
calling `cgroup_delegate_xattr_apply`. See the
[versioned source](https://github.com/systemd/systemd/blob/v259.5/src/core/cgroup.c#L975),
blob `1708e46b7fe1d8765b4a4976ac9fda86298c7a8b`. This explains the observed missing
marker without establishing a delegation or namespace permission failure. The source
review is consistent with the installed `259.5-0ubuntu3.4`; it is not a byte-for-byte
attestation of that distribution binary. No kernel/manager configuration change is warranted.

Manager properties and placement were checked before the xattr read, but the helper
wrote its ownership receipt only afterward. Therefore the initial complete manager record
was not retained. The final manager record and service entry preserve the invocation and
applied properties; they cannot retroactively supply the missing acquisition receipt.
Future acquisition must retain those independent observations before optional reads.

The launcher also printed service-manager accounting, including a 22.3M memory display.
That describes the service/helper scope, has display rounding, and is not any accepted
daemon/browser/run charged-memory observation. There were no LoreDock, Chromium, model,
corporate-source or application-resource runs. All historical failures remain unchanged.

## Next correction

[Task 153](../../tasks/153-loredock-user-service-ownership.md) fixes the ownership evidence
model offline. It will require manager-issued identity, current placement and stable
directory records rather than treating an optional marker as universal. It cannot grant
live trust from self-reported properties. This is a correction to the helper's predicate;
the current first attempt stays consumed and unavailable. Another live prerequisite needs
its own separately accepted scope and seal after the correction is verified.
