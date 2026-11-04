# Complete worker read qualification entry

Task 094 composes the unchanged Task 089 coordinator and Task 082 worker with the
Task 093 services. The opt-in `probe.mjs` verifies the five frozen inputs, 412
source/built/script identities, exact accepted implementation merge, pinned runtime
and clean measured tree before launch. Ordinary tests import only independent tiny
configuration and never the frozen family or probe.

The fixed [protocol](../../fixtures/loredock-worker-qualification/README.md) requires
all sixteen independent operation gates and seven cross-process comparisons. Keep
every first raw artifact, exit and error; any failure keeps the candidate unqualified.
No old family is run and no instrumentation, resource bound or application module
changes. The single invocation requires an owned absolute `LOREDOCK_WORKER_OUTPUT`
and an external 1,830-second watchdog with five-second kill grace. This is a retained
experiment, not a repeatable benchmark command or production entry point.
