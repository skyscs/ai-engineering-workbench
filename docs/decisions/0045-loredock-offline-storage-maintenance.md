# ADR 0045 — Explicit offline storage maintenance

Status: implemented and locally verified, 2026-11-01. Tasks 051–052.

## Context

Raw index generations retain independent bytes and search copies. History links include
answer attempts, engineer corrections, refresh baselines, reused-file receipts and code
inventories. Task 051 separated payload sizes, physical page allocation and live sidecars,
and measured free pages after source removal. Neither a history display limit nor a byte
estimate establishes safe deletion eligibility.

## Decision

Keep storage maintenance outside normal startup and the browser workflow. Two explicit
source-build commands accept an absolute existing LoreDock directory:

- `loredock:storage` opens schema 8 read-only, takes a consistent read snapshot and reports
  aggregate sizes/dependencies without application recovery or ownership takeover.
- `loredock:compact` first requires existing regular database/owner files and acquires
  the daemon's exclusive `.owner.db` transaction. An active owner fails immediately.
  It obtains the report, returns a no-op if no whole free pages exist, or performs SQLite
  quick checks, WAL checkpoints and one VACUUM. It closes the database and reports actual
  before/after allocation while still holding ownership. Database locks/failures release
  ownership and surface an error without retries or process termination.

Neither command instantiates CatalogStore, migrates schema or changes job status. The
compactor delegates physical rewriting to SQLite and deletes no logical records. No source,
Git, model or normal configuration access is added. All standard main/owner database
journal/WAL/shared-memory paths are checked for regular files; no path appears in JSON
reports. Only explicit command arguments select the local catalog.

## Consequences and limits

The operator stops LoreDock, copies the complete data directory for backup and supplies
enough temporary space for the rewritten database/WAL. No sidecar or ownership file is
manually deleted. A late failure may follow an already completed checkpoint/VACUUM; do
not infer that every byte is unchanged on failure. Logical job recovery remains normal
daemon startup's responsibility. An error never triggers a hidden retry.

Compaction can reduce file allocation and preserve citations/history, but cannot cap
retained history growth. Further savings require prospectively tested deduplication or
explicit retention rules with provenance/fencing support. This changes no database schema,
parser fingerprint, query behavior, model evaluation or semantic acceptance gate.

See [accounting](../fixtures/loredock-storage-audit/README.md) and
[compaction verification](../fixtures/loredock-storage-compaction/README.md).
