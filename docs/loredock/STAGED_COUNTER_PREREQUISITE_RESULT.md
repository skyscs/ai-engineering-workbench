# Creation-ordered counter prerequisite result

The sole Task 162 attempt is consumed and **PASS** for this tiny prerequisite. Acquisition,
native/payload checks, staged publication consistency and the unchanged memory assessor pass.
This is not full executor, application resource/timing, semantic-readiness, L5 or bridge acceptance.
All executor/resource qualification flags remain false. The prior Task 159 UNAVAILABLE remains
unchanged; its first entry was not retried or rewritten.

## Binding and scope

- Candidate: `c8e5c4b6c540ddcaa7ed239931ab78626745dbe1`.
- Manifest SHA-256: `1c09c6e5d4ed09523260d377cac4079efb6e9c0988585cda014165c2a7a103cb`.
- Unit: `loredock-task162-8076fe24-bfbf-416f-9b62-d7e3568642a6.service`.
- Invocation: `de96cc705d44422d8c4580a3f95c5867`.
- Boot: `47535de3-7236-47d4-b5e8-231c3b313885`.
- Root: mount 48, device 0:30, inode 117865, parent inode 117782.
- Daemon/browser: inodes 117943/117982 under that same root; both are empty prerequisite roles.
- Probe target: device 30, inode 117904; actual direct child PID 379496, start ticks 39944537.

Exactly one service, native execution, clone3, sandbox and payload ran. The fixed synthetic
payload allocated 1,048,576 bytes and touched 256 pages. No application, browser, model or
corporate code ran. There was no timeout, forced kill/cleanup, stop/reset/restart, fallback,
second capability probe, controller reset, host tuning or change of runtime/security profile.

The native executable is byte-identical to Task 157:
`0604c465eb6a6397c411f30c0d53ca95e368a573a6cc49339cb4657d730ee3a3`.
The sealed build records 178 observed compiler/header/linker inputs. The original runtime
binaries, existing profile file and relevant user-namespace settings match the recorded pins;
before/after launch checks report unchanged inputs. Profile file presence alone is not loaded
policy proof; the actual namespace/permit/payload observations remain the boundary evidence.

## Counter and publication result

All 8 root initial, 16 role initial and 24 final interfaces are complete. Every returned
read identity matches its original binding. The root binding is unchanged across attachment;
the accepted reader retains its original read-only FDs. No data, identity or clock error occurred.

| Scope | Initial current / peak bytes | Final current bytes | Final peak bytes |
| --- | --- | --- | --- |
| Run | 0 / 0 | 1,617,920 | 8,667,136 |
| Daemon, empty | 0 / 0 | 0 | 0 |
| Browser, empty | 0 / 0 | 0 | 0 |

Every initial/final swap current/peak and memory/swap event value is zero. Domain, populated=0
and frozen=0 evidence is complete. Final residual charged memory is not process membership:
target and all role/root membership observations are empty. The positive unreset root peak
includes setup and the tiny workload by placement; no earlier setup-only result is subtracted
and the bytes are not individually attributed. Empty role results do not measure the application.

| Stage | CLOCK_MONOTONIC bounds, nanoseconds |
| --- | --- |
| Earliest acquisition | 399445275395759 |
| Original root initial read | 399445277633329–399445278024920 |
| Root data fsync complete | 399445280856579 |
| Descendant construction/attachment | 399445281677395–399445322464903 |
| Role initial reads | 399445324545976–399445325681327 |
| Role data fsync complete | 399445331520388 |
| Pre-admission membership checks | 399445333437872–399445367805819 |
| Native creation lower bound / normal-wait upper bound | 399445372546671 / 399445409646166 |
| Final daemon/browser reads | 399445422525690–399445423540219 |
| Final root read | 399445423542117–399445423880000 |
| Raw inventory retained / receipt retained | 399445430674290 / 399445434750182 |

The pinned helper fsyncs each publication record before the subsequent action. Stage records
bind original raw data and checks, construction, four pre-admission membership records and
admission with hashes and ordered windows. The standalone timestamps are consistency evidence,
not a substitute for that actual owner control flow or independent complete lifetime qualification.

The unchanged memory assessor returns PASS with root terminal peak 8,667,136 and no reasons.
The combined outside assessment also returns PASS. Its deliberately incomplete raw diagnostic
remains UNAVAILABLE and cannot supply a false success. The earliest root acquisition boundary
and original separate initial snapshots are projected directly into the canonical receipt.

## Process boundary, closure and costs

Independent pre-exec observations show the exact target process, UID/GID 1000, empty
inheritable/permitted/effective/ambient capability sets and NoNewPrivs=1 before the durable
permit. The payload's seven namespaces differ from the attestor's, only descriptors 0/1/2
and the three fixed environment keys remain, host home/runtime/cgroup paths are hidden,
read-only writes fail with errno 30 and nested user namespaces fail with errno 28.
Seccomp=0 and the unchanged capability bounding set are diagnostics, not a new filter claim.

The direct child has actual normal wait, exit/signal/error 0, pidfd readiness and stable target
identity, with forcedKill=false. Immediate and separate read-only terminal checks both show
the unit not-found/inactive/dead, MainPID=0 and empty ControlGroup; the owned service group
is absent. Default properties reported for a removed unit do not describe its active profile.

Outside launch duration is 417,693,495 ns; systemd launcher duration 309,401,076 ns; native
capture duration 38,001,657 ns; outside assessment duration 35,717,026 ns. The launcher reports
300 ms service runtime, 142 ms CPU and a rounded 23.3M service peak. The attestor's own snapshot
after handle closure reports maximum RSS 35,454,976 bytes and approximately 0.100 s CPU.
These different metrics are separate diagnostics: do not add, subtract or equate them to the
charged root peak or claim complete helper lifetime coverage.

The first directory retains 136 records totaling 77,228 bytes. The [archive and verification
records](../fixtures/loredock-staged-counter-prerequisite/README.md) preserve all first data,
sealed inputs, raw output/errors, original scripts, build/runtime pins and closed logs.
No consumed file was rewritten. Implementation hashes remain those verified before the attempt.

## Next boundary

This result resolves creation-ordered zero admission and normal-exit counter retention for
one tiny child on this installed environment. It does not establish the complete shared
Node/Chromium runtime layout, ancestor controls, orphan/interrupted-collector handling,
full lifetime accounting or any application/semantic gate. After exact-head CI acceptance,
[Task 163](../../tasks/163-loredock-complete-executor-layout-review.md) reviews those remaining
requirements and scopes the smallest viable next step before any broader live run.
