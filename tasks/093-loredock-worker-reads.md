# Task 093 — Reuse prepared reads within one inventory worker

Status: implemented and locally verified, 2026-11-04; exact-head CI precedes merge.

Implement the single candidate selected by Task 092: reuse bounded prepared READ
statements during one asynchronous inventory worker invocation. Reuse Task 090's
unchanged 64-statement / 64 KiB scope, fresh execution and fallback semantics. Keep
production, prior measured modules and every exhausted resource family unchanged.

Use an explicit offline subclass seam around the existing emitted `run` method.
TypeScript marks that method private, but the pinned output uses a normal prototype
method. Document and hash-bind this dependency; do not copy the scheduler or worker,
weaken its shared catalog ownership guard, or expose a production extension API.
Delegate directly to the inherited worker under `withPreparedReads`. Synchronous
start/control, checkpoint validation, writes, transactions, originals, parsing,
publication, failure handling and scheduler cleanup remain inherited unchanged.

## Acceptance

- Compare baseline and candidate on independent tiny owned stopped catalog copies
  with identical pending inventory identity. Require exact units, payload/checkpoint
  hashes, manifests, dependencies, receipts and evicted history, apart from recorded
  elapsed duration. Compare complete SQL executions/current bindings, original reads
  and writes; show fewer preparations without claiming memory improvement.
- Exercise early return, pause/resume (fresh scope), cancel, stop/reopen, ownership,
  failures, corrupted originals/checkpoints, changed authorization, bounded partial
  publication, scheduler cleanup/resume races, concurrent paths and unrelated reads.
  Preserve public synchronous returns/errors and existing async idle/stop behavior.
- Reuse existing SQLite scope regressions for finite limits, failed-entry eviction,
  recursive/nested/overlapping/expired work and close. Add worker-specific behavior
  tests rather than duplicating the implementation. Retain first failed outcomes.
- Review complete source/diff/hash/reference boundaries and pass focused/full strict
  checks plus both CI events for the exact final PR head before identical-tree merge.
- No model calls, corporate source or demo access, resource probe, profiler, forced
  collection or production promotion. A separate fresh frozen full lifecycle remains
  necessary to qualify resources after semantic acceptance.

Task 092 merged as identical-tree `5df48e0` after exact head `851e707` passed push
41750705428 and pull-request 41750754499 CI (569 tests). Its audit remains evidence
for a hypothesis, not attribution of the Task 091 RSS failure.

## Outcome

Scope `79785f2`, implementation `d6b26c1` and test correction `8505c11` retain the
planned boundary. The first checks expose a fixture-key type error and incorrect
new-test expectations for existing trigger/path fencing; only tests change.
Identical stopped copies preserve all 171 SQL executions/bindings with preparations
reduced from 171 to 30, identical writes, nine original reads, exact durable units
and ten-original receipt bytes. Lifecycle, failures, races and both overlap
directions pass. No time/memory improvement is claimed.

Full strict checks pass 581 tests and builds; built offline services import. All
410 prior baseline files remain unchanged. Eight development logs, first failures
and the verification boundary are [retained](../docs/fixtures/loredock-worker-reads/README.md).
The next task separately freezes and executes a fresh complete qualification.
