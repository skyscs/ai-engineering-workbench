# Task 025 — Bulk local sources and fair baseline orientation

Status: implemented and locally verified; ready for PR/CI review. Follows merged Task 024 / PR #28.

## Scope and acceptance

1. Paste an explicit bounded list of local repository paths, preview canonical
   identities, duplicates, existing registrations and per-path failures, then add
   the valid unique set with one confirmation. No discovery, cloning or model call.
2. Revalidate the preview and registry version before atomic insertion. Persist
   request receipts for exact retry across restart; a replay cannot restore a revoked
   source. Reject altered inputs, stale previews and capacity overflow without
   partial registration. Support twenty active sources through storage, API and UI.
3. Persist a versioned allocation for new builds: deterministic equal source shares
   of the existing path/byte budgets, with root README and manifests first. Unused
   shares are not redistributed. Preserve legacy build resume, fixed-baseline reuse,
   explicit omissions, source revocation and evidence/history integrity.
4. Give all twenty sources overview cards with original context or explicit gaps.
   Reserve bounded README attempts before optional reading links. Do not expand
   answer/model contexts or imply complete architecture or semantic acceptance.
5. Verify atomicity, duplicates/aliases, invalid/changed paths, concurrent previews,
   restart/replay, migration, interruption/resume, imbalanced inventory/bytes, long
   README gaps, refresh/history, revocation and mobile onboarding/navigation.
6. Record a production twenty-source probe with durations, Git reads, extracted and
   retained bytes, omissions and zero model calls. Keep Task 024's historical blocker
   artifact. Update guide, architecture decision and development status; run the
   full check and relevant browser regressions before PR review and merge.

This is baseline source coverage, not L5 knowledge readiness. Wider retrieval,
framework support, real-model semantic review, retention and the Workbench bridge
remain separate follow-up slices.

## Verification

- Full `pnpm check`: 299 tests, strict typechecks and production builds.
- Final connected-source disclosure: web typecheck/build and all three Chrome suites.
- Twenty-source mobile browser, existing source/review workflow and optional-answer
  fake-runtime workflow pass; zero real model calls.
- Production capacity probe: all twenty sources, 79 indexed text files, twenty README
  contexts, unchanged reuse/history and separate Git/read/storage measurements.
- See [verification artifacts](../docs/fixtures/loredock-bulk-onboarding/README.md),
  [capacity result](../fixtures/loredock-scale/onboarding-result.json) and
  [ADR 0029](../docs/decisions/0029-loredock-bulk-source-baseline.md).

Next: evaluate bounded twenty-source question retrieval against the independent oracle;
keep semantic/real-model acceptance and the Workbench bridge as separate gates.
