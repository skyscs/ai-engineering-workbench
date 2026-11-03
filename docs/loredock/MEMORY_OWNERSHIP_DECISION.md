# Remaining capture memory: inspect terminal ownership before another optimization

Task 085 selects one **post-history and post-close heap-retainer diagnostic**.
It selects no SQL cache, payload compaction, forced-collection product behavior or
production integration. Task 084 has repaired offline assessment; the streaming
snapshot candidate and all prior resource families remain unqualified/exhausted.

## Evidence and limits of attribution

| Existing evidence | Established observation | Unresolved question |
| --- | --- | --- |
| [Task 079](../fixtures/loredock-memory-attribution/README.md) | Complete paths pass in all 48 operations. First large captures fail heap growth in same/reopened/control processes. History RSS fails in all three, despite about 2.2 MiB local growth. | Which reachable objects or other residency survive the read/replacement lifecycle? Preparation and query hooks alone do not explain the failures. |
| [Task 080](../fixtures/loredock-allocation-profile/README.md) | Allocation samples include collected objects. Snapshot stacks carry 60.874 MiB of weights; three full-header array calls contribute 38.022 MiB within that subset. Validation, SQL helpers and async steps also allocate substantially. | Sampled allocation weights do not identify live objects, native SQLite bytes or a leak. Store helper frames include row materialization as well as preparation. |
| [Task 081](../../scripts/loredock-streaming-snapshot/README.md) | Streaming preserves snapshot semantics and removes complete header-array materialization. | Functional equality is not measured residency reduction. |
| [Task 082](../fixtures/loredock-streaming-qualification/README.md) | Incomplete authored paths invalidate positive qualification. Independently, large same-process isolated heap growth is 66.666 MiB and history RSS is 397.477 MiB. | Shorter paths and a different family prevent complete-path causal comparison with Task 079. |
| [Saved lifecycle endpoints](../fixtures/loredock-memory-ownership/retained-boundaries.json) | Immediate service/database close leaves RSS unchanged in all four inspected large same/reopened workers from Tasks 079/082. | Closing handles is not a measurement of collection, live retained ownership or allocator release. |

The endpoint extract verifies the original archive and worker hashes and copies
existing observations only. For example, Task 079's reopened worker has RSS
419,078,144 bytes and heap-used 36,541,888 bytes immediately before close; after
close RSS is unchanged and heap-used is 36,551,416 bytes. Task 082's same-process
worker closes at RSS 416,784,384 bytes and heap-used 183,205,456 bytes. Different
heap-used levels can coexist with high RSS; subtracting heap-used from RSS cannot
label the remainder as SQLite/native allocation.

## Source ownership ledger

These are observable references and release boundaries, not estimates of bytes.

| Owner | Lifetime and required content | Consequence for the next decision |
| --- | --- | --- |
| [Path `project`](../../scripts/loredock-capture-memory/paths.mjs) | `entries` retains every validated payload; `consumed`, metadata and domain closures survive through resolution, admission and final fences. Task 079 counts 9,937 payloads for 21 facts. | Compaction may reduce overlap during reads, but dropping fact-free files would lose gaps/completeness. Source reachability inside a request does not prove retention after it. |
| [Binding metadata/domains](../../apps/loredock/src/code-paths-metadata.ts) | File/source/path/unit maps and a payload lookup support complete Java/import domains; the final digest is reread independently. | Any future compact representation must preserve every relevant path, unit status, gap, ambiguity alternative and final digest. |
| [Resolver](../../scripts/loredock-capture-scale/resolve.mjs) | The available-evidence map includes all scanned references; symbol/operation indexes retain document facts during resolution. | Display caps do not bound resolution ownership. Selective input omission is not a valid optimization. |
| [Analysis `file`/`validateUnit`](../../apps/loredock/src/code-analysis.ts) and [document reader](../../apps/loredock/src/map-document.ts) | Each call parses/hash-checks a saved payload and rereads complete original bytes/spans/ranges; it returns the validated payload. | The substantial sampled validation weight does not justify reusing a previously authorized result or removing original checks. |
| Analysis worker | `worker.done` is cleared in `finally`; `idle` waits for it, and `stop` removes the weak service registration. SQL inventory eviction deletes old records. | No application payload cache is visible here. Neither SQL deletion nor worker completion guarantees immediate garbage collection or lower RSS. |
| [Store](../../apps/loredock/src/store.ts) | `one`/`all`/`run` prepare per call; no application statement cache exists. `close` closes the database and directory owner. | The measured 137,650 preparations motivate a hypothesis, not attribution. Statement reuse introduces a new lifetime and needs separate evidence/ownership rules. |
| [Receipt and runner](../../scripts/loredock-capture-memory/receipt.mjs), [worker](../../scripts/loredock-streaming-qualification/run.mjs) | Receipt construction temporarily overlaps projection JSON, decoded validation, originals and final snapshot. The worker keeps bounded operation metadata and first projection; large read owners should be request-local. | Inspect whether settled promises, service closures, statements or harness references retain unexpected owners after history and after explicit close/release. |

