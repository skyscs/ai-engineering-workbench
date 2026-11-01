# Read-only history command verification

Task 057, 2026-11-01. Scope `6c046e9`; compiled/package-command implementation
`1123e6c66fb0002c2d0704d51de6b7e3bb81e179`. Node 22.23.2.
[Full aggregate result and script hashes](result.json).

A separately generated twenty-source system is indexed three times and analyzed after
each publication, then one preparing build is recorded without scheduling work. The
history report runs while the store is owned and again through the actual
`pnpm --silent loredock:history --data-dir …` command after closing services.

| Generation | Indexed files | Retained raw bytes | Incoming baselines | Incoming reused files | Retained code runs |
| --- | ---: | ---: | ---: | ---: | ---: |
| First | 79 | 16,869 | 1 | 79 | 0 |
| Second | 79 | 16,869 | 1 | 79 | 1 |
| Third/current | 79 | 16,869 | 1 | 0 | 1 |
| Preparing | 0 | 0 | 0 | 0 | 0 |

The two retained code inventories each contain 28,836 payload bytes. The earlier code
run was evicted by the existing bounded code service; raw history remains. All report
fields except capture time match between live and closed reads. The command preserves
the main database and owner file byte-for-byte, including the preparing build. All twenty
source HEADs/checkout states are unchanged. No user data or running demo was used and
no model request was made. The smoke removes only its own generated fixture.

Strict checks, 428 tests and builds pass. Seven new history checks/subchecks cover real
note reapplication and withdrawal, saved succeeded/failed/running answer metadata,
retained code facts, refresh ancestry, source purge versus policy fencing, live ownership,
paused/preparing recovery state and actual schema-8/9 command execution. Further cases
check Unicode/NUL byte accounting, empty catalogs, unsupported/foreign/missing/symlinked
paths, malformed build metadata, dangling references and 1,001 generations. An incoming
reference from the omitted 1,001st generation still contributes to displayed counts.
The focused storage/history/compaction run passes 16 checks/subchecks after the shared
read-only snapshot extraction. Existing audit and compaction JSON versions are unchanged.

Two early test assumptions were corrected: the synthetic code inventory has legitimate
partial coverage, and read-only SQLite can create bookkeeping sidecars. The final checks
assert unchanged inventory and main/owner bytes, matching the documented boundary.

The report does not identify disposable generations, estimate reclaimable disk or validate
embedded citation JSON, FTS postings or complete transitive closure. SQL reference checks
and bounded metadata inspection have an explicit coverage label. A passing check is not
permission to delete. Shared historical FTS statistics can affect current ranking; the
[retention design](../../loredock/RETENTION_DESIGN.md) preserves that limitation. No frozen
evaluation or result was rerun or modified.
