# Task 052 — Explicit offline compaction without history deletion

Status: implemented and locally verified, 2026-11-01. Scope: `b2d9332`.

Task 051 measured 90,112 reusable bytes after source removal in the small twenty-source
catalog. SQLite reuses those pages but does not shrink the database file automatically.
Provide an explicit maintenance command; preserve the running user demo and every
logical record. This does not cap retained history or solve cross-build duplication.

## Contract

- Add `pnpm loredock:compact --data-dir /absolute/loredock-data`. Accept only an explicit
  existing schema-8 catalog and existing owner file. Reject missing/foreign/symlink or
  nonregular database files. Acquire the same exclusive ownership lock as the daemon;
  an occupied directory fails without stopping or recovering any process/job.
- Do not instantiate application services, migrate schema, replay work or read normal
  configuration. Use the read-only report as the before/after basis. If there are no free
  pages, return an explicit no-op. Otherwise check SQLite integrity, checkpoint, VACUUM
  once and checkpoint again, preserving logical history, stable IDs and source boundaries.
  On a database lock or SQLite failure, report failure and release ownership without retries.
- Return an English versioned JSON summary and before/after accounting; no text, paths,
  model settings or evidence identities. Report measured allocation change, not promised
  savings. Keep current schema, parsers, query semantics and normal startup unchanged.
- Document stopping LoreDock, a complete stopped-directory backup, temporary disk space
  needed by VACUUM and command failure/recovery behavior. No scheduled or automatic cleanup,
  record deletion, manual sidecar removal, corporate input or model execution.

## Verification and delivery

Use owned synthetic data to verify live-owner rejection, no-op, database-lock failure,
invalid inputs, physical shrinkage after purge and preservation of logical rows/IDs,
both FTS rankings, original citations, saved review/answer records and code inventories.
Reopen normally and verify refresh reuse still works. Test actual CLI invocation and
retain a compiled smoke report. Run strict checks, all tests/builds, review/create PR and
merge after both exact-head CI events pass. Follow with prospective deduplication/retention
work; owner feedback and independent semantic acceptance remain separate.

## Outcome

The explicit schema-8 command acquires existing daemon ownership, reports a no-op without
free pages, or performs quick checks, checkpoints and one VACUUM. It preserves all logical
history and never recovers jobs or stops another owner. Read-only accounting also checks
the remaining standard SQLite journal/owner sidecar paths before opening a connection.

Strict types, 407 tests and builds pass, including four new integration scenarios and
the final eight-test storage regression run. Every logical table, FTS ranking, historical/
current citation, code inventory and engineer note survives the owned pressure scenario;
all thirteen remaining indexed files are reusable on the next refresh. The real package
command reclaims 126,976 bytes on the separate twenty-source smoke. User demo data and its
live process are untouched. See [verification](../docs/fixtures/loredock-storage-compaction/README.md)
and [ADR 0045](../docs/decisions/0045-loredock-offline-storage-maintenance.md).

Next: prospective deduplication/retention design. Compaction does not cap history growth;
manual product feedback and semantic acceptance remain open.
