# Task 081 — Streaming snapshot validation candidate

Status: implemented and locally verified, 2026-11-03; resource qualification pending.

## Baseline and scope

Task 080's single profile identifies three complete-header arrays inside snapshot
checks as an avoidable allocation target. Start from reviewed head `d0af1c4`; verify
PR #84's exact-head push/pull-request CI and identical merge tree before completion.
All old measurements, code, inputs and failures remain frozen and exhausted.

Implement one opt-in offline candidate that replaces only CodeAnalysis.snapshot.
Stream the same bounded SQL header rows in ordinal order. Validate every existing
checkpoint, status, ordinal, stored/payload/input byte, gap, count, manifest and
authorization condition. Hash the identical JSON array representation incrementally
and retain only ordered parsed-file IDs. Keep the three snapshot calls and every
path/receipt charge, original read and final publication fence unchanged.

Use a narrow injected analysis subclass over public catalog/store operations. The
candidate carries the baseline's authorization checks explicitly; production code
and its private API remain unchanged. Pin the copied source identity and compare
against the production snapshot on independent real SQLite inputs. Do not add SQL
statement/result caching, forced GC, skipped fact-free inputs or larger limits.

## Acceptance

- Exact complete snapshot and receipt bytes match the baseline on independent tiny
  fixtures, including empty and mixed parsed/unparsed units and JSON escaping.
- Corrupt checkpoints, ordinal/count/manifest/byte fields, pending rows, unavailable
  inventory, changed parser/limits/source policy and revocation retain explicit
  refusal. A malformed later row cannot escape validation; iterator cleanup must
  permit subsequent reads after refusal.
- Exercise the full original-supported capture, repeats, selected/isolated paths,
  root paging and history after analysis eviction with unchanged accounting and
  final fences. Require identical results on equivalent stopped copies.
- Keep CI independent of frozen profiling/resource families and machine-dependent
  memory acceptance. Verify bounded iteration without materializing all headers.
- Preserve first failures and logs; run relevant regressions, strict checks/builds
  and both exact-head CI events before merge.

This task implements and functionally verifies the candidate only. It does not
measure memory savings, change an application consumer or claim resource/private-
pilot acceptance. A separate task freezes new uninstrumented first/repeat/selected/
page/history qualification in long-lived and reopened processes with unchanged
time/work/output/heap/RSS limits. History RSS remains an unresolved requirement.
No corporate sources, model calls, old matrix reruns or demo operations.

## Implementation checkpoint

Scope `25764e9`. PR #84 merged as `a1c14436a15c9d1d6758d8772a898c19f61aa18e`
after exact head `d0af1c4845c91baefaac9a95adfc217fa49c8717` passed push 41630183897
and pull-request 41630230466 CI (515 tests). The merge tree is identical and is
included in this branch. Main is synchronized without rebuilding or demo changes.

The separate factory streams complete headers and hash input through the same
checks, retaining only parsed IDs. Real-SQLite differential tests pass for mixed
and empty snapshots, escaped hash input, late corruption, limits, policy/parser/
publication changes, revocation and the exact 10,000-header boundary. The first
test run exposed a test-only nested transaction in the revocation case; moving
that final case outside the rollback savepoint preserves the real revoke method.
Its original failure log remains retained, followed by three passing tests.

The full three-process regression passes on its first run: 24 operations retain
identical receipt/projection bytes and shared work across candidate/baseline,
including repeats, selected/isolated paths, page four and history after eviction.
Focused typechecking and the first full `pnpm check` pass: 519 tests, strict checks
and builds. [Retained logs](../docs/fixtures/loredock-streaming-snapshot/README.md)
include the original test setup failure and all later outcomes. Source/hash/diff
review confirms unchanged production and measured baseline code. No memory
qualification or frozen corpus execution has occurred.
