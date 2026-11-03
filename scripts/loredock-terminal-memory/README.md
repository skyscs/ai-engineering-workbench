# Complete lifecycle with terminal ownership observations

Task 087 integrates the [bounded helpers](../loredock-terminal-ownership/README.md)
with one complete long-lived synthetic LoreDock lifecycle. This opt-in offline
harness does not change application consumers. Earlier measured code is unchanged.

`run.mjs` forks the reviewed Task 082 sequence into a new module: prepare, close
and copy stopped data, reopen in the preparer's PID, first capture, three identical
repeats, selected root, page four, isolated root, two replacement analyses, and
history after eviction. The original resource/work/output/no-write counters and
raw artifacts remain. No profiler, query/phase/owner hooks or manual GC are enabled.

Only after recorded history completes does the worker export `after-history`.
Normal service closure runs in `finally`; all service-bearing local variables and
the owning async function then return. After a subsequent event-loop turn it exports
`after-release`. A close/export error is retained and prevents a successful result.
Backend collection and export affect both terminal observations; their difference
is not an estimate of ordinary shutdown memory savings.

`coordinator.mjs` supervises the worker with the fixed Linux file/time/RSS boundary.
After exit it constructs expected text and uses Task 084's independent offline
assessment. Each heap is parsed in a separate bounded process, never in the observed
worker. Parsing has a 60-second maximum watchdog; all other helper ceilings apply.
Content, operation resources and terminal completeness remain separate. Any required
failure rejects the overall result; even complete terminal graphs never qualify
the candidate for production. Missing observations and partial files remain evidence.

The independent tiny integration tests exercise all eight operations, first/repeat
and evicted-history comparisons, owning-stack release, a parent-only resource failure
with intact useful content, and a cleanup failure retaining only the first snapshot.
They use source services through a test-only `tsx` loader. The frozen diagnostic
uses built services and unmodified pinned Node instead. Ordinary tests never import
its corpus or CLI. See [retained development evidence](../../docs/fixtures/loredock-terminal-memory/README.md).

The [fresh protocol](../../fixtures/loredock-terminal-memory/README.md) is frozen at
`5fc0900`, after 538 tests, strict typechecks and builds passed. `complete.mjs` also
checks every typed flow node/edge, exact original span and complete source scope.
Its positive and deliberate mismatch regressions use only independent tiny data.
The opt-in CLI verifies all frozen input and 264 baseline source/built-file hashes,
requires clean Git and records the measured entry-point commit before execution:

```sh
LOREDOCK_TERMINAL_OUTPUT=/absolute/new-owned-output timeout --signal=TERM --kill-after=5s 1050s node scripts/loredock-terminal-memory/probe.mjs
```

Retain the outer stdout/stderr and exit alongside the owned output. The wrapper
deadline is part of the frozen protocol; no automatic retry is permitted.
