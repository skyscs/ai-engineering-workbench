# Targeted complete-capture allocation profile

Task 080 uses one new near-limit corpus and one fresh profiled capture. It is an
allocation diagnostic, with no resource-acceptance result or production change.
The [frozen protocol](../../fixtures/loredock-allocation-profile/README.md) fixes
inputs, sampling parameters, bounds, process sequence and stop rules in `c34cece`.
The prospective [revision 2](../../fixtures/loredock-allocation-profile/PROTOCOL_REVISION_2.md),
committed as `59ef02b` before device-corpus observation, declares backend collection
and unmapped export samples. Both freezes are verified without editing original inputs.

After a clean source build and committed harness, run exactly once:

```bash
LOREDOCK_ALLOCATION_PROFILE_OUTPUT=/absolute/new-owned-output node scripts/loredock-allocation-profile/probe.mjs
```

The probe checks pinned Node, Git cleanliness, input freeze and imported code hashes.
Its coordinator runs one preparer and one fresh reader, retains owned-process exits
and enforces watchdogs without retry. The preparer checks admitted counts/facts and
copies only a closed catalog. The reader verifies the copy and source/manifest values
before connecting an internal inspector session. It never constructs the corpus.

`sample.mjs` brackets the complete capture, preserves action and profiler failures
separately, stops sampling after action failure and disconnects in cleanup. It opens
no debugger socket and requests no explicit collection. V8 forces collection while
retrieving a sampling profile and can sample allocations made during export. Raw
profile/capture data are written before validation; application JSON serialization
is outside sampling. Protocol flags include allocations later collected by major/
minor GC. No heap snapshot is taken.

`summary.mjs` validates bounded trees/samples and groups direct node self-size weights
by frame and nearest application caller, without adding ancestor-inclusive totals.
The 100-group bound is shared by those two views (50 each); other/internal weights
remain explicit. Raw frames remain available, including dependency/native locations.
Well-formed samples with no returned node keep separate counts/weights and explicit
`partial-unmapped-samples` status; no owner is invented. Malformed data still fails.
These weights include backend effects and describe sampled allocation activity,
not exact retained bytes or RSS.

Receipt correctness, complete original support, scope, no-write fences and shared
work are validated independently after the reader exits. Existing capture limits
remain enforced by the unchanged helper. Profiled wall/memory observations cannot
supply acceptance samples. A failure remains failed; no frozen input or code is
tuned after the first observation.

Ordinary tests use independent allocations and the tiny locker fixture. They exercise
the actual fresh child boundary, profiler cleanup, malformed/bounded summaries,
source-supported receipt publication, failed preparation and watchdog termination.
They never import the frozen corpus, configuration or opt-in probe.
