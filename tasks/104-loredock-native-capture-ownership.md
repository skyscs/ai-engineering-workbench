# Task 104 — Decide native capture storage and lifecycle ownership

Status: scoped for source/architecture review, 2026-11-04.

Task 103 supplies the internal native v2 path producer and exact shared work budget.
Before porting capture publication/history, decide who owns native receipt bytes,
their dependency scope and their bounded lifecycle. An offline caller-supplied folder
is not automatically an application storage contract.

Review CatalogStore/Catalog ownership, source revocation/purge, policy changes,
startup/recovery, retention, shutdown and stopped backup/restore. Compare the smallest
viable storage options against the current final guarded publication and history
contract. Choose one concrete design with explicit failure/recovery behavior and
finite disk/record/directory bounds. Preserve read-only source catalogs during capture;
any change to that established boundary requires an explicit decision, not hidden
accounting or an unreported write.

Define native receipt/version identities and compatibility refusal. A recorded
projection/original/dependency set must remain exact after inventory replacement and
restart; history cannot derive new paths, read fact payloads or relabel old v1/
experimental records. Revalidate authorization and original support at every read.
Revocation/policy/purge and interruption must neither expose denied text nor silently
orphan sensitive copies outside the existing lifecycle. Address idempotent publication,
partial writes, unexpected/symlink files, concurrent owners, corrupted records and
deletion/cleanup failures without broadening into arbitrary-file import.

Retain one operation budget through preparation, path work, receipt validation and
the final synchronous publication guard. Specify the boundary between an internal
capture owner and any later HTTP/browser/answer/review consumer. Keep user controls
simple; this task adds no configuration inputs or endpoint.

Produce a bounded ADR/design and the next implementation task with concrete tests,
native decoder/independent-assessment requirements and final compiled qualification
gates. No product implementation, new resource family, model call or corporate data
is in scope. Review existing source and links, preserve historical artifacts and
require both exact-head CI events before merge. Continue with the scoped implementation
after acceptance without requesting renewed user approval.
