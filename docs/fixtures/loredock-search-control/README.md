# Matched rebuild-only control

Task 054, 2026-11-01. Design: `018763a`; frozen inputs/thresholds: `d6bfcb1`.
The single fixed comparison used committed implementation
`ff08c0449b6c17b7fa4b6eeacee21debfe5f5f05`, Node 22.23.2 and SQLite 3.51.3.
It is independent of Task 053 and leaves that result and receipt unchanged.

The [summary](summary.json) passes the frozen gate. The
[complete compressed raw result](raw-result.json.gz) retains every token/position tuple,
document identity/size, non-literal table digest, query/context output, per-object size
and implementation hash. Uncompressed JSON SHA-256:
`5ad9157720231c1783685481b58820488d5dedc149923eebdcd603635700c5e6`.
The exclusive fixed-attempt receipt is retained locally in `.loredock-evaluations/`.

## Result and attribution

One newly generated twenty-source fixture has 179 eligible files, two unchanged indexes
and a 121-file code inventory. Its stopped catalog is copied into three variants with
identical original IDs and records. Each receives one VACUUM before measurement. Totals
are compared within this run, not with Task 053's separately generated catalog.

| Variant | Compacted total bytes | Literal FTS plus mapping bytes |
| --- | ---: | ---: |
| Unchanged | 4,493,312 | 958,464 |
| Built-in literal rebuild only | 4,464,640 | 929,792 |
| External original-span content | 3,686,400 | 147,456 |

Rebuilding alone saves **28,672 bytes (0.64% of the unchanged total)**. The external-content
variant saves a further **778,240 bytes (17.4% of the rebuilt total)**, exceeding the 5%
total threshold. Its literal FTS plus mapping is **84.1% smaller** than the rebuild control,
exceeding the 10% threshold.

Per-object allocation isolates the reason: the rebuilt index's separate `search_content`
table occupies 823,296 bytes. Both rebuilt and external variants use the same 106,496
bytes for the remaining literal FTS objects. The candidate replaces the content table
with a 40,960-byte mapping and retains a 4,096-byte experiment marker, accounting exactly
for the 778,240-byte total difference. This supports text sharing rather than rebuild-only
maintenance as the next storage change on this shape. It does not establish a history cap
or predict savings on private repositories.

## Exactness and verification

All three variants retain **17,164 token occurrences across 358 documents**, including
every document rowid, column and token position. Vocabulary tuples, document sizes/global
statistics, rowid/span/content identities and every non-literal table digest agree.
All **112/112** ordered query/rank/snippet/full-context comparisons and **31/31** structural,
completeness and restart checks pass. Context hashes validate independently. Reopening
preserves the measured records and all three allocations. Source revisions and clean
Git state remain unchanged; model requests are zero.

Strict types, all **413 tests** and builds pass. A new three-source rehearsal exercises
the complete comparison and verifies that changed token positions, source identities,
query content, missing variants/contexts and inadequate size savings fail the assessment.
The final focused test passes after completeness/restart assertions were strengthened.
A separate Python recount of the retained raw vectors, context hashes, query outputs and
restart data agrees with every mechanical comparison and the space decision.

No production source, database schema, UI or API changed. The user demo stays running;
no corporate source or frozen full-volume/model run was used. The next bounded task is
production migration/write/purge hardening: preserve legacy rowids and configuration,
make conversion atomic and fail visibly on inconsistent content, retain rollback/restart
behavior, update storage reports/compaction compatibility and keep existing code inventories
usable. The prototype's SQL-string insertion hook is experimental and must not become the
production integration. Semantic acceptance and the Workbench bridge remain separate.
