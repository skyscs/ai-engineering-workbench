# Capture memory diagnosis boundary

Status: design only, Task 076, 2026-11-03. Task 075's
[first scale result](../fixtures/loredock-capture-scale/README.md) remains rejected.
This document authorizes no production optimization or resource-limit change.

## Observations and unknowns

The same twenty-source process prepared successively larger catalogs. The first capture
of 9,980 paths completed in 3,271.006 ms, with 374,607 aggregate work units and complete
write-ending paths. Its sampled heap growth was 50.326 MiB. Subsequent large operations
reached 79.290, 64.106, 67.799 and 67.211 MiB against a 64 MiB bound. After replacement
analysis and restart, history began at 406.422 MiB RSS; two following small variants
reached 407.191/407.316 MiB against a 384 MiB bound. Later small operations fell below it.

These are process samples, not retained-object measurements. A small serialized receipt
(about 43 KiB in the large default case) does not bound temporary validation work. A small
history read can inherit an already large process. Neither observation proves a leak,
identifies native allocations, or absolves an operation from the failed resource gate.
Preparation durations were separated, but preparation memory was not sampled by phase.
The observer records RSS/heap-used peaks, not heap capacity, external buffers, collection
events or allocation ownership. Do not derive "native memory" by subtracting heap from RSS.

## Source ownership audit

The following are concrete allocation sites and hypotheses, not measured causes:

| Site | Ownership and lifetime visible in code | Question to distinguish |
| --- | --- | --- |
| [Path reader](../../scripts/loredock-capture-scale/paths.mjs), `project` | Retains metadata, every validated payload in `entries`, consumed identities, binding domains and resolution through admission/final fences. | How much live data is retained through each stage, including files with no supported facts? |
| [Binding metadata](../../apps/loredock/src/code-paths-metadata.ts) | Holds file/source/path maps and unit summaries; creates a tree per source and rereads metadata for the final digest. Domain closures retain a payload lookup. | Which overlapping structures are needed simultaneously, and which are temporary? |
| [Inventory snapshots](../../apps/loredock/src/code-analysis.ts), `snapshot` | Materializes all checkpoint headers, validates them and computes the manifest. Path capture invokes it at initial/final path checks and at receipt publication. | Do temporary whole-manifest arrays account for a significant stage peak? |
| [Original validation](../../apps/loredock/src/code-analysis.ts), `validateUnit` / [document reader](../../apps/loredock/src/map-document.ts) | Parses each saved payload and reopens complete raw/span evidence, hashes and ranges before use. | How much transient text/buffer allocation precedes retained payloads? |
| [Store helpers](../../apps/loredock/src/store.ts), `one` / `all` / `run` | Each call prepares a SQL statement; request loops repeatedly invoke fixed queries. | Is repeated preparation a material allocation cost? Call counts alone cannot prove retention or a cache benefit. |
| [Path work](../../apps/loredock/src/code-paths-work.ts), `step` | Async steps are awaited per entry even when a cooperative yield is not due. The shared budget observes accepted deltas. | Does promise/observer churn dominate temporary allocation rather than retained domain data? |
| [Receipt](../../scripts/loredock-capture-scale/receipt.mjs) | Keeps serialized projection, parsed validation copy, originals and canonical envelope; final snapshot runs under the publication guard. | Where does whole-capture lifetime overlap exceed standalone path cost? |
| [Fixture/observer](../../scripts/loredock-capture-scale/fixture.mjs), [probe](../../scripts/loredock-capture-scale/probe.mjs) | Preparation retains owned input text while services run; results keep bounded metadata/histograms. Closing resources is not a promise of immediate garbage collection or RSS reduction. | How much starting residency follows preparation, earlier operations and instrumentation? |

All existing original/hash/range, source, manifest and saved-tree checks remain necessary.
Do not replace complete binding domains with display-selected facts or discard unsupported
file diagnostics. The 21 useful facts in Task 075 coexist with thousands of explicit parser
gaps; "no supported fact" does not mean "no integrity or completeness responsibility."

## Prospective diagnostic, separate from qualification

The next execution task must first freeze fresh owned source names/text, exact file/byte/
fact expectations, typed useful paths, fixed sequence and instrumentation protocol. Use
small and near-limit twenty-source catalogs within the existing per-source shares, including
documentation/contracts. Do not reuse Task 075's corpus or rerun an exhausted matrix.
Commit a separate instrumented fork/harness before observation, with baseline hashes.

Prepare each catalog once and use its exact saved state for paired process controls. The
preparer must finish jobs, close services and checkpoint/close SQLite before making an owned
copy; record file hashes and startup/recovery changes separately. Never copy a live database
without its required sidecars. Matching data identities, not different randomly regenerated
catalogs, are the control. No access to user catalogs is needed.

All arms begin reading the same closed initial state. The same-process arm reopens it in
the preparer's existing process; closing services is recorded and does not reset the process.
Keep initial copies intact until every arm finishes, with separate owned receipt directories.

Freeze these three diagnostic arms, one execution each per size:

1. **Same process:** preparation, first capture, three fixed repeat captures, selected root,
   isolated root, two replacement analyses, history and service closure. This represents
   the application's long-lived lifecycle. Keep results from every operation.
2. **Reopened process:** open the identical stopped initial catalog in a fresh process and
   run the same read sequence. Record opening separately. This separates preparation
   residency from reading; a lower value does not waive the same-process result.
