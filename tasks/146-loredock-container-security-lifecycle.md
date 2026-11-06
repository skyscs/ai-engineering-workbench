# Task 146 — Verify container security at the correct lifecycle boundary

Status: implementation and three actual preflights complete; the first launch attempt
fails input verification before Chrome starts. Full local checks pass 1,157 tests;
exact-head CI pending. See the [retained result](../docs/loredock/CONTAINER_SECURITY_RESULT.md).
Task 145 is accepted through PR #178, identical-tree merge `42830f5`, with both complete
CI logs passing 1,150 tests. Sixteen focused owner/adapter/applied-security/input regressions pass.
See the [prospective controls](../scripts/loredock-container-browser/README.md) and
[fixed plan](../scripts/loredock-container-browser/plan.json).

The consumed first attempt discovers a root-owned `0700` empty browser directory, reaps
its observer and stops cleanly with exit 1. There is no Chrome lifetime or RSS score.
[Task 147](147-loredock-container-input-readability.md) fixes directory ownership and
actual non-root input verification prospectively. No old attempt is retried.

Task 145's first preflight creates one object but sends no start request. Docker 29.7.2
returns an empty `AppArmorProfile` in state `created`; the controller's unconditional
`docker-default` comparison fails. No container process or browser ran. This observation
does not establish runtime enforcement or its absence. Preserve that object, its exact
receipts, first image/input/preflight paths and all old browser failures without retry.

1. Correct the state boundary with primary API/vendor documentation and recorded evidence.
   Explicitly request the existing `apparmor=docker-default` profile, as supported by
   [Docker documentation](https://docs.docker.com/engine/security/apparmor/), while retaining
   default seccomp, no-new-privileges, no capabilities, non-root execution and all existing
   mounts/namespaces. Never inspect or modify host profile files or daemon configuration.
2. Before start, verify exact durable ID, requested security options and every other fixed
   image/configuration/mount constraint. Treat unresolved runtime metadata explicitly.
   After start, require the resolved default profile and terminal state. Inside the pinned
   PID-1 wrapper, verify its own applied AppArmor label/enforcement, seccomp mode,
   no-new-privileges, UID/GID and effective capabilities before spawning the inner owner.
   No missing/unknown/unconfined value is a passing runtime receipt. Refused startup stops
   the candidate without a security fallback.
3. Add meaningful tests for created-versus-running/exited metadata, an explicit default
   request, wrong/unconfined profiles, missing applied-security receipts and cleanup after
   a failed post-start verification. Preserve one-start/exact-ID ownership and all deadlines.
4. Build a new prospectively recorded image/input set with the same Chrome/Node binaries
   and flags. Retain original dependency identities or document any concrete build change
   before execution. Use fresh Task 146 paths and new container IDs; never start, remove or
   repurpose Task 145's retained unstarted object. Freeze helpers/configuration before the
   fresh normal/orphan/host-interruption preflight. Keep first unexpected failures.
5. Only after all prerequisites pass, commit the concrete image, applied-security/exit
   receipts, input/adapter hashes and one exclusive thirty-second blank-control launch
   manifest. Keep 50-ms nominal/100-ms actual cadence, collector-inclusive 1-GiB RSS,
   storage and ownership limits unchanged. Execute at most one browser lifetime; no retry,
   PSS substitution, hidden metric change, application/model/corporate input or full-flow
   acceptance. Daemon aggregate-heap/startup qualification stays blocked.
6. Retain exact portable evidence and failures, update status/roadmap and review full local
   checks and both complete exact-head CI logs before merge. Scope the next action from
   the actual first result; no automatic numeric or security waiver follows.
