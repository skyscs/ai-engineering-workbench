# Explicit offline compaction verification

Task 052, 2026-11-01. Scope: `b2d9332`. [Full package-command result](result.json) includes
before/after aggregate reports and the compaction implementation hash. The user demo on
port 4244 remains running; every compaction target is separately generated owned data.

The final compiled twenty-source smoke prepares the existing 79-file/21-code-file demo,
publishes one unchanged refresh and removes the synthetic portal source. After closing
the application, the actual `pnpm --silent loredock:compact --data-dir ...` command reduces
SQLite allocation from **839,680 to 712,704 bytes**, reclaiming **126,976 bytes**. Free pages
fall to zero, payload/dependency totals agree and all generation rows and a surviving
original citation agree after normal reopening. Fresh UUIDs and page packing can change
absolute sizes across generated examples; this is not a full-volume capacity benchmark.

Four integration tests separately verify:

- a three-source fixture with a deliberately large removable Markdown file, two early
  generations, source purge, a new surviving index/inventory, an engineer correction and
  a synthetic stored answer row. Compaction reclaims over 1 MiB. Every table's logical rows
  agree, including FTS shadow tables; both FTS rankings, historical/current text search,
  original evidence, review history and code inventory agree. The next refresh reuses all
  thirteen indexed files and retains the expected baseline;
- live-owner rejection and the real CLI's byte-preserving no-op on an empty catalog;
- an independent database writer blocking maintenance, with unchanged logical rows and
  ownership released afterward;
- missing/unsupported databases and symlinked main/owner sidecars, without creation or
  migration. Read-only accounting uses the same expanded set of sidecar checks.

Strict types, all **407 tests** and production builds pass. The final eight-test accounting/
compaction run and package smoke pass after the sidecar guard review. The first draft
logical snapshot helper assumed every SQLite table had a rowid; it was corrected to use
primary-key order for FTS `WITHOUT ROWID` tables. No product behavior was changed for that
test-harness issue. No browser changes, corporate sources, model calls or frozen evaluation
reruns are involved. The stored synthetic answer row tests retention, not answer quality.

The command checks integrity, checkpoints, vacuums once and checkpoints again only when
whole free pages exist. It needs offline ownership and temporary disk space. A later
failure can occur after some physical maintenance has completed; it reports the error and
never retries automatically. No history is deleted. Retained growth, deduplication and a
future retention policy remain separate from reclaiming free pages; see
[ADR 0045](../../decisions/0045-loredock-offline-storage-maintenance.md).
