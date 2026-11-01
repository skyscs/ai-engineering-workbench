# Task 057 — Read-only generation dependency inventory

Status: scoped before implementation, 2026-11-01.

Implement the next diagnostic defined by Task 056 and
[the retention design](../docs/loredock/RETENTION_DESIGN.md). Do not implement cleanup.

## Contract

- Add `pnpm loredock:history --data-dir /absolute/loredock-data` for existing schema-8/9
  catalogs. Share the maintenance read-only snapshot/path boundary without constructing
  CatalogStore, acquiring ownership, migrating/recovering/checkpointing work or invoking
  Git/models. Existing storage and compaction contracts remain unchanged.
- Emit versioned JSON with total generation count and at most 1,000 deterministic rows,
  bounded to 4 MiB with explicit omissions. Report build identity/time/status/current and
  baseline, file/status/raw/span/search/code-payload counters, answer/review/code-run
  counts, unfinished states, incoming baseline/reuse and cross-build reapplication counts.
- Include terminal/fenced/purged records; distinguish direct observed references from
  full transitive or embedded-JSON validation. Report SQL FK violations, dangling current
  pointers and malformed reported build metadata as inconsistent without exporting the
  malformed values. No source names/paths/text, questions, notes or connection settings.
- Explain shared FTS statistics, overlapping logical byte counters and the absence of
  deletion eligibility/reclaimable-space conclusions. Never infer no dependencies from
  omitted generations. Read-only SQLite bookkeeping remains the same documented limit.
- Cover refresh chains and real note reapplication, historical/failed answers, code runs,
  revoked payload vs retained metadata, policy fencing, pending/restart state, UTF-8,
  both schemas, empty/invalid/missing/foreign/symlink inputs, bounded output and malformed
  metadata/dangling references. Use owned synthetic fixtures and actual command execution.

## Delivery

Commit this scope before code. Update the user guide/README/design/status, run relevant
integration tests and strict/full checks/builds, retain one owned compiled/package-command
smoke with source-checkout preservation, then review/create/merge after both exact-head CI
events pass. Do not touch the running user demo or any frozen experiment/receipt. This
finishes the bounded read-only history diagnostic; future deletion/ranking/content-sharing
changes need their own contract and do not follow implicitly from the report.
