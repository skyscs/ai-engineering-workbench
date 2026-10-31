# Task 045 — Durable bounded per-file code inventory

Status: implemented and locally verified, 2026-11-01.
Scope was committed in `f04b283` after merged PR #48 (`a35c7e5`).

Task 044 found complete bounded extraction feasible on the synthetic volume: 3,621
files, 741,496 fact bytes, identical repeat records and explicit unsupported syntax.
Implement a production service that persists those per-file results independently of
the sampled interactive graph. This is a storage/lifecycle foundation; automatic index
integration, HTTP/UI and broader query use belong to the following task.

## Contract

- Use only authorized published stored source bytes, with a pinned build and current
  policy/registry. Enumerate the current code extensions in saved source/path order.
  Preserve the parser implementations and their syntax guards. No Git reads, source
  execution, model requests or corporate fixtures are added.
- Fingerprint actual parser, extraction/validation and TypeScript dependency bytes,
  including the runtime identity. Development and compiled fingerprints may differ;
  mismatches refuse reads/resume instead of relabeling old facts.
- Bound candidates to 10,000, complete file bytes to 32 KiB, spans to eight, examined
  bytes to 50 MiB, serialized per-file payload to 128 KiB, total payload to 16 MiB and
  cumulative active elapsed time to five minutes. Payload bounds include original
  locators/ranges and facts. Explicitly mark every excluded, failed or unattempted file;
  unsupported parser gaps remain visible even when the file was examined.
- Persist a run and pending file units before scheduling. Allow one active run. Start
  is idempotent for retained request identities and refuses changed inputs. Pause/cancel
  take effect between complete bounded files. Restart/shutdown interrupts; explicit
  resume validates original inputs and every completed checkpoint on the same index.
  Never resume automatically or reset cumulative budgets. New runs parse again; no
  cross-revision reuse or performance promise.
- Each file result and its counters commit together in a short transaction. Bind the
  payload hash to its file/build/source/revision/blob/content/fingerprint. Validate
  complete originals, UTF-16 ranges and owner references on resume and reading facts.
  Derived facts never become independent citation authority. Publish only a terminal
  complete/partial inventory; preserve the previous completed inventory on failure.
- Add schema 8 without rewriting old source, answer or correction history. Keep at most
  two inventories: the most recent published one plus its predecessor or one in progress.
  Starting a new run evicts the other replaceable inventory; outstanding active work
  must be paused/cancelled explicitly. Retained request IDs replay; evicted IDs/results
  have no lifetime replay guarantee. No saved answer depends on this disposable cache.
  The two payload budgets cap derived JSON at 32 MiB; metadata/SQLite overhead, WAL and
  the independently retained raw indexes are outside this payload limit.
- Source registry/policy changes fence the run before another unit or fact read. Purge
  all dependent per-file derivatives on source revocation, including completed and
  interrupted runs, in the catalog's existing purge transaction. Policy changes clear
  obsolete derived payloads too. External backups remain outside logical purge.

## Acceptance and follow-up

Use small owned fixtures for restart/resume, corruption, changed fingerprints, every
budget, atomic failure, request replay, concurrency, retention, source/policy fencing,
revocation purge and migration. Prove ordinary projections and saved originals remain
unchanged. Run strict types, relevant tests and full checks; no new full-volume/model
benchmark is needed for this foundation. Document the architecture and availability.

After exact-head push and pull-request CI pass, merge and continue immediately with
simple coverage UI/protected API integration, then bounded query use of the full inventory.
Do not silently enlarge the graph or answer prompt or infer semantic acceptance.

## Implementation

`CodeAnalysis` and its bounded fact validator add durable run/file/source-dependency
records under schema 8. Actual installed module/dependency and Node fingerprints reject
stale reads/resume. Original content, Git blob hashes, complete spans and UTF-16 ranges
are checked without Git execution. File payloads and counters commit atomically.

Pause/cancel, restart interruption, explicit validated resume, failed-run preservation
and at most two retained inventories are implemented. A policy/registry trigger fences
and clears derivatives atomically, including registration changes; revocation purge adds
a recovery path for all dependent inventories. Legacy source/answer/correction history
remains separate. The service has no daemon startup hook, HTTP endpoint or UI in this task.
See [ADR 0040](../docs/decisions/0040-loredock-durable-code-inventory.md).

Nine focused tests cover the lifecycle and integrity contract, including a 121-file
owned shape beyond the graph's 100-document sample. Seven unsupported-syntax messages
belong to six files; both remain distinct from complete language coverage. No new model
or full-volume acceptance run was performed. Follow with API/coverage integration, then
bounded query use; no cross-revision reuse is introduced.

Strict types, all 375 tests, production builds and the compiled-service smoke pass. See
[verification](../docs/fixtures/loredock-durable-code-inventory/README.md).
