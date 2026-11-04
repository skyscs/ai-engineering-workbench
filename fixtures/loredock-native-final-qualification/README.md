# Frozen native final-composition family

This prospective Task 110 family describes ferry ticket issuance. It exists only for
one first complete-operation qualification of the actual compiled native application.
Do not import it from ordinary tests, run it as a warmup, tune from its results or
repeat its reserved attempt. Historical resource families remain exhausted.

The workload has twenty independently owned sources, 499 files per source, 9,980 files
in total, 9,957 code inputs and 530,808 source bytes. The authored fact expectation is
21: nine symbols, four operations, five calls and three record facts. The other 9,949
code files contain only independent comments. This deliberately preserves the existing
marker-heavy workload class; it cannot prove dense-code, long-lived or other-OS bounds.
Seventeen README/marker sources have no displayed endpoint but remain full dependencies.

## Source capability review before execution

The expected result is defined by the owned source text and existing supported rules.
No reserved catalog/index/analysis/path/capture run has occurred during preparation.
Only generator counts, hashes and authored line ranges are checked before freezing.

| Segment | Construct and exact expected support |
| --- | --- |
| Vue roots | `AABook.book`, `BBReserve.reserve`, `CCConfirm.confirm`, `DDRetry.retry` use named `issueTicket` from `./issue`; these are the four ordered first-page roots. |
| HTTP | `issueTicket(passenger, route)` calls `POST /ferry/tickets`, supplies the direct `X-Passenger-Id` header and the route payload. |
| Route/handler | `routes.json` declares `Tickets.issue` and `Tickets.issue.passenger` bound to `X-Passenger-Id`; the literal header comparison matches. |
| Java publication | `Tickets.issue` constructs `TicketIssued(String passenger, String route)` and calls typed `EventPublisher.publish` with direct `"ferry.ticket.v4"`. |
| Java subscription | `ManifestWriter.start` passes the same direct topic and `this` to typed `KafkaSubscriber.subscribe`. |
| Consumer/write | The single compatible `ManifestWriter.onMessage(TicketIssued event)` constructs `PassengerKey(event.passenger())` and calls `MongoCollection.replaceOne`. The method role is `java-method`; no handler-name fallback is permitted. |
| Contract | Both scoped JSON records declare `TicketIssued`, version 4, Kafka, `ferry-native` and the same two string fields. The delivery remains a candidate with unknown deployment coherence. |
| Isolated root | `ZZLocate.locate` imports `./missing`; page four contains that root, its selected path has one symbol/no edges and an explicit `unresolved-import` omission. |

Default output contains two exact ten-node/nine-edge flows (eleven nodes and ten edges
in their union), a selected useful flow contains ten/nine, and the isolated path has
one/zero. Useful receipts retain ten originals, isolated receipts five, and every receipt
retains all twenty sources. Exact typed sequences, root order and source line ranges
are authored in `oracle.json`. Original ranges exclude only the terminal empty newline
line, matching the established extractor; full file hashes still include original bytes.

## Fixed operation and observation contract

The same-process arm retains actual indexing/analysis preparation memory. A separate
reopened process receives the identical stopped schema-10 catalog UUID and snapshot.
Each runs first capture, three repeats, selected capture, page four, isolated capture,
then history after two inventory replacements: sixteen operations and seven byte-exact
cross-process comparisons. History must revalidate every original with no fact/path/
snapshot derivation and no publication lock. Sources, legacy rows and Git remain unchanged.

Use the actual compiled worker, native v2 producer, OperationBudget, strict codec,
catalog-owned store and NativeCaptures. No experimental schema translation, fingerprint
override, profiler, per-charge array, query/owner hook, cache clear or forced collection.
Only ordinary scalar counters, aggregate work and the outer 5 ms sampler are enabled.
Raw outputs/receipts and process failures are retained before independent assessment.

The resource gate is unchanged: under 5,000 ms per complete operation, at most 1,000,000
work units, 150 ms sampled interval, 384 MiB RSS, 64 MiB heap growth, 512 KiB projection,
640 KiB receipt, 64 KiB original text, 30 spans and 20 sources. Sampled observations do
not claim continuous maxima. Lifecycle watchdogs are 600 s preparer, 180 s reader,
900 s overall and 5 s termination grace; these do not relax operation gates.

`baseline.json` pins runtime sources, emitted modules, dependency/lock/toolchain inputs
and the candidate implementation. `preflight.json` pins the generator digest and exact
size without executing services. This README, corpus, oracle, preflight, baseline and
configuration module are immutable after the freeze commit. The measured entry point
must be committed, use the pinned Node/V8 runtime and refuse any changed frozen input,
changed baseline or dirty checkout. Accepted exact-head push/PR CI and an identical-tree
merge of the driver must precede execution.

Archive the sole attempt unchanged regardless of outcome. Missing or failed content,
exact path, authority support, no-write/accounting, lifecycle, parity or resource evidence
fails/blocks the fixed gate. A failure requires a separate diagnosis/candidate and a
new future family. Passing does not establish semantic acceptance, private-pilot/L5
readiness or authorize the Workbench bridge. Product consumers follow a separate task.
