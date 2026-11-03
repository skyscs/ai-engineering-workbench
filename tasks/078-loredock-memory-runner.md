# Task 078 — Diagnostic process and serialization regression

Status: in progress, 2026-11-03.

## Baseline and scope

Task 077's first diagnostic is rejected: 32/48 operations never execute because
the opening guard compares SQLite null-prototype rows with ordinary JSON objects.
Its measured candidate, inputs, outputs and budgets remain frozen and exhausted.
Start from reviewed head `a58e41194b6b9ff9119f9d2b050cdf74de4ba3d3`; record PR #81's
verified exact-head push/pull-request CI and merge before completing this task.

Create a separate offline runner that accepts an owned fixture and injected source
services. Compare complete source-row field values across the SQLite/JSON boundary,
preserving column, order and value checks. Do not change the frozen worker or any
production parser, API, UI, database schema, path algorithm or resource limit.

Exercise the complete preparation, closed-copy, JSON handoff, reopening, capture,
selection, paging and evicted-history protocol in three separate processes using
an independent tiny corpus. Both instrumented arms and the control must execute
all eight operations and return byte-identical receipts/projections. Reject altered
source headers explicitly and preserve nonzero child exits and diagnostics.

## Acceptance

- Normalize only valid scalar source rows; reject missing/extra/changed columns,
  row order changes and unsupported values. Test real SQLite rows through JSON.
- Verify all 24 operations, exact initial snapshot hashes, typed connected/isolated
  paths, original support, repeat/control parity and history without nested work.
- Cover the actual child entry point and metadata serialization boundary; a
  same-process factory test alone is insufficient.
- Keep ordinary CI independent of frozen corpora, diagnostic matrices, memory
  acceptance, model requests, corporate sources and the user's demo.
- Run relevant regressions, strict checks and builds; review the diff and both
  exact-head CI events before merge. Record first failures and final checks.

After this repair, prepare new prospective attribution inputs in a separate task.
No optimization is selected and no diagnostic matrix is run in Task 078.
