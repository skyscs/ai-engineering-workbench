# Offline memory-receipt assessment

Task 151 implements [`assessMemoryReceipt`](../../scripts/loredock-memory-receipts/assess.mjs)
for the prospective [v2 contract](observable-resource-contract-v2.json), adopted by
[ADR 0068](../decisions/0068-loredock-observable-resource-contract.md).
It evaluates supplied records; it does not acquire measurements or qualify an executor.
There is no CLI, application integration, cgroup access, process creation or network call.

## API and bounds

`assessMemoryReceipt(serialized, { runId, candidateSha256 })` is synchronous and pure.
The caller supplies an expected binding from its separate manifest; a receipt cannot
select its own expected identity or override a limit. Contract ID and SHA-256 are pinned
inside the module, with a regression against the accepted JSON bytes.

The input is one canonical `JSON.stringify` encoding, without a trailing newline, at
most 1,048,576 UTF-8 bytes. Pretty printing, duplicate keys, noncanonical number/string
encodings and malformed/deep input are unavailable, not exceptions or last-value wins.
The trusted caller binding is a plain record containing a lowercase UUID and SHA-256.
The [hand-authored test fixture](../../scripts/tests/loredock-memory-receipts.test.mjs)
provides a complete example; its counters are invented and are not runtime evidence.

Every raw kernel read is at most 4,096 UTF-8 bytes and retains its final newline. Scalar
values and event values are canonical decimal unsigned 64-bit integers. Arithmetic uses
`BigInt`; JSON numeric counters, signs, fractions, exponent notation, overflow and missing
values are rejected. Outputs serialize observed values as decimal strings or null.
Each scope accepts at most 64 optional prior peak checkpoints. This is an input bound,
not a sampling/coverage guarantee or a change to the product's memory target.

## Receipt representation

| Field | Required meaning |
| --- | --- |
| `schemaVersion` | `loredock-memory-receipt/1` |
| `contract` | Exact `id` and `sha256` matching the adopted v2 bytes |
| `run` | `id`, `candidateSha256`, `bootId` (lowercase UUID), `clockId` (SHA-256 identifying the declared monotonic domain); decimal-string `acquiredAtNs`, `firstChildAtNs`, `lastExitAtNs`, `retainedAtNs`; explicit `allExited`, `forcedCleanup`, `fsynced`, `delegation`, `counterMode` |
| `environment` | `initial` and `final` records, each with decimal-string `mountId`, unique bounded `options`, and `eventsMode: "hierarchical"`; required HugeTLB accounting, no local-only events, unchanged options/identity |
| `scopes` | Only `run`, `daemon`, `browser`; each has `initial`, `checkpoints`, `final` |
| Full snapshot | `identity`, `window`, `raw`; required for acquisition and terminal retention |
| Peak checkpoint | `identity`, `window`, `raw`; only the two raw peak reads, from a separately retained prior observation |
| `identity` | `bootId`, positive decimal-string `mountId`, `inode`, `parentInode`, and decimal `major:minor` device string; unchanged across a scope's lifetime |
| `window` | Decimal-string `fromNs`, `toNs` and the same declared `clockId`; no assumed atomic sample instant |
| Full `raw` | Exact interface names: `memory.current`, `memory.peak`, `memory.swap.current`, `memory.swap.peak`, `memory.events`, `memory.swap.events`, `cgroup.events`, `cgroup.type` |
| Checkpoint `raw` | `memory.peak`, `memory.swap.peak` only |
| `diagnostics.heap` | `coverage` partial/unavailable, `aggregateHeapPeakBytes: null`, `completeIsolateCoverage: false` |
| `diagnostics.rss` | `coverage` complete/partial/unavailable and a nonnegative safe-integer `unavailableSamples`; complete cannot coexist with a nonzero missing count |

Normal closure declares `allExited: true`, `forcedCleanup: false`, `fsynced: true`,
`delegation: "exclusive"`, `counterMode: "read-only-never-reset"`. These declarations
are checked for consistency, **not authenticated as operating-system facts**. The future
executor qualification must establish them from its held descriptors, manager/owner
receipts, actual waits and retained raw evidence. A self-declared qualification field is
unsupported. This module does not validate a complete heap/RSS ledger or a family registry.
It also cannot prove ancestor-control stability, descriptor protection or namespace
confinement from these declarations; those remain part of live executor qualification.

Initial raw counters/events must be empty and type must be `domain`. Terminal current
memory may remain nonzero because charged cache can outlive processes. Terminal `populated`
and `frozen` must be zero. Unknown/duplicate/missing event fields are unavailable; known
positive pressure/swap events remain failures even if a separate event is missing.
The optional socket-throttling field must be present in both endpoints or neither.

The three initial group identities must be distinct on the same boot/mount/device.
Daemon/browser parent inodes must match the root inode. Acquisition windows precede first
child creation; final windows follow the declared last actual exit and precede retained
evidence. Root's final window starts after both role windows end. Every supplied checkpoint
is ordered and bound to its original group. A decrease is unavailable, and a previously
observed excess remains failed. No timestamp gap is filled with invented observations.

## Result and attribution

Results have per-scope and record-consistency outcomes, stable reason codes and retained
failure/unavailability reasons. `FAIL` means a known predicate violation in attributable
supplied data; `UNAVAILABLE` means missing/ambiguous evidence; `PASS` means only that this
module's predicates hold for these records. `NOT_RUN` is not inferred from a missing
receipt. Early schema/contract/subject mismatch stops interpretation under the wrong
quantity or run. A stale initial scope cannot attribute later values to a fresh run.

Once initial identity/acquisition is valid, a valid peak or current reading can establish
a breach even if another reading or scope is unavailable. Prior excesses survive missing
finals and later counter decreases. Null remains null. Role peaks are never added to
construct a root peak, and independent heap maxima are never aggregated.

Every result has `offlineOnly: true`, `resourceQualification: false`, null aggregate heap
and false complete-isolate coverage. `notAssessed` lists live executor trust, full diagnostic
ledgers, useful cases, responsiveness, work, storage, authority, semantic quality and v1
qualification. Passing self-reported data cannot make any of those axes pass.

## Validation and next boundary

Thirty-three focused regressions cover inclusive ceilings, retained short-child peaks,
missing data plus independent failures, stale/reused identities, clock/order changes,
memory/swap events, diagnostic gaps, integer precision, malformed/oversized/deep input and
duplicate JSON/event keys. The tests run without application or OS-resource execution.
See [retained checks and accepted Task 150 CI](../fixtures/loredock-memory-assessor/README.md).

The earlier [prerequisite matrix](../fixtures/loredock-resource-contract/prerequisite-cases.json)
is broader than this module: actual permissions, creation, namespace confinement, orphan
cleanup, interrupted collectors, real timing/trace coverage, source authority and useful
outputs still need independent evidence. Claims of those facts in a transcript are not
their qualification. After Task 151 acceptance, scope the smallest separately sealed
executor prerequisite. No application resource family or model continuation opens here.
