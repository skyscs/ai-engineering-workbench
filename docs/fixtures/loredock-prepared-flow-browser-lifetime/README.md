# Browser lifetime ownership

Passive live ancestry alone cannot attribute a browser descendant that orphans before
the first observation. The [lifetime collector](../../../scripts/loredock-prepared-flow/browser-lifetime.py)
enables and verifies a dedicated Linux child-subreaper before launching the real browser.
Browser orphans are adopted into that same collector's kernel ancestry. The existing
external evaluation owner remains the only global wall/storage watchdog; the collector
uses its already tested kernel discovery, pidfd signaling, bounded cleanup and `wait4`
reaping helpers. It never treats a PID file, executable name or port as signal authority.

The actual launcher PID is bound before browser startup and checked against live parent
identity. A parent already missing at bootstrap prevents browser launch; later parent
death or a termination signal starts owned cleanup. A normal browser exit also drains
any remaining owned descendants before the collector exits. Browser-specific output,
commands, exit/usage records and ancestry events are retained under `browser/lifetime`.
The empty inherited storage journal is not a measurement: this collector never runs the
outer owner's wall/storage sampling loop.

The [browser adapter](../../../scripts/loredock-prepared-flow/browser.mjs) keeps actual
Chrome arguments, isolated profile, HTTP traffic, compiled UI and passive observations.
Its process-tree samples now start at the lifetime collector, so collector overhead is
included in the reported memory scope. Normal CDP close gets up to one second to reach
the collector before fallback termination. The last-resort collector kill allows its
existing ten-second grace plus five-second forced-cleanup window to finish; this does
not increase a frozen application or UI latency threshold. The outer owner remains
responsible for descendants if the collector itself fails or is killed.

## Observations and limits

Four [subprocess controls](../../../scripts/tests/loredock-browser-lifetime.test.mjs)
exercise normal completion with an adopted child, failed completion with a TERM-resistant
orphan, actual launcher death before outer cleanup, and pre-launch parent mismatch.
The adopted allocation remains alive until termination, and its OS usage is recovered.
All controls leave no owned descendants. The mismatch case creates no browser process.

Actual Chrome desktop/390px review controls complete one controlled answer and shut down
with no errors or surviving descendants. The final parent-bound normal run retains eight
reaped-child records, 39 complete passive samples, and **1,374,105,600 bytes** of sampled
RSS including the collector. That remains above the unchanged **1 GiB** ceiling.
An actual driver exit 7 is retained as `driver-left-owned-process`; the collector and
outer owner drain the browser and daemon. The final fault control preserves twelve
reaped-child records and one explicitly incomplete passive sample during failure.
The fault control overlaps ordinary repository checks and is not a timing/resource pass.

The first browser/crash controls and three-test implementation preceded the explicit
launcher-PID binding. They remain separate retained observations with their original
input bytes. The bound-parent controls and four-test implementation are recorded
separately. No failed process outcome or historical metric is replaced. A final metadata
clarification avoids interpreting the raw OS counters as exclusive per-PID usage.

`wait4` reports child resource counters. Descendant usage can be included in child
accounting, and Linux child high-water RSS is not a simultaneous whole-tree maximum.
The collector preserves the actual counters without adding maxima or claiming exclusive
per-PID CPU/peak attribution. See the primary
[wait4 documentation](https://man7.org/linux/man-pages/man2/wait4.2.html) and
[getrusage documentation](https://man7.org/linux/man-pages/man2/getrusage.2.html).
Short-lived descendants reaped by Chrome itself may have only aggregate OS accounting;
live tree samples remain sequential, sampled measurements, not a continuous bound.
Missing collector output, sampling races or errors remain explicit failures/incompleteness
for the final resource assessor. A machine crash, collector SIGKILL or uninterruptible
kernel state is not presented as a guaranteed graceful shutdown.

## Retention and qualification status

[records.json](records.json) binds all four actual runs, original/final inputs, retained
subprocess controls, copied stopped catalogs and verification logs. Four independent
catalog copies pass integrity and foreign-key checks; each retains one successful answer
and one witness. Source bytes and complete raw trees remain unchanged by inspection.
Owned temporary Chrome profile/cache directories remain local and are explicitly
excluded from portable archives; observations, requests, responses, screenshots and
collector logs are retained.
The final four focused controls and full 962-test check pass, with strict typechecks,
production builds and the unchanged application/input seal. Earlier focused/full checks
remain separately retained; the initial full check passes 961 tests.

The preceding oracle checkpoint is accepted through
[PR #138](https://github.com/skyscs/ai-engineering-workbench/pull/138): push 42008587392 and
pull_request 42008788188 pass 958 tests at exact head
`5bfad57f7c500f4992a74019035ddcc6e0c80fab`. Merge
`16f1c07815d3122fdd7227b1306ecf00883c7f80` has an identical tree. Both full CI logs are
retained here. Its genuine required-positive derived-size failure stays unresolved.

This is ordinary Task 128 driver infrastructure. Application bytes, resource thresholds,
frozen oracle and source family are unchanged. No model or reserved-family candidate
read occurs. The complete ordered coordinator, resource assessment and committed
executable/environment/output seal are still required before the once-only gate.
