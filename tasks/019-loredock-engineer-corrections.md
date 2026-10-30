# Task 019 — Durable engineer corrections for relationships and flows

Status: implemented and locally verified, 2026-10-30; ready for code/product review.
Task 018 was accepted through the owner's merge
of PR #22 (`25032fd`); the owner requested continuation.

## Objective

Dispute or clarify a declaration comparison or code link, optionally state its
environment scope, and retain the correction/history across restart. Show the
original claim and the engineer-supplied correction together. Mark dependent flow
outlines as needing review without rewriting source evidence or silently invoking AI.

## Implementation boundary

- Add a separate versioned correction overlay; keep declaration-map/code-flow v1
  contracts and their source-derived facts unchanged. Only issued relationship IDs
  from an authorized published index can be targeted.
- Store append-only correction versions, original target/evidence provenance,
  explicit source dependencies and affected flow IDs in LoreDock schema 4.
  Actions are dispute, clarify and withdraw; withdrawal is a new version.
- Use request replay and compare-and-set on the current correction/project revision.
  Reject stale projection hashes, unknown/foreign targets, invalid input and bounds.
- Corrections apply only to their recorded index/adapter. Do not carry them across
  reindexing or promote human scope into observed deployment evidence. Preserve
  candidate/static status and show conflicts as engineer-supplied claims.
- Invalidate flows that use a corrected code edge. For declaration corrections,
  conservatively mark flows sharing the original supporting evidence for review.
  Keep dependency invalidation explicit and visible rather than deleting history.
- Fence correction content on policy/source changes. Conservatively depend on every
  active source in the recorded index; revocation purges all dependent versions and
  target snapshots through the existing resumable purge lifecycle.
- Add inline correction controls, optional scope, history and withdrawal, with escaped
  text and revision-tagged async UI. No new setup form or automatic AI regeneration.
- This slice reviews map/flow relationship claims. Cited-answer generation remains
  based on original source evidence; corrections are not silently sent to a provider.
  Answer-claim review/context integration remains separate work.

## Acceptance

- Disputing the shared delivery edge marks both pilot flows for review. Clarification
  with local scope remains explicitly human; it cannot confirm a production connection.
- Save, revise, reopen history and withdraw through protected APIs and the browser.
  Exact replay is idempotent; conflicting replay, concurrent/stale edits and rollback
  are tested. Restart preserves history and dependency-derived review state.
- New index selection does not inherit corrections; the historical index retains them.
  Source removal/policy fences prevent content exposure through list/history/replay.
  Purge removes dependent human text and target snapshots, including withdrawn versions.
- Migration preserves existing catalog/answer data. Bounds, invalid/foreign targets,
  unsupported adapters, damaged evidence, HTML-like input and late UI responses are
  covered. Full checks and existing source/answer browser scenarios remain green.
- Commit reproducible synthetic review evidence, updated English documentation and
  zero real model calls. No normal source checkout or Workbench data is changed.

## Follow-up

Broader project overview/guided orientation, real-framework adapter qualification,
reliable incremental updates, 20-repository acceptance and the Workbench bridge remain
separate milestones. This slice does not by itself close full L3 acceptance.

## Verification record

Full checks pass 229 tests (78 LoreDock), strict typechecks and production builds.
Synthetic service evaluation records exact replay, unchanged original map/flow hashes,
two affected flow IDs, restart-identical history, withdrawal, new-index isolation,
historical availability and source revocation/purge. Browser review exercises concurrent
editing without draft loss, history, source/index fences and 390px rendering, alongside
the earlier source/flow checks. The answer regression uses four fake invocations;
no real model is called. See [recorded evidence](../docs/fixtures/loredock-corrections/README.md).
