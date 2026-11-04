# Native replacement-worker ownership audit

Task 111 identifies three repeated write preparations as a bounded candidate after
Task 110's failed memory gate. It does **not** establish the cause of that RSS sample.
The [first diagnostic](../fixtures/loredock-native-worker-ownership/README.md) uses
actual compiled services and one fresh four-source input: 47 files, 40 code inputs,
5,201 bytes, SHA-256 `3d01d961a1165113b91894e343b3643252c60d0ca526c6badadea1b66469c24c`.
The existing small permit example is extended with 32 new comment-only diagnostic
files. It is not a held-out qualification family. No prior reserved family is run.

## Observed calls

The observer stores bounded SQL identities and aggregate counts, without arguments,
rows, native statement references or per-call records. It changes allocation/timing;
no memory score or native allocation attribution is attempted. Exactly 47 templates
and 7,581 SQL bytes are retained, below 128 identities/64 KiB. Seven stages are recorded.
Preparation, statement invocation and `db.exec` calls are distinct dimensions.

| Stage | Prepare calls | Statement invocations | Write invocations | `exec` calls |
| --- | ---: | ---: | ---: | ---: |
| Native capture | 390 | 1,103 | 0 | 2 |
| First replacement admission | 63 | 63 | 43 | 2 |
| First replacement worker | 92 | 729 | 81 | 80 |
| Second replacement admission | 63 | 63 | 43 | 2 |
| Second replacement worker | 92 | 729 | 81 | 80 |
| Evicted history | 289 | 289 | 0 | 0 |
| Owner close | 0 | 0 | 0 | 1 |

Each admission prepares the same `code_analysis_files` INSERT forty times. Each
worker prepares the checkpoint UPDATE forty times and cumulative-counter UPDATE
forty times. Its remaining write is the single final publication. Eleven prepared
reads serve 648 read invocations within the existing read scope. The forty individual
transactions, all original validations and the final publication still execute.
Each replacement has 124 `store.run` calls. The observed large-run counter of 59,750
for two replacements is consistent with the same `2 * (3 * 9957 + 4)` call structure;
this arithmetic neither measures nor extrapolates memory savings.

Both replacements parse all forty inputs and publish explicit partial coverage:
32 comment-only files retain their existing unsupported-syntax gaps. History returns
the exact saved projection, ten originals and all four dependencies after eviction.
It reads exactly ten originals with zero Git calls, source/derived writes, fact reads,
snapshots, path reads, path work or publication locks. All source table bytes hash
identically before/after. Actual service owners close successfully. No model is used.

## Owners and lifetimes reviewed

| Owner | Retained data and release boundary |
| --- | --- |
| `CodeAnalysis.start` | Bounded metadata array and `{fileId,inputHash}` manifest, at most 10,000 units; synchronous admission transaction inserts each pending row. Locals expire on return/error. It does not retain all payloads. |
| `CodeAnalysis.schedule` | One worker promise/ID per catalog, one prepared-read scope, no global worker queue. The read scope expires in `finally`; worker cleanup releases its owner and handles the explicit resume race. |
| `CodeAnalysis.run/save` | One pending unit, validated full document, parser facts/ranges and serialized payload at a time in normal processing. Per-file transaction reauthorizes before checkpoint plus cumulative counters. Yield occurs after commit. Input/payload limits and error paths remain active. |
| Budget-stop and explicit resume | Existing bounded pending/full-unit arrays are still materialized by these paths; resume validates every stored unit. The audit does not exercise these branches or infer their memory bound from the normal worker. |
| `PreparedReadScope` | Per-store async context, at most 64 statements/64 KiB SQL, no row cache. Nested/overlapping work falls back to fresh preparation. Error evicts the statement; scope expiry/close clears references. |
| `CatalogStore.run` | Every write calls `db.prepare(sql).run(...args)` afresh. There is no explicit retained write cache, immediate native finalization API or proven per-call native release. |
| `CodeAnalysis.snapshot` | Synchronous ordered iterator hashes headers one at a time and retains bounded parsed file IDs. Payloads are validated separately by `file`; it is not an all-payload snapshot. |
| Native capture/history | Operation-owned originals, codec buffers and shared budget. Capture holds the final source fence through publication; history reopens originals without deriving paths. Existing stop/failure cleanup is retained. |
| Store shutdown | Native receipt owner closes before read-scope references, database and exclusive catalog owner. Diagnostic closure includes the actual WAL checkpoint/close sequence. |

The pinned [Node 22.23.2 implementation](https://github.com/nodejs/node/blob/v22.23.2/src/node_sqlite.cc)
clears bindings before each bind operation and resets statements around `run`.
It finalizes them in native destruction or database closure. Its public
[StatementSync API](https://nodejs.org/download/release/v22.23.2/docs/api/sqlite.html#class-statementsync)
does not expose per-statement finalization or binding clearing. SQLite documents that
[reset preserves bindings](https://www.sqlite.org/c3ref/reset.html). Therefore a retained
statement may retain its last bound value between calls; dropping a JS reference is
not a synchronous native-memory release guarantee. These source-level facts do not
attribute Task 110's process RSS to any particular native allocation.

## Candidate and acceptance boundary

[Task 112](../../tasks/112-loredock-bounded-analysis-writes.md) may reuse only the three
exact repeated statements inside explicit per-store admission/worker scopes. Keep
`PreparedReadScope` read-only. Do not add a process-wide mutation cache, batch files,
skip validation, retain result rows or change transaction ordering. The single final
publication and unrelated writes need no caching. All source, schema, work/output and
operation limits remain unchanged.

Require a fixed three-statement/4 KiB SQL ceiling and a 144 KiB bound on admitted
variable-size bindings per statement; exceeding it uses the existing fresh path.
The latter includes a bounded 128 KiB payload plus metadata and describes admitted
binding bytes, not total native heap. References expire on every synchronous return,
async completion, pause/cancel/failure and store close; overlap/reentrancy uses fresh
statements. Evict on execution errors and preserve the exact thrown error and SQLite
result. Never execute a write again merely to clear its bindings.

Before integrating, preserve independent prior-behavior controls and verify actual
changing/null/blob bindings, rollback, constraint errors, scope isolation/expiry,
failure between checkpoint/counters, cancellation, revoke/policy fencing, restart,
retention and native capture/history. Changing the hashed analysis implementation
must invalidate its inventory fingerprint normally; never disguise parser identity.
A successful candidate still needs independent compiled regression and a different
future reserved family. Task 110 stays failed/exhausted; public consumers, semantic
acceptance, private pilot, L5 and the Workbench bridge remain separate gates.
