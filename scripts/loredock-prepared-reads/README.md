# Request-local prepared read statements

Task 090 tests one candidate selected after the
[failed compact qualification](../../docs/fixtures/loredock-compact-qualification/README.md).
The original store prepares each query on every `one`/`all` call. This opt-in wrapper
reuses a finite set of compiled statements during one connected-path read, while
executing every query again. It changes no production consumer or previously
measured module. No resource family is authored or executed in this task.

`createPreparedReads` returns store/path subclasses around the unchanged compact
services. `CodePaths.read` opens one asynchronous scope. The store intercepts only
`one` and `all` in that scope and executes the same `get`/`all` with the current
positional parameters. Native row prototypes, values, ordering and errors remain.
The base constructor runs before scope registration and retains its original reads.

Only trusted internal SQL beginning with `SELECT` and exact `PRAGMA data_version`
are eligible. This is an optimization filter, not SQL validation or authorization.
There is no new SQL input API. Up to 64 distinct statements and 64 KiB of their
UTF-8 SQL text can remain referenced. At either bound, other queries prepare afresh;
there is no eviction or growing overflow list. Limits may only decrease.

AsyncLocalStorage isolates unrelated calls across cooperative yields. One store
has at most one active scope. Nested/overlapping calls execute without reuse and
retain the existing `PATHS_BUSY`/stop behavior. A synchronous recursive execution
uses a fresh statement instead of reentering a busy one. An execution failure drops
that entry and propagates the same error. Successful completion, rejection and
cancellation clear the map in `finally`; close clears it and disables the context
before the original close. Expired descendants fall back to fresh preparation.

The [pinned Node SQLite contract](https://nodejs.org/download/release/v22.23.2/docs/api/sqlite.html#class-statementsync)
supports repeatedly executing a prepared statement with bound parameters. The
[asynchronous context contract](https://nodejs.org/download/release/v22.23.2/docs/api/async_context.html#asynclocalstoragerunstore-callback-args)
provides scope propagation through the callback's asynchronous work. The wrapper
does not promise native statement finalization or RSS reclamation when references
are released. SQLite may retain the latest bindings for a statement's lifetime.

No result row, authorization decision, original, payload or receipt is reused.
Every source/hash/range/fact check, full domain, work charge, metadata check and final
fence still executes. Direct database statements/iterators and writes remain on
their original paths. Receipt work outside `CodePaths.read`, publication and evicted
history are unchanged. There is no cross-request cache or manual collection.

## Verification boundary

Independent real SQLite tests cover binding/row freshness, external commits and
schema changes, errors, count/text caps, ineligible statements, concurrent/nested/
expired callbacks, recursive execution and close. Tiny full captures compare exact
baseline/candidate receipt/projection bytes, consumed identities, work/output/read
counts and no writes across repetitions, selection, paging, isolation and evicted
history. Preparation counts only establish that the candidate actually reuses
statements; they do not establish time, memory or resource acceptance.

Negative and adversarial integration cases cover corrupted unreferenced payloads,
original bytes and ranges, incomplete imports, ambiguous handlers, unsupported
consumers, changed policy/registry, cancellation, metadata fences, overlapping reads,
stop and final receipt publication. `baseline.json` records unchanged dependencies.
See [retained verification](../../docs/fixtures/loredock-prepared-reads/README.md).
A fresh frozen complete uninstrumented qualification for both process lifecycles
remains mandatory before any resource claim or production integration.
