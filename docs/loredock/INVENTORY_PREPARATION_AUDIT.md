# Inventory replacement preparation audit

Status: Task 092 source/counter review, 2026-11-04. No optimization is implemented
or promoted by this document. Task 091's 15/16 failed resource result remains.

## Evidence and interpretation

The [retained complete qualification](../fixtures/loredock-prepared-qualification/README.md)
places the remaining RSS crossing before history: the reopened process moves from
318.793 to 356.934 to 387.031 MiB across two inventory replacements, with used heap
also growing. History begins above the 384 MiB bound and does no path/fact/snapshot
work. These endpoints identify an interval, not an allocation site or native owner.

The [independent tiny audit](../fixtures/loredock-inventory-preparation/README.md)
uses three sources, 38 files / 32 code files / 4,338 UTF-8 bytes. Its first invocation
stops before database preparation because the harness assumes four sources. The
correction matches the established three-source fixture; input bytes are identical.
Both invocations remain inspectable. The first complete audit exits zero, completes
both replacements and preserves exact evicted history with ten original reads and
zero nested path/fact/snapshot/Git/write activity.

| Observed phase | Preparations | SQL identities | Read preparations | Write preparations |
| --- | ---: | ---: | ---: | ---: |
| Reference capture | 435 | 28 | 435 | 0 |
| Replacement one: synchronous start | 54 | 17 | 19 | 35 |
| Replacement one: asynchronous worker | 585 | 13 | 520 | 65 |
| Replacement two: synchronous start | 54 | 17 | 19 | 35 |
| Replacement two: asynchronous worker | 585 | 13 | 520 | 65 |
| Evicted history | 347 | 7 | 347 | 0 |

Each worker's 520 reads use only **ten SELECT identities**; its 65 writes use three
UPDATE identities. Among the reads are 162 project queries, 97 build-header queries,
67 analysis-row queries and 33 next-pending-file queries. All six phases total 2,060
preparations across 42 identities / 7,504 SQL text bytes. Counts are direct observer
sums, not estimated large-input behavior. The observer logs templates/hashes/counts
without parameters or returned values. Its memory/timing endpoints are instrumented
and cannot qualify resources or identify ownership.

## Source ownership and lifecycle

- [`CodeAnalysis.start`](../../apps/loredock/src/code-analysis.ts#L142) checks request,
  published build/policy and coverage through `catalog.readBuild`, then authorizes
  idempotent reuse or creates a new inventory. The transaction reads complete file
  headers, constructs input/manifest identities, evicts eligible old inventories
  and inserts pending units and full source dependencies. `readBuild` does **not**
  revalidate every original here; full original checks occur in the worker.
- [`schedule` and `run`](../../apps/loredock/src/code-analysis.ts#L193) own the queued
  promise and asynchronous file loop. Every iteration rereads status/authorization,
  retrieves the next pending unit, validates metadata/input hashes, checks limits,
  and reopens the full original through `document` / `readMapDocument`. Parsing,
  ranges, canonical payload and hashes are constructed afresh. A transaction repeats
  authorization and atomically saves the unit and cumulative counters before yielding.
- Publication rechecks remaining units and build coverage. The scheduler records
  failures and clears its worker in `finally`; an explicit resume racing with cleanup
  can schedule another invocation. Pause/cancel/stop alter persisted state, and
  resume validates the complete checkpoint/manifest before starting work again.
  These are existing lifecycle requirements, not permission to bypass validation.
- [`CatalogStore.one/all`](../../apps/loredock/src/store.ts#L152) prepare each query.
  The [Task 090 wrapper](../../scripts/loredock-prepared-reads/reuse.mjs) changes this
  only inside a `CodePaths.read` scope. Inventory workers, writes and receipt/history
  work remain outside that scope. The recorded repeated worker preparations are
  therefore expected from the current source, not evidence of a missing read check.

Source review explains the counters and identifies a bounded opportunity. It does
not distinguish parser allocations, row/payload objects, SQLite allocations, runtime
collection policy or allocator retention as the cause of the failed RSS endpoint.

## One next candidate

Test **prepared read statement reuse within one asynchronous inventory worker
invocation**. Use the existing finite 64-statement / 64 KiB read-only scope semantics:
each `one`/`all` must execute again with current bindings and unchanged result rows.
Keep synchronous start/admission, writes, direct iterators, parsing, originals,
checkpoint hashing, transactions, publication and history unchanged. This focuses
on the observed repeated SELECT preparations; no result cache or second optimization
is selected. It is a testable allocation hypothesis, not a promised RSS reduction.

The scope must follow exactly one owned worker invocation, release references on
all returns/errors/pauses/cancellation/stop, and start fresh on resume. Preserve
synchronous `start`/`control` results and exceptions, asynchronous `idle`/`stop`, the
one-analysis-per-catalog guard and scheduler failure/cleanup behavior. Do not hold
a transaction across yields. Concurrent path reads and unrelated operations must
retain their existing fences and fresh execution rather than sharing the worker's
statements. Existing bounds and fallback behavior remain; clearing references is
not native finalization or forced collection.

Before resource work, use independent owned stopped copies to compare identical
inventory/checkpoint/payload and receipt/history identities, query/read/write counts,
all validation failures, pause/resume/cancel/stop, cleanup races and concurrent path
reads. Any unavoidable implementation seam must be explicit and reviewed; do not
silently weaken ownership to attach a scope. Preserve every first failure. Only a
separate fresh frozen complete uninstrumented lifecycle may establish resources.
All earlier frozen families remain exhausted, and production integration stays gated.
