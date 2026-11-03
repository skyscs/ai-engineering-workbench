# Uninstrumented streaming snapshot qualification

Task 082's opt-in harness runs the frozen laboratory-kit family once. The
[input protocol](../../fixtures/loredock-streaming-qualification/README.md) fixes
two sizes, two process lifecycles, eight operations per lifecycle and unchanged
resource/content limits. Input freeze: `c723cab`. Candidate implementation: Task
081, `94ccbdf`; normal application consumers remain unchanged.

After committing the checked harness and verifying the candidate merge, execute:

```bash
LOREDOCK_STREAMING_QUALIFICATION_OUTPUT=/absolute/new-owned-output node scripts/loredock-streaming-qualification/probe.mjs
```

The probe requires clean Git, pinned Node 22.23.2, no runtime flags/NODE_OPTIONS,
and exact frozen input/baseline hashes. It records hardware and code identities.
`run.mjs` is a separate narrow successor to Task 078's process runner: it uses two
lifecycles, installs no MemoryObserver, passes no phase/query/owner hooks and
checks prepared fact/byte totals. It retains ordinary counters, aggregate work
charges and the original outer sampler. Preparation, source guards, stopped
copies, selection, repeats, eviction/history and cleanup remain unchanged.

`coordinator.mjs` retains raw artifacts and owns process groups/watchdogs without
retry. It evaluates integrity, resources and exact byte parity separately. Both
lifecycles satisfy the previous uninstrumented control's observation contract,
including zero query-hook calls. First failed resources never erase content
results, and content validity never waives resource limits.

Ordinary tests use only the independent tiny locker fixture. They run both actual
child processes and all sixteen operations, deliberately fail a parent-only
resource gate to verify independent integrity, and cover exit 7/watchdog blocking.
They never import the frozen corpus or opt-in probe. No profiler is used.

Retain the first qualification outcome and all errors. No old family rerun,
increased limit or post-observation candidate change is permitted. Only a complete
passing qualification permits separate production integration review.
