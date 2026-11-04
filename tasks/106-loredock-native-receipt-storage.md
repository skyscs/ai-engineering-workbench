# Task 106 — Implement catalog-owned native receipt storage

Status: implementation started, 2026-11-04.

Implement ADR 0057 using the strict codec from Task 105. This is the
storage/lifecycle foundation; no async capture/history orchestration, new HTTP route,
browser/answer/review consumer or resource family is in scope.

Add schema 10's one-row durable catalog identity transactionally. Preserve current
logical source/history data and parser fingerprints. CatalogStore owns one receipt
storage child at its fixed UUID-bound directory, including startup recovery and close;
do not rely on an optional consumer/listener to perform source purge. Native cleanup
must precede source purge completion, retain pending state on failure and preserve
unrelated valid records. Policy fencing retains bytes; revocation removes dependencies.

Enforce at most 64 completed files and one fixed pending file, 640 KiB/file, bounded
incremental directory enumeration and descriptor reads. Use exclusive pending creation,
fsync, non-overwriting hard-link publication and exact duplicate verification under a
trusted live guard. Ordinary failure removes only newly created files; cleanup failures
remain explicit. No automatic eviction, arbitrary path, public deletion API or new user
setting. Unknown/corrupt/foreign files fail closed and remain available for repair.

Update source-only storage/history/compaction tools for schema 10 with explicit native-
file exclusions. Preserve read-only diagnostic and offline exclusive compaction behavior.
Document complete-directory backup and pre-upgrade-backup rollback; old schema-9
applications must reject the new catalog rather than bypass receipt purge.

Test owned independent inputs: exact duplicate/reopen bytes; catalog mismatch; native
hash/witness/support corruption rejection through the existing codec; capacity and every bound; symlink/FIFO/growth/truncation;
interrupted pending/final states; new/existing publication failures; repeated close and
owner conflict; source/policy transitions, partial purge/recovery and unrelated retention.
Verify migration failures, original/answer/review invariants and stopped backup/restore.
Keep preserved test references and historical measured artifacts unchanged; adapt any
new-schema comparison explicitly without erasing the original assertion.

Preserve first failures/logs, run focused and full strict checks/builds plus a compiled
owned lifecycle check, review all imports/data boundaries and require both exact-head
CI events before merge. Then scope native capture/history orchestration and final
independent assessment. No performance, full-system semantic or L5 claim follows here.
