# Held-counter reader verification

The [reader](../../loredock/HELD_COUNTER_ACQUISITION.md) is verified with temporary regular
files, actual descriptor metadata and injected clocks/errors. No actual cgroup counters,
services, workloads, application/browser or model are executed. Compatible receipt tests
explicitly supply synthetic lifecycle/environment/ownership/fsync declarations; the existing
assessor remains offline-only and grants no live qualification.

The records file binds three reviewed source hashes and seven closed logs. Accepted Task
157 push/PR CI each pass 1,208 Node tests; its complete consumed first PASS archive remains
unchanged and is referenced by hash. Current local verification passes 1,212 Node tests,
28 new Python cases, previous 4/18/34/20/20/16 Python cases, ten typechecks and ten final
builds without failures/cancellations/skips. All 148 emitted application/package modules
and previous consumed inputs/first records remain unchanged.

The 24-case initial and 27-case expanded focused logs are labeled development history;
the final focused log contains 28 Python cases and four Node checks. Review adds returned-
metadata isolation, preservation of mount-metadata errno and a 4-KiB per-request cap. There
are no hidden failed runs or first-attempt resource results in this offline task.

The preparation record preserves prospective expectations recorded before implementation.
Its pending predecessor acceptance is historical; Task 157 subsequently merged as 0e7351e.
Both complete exact-head CI logs remain required before accepting Task 158. A separate
tiny integration must establish actual counter capability and lifetime before any application
resource run; ancestor controls, orphan/interrupted-collector and other gates remain separate.
