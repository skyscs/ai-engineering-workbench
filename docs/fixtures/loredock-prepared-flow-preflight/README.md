# First-preflight authority observations

This ordinary Task 128 slice exercises the remaining boundary before the controlled
runtime's first `prepare` call. It uses actual prepared-answer HTTP admission and worker
validation, without changing application code, constructors, budgets or validators.
No model or reserved-family candidate read occurs.

The [public-mutation driver](../../../scripts/loredock-prepared-flow/preflight-observation-development.mjs)
starts three independent copies of a stopped catalog. It admits a real reviewed
preparation, then changes review, policy or starts a replacement build through HTTP.
A declared hold in the controlled runtime prevents dispatch if the first boundary has
already been missed; a zero prepare count proves that hold was never entered.

Review and policy changes prevent all preflight/provider calls. Their retained final
runtime counters remain zero after shutdown. The build-start case also stops the worker,
but the answer is already failed while the replacement build is still `preparing` and
unpublished. This proves an earlier write fence, not rejection of the changed published
build. That case stays `observedFirstPreflight: false`; the driver and owner exit 1.
It is an incomplete observation, not an application failure or a qualifying pass.

The separate [published-build fault driver](../../../scripts/loredock-prepared-flow/published-build-fault-development.mjs)
closes that distinction with an explicitly isolated catalog intervention:

1. The actual production entry indexes the ordinary sources twice through HTTP and
   completes native analysis for both real builds. Their full originals remain present.
2. After shutdown, a complete copy selects the earlier, still completed/published build
   as current. The real preparation service produces Ready against that build.
3. A retained SQLite `AFTER INSERT ON answer_witnesses` trigger selects the already
   completed alternative build during the actual admission transaction, after its owned
   witness is saved and before the worker's first preflight.
4. The actual worker rejects the stale input. Preflight/provider counters stay zero,
   dispatch and usage stay null, the original witness remains bound to the earlier build,
   and identical-request replay returns the same attempt without dispatch.

The final complete project view equals the view previously returned by actual publication
of the alternative build. Both identities, build contents and native inventories were
produced by the application. The fault does not invent a build, insert an admission or
witness, modify parser compatibility, call a private method or change the application
schema version. The diagnostic trigger remains in the retained isolated catalog and is
explicitly recorded in `fault.sql`; this is a state-selection fault, not a normal public
rollback feature or an uninstrumented timing observation.

[records.json](records.json) binds both complete raw trees, original source repositories,
stopped catalogs, HTTP journals, process output, driver/reference inputs and verification
logs. Independent inspection of six complete stopped copies passes SQLite integrity and
foreign-key checks, with no recorded dispatch. Source hashes and all original raw trees
remain unchanged by inspection. The incomplete public build-start result is preserved
separately from the successful deterministic state-selection fault. Both owners retain
their actual nonzero/zero outcome and report no errors or surviving children.
The local `pnpm check` passes 955 tests, strict typechecks and production builds.
The unchanged application/input seal validates without a candidate read of the reserved
family. These ordinary driver observations supplement that check; the incomplete
build-start case remains an exit-1 result.

## CI review correction

The first PR #135 push check (41998815851) passes at `49e8d36`, but pull_request
41999296250 fails an existing independent tiny terminal-memory integration test.
Its `repeat-3` sample records **405.999008 ms** against the unchanged **150 ms**
slice limit. All eight artifact/shape/support checks, seven useful cases, saved history,
raw repeats and both terminal exports/parsers pass. The diagnostic correctly reports
one resource failure and `failed: true`; the first CI failure is preserved.

That functional integration test now checks complete functional/terminal behavior
separately from resource observations on the shared CI runner. Every resource failure
must still set the diagnostic's `failed` flag. The test prints that failed report and
retains its temporary tree even when its functional assertions pass. Its companion
zero-RSS-limit test continues to require all eight resource failures. No assessor,
measurement, resource threshold or application behavior changes. This does not turn
the original resource failure into a pass or qualify any hardware/resource gate.

The full failed CI log and extracted diagnostic report are retained. The remote runner's
temporary heap/catalog files were not uploaded by the existing CI workflow and cannot be
recovered from that log; their hashes/references are recorded, not claimed as full raw
artifact retention. New local observations retain their original complete output trees.
The correction passes all three targeted terminal tests and the complete 955-test
local check, strict typechecks, builds and the original application/input seal.

The preceding cancellation slice is accepted through
[PR #134](https://github.com/skyscs/ai-engineering-workbench/pull/134): push 41996528951 and
pull_request 41996827429 pass 955 tests at exact head
`f07132df0af5effbafb785b5de36751d05aff9e4`. Merge
`eedc69eff34a87af133d7ae618628e3762014840` has an identical tree; both full CI logs are retained.

The full R01–R15 driver/assessor and pre-observation executable seal remain required.
Ordinary controls do not qualify a reserved-family case or remove known history-work,
Chrome-RSS or startup-delay failures. The kiln family remains unobserved by a candidate,
the thresholds and oracle are unchanged, and semantic execution/default adoption remain
conditional on the original complete gate.
