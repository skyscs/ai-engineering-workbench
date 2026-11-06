# Prospective container input readability

Task 147 follows the [retained Task 146 result](../../docs/loredock/CONTAINER_SECURITY_RESULT.md).
All three security/lifecycle preflights passed, but input verification stopped the first
blank attempt before Chrome started: an empty `0700` directory was copied with root
ownership. Every earlier image, object, attempt and claim remains retained without retry.

The new Dockerfile uses `COPY --chown=1000:1000` for the exact browser input tree.
[Docker documents](https://docs.docker.com/reference/dockerfile/#copy---chown) that ordinary
COPY creates root-owned files. It copies directory contents rather than the source root;
therefore the new image explicitly preserves the recorded root mode `0775` and owner.
Nested directory modes, all Chrome/Node file bytes, browser flags and default security
remain unchanged. Only the newly built image changes; no host toolchain permissions do.

`prepare.py` records the complete source/staged browser directory set, including the root
and empty directories, with type, mode and UID/GID. It rejects symlinks and verifies every
original file hash/mode before staging. The runtime manifest separately declares the
canonical `/` and `/opt` parents. Whole-image file inventory remains build-time metadata;
it does not assert identity for Docker's runtime-injected `/etc` files.

`inputs.mjs` verifies this metadata, rejects redirected roots/parents/children, checks
actual read/traverse access as UID/GID1000 and reads every file through the unchanged
hash verifier. Directory identity is checked again after hashing. The same function runs:

- during image construction after `USER 1000:1000`, without launching Chrome;
- before the normal/orphan/interruption probes create their synthetic children;
- before and after the actual blank-browser lifetime.

Each runtime check records the control-manifest digest, directory observations and file
counts. Both preflight and the exclusive launcher require matching successful non-root
receipts. Missing, failed or mismatched input verification cannot authorize a browser.
The consumed Task 146 launch manifest remains in accepted Git history and the immutable
[receipt archive](../../docs/fixtures/loredock-container-security/README.md); it is removed
from the active launcher path and excluded from future staged helper inputs. A concrete
Task 147 manifest may be committed only after the new prerequisites pass.

Fresh exclusive roots are `/home/toshiba/aew/task147-image-inputs-first`,
`/home/toshiba/aew/task147-image-build-first`,
`/home/toshiba/aew/task147-container-preflight-first` and
`/home/toshiba/aew/task147-container-browser-first`. The [fixed plan](plan.json) preserves
one-start exact-ID ownership, applied default AppArmor/seccomp, no capabilities,
no-new-privileges, non-root execution, network isolation, read-only root and one evidence
mount. The original kernel owner stays below PID1; all wall/cleanup deadlines remain.

No browser launch is authorized by this preparatory commit alone. After a verified image,
three passing input/security/lifecycle prerequisites and a committed concrete manifest,
consume at most one thirty-second blank lifetime. Retain 50-ms nominal/100-ms actual
cadence, collector-inclusive 1-GiB summed RSS, 2-GiB storage and 64-MiB private shm limits.
No retry, metric substitution, application/model/corporate input or full-flow acceptance.
Daemon aggregate-heap/startup qualification remains blocked.
