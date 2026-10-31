# Durable code inventory verification

Task 045, 2026-11-01. Scope was committed in `f04b283` after PR #48 reached main
as `a35c7e5`. This verifies the internal production service, not a new capacity or
semantic acceptance experiment. See [ADR 0040](../../decisions/0040-loredock-durable-code-inventory.md).

Strict types, all 375 tests and production builds pass. Nine focused tests cover:

- Retained request replay, conflicting inputs, single-worker admission and unchanged
  ordinary graph/answer behavior; refreshed indexes are parsed again with new file IDs.
- Pause, shutdown/process-loss recovery, explicit resume and the pause/resume cleanup race.
- Corrupt payloads, original bytes/span hashes, manifests, counters, Git blobs, parser
  fingerprints and changed limits. Bad data never silently becomes a cache hit.
- Every byte/document/span/time budget, cumulative resume bounds, explicit omissions
  and atomic file/counter rollback on a simulated SQLite write failure.
- Two-inventory retention, previous publication after failure, registration/revocation/
  policy fencing and derivative purge across restart, plus schema 7 migration.
- A small twenty-source shape with 121 code candidates: all are retained while the
  existing graph still examines 100. Three bounded pages contain 50/50/21 files.
  Seven unsupported-syntax messages in six files remain visible.

The first full check caught a mistaken test expectation that equated gap messages with
files; the fixture contains two gaps in one AMD file. The expectation was corrected to
six affected files, without changing parser output or weakening its seven-gap assertion.
Review additionally added Git blob hashing of original bytes and its corruption test.
The final full check passes.

The [compiled smoke result](compiled-smoke.json) records a separate fresh three-source
fixture exercised through built JavaScript: five code files retain their original
references, source checkouts stay clean and model requests/answer attempts are zero.
Its compiled fingerprint intentionally differs from source-mode execution. This is an
installation-path check, not a performance target. Only owned temporary data was removed.

No HTTP/UI or automatically started worker is introduced here. Follow with simple coverage
integration, then separately bounded query use. Historical full-volume/model reports,
failed semantic gates and independent/private-project acceptance remain unchanged.
