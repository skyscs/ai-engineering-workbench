# ADR 0066 — Own a separate browser control in a pinned Linux container

Status: accepted design; environment construction and the first control belong to Task 145.

## Context and scope

Task 143 is accepted through [PR #176](https://github.com/skyscs/ai-engineering-workbench/pull/176),
head `3bf786a1d5d20e023b6510a9b6c631ca46755abc`, identical-tree merge
`86d1908a7ca8c4030e78edd5ea72253cb7a9fdab`. Both complete CI logs pass 1,141 tests,
ten typechecks and ten final builds. Its [first blank control](../loredock/PINNED_BROWSER_ELIGIBILITY.md)
fails summed RSS at 1,937,039,360 bytes and the actual sampling gap at 103.099 ms.
Task 134's system-browser failure also remains failed. Neither observed extension-process
flags nor a lower sequential PSS sum establishes a cause or repairs either result.

Choose a separate local Linux container for one prospective blank-page control with the
same browser binary and flags. This is test infrastructure, not a product dependency or
Workbench service orchestration feature. Do not inspect or modify the user's profiles,
extensions, machine policy, security controls or ordinary checkout. No corporate input,
application server/page, models, repaired host score or full-flow acceptance is involved.
Daemon aggregate-heap/startup qualification remains blocked under [ADR 0065](0065-loredock-resource-observation-boundary.md).

## Read-only environment decision

The [retained audit](../fixtures/loredock-browser-environment/README.md) records only Docker
`GET /version` and `GET /info`, executable/socket availability and public registry metadata.
The local server reports Docker 29.7.2, API 1.55, Linux amd64, kernel 7.0.0-38-generic,
cgroup v2/systemd, AppArmor and the built-in seccomp profile. The socket is accessible.
It does not advertise rootless operation. A non-root container user does not make the
daemon rootless. No images/workloads were listed, pulled, built, created or started.

| Environment | Evidence and limitation | Decision |
| --- | --- | --- |
| Existing host browser installations | Two retained controls exceed the unchanged RSS ceiling | Do not tune or rerun |
| Existing local Docker server | Accessible API and required namespace/security facilities; runtime compatibility untested | Candidate for Task 145 |
| Separate hosted CI browser control | Different kernel/image and runner ownership would need another exact manifest | No automatic fallback |
| New rootless runtime or host namespace/security reconfiguration | No installed Podman/nerdctl/buildah; no need to alter the host to test this candidate | Outside this task |

Docker documents separate filesystem, network and process namespaces and digest-addressed
images in [Running containers](https://docs.docker.com/engine/containers/run/).
The inference is limited to that declared container boundary: the host kernel/daemon remain
shared trusted infrastructure. Container eligibility would apply only to the recorded
environment, not the user's desktop browser or application workload.

Pin the official `library/python:3.14.4-slim-bookworm` Linux amd64 manifest:

```text
docker.io/library/python@sha256:db5942d111df72110e7a67da3fc5159e83ac85cd24808b91bdc4769e166ed1b7
```

The public OCI index, platform manifest and config bytes were retrieved and checked
against content digests. Config declares Python 3.14.4; no runtime execution follows
from that metadata. Task 145 must also freeze the built image ID/config/layers, installed
dependency versions and file inventory, Python executable and runtime checks before the
browser lifetime. Do not run a moving tag or rebuild after seeing the control result.
Build-time package retrieval is separate from the network-disabled measured runtime.

Copy the existing full Chrome for Testing 157.0.8103.38 installation, verifying all 301
files against Task 143; executable SHA-256 is
`41ea350a7f209da77c14d1df3924d71ac66988623e71d44459b49a3dceb1c14e`.
Copy the exact Node 22.23.2 executable, SHA-256
`3517c2df0b2f8cd7f422b4b8450ef81c6889f08eb03e281d6de9079b15e6a327`.
Retain all dependency/build failures. A missing capability stops this candidate; it does
not authorize a different browser, root execution or relaxed container security.

## Container boundary and ownership

Use a non-root UID/GID, all capabilities dropped, `no-new-privileges`, the default
seccomp/AppArmor protections, private PID/cgroup/IPC namespaces, read-only root filesystem,
`network=none`, no exposed ports, no devices and no restart policy. Preserve the
[default seccomp boundary](https://docs.docker.com/engine/security/seccomp/); no unconfined
fallback. Keep the existing browser flags, including its already-declared `--no-sandbox`;
do not add extension, process-count, heap, shared-memory or memory-reduction switches.

Bake only audited helper files, runtimes and browser inputs into the image. Bind one fresh
dedicated evidence directory; do not mount the host home, browser configuration, whole
repository or Docker socket. Route fresh home, cache, profile and temporary files beneath
that evidence root. Keep private `/dev/shm` at Docker's declared 64-MiB default and account
for its observed bytes separately alongside evidence storage against the unchanged 2-GiB
total. Freeze the exact layout and permissions before launch. No CPU/memory pressure limit
may be used to manufacture a passing RSS value. Preserve complete stdout/stderr in owned
files; disable daemon-side log duplication and rotation for this dedicated container.

The Docker daemon creates the container's processes: they are **not** descendants of the
host controller. Host PID ancestry cannot authorize their cleanup. Use two explicit owners:

1. The host controller writes an exclusive intent/nonce, then calls
   [create without start](https://docs.docker.com/reference/cli/docker/container/create/).
   Persist and fsync the returned full container ID before start; inspect that exact ID
   and verify image, label/nonce, user, command, mounts and security configuration. Never
   select or remove a container by name, port, executable or a list of existing workloads.
   A conflict or ambiguous create response stops the attempt without retry/start. At most
   an unstarted object may remain; preserve uncertainty for recovery.
2. Inside the private PID namespace, a small pinned PID-1 wrapper starts the unchanged
   Python kernel owner as a child. **Do not make that owner PID 1**: its ancestry walk
   intentionally stops at PID 1. The wrapper forwards interruption and waits for actual
   exit; it must not return while its owner is alive. The inner owner retains its independent
   120-second wall limit, ten-second grace and existing five-second forced-exit wait.
   Its child-subreaper, PID/start identity and pidfd signaling remain unchanged. A separate
   150-second wrapper deadline bounds an unavailable inner owner. Exiting PID 1 terminates
   the private namespace; report missing cleanup evidence as failure, never success.

All host Docker API calls have explicit finite deadlines. Host interruption or ambiguous
start requires bounded inspect/stop/kill of the **already verified exact ID** only. No second
start is allowed. Capture every request outcome and actual terminal inspect state; Docker
CLI exit alone does not prove browser exit. If the host controller disappears, the inner
deadlines still operate. An unavailable daemon means cleanup is unconfirmed, not complete.
Retain the stopped container until records and mount contents are verified; removal, if
needed, targets only its durable verified ID. Never enable automatic removal or restart.

Before the browser control, test PID-1 forwarding, inner ancestry/signaling, host interruption,
ambiguous API responses and real stopped-state verification with small non-browser fixtures.
Container capability probes are separate retained preflight executions, not resource scores.
Do not start a browser if these prerequisites fail under the declared security settings.

## Observation and first-result boundary

Keep the original browser lifetime collector and prepared-flow files byte-for-byte. A new
hashed adapter may relocate imports, select `about:blank` and change only the nominal
RSS timer from 100 to **50 ms**. Freeze every replacement and its source/output hashes.
The actual maximum sample-start/startup/exit gap remains **100 ms**; startup/end gaps,
incomplete samples and sequential process-read limitations remain explicit. No timestamp
filtering, zero-filling, baseline subtraction, PSS substitution or continuous-peak claim.

The unchanged acceptance metric includes the browser lifetime collector and all its owned
descendants. Keep its complete RSS sum under **1,073,741,824 bytes**. Record outer wrapper,
kernel owner and Node observer overhead separately; do not silently redefine the old tree
scope, subtract shared pages or call a namespace total the same metric. Private-namespace
census is an additional cross-check, not permission to omit a browser descendant.

[Task 145](../../tasks/145-loredock-container-browser-eligibility.md) commits concrete image,
adapter, owner and input manifests before one exclusive thirty-second blank control.
Keep raw clocks/process records, exact before/after hashes, input copies, first failures
and actual exit receipts. Any over-limit result, missing sample/process/ownership evidence
or changed input fails eligibility. No browser retry, flags/binary fallback or late ceiling
change. A pass permits planning a separate application-page control only; it does not open
the blocked daemon or full-flow gates. A failed preflight or control yields its concrete
finding and the next separately reviewed scope.

## Validation of this decision

This task changes documentation and retains read-only metadata and accepted Task 143 CI
logs. Validate local links, digests, unchanged product/frozen collector/API bytes and both
complete exact-head CI logs before merge. It does not install/build/run a container or
browser and adopts no change to numeric limits or resource coverage semantics.
