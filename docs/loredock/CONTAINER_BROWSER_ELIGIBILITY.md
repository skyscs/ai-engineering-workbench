# Container browser eligibility: first preflight stopped before start

Status: first preflight failed; no container process or browser was started.

[ADR 0066](../decisions/0066-loredock-independent-browser-container.md) was accepted through
[PR #177](https://github.com/skyscs/ai-engineering-workbench/pull/177), head `54d7a9d`,
identical-tree merge `4acc21a`. Both complete CI logs pass 1,141 tests, ten typechecks and
ten final builds. Task 145's prospective implementation/plan was committed at
`d13b5a478606f2d20570c3ec914da94d9cdcb0e2` before staging, image construction or preflight.

## Implemented boundary

The [ordinary controller](../../scripts/loredock-container-browser/README.md) uses only a
new exact container ID returned by create. It persists that receipt before verifying image,
command, non-root user, security, namespaces, mounts and resource settings. Start is single-use;
ambiguous outcomes never trigger another start. Finite API deadlines and explicit interruption
handling retain unresolved cleanup. There is no workload discovery, name/port-based cleanup,
automatic restart/removal or mount of host home, configuration or the Docker socket.

A pinned PID-1 wrapper keeps the original kernel owner below PID 1, preserves its independent
wall/cleanup deadlines and records namespace/process/storage diagnostics. Small prospective
normal, TERM-resistant orphan and host-interruption probes precede any browser. The fresh
adapter retains original collector bytes and browser flags, declares its exact substitutions
and changes only the nominal RSS timer to 50 ms under the unchanged 100-ms actual limit.
The optional old sequential PSS diagnostic is omitted prospectively; it is never substituted
for the unchanged collector-inclusive summed RSS. No application code changed.

## Built image and first result

The public Python 3.14.4 Linux amd64 base is pinned by digest. Build inputs retain all 301
Task 143 Chrome files, exact Node 22.23.2 and explicit helper inputs: **326 files,
552,268,810 bytes**. All staged hashes remain unchanged. The first build exits 0 in
121,573.388 ms, confirms Python/Node versions, resolves browser/Node dynamic libraries and
records 7,259 image file/symlink entries (703,528,054 regular-file bytes). This is construction
metadata, not a memory measurement. The local built image is:

```text
sha256:772d3eb806a22a9a7a0094e7462ea8cf5c87c314d32c464dd2e7342d4a06500d
```

The first normal preflight creates container
`56e390f717ffd910f3ac65b95081426483414cee4cf9f8f0feb83bcddb2f534e`.
Create returns HTTP 201 with no warnings. Its inspect response records:

| Field | First observation |
| --- | --- |
| Status / Running / PID | `created` / `false` / `0` |
| Start attempts | **0** |
| AppArmorProfile | Empty string |
| Requested security options | `no-new-privileges`; no AppArmor or seccomp override |
| User / capabilities | `1000:1000` / all dropped |
| Network / root filesystem | `none` / read-only |
| Host controller elapsed | 34.243 ms |

The controller rejects the empty profile before authorizing start. Its `stoppedConfirmed`
receipt remains false because validation stopped early; it does not manufacture a successful
cleanup receipt. A separate read-only final inspect confirms the same unstarted state,
zero PID and unset start/finish timestamps. The object remains retained and must not be
started or repurposed. The orphan/interruption probes and browser control are unexecuted.
No measured browser first directory or concrete launch manifest exists.

This failure demonstrates a premature runtime-metadata assumption in the controller.
The server advertises AppArmor support, but no applied runtime policy was observed.
[Docker documents](https://docs.docker.com/engine/security/apparmor/) the default profile
for running containers and an explicit `apparmor=docker-default` request. That supports a
new prospective distinction between requested configuration and applied process security;
it does not authorize disabling or weakening a profile to continue this attempt.

## Evidence, verification and next action

The [retained evidence](../fixtures/loredock-container-browser/README.md) binds complete
build/CI/check logs, staged/helper inputs, immutable image/layer/dependency inventories,
create/inspect/error receipts and the final unstarted state. Large public runtime payloads
remain at their original local paths and in the local image; their hashes are published.
No user profile/cache or corporate source bytes enter these artifacts.

Nine focused synthetic controller/adapter tests and the full local check pass **1,150 tests**
(728 LoreDock, 287 scripts, 135 other package tests), ten typechecks and ten final builds,
with no failures or cancellations. Those regressions do not grant runtime eligibility:
the first actual preflight remains failed. Both complete exact-head CI logs are required
before merge. Product source/emission, original collectors/API and resource ceilings remain
unchanged. Daemon aggregate heap/startup and application/full-flow gates remain blocked.

[Task 146](../../tasks/146-loredock-container-security-lifecycle.md) corrects the security
lifecycle boundary on a fresh declared input/image/preflight set. It requires an explicit
default profile and applied security checks before child execution; any unexpected first
failure remains retained. No original control or container is retried.
