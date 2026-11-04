# Task 098 — Review production integration of the qualified composition

Status: scoped before review, 2026-11-04.

Task 097's single frozen qualification passes all complete-path/support/scope/work
and resource gates in both required processes. Review the complete candidate before
any production adoption. This task changes documentation only; no production code,
experimental code, input family, fixture, measurement or schema changes are allowed.

Trace streaming snapshot validation, compact/canonical path entries and bounded
prepared reads through production service ownership and every current caller.
Identify experimental-only seams, all hash/range/authorization/work/final fences,
shared ownership, shutdown/overlap behavior, storage compatibility and rollback.
Distinguish production browser reads from the offline receipt harness.

Select the smallest typed implementation boundary and explicit acceptance matrix:
independent exact-output/negative/lifecycle tests, actual protected HTTP/browser
integration, source/build/runtime identity and qualification of the final production
composition. Preserve all frozen measured dependencies and historical evidence;
production source changes must not silently invalidate ordinary historical tests.
Define how prior source-bound tests remain meaningful when production changes.

Require both Task 097 final-head CI events and an identical-tree merge before
claiming its acceptance. Record evidence and limitations without a new resource
run, causal improvement claim, model call, corporate source or demo mutation.
Full L5/private-pilot and Workbench bridge acceptance remain separate.

Commit the review and one concrete follow-up task, verify documentation links/diff
and review completeness, then require both exact-head CI events before merge.
