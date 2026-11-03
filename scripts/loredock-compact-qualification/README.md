# Independent complete compact-payload qualification

Task 089 reuses the unchanged generic Task 082 uninstrumented worker with the new
compact services. Its coordinator replaces the old sequential integrity gate with
Task 084's independent artifact/source/usefulness/history/repeat/resource assessment,
Task 087's exact ordered-path/span/scope checks and separate original no-write/work/
output/hook checks. Resource failure cannot erase a valid first receipt or suppress
history, parity and observation results. Missing preparation/results retain fixed
operation denominators and explicit blocks; any required failure rejects overall.

Owned child groups keep the original preparer/reader/overall watchdogs and sanitized
environment. Descriptor, spawn, timeout, cleanup and worker failures stay visible.
Regular worker/metadata JSON is bounded at 1 MiB and checked before assessment.
Receipt decoding uses the existing canonical/hash/schema/boundary checks. Expected
corpus construction and decoding occur outside each observed worker after exit.

Ordinary tests run actual tiny supported preparer/reopened children and verify all
sixteen operations plus seven exact cross-arm comparisons. Further actual-process
cases cover parent-only resource failure, exit 7/missing preparation, cleanup
failure with a still-valid stopped copy, watchdog termination and malformed saved
worker JSON. No test imports the [future frozen corpus](../../fixtures/loredock-compact-qualification/README.md)
or measurement entry point. Neither snapshots nor profilers are used here.

Generic integration `6c4212f` passed 551 tests, strict typechecks and builds before
input/protocol freeze `81d926f`. Task 088 head `68081c2` passed both exact-head CI
events and merged as identical-tree `2d99d83`. The CLI verifies all five frozen
inputs and 406 source/built/script hashes, requires clean Git and records its head.

```sh
LOREDOCK_COMPACT_OUTPUT=/absolute/new-owned-output timeout --signal=TERM --kill-after=5s 1830s node scripts/loredock-compact-qualification/probe.mjs
```

Retain the outer stdout/stderr and exit too. The family is exhausted after that
single execution, including any failed or incomplete result.
