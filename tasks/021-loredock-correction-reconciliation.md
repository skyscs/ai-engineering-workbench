# Task 021 — Review and reapply earlier engineer corrections

Status: accepted through the owner's merge of PR #25 (`b4cd66e`), 2026-10-31.
Task 020 was accepted through merged PR #24
(`ff1cb6f`); the owner requested continuation.

## Objective

After updating knowledge, review earlier engineer corrections against the selected
index and explicitly reapply an eligible note without retyping it. Preserve its
origin and both index histories. Never automatically transfer old conclusions.

## Implementation boundary

- Default to the fixed previous index. Allow choosing an older recorded refresh
  ancestor, bounded at 20 indexes; no arbitrary historical/source search or name-only
  matching. Expose missing lineage and preview limits as gaps.
- Reconstruct supported original/current source projections. Match a relationship by
  kind, source identity, file paths and endpoint kinds/labels; require one mapped match
  on both sides. Reapplication eligibility additionally requires identical relationship
  semantics and complete original evidence descriptors/content hashes. Revisions and
  issued IDs may differ; that alone does not change supporting file content.
- Show unchanged-support, changed-support, missing, ambiguous, unsupported and already
  reviewed states. Only unchanged-support proposals can be explicitly applied. Matching
  support is not proof that the human statement still applies to the wider new scope.
- Add protected bounded preview/reapply APIs. Validate the exact preview hash, current
  review revision, active original version, empty target review and both authorizations.
  Preserve request replay and optimistic concurrency; no overwrite of current decisions,
  including withdrawals, and no silent automatic application on refresh or restart.
- Schema 6 adds immutable reapplication lineage referencing the exact earlier version
  and source/target checksums. Publish the new correction, provenance and recomputed
  flow dependencies atomically. Original history remains unchanged; new review is an
  independent human/unverified decision.
- Preserve the union of original and target source dependencies. Policy/source fences
  cover preview, history and replay; revocation logically purges dependent text/snapshots
  through the existing lifecycle. Opaque lineage is not an exemption from authorization.
- Add one contextual earlier-review panel with old/current evidence, explicit review/
  apply controls, optional older-index selection and late-response guards. Do not add
  setup inputs, model calls, new dependencies or answer-prompt integration.

## Acceptance

- An unchanged update proposes the prior shared delivery correction without applying
  it. Explicit approval creates a new correction, original-version lineage and review
  invalidation of both new flows; original history/evidence stays pinned.
- Changed source/config/contracts, missing or duplicate targets and unsupported adapter
  provenance cannot be applied. A current target correction/withdrawal is never replaced.
- Tests cover source/target edits after preview, exact/conflicting replay, rollback,
  lineage migration/integrity, preview/ancestry bounds, historical selection, source and
  policy fences, purge and restart. Include older-ancestor recovery after a skipped review.
- Browser acceptance verifies the review/apply decision, source links, provenance,
  historical isolation, current-target protection, changed-support state, restart,
  revocation/late responses and 390px layout. Existing answer/source acceptance passes.
- Record reproducible English artifacts, unchanged normal checkouts/Workbench data
  and zero real model calls. This is a bounded L4 delivery, not complete knowledge-ready
  acceptance or automatic semantic reconciliation.

## Follow-up

Broader orientation/guidance, answer-review integration, semantic/AI refresh, production
adapters, scale/retention and the Workbench bridge remain separate milestones.

## Verification record

`pnpm check` passes 265 tests (114 LoreDock), strict typechecks and production builds.
Production-service evaluation preserves original history, proposes without applying,
records exact lineage on explicit application, invalidates both new flow outlines and
blocks changed support after a skipped review. Original/new evidence resolves to its
own revision vector and content/span hashes. Chrome verifies explicit review/application,
origin citations, current-target protection, restart, historical/older selection,
changed-support blocking, delayed-preview revocation fencing and 390px rendering alongside
the prior source/correction/refresh scenarios. Existing answer acceptance uses four fake
invocations. Zero real model calls; no normal checkout or Workbench data changed. See
[recorded review evidence](../docs/fixtures/loredock-reconciliation/README.md).
Owner acceptance applies to this bounded delivery; broader milestone acceptance remains separate.
