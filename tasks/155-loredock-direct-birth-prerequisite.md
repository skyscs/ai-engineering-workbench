# Task 155 — Prove direct measured process birth once

Status: planned after Task 154 acceptance. Its first namespace prerequisite passes; no
complete resource executor or direct cgroup birth is qualified yet.

1. Review the installed kernel ABI and existing compiler availability without running a
   process in a measured group. Design a minimal owned native helper for
   `clone3(CLONE_INTO_CGROUP)` with actual child identity/exit observation. Pin source,
   build command/toolchain and executable bytes; do not install a replacement runtime or
   change host permissions/profile. Missing support ends this candidate path.
2. Reuse accepted acquisition concepts in a separate adapter, preserving all consumed
   Task 152/154 helpers, seals and first evidence. Create only a fresh delegated user service
   and explicitly owned descendants. Never reuse or modify the terminal/user-manager root.
   Enable accounting only inside the newly owned boundary when needed; impose no memory,
   CPU, swap or reclaim limits and create no pressure.
3. Create the fixed payload process directly in a fresh owned measured group. Spawning then
   migrating is forbidden. Retain target/parent/held-descriptor identity and actual child
   placement before payload execution. Close control descriptors before entering the same
   required namespace boundary; sandbox-visible descriptors and paths cannot expose cgroup
   controls or the service-manager socket. Explicitly account native control/monitor roles.
4. Keep one service, one fixed sandbox/payload and one 1-MiB touched allocation, the same
   10/5/2-second service profile and 25-second outside launcher bound, 64-KiB streams,
   1-MiB records and 2-MiB retained first output. Verify actual direct-child exit, ordered
   terminal group observations and durable evidence before service exit. Any counter reads
   are tiny-prerequisite diagnostics, never an application resource result. No application,
   browser, model, corporate source, runtime fallback or old-family rerun is included.
5. Test syscall errors, mismatched/replaced target identity, descriptor inheritance,
   interruption, child/collector failure and cleanup before the live attempt. Include a
   positive mocked path. Run full checks and review all native/process boundary code before
   committing and sealing the sole prospective attempt. The first result remains consumed
   on failure; a real capability failure ends this path without environment tuning.
6. Retain accepted Task 154 CI and the full first evidence. Review both complete exact-head
   CI logs before merge. A direct-birth pass still cannot qualify protected counter lifetime,
   orphan/interrupted-collector handling, full application resources/timing, semantic quality
   or the Workbench bridge; scope subsequent work from the actual retained result.
