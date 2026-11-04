# Task 098 — Review production integration of the qualified composition

Status: review completed, 2026-11-04; exact-head CI precedes merge.

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

## Outcome

Scope `013aee6` precedes the source review. The
[integration review](../docs/loredock/QUALIFIED_COMPOSITION_INTEGRATION.md) identifies
that the qualified composition includes changed topic semantics, identities and
offline receipts as well as resource ownership. ADR 0056 separates transient
representation integration from the versioned producer/receipt migration.

The review maps launcher/fallback HTTP services, symbol lookup, automatic/manual
analysis, shutdown, browser state and existing consumers. It defines exact v1
equivalence, fresh final-composition qualification, rollback and a portable test-only
baseline so historical source-bound comparisons retain an independent control.
[Task 099](099-loredock-typed-resource-primitives.md) selects only three typed,
unconnected resource primitives first. No application or measurement code changes.

Documentation link and complete-diff review cover this change. Local executable
checks are not rerun for documentation alone; both CI events remain required.

Task 097 final head `d1f7c88` passed push 41819966325 and pull-request 41820108045
CI (597 tests), then merged as identical-tree `592bbc0`, verified before completing
this review.
