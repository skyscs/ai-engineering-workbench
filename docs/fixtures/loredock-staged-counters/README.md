# Staged counter reader verification

The [implementation](../../loredock/STAGED_COUNTER_ACQUISITION.md) is verified with temporary
regular files, descriptor metadata and injected clock/identity/read failures. Roles are created
after the original root capture. Tests retain the same root FDs while later setup charges grow;
they never read actual cgroup counters or start a service/native/sandbox/workload/model.

The records file binds three source files, the preparation record, accepted Task 160 complete
push/PR CI logs and four current closed logs: installation, first focused, reviewed focused and
full local verification. The first focused wrapper expected 24 Python cases while all 23 cases
then present passed. It reports one Node failure and is retained unchanged. Review adds five
boundary/race cases, verifies root continuity around role initial capture and rejects reentrant
close. The reviewed focused suite passes 28 Python cases and four Node checks.

Full local verification passes 1,225 Node tests (17/18/43/728/57/362), the new 28 and prior
16/28/4/18/34/20/20/16 Python cases, ten typechecks and ten final builds with no failures,
cancellations or skips. All 95 LoreDock / 148 total emitted application/package modules match
the retained Task 147 baseline. Tracked consumed implementations and evidence remain unchanged.

The Node receipt tests explicitly supply synthetic lifecycle/environment/fsync declarations.
Their compatible PASS is an offline representation check. Lost final fields remain unavailable;
a separately observed root breach still produces FAIL. No ownership, durability, executor,
terminal or resource qualification follows from these fixtures. Both complete exact-head CI
logs are required before accepting this task. Independent human semantic acceptance remains separate.
