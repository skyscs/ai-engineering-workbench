# Task 090 — Bound prepared read statements to one path request

Status: scoped before implementation, 2026-11-04.

## Evidence and scope

Task 089 preserves all complete content checks but fails five long-lived RSS gates.
Its retained preparation readback and Task 080 allocation evidence support testing
repeated preparation as one allocation hypothesis. They do not establish native
ownership, a leak, or a memory saving. All previous families remain exhausted.

Implement one opt-in store/path wrapper around the unchanged Task 088 services.
Reuse prepared statements only during one `CodePaths.read` asynchronous call. Each
`one`/`all` executes again with its current bindings and returns native row shapes;
no row, authorization, payload or receipt result is cached. Writes, direct database
calls/iterators, preparation, receipt publication and history remain unchanged.

Keep at most 64 statements / 64 KiB of SQL text per store's active read scope.
Only trusted internal `SELECT` statements and the exact read-only `PRAGMA data_version`
are eligible. Eligibility is an optimization filter, not a SQL security boundary.
Excess/ineligible statements use the original fresh preparation. Isolate the scope
from unrelated asynchronous work. Nested/overlapping scopes and reentrant execution
must fall back without sharing a busy statement or changing existing path refusal.
Release every retained statement reference in `finally`, on error/cancellation and
before close. Expired asynchronous descendants must not reuse released statements.
Clearing references does not promise SQLite finalization or RSS reclamation.

## Acceptance

- Real SQLite cases prove fresh parameters/values/rows, binding and execution errors,
  count/text caps, ineligible writes, reentrancy, concurrent/outliving callbacks,
  exception cleanup and close. Constructor-time base reads remain compatible.
- Independent tiny complete captures compare exact baseline/candidate projection
  and receipt bytes, work/output/read counts and no writes, including repeated,
  selected, paged, isolated and evicted history behavior. Observe preparation counts
  only in these tiny tests; confirm reuse without treating it as resource acceptance.
- Corrupt originals/payloads/ranges, incomplete and ambiguous domains, source/policy
  changes, cancellation and final fences preserve the baseline's exact refusal.
  No validation, domain, source scope, work charge or final check is omitted.
- Keep production and all previously measured modules unchanged. Record dependency
  hashes, first development failures, source/diff review, full checks and both exact-
  head CI events. Merge only after all pass, with an identical merge tree.
- No new resource family, profiler, heap snapshot, forced collection, model call,
  corporate code or demo operation. A separate fresh frozen full qualification
  remains necessary before resource claims or production integration.
