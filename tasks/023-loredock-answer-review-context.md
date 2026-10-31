# Task 023 — Engineer review context for cited answers

Status: agent-reviewed and merged through PR #27 (`586bff3`), 2026-10-31,
after both CI runs passed. Task 022 was accepted through the owner's merge
of PR #26 (`76fdde3`). The owner authorized agent review, merge after successful
checks, and continuation to the next bounded development phase.

## Objective

Keep Ask Project aware of engineer disputes and clarifications attached to its
retrieved source passages. Let readers distinguish the exact review supplied to
an answer from later review changes without treating human notes as source facts.

## Implementation boundary

- Freeze a bounded snapshot of current, authorized, non-withdrawn corrections for
  the selected index when their original evidence overlaps the retrieved passages.
  Preserve exact note/version, human scope and original relationship labels; expose
  selection limits and omissions. A span match is a relevance hint, not proof.
- Send notes separately from source evidence. Notes are untrusted human assertions,
  never instructions, source citation IDs, verified facts or deployment evidence.
  Keep the original source-only answer schema and independent source/review labels.
- Include the review revision in the reviewed input hash. Reject stale previews and
  changes before dispatch or publication. Saved answers retain their original bytes
  and expose current/changed/not-recorded review state without automatic regeneration.
- Reuse saved JSON and dependency tables; carry every included note's source
  dependencies, including reapplication lineage. Revocation/policy fences and purge
  cover note text in answers. No new schema, model connection or source execution.
- Show included notes before generation and alongside saved answers, with original
  evidence navigation, escaped prose and source/index/review response guards.

## Acceptance

- Latest matching disputes/clarifications reach the prompt; withdrawn, other-index,
  unrelated and unauthorized notes do not. Count/UTF-8 budgets disclose omissions.
- Note IDs cannot serve as source citations. Human scope does not alter source scope.
- Preview edits, preflight changes and late completions fail without publishing stale
  review. Exact replay, historical answers and restart preserve the original snapshot.
- Current and legacy answers show honest review state; browser polling notices new
  review and withdrawal. Delayed responses cannot restore obsolete previews or revoked
  notes. All included source dependencies participate in fencing and purge.
- Focused behavioral checks, full check and production Chrome scenarios pass with
  fake runtime calls only. Record English artifacts and no claimed real-model semantic
  acceptance of the new prompt. Workbench and frozen source templates stay unchanged.

## Follow-up

Source-based note matching is intentionally conservative and incomplete. Semantic
review relevance, claim-level attribution, real-model quality evaluation, broader
adapters, scale and the Workbench bridge remain separate.

## Verification record

Full `pnpm check` passes 290 tests (139 LoreDock), strict typechecks and builds.
Production Chrome checks cover review input, literal hostile notes, original citations,
history, edit/withdrawal, restart, delayed preview/edit and answer/revocation responses,
and 390px layout with four fake runtime invocations. Source-browser regression and
frozen retrieval checks retain the existing behavior and 20/20 expected evidence sets.
No real model calls, DB migration or changes to frozen sources/Workbench data.
See [recorded evidence](../docs/fixtures/loredock-answer-review/README.md).
Agent review/merge is authorized; independent semantic acceptance remains separate.
