# Fresh capture memory attribution

Opt-in Task 079 coordinator, separate from ordinary tests and all exhausted matrices.
Inputs were frozen in `3663114` before implementing this harness. It uses Task 078's
repaired process entry point and unchanged diagnostic/path/receipt libraries, with
baseline file hashes. No production behavior or existing limit changes.

`probe.mjs` requires a clean committed tree, pinned Node 22.23.2, no Node flags or
`NODE_OPTIONS`, verified frozen input bytes and one new exclusive output directory:

```bash
LOREDOCK_MEMORY_ATTRIBUTION_OUTPUT=/absolute/new-owned-output node scripts/loredock-memory-attribution/probe.mjs
```

Build the source checkout first, then stop heavy checks before measuring. Follow
the [frozen protocol](../../fixtures/loredock-memory-attribution/README.md) exactly
once. Never rerun it after a failed gate. `small.mjs`/`large.mjs` load expectations
without generating source data in fresh readers; only the preparer constructs it.
The coordinator constructs source text for verification after each child exits.

`coordinator.mjs` accepts injected configuration and corpus/validator functions for
independent regression testing. It supervises owned process groups, retains every
stdout/stderr/exit and checks artifact hashes before validation. Operation resource
and integrity results are independent; cross-arm receipt/page bytes must match.
`validate.mjs` uses explicit default and selected typed-node lists rather than a
fixture-specific path exception. No evidence or scope fields are excluded from parity.

Ordinary CI uses the tiny locker sources from Task 078, not the frozen loan corpus.
One test intentionally fails only the coordinator's time gate while requiring all
24 integrity results and both process comparisons to pass. Another preserves a
child's deliberate exit 7 and blocks readers without a prepared snapshot. A watchdog
test verifies owned-child termination without retry and the retained exit/signal. This
tests reporting semantics; it supplies no memory-acceptance samples.

The first diagnostic must retain rejected resource outcomes even if every receipt
is correct. Select at most one later optimization only from supported attribution;
otherwise scope a targeted profile. Any changed candidate needs independent tests
and a fresh uninstrumented qualification before production integration.
