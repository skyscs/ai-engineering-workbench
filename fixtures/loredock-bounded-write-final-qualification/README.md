# Frozen native composition after bounded analysis writes

This prospective Task 114 campsite family is reserved for one complete-operation run
of the accepted compiled application. Task 110 and every earlier resource family remain
exhausted. Do not run this family in ordinary CI, as a warmup, or to select/tune inputs.
Freeze all inputs and the guarded entry before the sole attempt; retain any first failure.

Twenty owned sources contain 500 files each: 10,000 files, 9,977 code inputs and
490,457 source bytes. Expected supported facts total 21: nine symbols, four operations,
five calls and three record facts. The remaining 9,969 code inputs are marker comments.
Seventeen registered README/marker sources have no displayed originals but must remain
full receipt dependencies. This preserves the earlier marker-heavy workload class.

## Capability review before execution

The oracle is authored from source text and the existing supported contracts, without
running a reserved parser, catalog, analysis, path, capture or history. Pure generation,
counts, source hashes and line-range checks are permitted. The domain/text/revisions are
new; the supported syntax and workload shape intentionally reuse the established class.
This is a reviewed source contract, not an independent human oracle or dense-code test.

| Segment | Expected supported construct |
| --- | --- |
| Root order | `AABook.book`, `BBExtend.extend`, `CCConfirm.confirm`, `DDRetry.retry` are four named Vue actions importing `reserveSite` from `./reserve`. |
| HTTP | `reserveSite(guest, site)` calls `POST /campground/bookings` with direct `X-Camp-Guest` and the site payload. |
| Route | `routes.json` declares `Bookings.reserve` and maps `Bookings.reserve.guest` to the same literal header. |
| Publisher | `Bookings.reserve` constructs `SiteBooked(String guest, String site)` and calls typed `EventPublisher.publish` with direct `"camp.site.v5"`. |
| Subscriber | `OccupancyWriter.start` passes the identical direct topic and `this` to typed `KafkaSubscriber.subscribe`. |
| Consumer | The single compatible `OccupancyWriter.onMessage(SiteBooked event)` constructs `GuestKey(event.guest())` and calls typed `MongoCollection.replaceOne`. Its role is `java-method`; no alternative handler name is inferred. |
| Contract | Both JSON contracts declare `SiteBooked`, version 5, Kafka, `camp-native` and two identical string fields. Delivery is a candidate; deployment coherence is unknown. |
| Isolated root | `ZZLocate.locate` imports `./missing`; page four returns this fifth root and its selected path has one symbol, zero edges and `unresolved-import`. |

The default two complete flows each have ten typed nodes and nine edges; their union
contains eleven nodes and ten edges. Selected useful output has one ten/nine flow.
Useful receipts contain ten originals, isolated receipts five, and all retain twenty
dependencies. Exact node/edge sequences, roots and original ranges are in `oracle.json`.
Vue ranges are 1–6, the isolated Vue range 1–5, TypeScript 1–3, `Bookings.java` 1–10,
`OccupancyWriter.java` 1–13, and JSON 1–1. The terminal empty newline line is excluded
from the span; original full-file hashes still include it. Five Vue actions, one exported
function and three Java methods account for the nine expected symbol facts.

## Frozen operation contract

The unchanged native coordinator uses actual compiled services with the bounded write
owner, the shared OperationBudget, v2 paths, strict native codec and catalog-owned
receipt storage. The same-process arm keeps genuine preparation memory. A separate
reopened process starts from the byte-identical stopped catalog UUID and snapshot.
Both run first capture, three repeats, selected capture, page four, isolated capture
and history after two inventory replacements: sixteen operations, seven raw comparisons.
History revalidates all originals/dependencies with zero fact/path/snapshot derivation,
path work or publication locks. Git, source records and legacy receipts remain unchanged.

Every gate remains fixed: under 5,000 ms per complete operation, at most 1,000,000 work
units, 150 ms sampled interval, 384 MiB RSS, 64 MiB heap growth, 512 KiB projection,
640 KiB receipt, 64 KiB original text, 30 spans and 20 sources. The 5 ms sampler measures
observations, not continuous maxima. Separate watchdogs are 600 s preparer, 180 s reader,
900 s overall and 5 s termination grace. No deliberately competing builds/tests/profilers
may run during the attempt. No forced GC, query instrumentation, per-charge arrays,
statement clearing, fingerprint overrides, schema translation or model calls.

`baseline.json` pins the accepted head, Node binary/V8, TypeScript payload, pnpm, lockfile,
source and emitted runtime closure, driver and assessor. `preflight.json` pins the pure
corpus digest/size. README, corpus, oracle, preflight, baseline and configuration become
immutable at the freeze commit. The separately committed entry verifies those inputs,
the actual runtime and a clean measured checkout, plus exact-head push/PR CI and the
identical-tree accepted merge. No resource run can begin before that acceptance.

Retain raw outputs, receipt bytes, stdout/stderr and process/watchdog outcomes before
independent scoring. Missing or failing content, exact paths, source support, usefulness,
history, accounting/no-write, lifecycle, raw parity or resources remains failed/blocked.
No retry or report repair is permitted. A pass may scope a separate public consumer
task; a failure requires bounded diagnosis/candidate work before a different family.
Neither outcome establishes whole-lifetime/dense-code bounds, semantic/user acceptance,
a private pilot, L5 or the Workbench bridge. No corporate source is used.
