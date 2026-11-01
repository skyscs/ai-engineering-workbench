# Task 051 — Read-only storage accounting before retention

Status: implemented and locally verified, 2026-11-01. Scope: `d9738e8`.

The owner requested continued synthetic development while manual testing is unavailable.
Task 041 measured approximately doubled database size after an unchanged refresh. Raw
history has no retention limit, while answers, corrections, refresh baselines and reused
file receipts depend on earlier generations. Determine what occupies storage before
choosing deduplication or deletion. Preserve the running user demo and semantic gates.

## Contract

- Add an explicit advanced `pnpm loredock:storage --data-dir /absolute/directory` command
  producing an English, versioned JSON report. Require an existing LoreDock schema-8
  database; open it read-only without CatalogStore, migrations, recovery or ownership
  takeover. Reject missing/foreign/unsupported databases and nonregular/symlink data files.
- Report one consistent SQLite snapshot: page allocation, freelist pages, aggregate UTF-8
  payload sizes, generations and dependency counts. Account separately for original bytes,
  spans, both search copies, code facts, saved answers and engineer notes. Use SQLite page
  accounting to include indexes/FTS overhead, and label payload sizes as overlapping with
  physical allocation rather than additive. Measure fixed database/sidecar file lengths
  separately; this is neither filesystem allocated blocks nor a recursive directory total.
- Return aggregate counts only: no repository names/paths, source text, questions, notes,
  connection settings, identities or evidence IDs. Count dependency reasons separately;
  overlapping counts are not a deletion eligibility decision. Hash/length duplicate-byte
  estimates are candidates for investigation, not verified equality or reclaimable space.
- Perform no deletion, checkpoint, vacuum, source/Git/model operation or history mutation.
  Never read normal configuration or infer a data directory. A live owner remains running;
  SQLite snapshot statistics are consistent, but separately sampled sidecar lengths can
  change. A full scan is an explicit maintenance operation, not a poll/HTTP request.

## Verification and next step

Use owned synthetic databases to verify exact UTF-8/BLOB accounting, unchanged refresh
growth, dependency counts, code-inventory bytes, purge effects, closed-file hashes and live
job status preservation. Exercise invalid inputs/schema/symlinks and the actual CLI. Run
strict checks, full tests/builds; retain a small twenty-source before/after report and a
concrete storage design recommendation. Do not repeat frozen full-volume or model runs.
Review/create the PR and merge after both exact-head CI events pass. Continue with the
smallest measured storage improvement; owner feedback and semantic acceptance stay open.

## Outcome

The explicit JSON command performs schema-8 snapshot accounting through a read-only
connection, with separate fixed-file measurements and no content/identity export.
Strict checks, 403 tests and builds pass. Four integration tests and the owned twenty-source
compiled smoke verify accounting, dependencies, live ownership/job preservation, purge,
CLI use and unchanged closed database bytes. The user demo remains running untouched.
See [measurements and staged storage recommendation](../docs/fixtures/loredock-storage-audit/README.md).
Next: explicit offline compaction of already-free pages, preserving all logical history;
deduplication and retention require their own contracts. No model/corporate inputs used.
