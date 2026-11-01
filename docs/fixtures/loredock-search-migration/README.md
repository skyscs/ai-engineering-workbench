# Production literal-search migration verification

Task 055 compiled smoke, 2026-11-01. Implementation `20d2031a00205a630027c3338003bc7b97bfb4c4`;
actual legacy application `753d134d16c38c870ec365b8835145b24a641d18` from a separate clean
checkout. Node 22.23.2 / SQLite 3.51.3. [Full aggregate result and compiled hashes](result.json).

The previous application's compiled services create a fresh twenty-source fixture with
79 admitted files, two indexes and a 21-file code inventory. The new compiled application
opens that stopped schema-8 database normally. Unlike the smaller regression fixtures,
this input is produced by the actual previous writer, without test schema reversal.
The script accepts an output directory and the pinned legacy checkout, never user data.

All 3,964 token instances, 158 document identities, document sizes/global statistics and
non-literal record digests agree. All 56 query comparisons pass across migration and
compaction/reopen, including ordered literal results, raw ranks/snippets and full answer
contexts. The saved code inventory remains usable without reanalysis. A subsequent index
reuses all 79 files; portal revocation leaves FTS/mapping/FK integrity intact. All twenty
Git checkouts remain unchanged. No model calls or user-demo operations.

| Stage | SQLite allocated bytes | Free page bytes | Literal postings and mapping bytes |
| --- | ---: | ---: | ---: |
| Legacy schema 8 | 827,392 | 0 | 98,304 |
| Migrated schema 9 | 888,832 | 98,304 | 61,440 |
| Explicit package-command compaction | 790,528 | 0 | 61,440 |

Migration itself does not shrink the file: old and new indexes temporarily coexist and
freed pages remain reusable. Explicit `pnpm --silent loredock:compact --data-dir …`
reclaims 98,304 bytes afterward. The compacted catalog is 36,864 bytes (4.5%) smaller
than this legacy input, which already had no free pages. Logical searchable text remains
33,580 bytes while `copiedTextBytes` changes from 33,580 to zero. This smaller text shape
has different proportions from Task 054's 179-file measurement; 17.4% is not a universal
savings promise. No history is deleted and retained-history growth remains unbounded.

Strict types, all 421 tests and builds pass. The final 21-test storage/migration regression
also checks explicit rank vectors after the full run. Failures cover mismatched/missing/
duplicate legacy text, corrupted postings, unsupported tokenizer layout and a collision
partway through conversion. Every failed migration retains schema 8, pending recovery
state and logical records and releases ownership. File-write/purge rollback, fresh and
older schemas, nondefault rank/numeric settings, historical citations, engineer notes,
saved answer context, code facts and schema-8/9 maintenance compatibility are covered.

An initial configuration regression exposed node:sqlite REAL binding of numeric settings;
production now binds those settings as INTEGER. Historical experiment tests now recount
their retained raw results rather than applying the schema-8 prototype to schema 9.
All frozen results, pins and receipts remain unchanged. This is migration/maintenance
verification, not semantic answer quality or independent/private-pilot acceptance.
