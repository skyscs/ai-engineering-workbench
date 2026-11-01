# Task 052 — Explicit offline compaction without history deletion

Status: in progress, 2026-11-01.

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
