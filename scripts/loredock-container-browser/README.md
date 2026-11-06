# Prospective container security and browser control

Task 146 follows [the retained Task 145 failure](../../docs/loredock/CONTAINER_BROWSER_ELIGIBILITY.md).
The original image, unstarted object and first paths remain unchanged. This revision uses
fresh Task 146 paths and explicitly requests the existing default AppArmor profile.

The running Docker daemon reports source commit `6a43e3d`; the exact
[start implementation](https://github.com/moby/moby/blob/6a43e3d5afddf4111da0f864bbc7cae5d7e95001/daemon/start.go#L181)
calls profile configuration during start. The
[profile selection](https://github.com/moby/moby/blob/6a43e3d5afddf4111da0f864bbc7cae5d7e95001/daemon/container_linux.go#L10)
resolves the requested/default profile. The
[OCI process configuration](https://github.com/moby/moby/blob/6a43e3d5afddf4111da0f864bbc7cae5d7e95001/daemon/oci_linux.go#L124)
applies it to execution. The first empty created-state field is consistent with that order.
No host policy/profile/configuration file was inspected or modified.

The exact-ID owner still persists create before one start and verifies all fixed requested
configuration, user, security, namespaces, mounts and resource settings. An empty applied
profile is unresolved metadata only on an unstarted created object. The explicit requested
`apparmor=docker-default` remains mandatory. Runtime metadata must resolve to that profile;
a wrong/missing/unconfined runtime value fails. Cleanup separately confirms actual stopped
state for the already verified object without treating failed security as a passing control.

Before spawning the frozen kernel owner, PID 1 records its own applied AppArmor label and
process status, requiring `docker-default (enforce)`, seccomp mode 2, no-new-privileges,
UID/GID 1000 and zero inheritable/permitted/effective/bounding/ambient capabilities.
Missing or relaxed values stop child execution. Preflight revalidates the raw receipt.

`prepare.py` stages a clean committed candidate exclusively at
`/home/toshiba/aew/task146-image-inputs-first`. The exact Chrome/Node files and original
collectors stay unchanged. The new image must retain the original dependency layer or
record a concrete prospective difference. Image config/layers, runtime/dependency files,
source/input hashes and complete build logs precede any browser control.

`preflight.py` runs one normal/orphan/host-interruption set at
`/home/toshiba/aew/task146-container-preflight-first`. The orphan ignores TERM; successful
preflight requires real pidfd KILL/wait receipts and no survivors. Host interruption must
propagate through Docker/PID 1 to the actual inner owner, and Docker stopped state is
inspected. Expected induced failures stay explicit. Unexpected first failures stop the set.

The [fixed plan](plan.json) retains all limits: 120-second inner owner, ten-second grace,
five-second forced-exit wait, 150-second wrapper, 160-second host and five-second API calls.
There is no restart, automatic removal, name lookup, host profile/socket mount or privileged
mode. Runtime network is disabled; the browser debugging endpoint stays on private loopback.
Evidence and private-shm storage are observed together under the same 2-GiB ceiling.

Only after these prerequisites pass may a committed concrete manifest authorize one fresh
thirty-second blank browser lifetime. The unchanged adapter varies only import/page
relocation and the 50-ms nominal timer; actual gaps must remain at most 100 ms and browser
collector-inclusive summed RSS at most 1,073,741,824 bytes. Separate namespace/outer-owner
observations do not change that metric. No browser run is authorized by this preparatory
commit alone. No daemon, application UI, model or corporate source runs; daemon resource
qualification stays blocked. Preserve every first failure without retry or fallback.