3. **Instrumentation control:** on another identical initial copy, use the fixed read
   sequence without phase/query instrumentation, retaining the existing outer sampler.
   This detects observer cost. It is still diagnostic data, not fresh acceptance of Task 075.

History replacement happens after captures in each arm; compare initial-capture semantics
before those intentional mutations. No process-per-request reset, forced GC, heap flags,
idle-until-memory-drops loop or selective repeat is allowed in these arms. Record Node/OS/
hardware, command arguments, environment controls, process boundaries and all exits. Run
no concurrent heavy checks. Freeze an overall watchdog independently of per-operation limits;
timeout, incomplete preparation and missing stages are recorded, never silently retried.

## Bounded instrumentation

Retain the existing 5 ms outer sampler, wall time, sampled interval, RSS and heap-growth
values and their unchanged limits. Add diagnostic `heapUsed`, `heapTotal`, `external` and
`arrayBuffers` samples at fixed phase boundaries: before/after preparation and analysis,
opening, initial snapshot, metadata, facts, resolution, admission, final validation,
original reopening, publication, history and closure. Record the actual collection time;
an asynchronous hook is not an exact allocation timestamp. Report raw bytes as well as MiB.

Use a maximum of 64 phase records per operation and 128 fixed-query identities per process;
overflow is an explicit diagnostic failure. Aggregate query/prepare counts by a hash of
the SQL template, without parameters, payloads or source text. Count fact/snapshot/original
reads and accepted work by phase. Sample bounded owner counts for metadata rows, retained
payloads, meaningful fact entries, evidence references and manifest headers. Do not estimate
object bytes from serialized JSON or duplicate the full live graph for the observer.

Buffer only these bounded records. Flush raw results/errors and metrics outside the measured
operation before evaluating assertions. Do not stringify/retain a trace event for every file,
charge or query. Instrumentation must not skip validation, cache results, change SQL, alter
check/yield cadence or execute code from source repositories. Any unavailable ownership
counter is reported as unavailable rather than reconstructed from assumptions.

Evaluate resource and semantic checks independently once an operation returns. A memory
failure must remain failed while typed node/edge/path, exact original and scope checks can
still report their own outcomes. An operation refusal blocks dependent checks explicitly.
Observer exceptions and cleanup failures are separate errors, never expected refusals.
Singleton isolated paths must be described by their node/edge identities, not assumed absent.

Compare substantive path/evidence/scope/omission content across controls, excluding only
prospectively listed experiment/measurement identity fields. Compare repeat receipt bytes
within each generation. History must still do zero path/fact work. Preserve every original
failure, stderr/exit, raw result and hash; no diagnostic result changes the Task 075 gate.

## Decision and stop rules

The diagnostic answers where allocation/residency changes, which owners remain live and
whether instrumentation/preparation materially affects them. If these observations cannot
distinguish the hypotheses, record the uncertainty and scope a targeted allocation profile;
do not guess a fix or loop the same diagnostic until it appears stable. Heap snapshots or
forced-collection liveness probes require a separate declared diagnostic mode and may never
supply the unchanged resource gate's success samples.

Select at most one bounded optimization for a subsequent task from the evidence. Possible
targets include shorter payload lifetimes, compact completeness summaries, bounded statement
reuse or fewer temporary async objects; none is selected by this design. Changes must preserve
every admitted fact, ambiguity alternative, relevant omission, complete original, shared
charge/check and publication fence. Do not narrow catalogs, raise limits, disable validation
or add a request reset to manufacture a passing capture.

An optimization gets independent regressions and then a new prospective **uninstrumented**
resource qualification covering useful first/repeat/selected/history operations in both
long-lived and reopened lifecycles. Keep the 5,000 ms/1,000,000-unit/150 ms/384 MiB/64 MiB
bounds and all output limits. Only that passing gate permits separate production integration
review. The current application, old receipt readers, semantic/private-pilot gates and model
budgets remain unchanged.

## Task 077 outcome

The [first diagnostic](../fixtures/loredock-capture-memory/README.md) fails its observer and
resource gates. Sixteen same-process operations pass integrity, while six exceed memory.
Four fresh-process arms stop at a prototype-sensitive comparison of SQLite rows with JSON
metadata, leaving 32 operations and cross-arm parity unavailable. Retained values match,
but post-run inspection cannot replace the blocked controls or attribute memory costs.

Next: separately correct and test the full process/serialization boundary, then freeze a
new diagnostic family. No optimization is selected; all first bytes and existing limits stay.

## Task 079 outcome after the separate process repair

The [new paired attribution](../fixtures/loredock-memory-attribution/README.md) completes
all 48 operations with correct content and exact cross-arm bytes; nine resource checks
still fail. First large captures exceed heap growth in same, reopened and uninstrumented
processes. Histories exceed RSS after replacement analyses with zero nested read work.
The preparation/observer-only explanations do not account for all observed failures.

Snapshot arrays, validated payload/domain retention, SQL preparation and async allocation
remain competing costs. Phase endpoints cannot assign bytes to them or identify native
residency. Apply the stop rule: scope one targeted allocation profile on separately
declared new inputs before choosing an optimization. Keep profiler observations outside
resource acceptance, retain every first profile/error, and do not repeat this broad matrix.
