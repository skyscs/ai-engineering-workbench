# Task 081 — Streaming snapshot validation candidate

Status: in progress, 2026-11-03.

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
