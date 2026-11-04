# Final native composition qualification

Task 110's single reserved ferry-family attempt **fails** the fixed resource gate.
All sixteen operations pass integrity, expected source support, exact complete paths,
functional usefulness/history, no-write/shared accounting and lifecycle checks. Seven
raw cross-process comparisons pass. The reopened history operation records
399.58984375 MiB RSS against the unchanged 384 MiB ceiling; the other fifteen resource
rows pass. The accepted compiled native implementation is therefore not yet qualified
for consumer migration at this workload boundary.

The actual compiled driver is accepted PR #113 at `c32f75b`, with successful exact-head
push 41883388526 and pull-request 41883797308 CI, merged with the same tree as `0d65d12`.
Inputs and expected results were frozen at `688b082` before the sole measured head
`a28d7aa`. The owned corpus contains twenty sources, 9,980 files, 9,957 code inputs and
530,808 source bytes. It is mostly marker comments, with 21 supported facts and a
complete Vue/HTTP/Java/Kafka/Mongo protocol plus an isolated root. Seventeen sources
remain authorized dependencies without displayed code endpoints.

The attempt began at 2026-11-04T18:14:08.289161Z and ended after 388.636407104 seconds,
with outer exit 1. Both actual workers exited 0: same-process PID 791070 ran for
315573.167132 ms; reopened PID 822596 ran for 72290.526958 ms. No model, corporate
source, profiler, forced collection or diagnostic hook was used. Raw output, source
pins, runtime/input hashes, process exits, summaries and command logs are
[retained](../fixtures/loredock-native-final-qualification/README.md).

## What the recorded endpoints establish

The reopened process has 344.33203125 MiB RSS immediately before the first inventory
replacement, 398.83203125 MiB afterward and 399.58984375 MiB after the second. Its
history baseline is already 399.58984375 MiB. History takes 12.137534 ms, grows sampled
heap by 3.302605 MiB, reads exactly ten originals, and performs zero Git/source writes,
fact/snapshot/path reads, path work or publication locks. It returns the exact saved
projection/originals and all twenty dependencies.

These observations justify reviewing replacement-worker transient ownership before
optimizing the small history operation. They do not identify an allocator, SQLite
statement or JS retention mechanism. The second replacement's heap-used endpoint falls
from roughly 132.5 MiB to 46.4 MiB while RSS remains high; that is not a causal attribution
or proof of a leak. Sampled intervals and lifecycle endpoints are not continuous peaks.

All wall-time, responsiveness, heap-growth, work, output/support and source-integrity
gates pass. Maximum complete wall time is 2108.721598 ms, sampled interval 86.480549 ms,
heap growth 50.919670 MiB and work 552856 units. Every useful flow and original survives
restart-equivalent reopening and two inventory replacements with exact raw parity.
This functional success does not cancel the one failing memory row.

## Decision

The family is exhausted. Do not rerun it, change its limits, repair its report or omit
history from the denominator. [Task 111](../../tasks/111-loredock-native-worker-ownership-audit.md)
reviews actual replacement-worker ownership and bounded prepare/execute counts on a
fresh small diagnostic input. A supported narrow candidate must then pass independent
regression and a different future reserved family before consumer migration. Dense-code,
whole-lifetime, independent semantic/user acceptance, private pilot, L5 and the Workbench
bridge remain separate gates. No production code or user application behavior changes
in this qualification task.
