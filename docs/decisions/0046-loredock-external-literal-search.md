# ADR 0046 — External-content literal search

## Status

Accepted for Task 055 implementation, 2026-11-01. Earlier controlled measurements
remain frozen; this decision does not imply semantic answer or private-pilot acceptance.

## Decision

Schema 9 removes the literal FTS index's separate text copy. An integer primary-key
mapping associates each FTS document rowid with one original span. A view joins that
mapping to `spans`; FTS5 reads the original text through this external-content view.
`question_search` remains separate because its derived path/stem text differs from
the original. Raw files and spans still repeat across index generations.

The schema-8 conversion runs in one immediate transaction under daemon ownership,
before restart recovery. It accepts the application's original FTS layout, checks FTS
integrity and complete byte-for-byte span correspondence, and preserves document rowids
and saved FTS settings. Numeric settings bind as SQLite INTEGER. Unsupported manual
layouts or inconsistent text fail visibly, without repairing or losing the old index.
The new postings are validated against external content before committing schema 9.
Failure releases ownership and rolls back this conversion; earlier schema upgrades,
if required, remain separately committed as before.

File completion inserts the original span, mapping, literal postings and derived
question postings inside the existing file transaction. Source purge deletes both
FTS indexes while original text is still present, then deletes spans and cascades the
mapping. Revocation remains fenced even if purge fails; an explicit retry/startup purge
can finish later. No generic SQL interception or experiment marker enters production.
See SQLite's [external-content contract](https://www.sqlite.org/fts5.html#external_content_tables).

Migration is a one-time full scan/rebuild at startup. It temporarily needs old and new
indexes plus SQLite journal/WAL space and can delay readiness on a large history. It
does not VACUUM automatically. Freed pages are reusable, so a database file need not
shrink until explicit offline compaction. Back up the complete stopped data directory
before upgrading. Older application builds reject schema 9; rollback requires restoring
that backup, not editing `user_version` or deleting sidecars.

Read-only storage accounting and offline compaction accept both schemas 8 and 9 without
application migration/recovery. Audit version 2 keeps `literalSearch.bytes` as logical
searchable UTF-8 bytes and adds `contentStorage` and `copiedTextBytes`; the latter is zero
on schema 9. Mapping and its unique index belong to SQLite `literalSearch` allocation.
Compaction version 2 embeds the new audit contract. Historical version-1 reports stand.

## Evidence and limits

Task 053 passes 182 lifecycle comparisons. Task 054 separates the rebuild effect and
passes complete token positions plus 112 query comparisons; external content saves
17.4% of compacted allocation against rebuilding alone on that synthetic shape.
Neither number is a universal space/latency guarantee or a retention quota.

Production coverage verifies exact legacy vocabulary, row identities, settings, ranks,
snippets, historical contexts and non-literal records, then restart, refresh, revocation,
rollback and maintenance. A compiled smoke creates its input using the actual pinned
schema-8 application. Frozen experiment scripts/results are archival; their CI assessors
recount saved raw observations, while current integration coverage tests production.
No model calls, corporate inputs, UI change or automatic user-process restart is included.
