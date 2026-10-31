# Task 032 — Source-backed interface comparisons in answer context

Status: implemented and locally verified. Follows Task 031 / merged PR #35 (`ab54021`).

## Scope and acceptance

1. Establish an independent client/handler example before implementation. Keep frozen
   evaluation corpora, answers, scores and contracts unchanged. Model budget: zero.
2. Add a separately versioned static-analysis block to answer previews, immutable inputs
   and the issued prompt. Include only admitted HTTP candidates whose complete evidence
   already occurs in the retrieved spans; never expand or replace source retrieval.
3. Preserve match/gap/unknown semantics and candidate status. Derived labels/identifiers
   are not source citations or runtime facts. Retain adapter provenance and both originals;
   explain incomplete selection, omitted comparisons and bounded graph coverage.
4. Limit complete comparisons to six and 8 KiB serialized comparison data. Fit the complete
   prompt within the existing 96 KiB cap by omitting whole comparisons, without dropping
   original spans or engineer notes. Reject an oversized base context before runtime setup.
5. Hash and persist the exact reviewed block. Recheck current derivation/support before
   publication; reject altered provenance, unsupported versions and rehashed invented
   comparisons. Preserve registry/policy/review changes and source revocation fencing.
6. Advance the prompt version. Keep retrieval v7, answer schema v3 and database v7 unchanged.
   Older immutable contexts omit the new optional field; do not backfill or rescore them.
   The exhausted Task 030 contract must reject the new production prompt before dispatch.
7. Show derived comparisons separately from source passages and engineer notes in preview
   and saved answers, with original citations, omission explanations, escaped text and
   mobile/keyboard support. Preserve late-response and historical selection boundaries.
8. Test independent mismatch/match/unknown cases, complete-support admission, count/byte/
   prompt limits, tampering, legacy/restart/replay and revocation. Verify existing retrieval
   baselines without model calls, full checks and browser acceptance. Document remaining
   semantic uncertainty and merge only after both exact-head CI runs pass.

Further model qualification requires a new prospective design and explicit budget. This
task does not change the failed historical semantic gates or claim full-system readiness.

## Outcome

- Prompt v9 and the preview/history UI include separately labeled, source-backed static
  comparisons. Admission never changes retrieved source spans or engineer review notes.
- Six-comparison / 8 KiB selection and exact 96 KiB prompt fitting disclose omissions;
  publication validates original support and derivation, including rehashed tampering.
- Retrieval v7, answer/database schemas and older context bytes remain unchanged.
  The exhausted v8 protocol rejects current production services before preparation.
- Full check: 334 tests, typechecks and builds. The independent baseline failed before
  implementation. Focused tests and both browser scenarios pass with zero real calls.
- Recall remains 24/24, 20/20 and 20/20; original selections match the previous baselines.
  Maximum observed expanded/prospective prompt: 35,958 bytes, below the existing cap.
- Review found no remaining blocking defect within scope. New semantic qualification
  remains pending; see [ADR 0035](../docs/decisions/0035-loredock-answer-interface-context.md)
  and [retained evidence](../docs/fixtures/loredock-answer-interfaces/README.md).
