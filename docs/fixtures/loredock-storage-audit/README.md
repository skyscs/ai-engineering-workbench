# Read-only storage accounting

Task 051 verification, 2026-11-01. Scope: `d9738e8`; implementation and complete evidence
are in the delivery commit. [Raw measurements](result.json) retain all four samples and
the audit implementation hash. No frozen full-volume evaluation was rerun.

`pnpm loredock:storage --data-dir /absolute/loredock-data` opens an existing schema-8
database read-only. It bypasses CatalogStore startup/recovery and ownership acquisition.
It reports aggregate counts/bytes without source paths, contents, connection settings or
evidence identities. A consistent SQLite read transaction supplies page and payload
accounting; file lengths are sampled separately and can move during a live daemon.

## Owned twenty-source measurement

Two indexes each admit the existing 79-file synthetic example. Each receives a 21-file
code inventory. The second index is an unchanged refresh. One source is then revoked;
the daemon/store are closed, and the actual CLI reads the result again.

| Measurement | Initial | Unchanged refresh | After one source removal |
| --- | ---: | ---: | ---: |
| SQLite allocated bytes | 561,152 | 827,392 | 827,392 |
| SQLite free-page bytes | 0 | 0 | 90,112 |
| Retained original bytes | 16,869 | 33,738 | 30,446 |
| Two search indexes, allocated bytes | 167,936 | 245,760 | 245,760 |
| Code-inventory allocation | 81,920 | 126,976 | 36,864 |

Payload sizes overlap physical SQLite allocation. On the refresh, original text is
33,738 bytes, spans/literal-search copies are each 33,580 bytes, question-search content
is 72,660 bytes and code fact payloads are 57,672 bytes. Metadata, indexes, page slack and
FTS structure also occupy space. Original-byte deduplication alone would therefore not
remove most database allocation on this small shape. It is not a capacity extrapolation.

Live database/sidecar lengths total approximately 4.7–5.0 MB, including WAL. After normal
shutdown the observed total is 860,160 bytes; no report command issued a checkpoint.
This distinguishes a SQLite snapshot's allocation from separately sampled file lengths.
Removal logically clears the affected originals and every dependent code inventory; free
pages become reusable inside the file without immediately shrinking its length.

Refresh-baseline, reused-file and code-inventory dependencies are counted. An independent
integration test also adds synthetic live answer/review dependencies and confirms they
overlap rather than form deletion candidates. Closed database/owner bytes, active job
statuses, ownership exclusion and original reads survive accounting unchanged. Source
checkouts keep their revisions and clean status. Model requests: zero.

## Verification and next storage steps

Strict types, 403 tests and production builds pass. Four new integration tests cover
UTF-8/NUL byte accounting, search/page totals, unchanged refresh, dependencies, code facts,
revocation, live-state preservation, the actual CLI, unchanged closed database bytes and
invalid/foreign/schema/symlink inputs. The dedicated compiled smoke passes separately.
Draft smoke assertions were corrected to include duplicates already present between
different source files and to compare SQLite row objects after JSON serialization; the
production accounting did not change in response. No browser surface or daemon behavior
changed, and the user's existing demo listener/data remain untouched.

1. Add explicit offline compaction for already-free SQLite pages, with exclusive ownership,
   unchanged logical records/citations and clear failure behavior. Do not delete history.
2. Evaluate search-content and original-content deduplication prospectively on owned copies.
   Preserve FTS ranking, stable citation identities, source-specific purge and refresh reuse.
3. Design explicit history retention only after accounting for answer/review provenance,
   baseline comparisons, reused-file receipts, interrupted jobs and current inventories.
   A recent-history UI limit and a dependency count do not authorize deletion.

Compaction cannot cap retained history growth; deduplication cannot provide a total quota
either. These are separate contracts. Manual product feedback and independent semantic
acceptance are still pending; this maintenance work does not advance the Workbench bridge.
