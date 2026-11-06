# Task 152 — Check the namespace prerequisite once

Status: implementation in progress; no live attempt yet.
Task 151 is accepted through PR #184, head `902c98f`, identical-tree merge `a42a006`.
Both complete CI logs pass 1,202 tests, ten typechecks and ten final builds.

Implement the smallest live prerequisite for ADR 0068's candidate: one fresh transient
user service with explicit memory delegation and an attestor subgroup, then one existing
non-setuid Bubblewrap invocation. This tests namespace availability and a small confinement
boundary before investing in direct-birth/counter ownership. It does not implement or
qualify the resource executor. Do not start LoreDock, Chromium, a model or corporate code.

1. Pin the helper/payload/runtime hashes, command, service name, first-output path,
   environment allowlist and expectations before execution. Consume one durable exclusive
   claim before requesting the service; never retry that attempt or choose another profile.
2. Verify the service invocation, current placement and delegation marker before sandbox
   creation. Request no new privilege, use the existing unprivileged user manager and
   preserve host security. Do not write cgroup controls, use an existing terminal group,
   change host settings, install a profile or fall back to another runtime.
3. Require distinct user/mount/PID/network/IPC/UTS/cgroup namespaces. Expose only read-only
   runtime/probe inputs plus private proc/dev/temporary paths. Clear the sandbox environment,
   drop capabilities, close inherited control descriptors and prevent further user namespaces.
   Verify non-root identity, no-new-privileges, absent host/control paths and read-only input.
4. Use exactly one fixed payload, no fork or network operation, and a 1-MiB explicitly
   touched allocation. This is bounded synthetic work, not a process-memory ceiling or
   charged-memory result. Admit no arbitrary child command. Allow at most one service,
   one sandbox invocation and one payload; runtime-internal helpers are disclosed.
   Service runtime is 10 seconds, start timeout 5 seconds, stop timeout 2 seconds; outer
   watchdog is 25 seconds. Cap each captured stream at 64 KiB, individual records at 1 MiB
   and retained first output at 2 MiB. No application resource/CPU/heap limit is imposed.
5. Retain actual subprocess exits, initial manager/placement evidence, first stdout/stderr,
   terminal unit/hierarchy state and the first assessment. Cleanup may target only the
   exact invocation established by the retained ownership receipt. Timeout/forced cleanup
   cannot pass. Missing capabilities terminate this path as unavailable, with no host tuning.
6. Test ownership, immutable first-attempt admission, bounded capture and result validation
   without systemd/Bubblewrap execution. Run focused and full checks, inspect the entire diff,
   then seal and execute the single prerequisite. Archive its first result and accepted
   Task 151 CI evidence. Review both complete exact-head CI logs before merging.

A successful prerequisite still leaves direct `clone3` birth, protected counter ownership,
ancestor controls, retained peaks, orphan/interrupted-collector cases and complete executor
qualification unproved. Scope that next lifetime only after this task's result is accepted.
If prerequisites are unavailable, retain the result and return to bounded independent
functional work under the existing roadmap. Existing exhausted families remain untouched.
