# First production parser adoption record

This ordinary compatibility record belongs to [Task 140](../../../tasks/140-loredock-production-parser-adoption.md)
and [ADR 0064](../../decisions/0064-loredock-production-parser-ownership.md). It uses only
fresh copies of retained synthetic inputs, with zero model calls and no reserved replay.
The prospective plan was committed at `fcdee57`; the first observed candidate is
`f20dfd27330b32469be03428c160a81a4e0f0788`. This first observation is never rerun.

`trees.json` pins two archives and their complete compressed member inventories:

- `first.tar.gz`: 577 entries, including exact candidate source/emission/runtime inputs,
  all 254 copied Task 138 entries, fresh catalog copies, comparisons, parent samples,
  thread/request/reply/exit events, complete stdout/stderr and the external owner.
- `early-inputs.tar.gz`: 540 entries retaining the initial accepted source snapshot,
  the first core-test patch and untracked first core-test modules. These are identified
  development checkpoints, not an assertion that every failed interim tree was captured.

The log inventory separately pins 44 closed local validation logs and both
complete Task 139 CI logs. Initial typecheck, source syntax, asynchronous test ordering,
historical dependency and prototype failures remain visible. Expectations and old
fixture manifests were not rebaselined. Current source/emission has an explicit verified
delta layer, while old regression assertions execute with their old dependency identity.

All eight retained catalogs preserve exact graphs, contexts, reviews and prompts. Twenty
saved v1 plus one saved v2 answer retain exact details, witness snapshots and idempotent
replays. The three transport cases preserve exact original facts, UTF-16 ranges and graphs.
There are ten worker lifetimes, 540 requests, 550 replies including readiness, ten actual
exits and no survivors. The source-only case creates no thread. Actual replies and
requests are counted without copying their source text into event records.

The whole child exits 0 after 3,625.049 ms, without timeout. CPU is 4.082 user / 0.393
system seconds from its observation start; kernel high-water RSS is 248,792 KiB.
There are 297 parent samples, maximum interval 37.670 ms and sampled parent heap maximum
43,760,592 bytes. Worker heap, early module loading, a simultaneous aggregate peak,
near-limit capacity and browser memory are not covered. No resource gate is qualified.
The source and emitted real-server lifecycle tests are separate from this ordinary
comparison; their logs record readiness, SIGTERM, actual exit and catalog reopening.

Final review after the first observation adds a guard between readiness and listening,
a regression for that handoff, and accurate deadline/cancellation messages. The current
application source and compiled `app`/`server` modules plus the explicit integrity delta
therefore differ from the first snapshot. Parser facts, native fingerprint inputs,
composition, prompts and limits remain exact. The final full suite independently repeats
the eight fresh catalog comparisons and all 21 saved reads; the first observation is kept.

Both first CI events at `e701fc0` fail before historical tests load because the materializer
expects `dist/types.js` before the daemon build. The independently retained complete logs
and job identities are in `ci-first/records.json`. The fix emits the pinned historical type
module when current emission is absent; existing current bytes are still verified when
available. No production implementation changes. A fresh detached checkout at `cffcd1d` passes the
entire normal build/test sequence: 1,125 tests, ten typechecks and all ten final builds,
with no prebuilt application output. `ci-first/clean-verification.json` retains the
independent result and closed logs. Only the historical helper and its documentation
change after the previously verified application candidate.
