# Task 022 — Source-backed project orientation and a first reading guide

Status: implemented and locally verified, 2026-10-31; ready for code/product review.
Task 021 was accepted through the owner's merge of
PR #25 (`b4cd66e`); the owner requested continuation.

## Objective

After indexing, help a newcomer read the repositories as one selected source set:
show what each root README documents, how to open supporting source and where to
explore declared interfaces and a partial flow. Close the basic orientation/navigation
gap without requiring model setup or presenting excerpts as verified system knowledge.

## Implementation boundary

- Add a versioned, model-free orientation projection over one authorized published
  index. Each active recorded repository has a card with original README context or
  an explicit gap, revision and coverage. New active sources absent from that index
  are listed separately; never blend their content into historical snapshots.
- Support a single unambiguous root `README`, `README.md` or `README.txt`
  (case-insensitive) and optional root `package.json` / `pom.xml`
  reading links. No name-based role inference, invented cross-repository summary,
  semantic rewriting, setup execution, arbitrary file access or source discovery.
- Quote a bounded introductory prose excerpt exactly with original inclusive line
  ranges and issued evidence IDs. Preserve contradictory/outdated README wording;
  documented intent is not runtime/deployment evidence. Render markup/instructions
  literally, not as application instructions or executable HTML.
- Validate byte/span metadata before source reads, then full original evidence and
  complete file coverage. Bound documents, per-file/aggregate bytes, excerpt lines/
  bytes and output; make unsupported/missing/ambiguous/excluded/truncated input visible.
  Examine README candidates across every source before optional manifests.
- Add a compact Project overview before the map and a collapsed Guide me route:
  repository context, declared interfaces, one existing partial flow and source gaps.
  Reuse current source/map/flow/evidence views and their human review labels. Explain
  unavailable steps; do not add setup forms, model calls, learning state or a DB schema.
- Protect the API with existing session/no-store/policy/source rules. Selected index,
  publication and source/policy boundaries fence late responses and navigation state.
  Preserve Workbench data, default model-free startup and normal checkouts.

## Acceptance

- Frozen-corpus cards retain the three documented roles and the API README's outdated
  `orders.created.v1` statement verbatim, with exact resolving source locators/hashes.
  They do not silently reconcile it with configuration or claim deployment coherence.
- Every authorized recorded source has either context or a visible reason it is
  unavailable. Missing/ambiguous/code-only README, exclusions, byte/span/output limits,
  failed inventory, malformed storage and corruption fail honestly within bounds.
- Historical text survives update/restart; new registration is an explicit unindexed
  gap. Revocation and policy changes fence content and citations, including delayed
  orientation responses. No model/Git/source execution is triggered by orientation.
- Browser checks cover initial cards, original citation/focus, Guide me navigation,
  unavailable steps, changed/missing README, historical isolation, refresh/restart,
  hostile text, delayed-response revocation and 390px rendering. Existing source,
  correction/reapplication, flow and answer regressions remain green.
- Record English documentation and reproducible production/browser artifacts with
  zero real model calls. This delivers basic orientation, not semantic understanding,
  production adapter qualification, full L3/L4/L5 acceptance or 20-repository scale.

## Follow-up

Broader project synthesis, terms/rationale, supported production frameworks, answer-review
integration, semantic/AI refresh, scale/retention and the Workbench bridge remain separate.

## Verification record

`pnpm check` passes 282 tests (131 LoreDock), strict typechecks and production builds.
Production evaluation records three original README contexts, exact source/hash locators,
preserved outdated topic prose, changed/missing documentation, historical isolation,
restart and source revocation with no orientation Git/model calls. Chrome passes context
citations/focus, Guide me navigation and an unavailable-step explanation, literal hostile
text, update/history/restart, delayed-response revocation fences and 390px layout alongside
existing source/map/flow/correction/reapplication/refresh acceptance. The existing answer
regression uses four fake invocations. Zero real model calls; frozen templates, normal
source checkouts and Workbench data remain unchanged. See
[recorded orientation evidence](../docs/fixtures/loredock-orientation/README.md).
Owner/product acceptance of this bounded delivery remains pending review.