## One bounded diagnostic, prepared separately

Implement and test the observer/parser on independent tiny fixtures first. Then
freeze a fresh positive near-limit twenty-source family, its exact bytes and
source/adapter capability table, complete-path oracle, baseline hashes, settings,
artifact limits and watchdogs before observation. The consumer must use the pinned
supported `onMessage` shape. No old family is replayed and no new broad matrix is
authorized by this decision.

Use one owned long-lived preparer/reader process with the streaming candidate.
Run the existing eight-operation sequence through two replacement analyses and
evicted history. Preserve raw returns, no-write/shared-work observations and
unchanged resource gates. Do not collect a heap snapshot, force GC, run a profiler
or add a per-object registry during preparation or any of these operations.

After history returns and its raw artifacts are saved, take exactly two snapshots:

1. **After history, services open:** leave only the normal bounded worker state
   and intentionally open services reachable. Record memory immediately before and
   after snapshot generation, outside every application operation interval.
2. **After close and release:** await normal shutdown, clear owned service/runtime
   references, return from the owning stack, then take the second snapshot in a
   subsequent event-loop turn. Record the same endpoints. A closed but deliberately
   retained service must not be mistaken for a leak.

Keep expectation construction, JSON/receipt assessment and heap graph parsing in
the parent or a separate offline process after the worker finishes. The diagnostic
must not retain its own payload registry, parsed graph or service-bearing callbacks
in the worker. Preserve the original worker/cleanup failure even if later snapshot
work also fails. Missing history blocks its diagnostic snapshots explicitly.

Use pinned Node 22.23.2 `writeHeapSnapshot` with explicit owned filenames and
default options. Its synchronous export has additional memory cost and a
V8-specific schema ([Node documentation](https://nodejs.org/download/release/v22.23.2/docs/api/v8.html#v8writeheapsnapshotfilenameoptions)).
The pinned backend explicitly collects garbage while generating the heap graph
([Node wrapper](https://github.com/nodejs/node/blob/v22.23.2/src/heap_utils.cc),
[V8 generator](https://github.com/nodejs/node/blob/v22.23.2/deps/v8/src/profiler/heap-snapshot-generator.cc#L2780-L2793)).
Consequently these are intrusive terminal ownership observations. The first
snapshot perturbs the later close state; their difference cannot estimate normal
shutdown savings or replace uninstrumented acceptance. Do not add manual GC flags.

Before any frozen family is authored, the independent harness must demonstrate
bounded regular-file handling, schema/index/edge validation, explicit unknown
retainer classifications, and detection of deliberately retained versus released
objects. Set finite file/node/edge/parser-memory limits and a parent watchdog in
the subsequent protocol. Snapshot generation blocks the worker: the parent must
supervise it, preserve partial files/exits, and terminate owned work on limits.
An export cap failure or unsupported schema stops this diagnostic; no automatic
larger bound, retry or extra snapshot is allowed. Raw graph bytes, hashes, runtime
identity, stderr/exits and both pre/post endpoints remain available for review.

## Readout and decision rules

Report independently: original operation resource outcomes; source/usefulness and
history results from Task 084's `assessArm`; diagnostic completeness; snapshot
object counts/shallow sizes; and bounded strong retaining paths from roots to
identified application owners. Distinguish weak edges, shared objects and unknown
native/embedder nodes. Do not sum overlapping retained subgraphs or infer all
process residency from JavaScript heap data. Snapshot node IDs are local to their
graph; classify by verified structure and references rather than assuming IDs
match across snapshots.

- If unexpected payload/service owners survive close/release, identify an actual
  strong retaining path before scoping one lifetime fix. Harness-owned retention
  is a diagnostic defect and must not become a product optimization claim.
- If JavaScript owners are released but RSS stays high, record the unresolved
  allocator/native/runtime component. A later native-specific observation would
  need a new task; this result alone still cannot select a SQL statement cache.
- If the snapshots show only expected bounded owners, preserve that result. The
  in-operation payload/validation allocation hypothesis remains separate; these
  terminal snapshots do not measure its peak or authorize skipped validation.

Do not select another optimization from a successful snapshot export alone. After
one evidenced implementation and independent regressions, fresh **uninstrumented**
complete-path qualification must still cover both same-process and reopened
lifecycles, all eight operations, and unchanged 5,000 ms / 1,000,000 work / 150 ms /
384 MiB RSS / 64 MiB heap-growth and output bounds. No post-collection success
sample, fresh-process substitution or failed-family readback can promote the
candidate. Production, private-pilot and semantic acceptance remain separate.
