# LoreDock engineer-correction acceptance evidence

Date: 2026-10-30. Scope: [Task 019](../../../tasks/019-loredock-engineer-corrections.md).
These are implementation-agent checks using synthetic engineer input, not signed
production knowledge or full L3 acceptance.

## Service evaluation

[correction-result.json](correction-result.json) records production storage/services
over the original frozen three-repository corpus. No oracle/model output is an input.
It includes the original revision vector, three immutable versions (dispute, scoped
clarification, withdrawal), original relationship/evidence provenance and six resolving
supporting evidence records.

- The shared delivery correction affects both original flow IDs. Human/local scope
  remains unverified; original candidate/static/deployment labels remain unchanged.
- Exact replay creates no duplicate. Restart preserves byte-equivalent history;
  map/flow projections remain identical before/after review edits.
- Withdrawal clears the active effect and retains earlier versions. New indexes do
  not inherit the correction; selecting its historical index retains review history.
- All original index sources are conservative dependencies. Removing the portal also
  fences/purges a delivery note about the API/worker. No dependent statement, environment
  or target snapshot remains in logical storage; withdrawn versions are included.

The artifact deliberately retains an authorized history snapshot captured before the
synthetic revocation. Such external copies are outside application-controlled purge.

## Automated and browser checks

Full `pnpm check`: **229 tests** (17 Git, 18 AI, 43 storage, 78 LoreDock, 57 daemon,
16 scripts), strict typechecks and production builds. Tests cover schema 3 migration
with preserved answer/evidence bytes, request replay independent of JSON key order,
competing edits, stale projection hashes, foreign/invalid targets, rollback, immutable
history, source/policy fences, resumable purge, damaged evidence and resource limits.
Human scope and original source scope are asserted separately.

[browser-result.json](browser-result.json) covers inline dispute/scoped clarification,
both outlines needing review, a concurrent editor with retained draft and explicit
reconciliation, version history, withdrawal/replacement, restart, new-index isolation,
historical selection and delayed-response revocation fencing. The browser exercises
five versions. An older correction response containing actual fixture note text is
held until after source removal, then released; no content is restored.

Human input contains adversarial HTML, rendered as literal text with no image or
handler execution. The source fixture also keeps the earlier temporary hostile package
label variation. Frozen corpus files are unchanged. See [desktop](desktop.png) and
[390px mobile](mobile.png) correction screenshots.

The initial mobile attempt exposed an inherited layout issue: a long open JSON evidence
line expanded the workspace's implicit grid column. The column now explicitly permits
shrinking; source text scrolls within the card. Navigation polling also tolerates the
brief initial document state before a body exists. The final scenario retains original
source/search/flow acceptance and confirms the narrow viewport has no horizontal overflow.

[answer-browser-result.json](answer-browser-result.json) records the existing answer
regression: four fake invocations, original citations, escaped output, failure/cancel
history, restart and mobile behavior. **Zero real model calls** were made. Corrections
are not added to answer prompts or silently sent to an AI provider.

## Reproduction

Use the pinned Node/pnpm versions and a frozen-lockfile installation:

```sh
pnpm check
node scripts/loredock-correction-evaluation.mjs > /tmp/loredock-correction-evaluation.json
node scripts/loredock-smoke.mjs
node scripts/loredock-answer-smoke.mjs
```

Run browser scripts sequentially; they require Linux, `google-chrome` and free port
4244. They own/clean temporary repositories, browser profiles, daemons and data.
Ordinary source checkouts and Workbench data are untouched. Schema 4 upgrades earlier
LoreDock databases; back up the stopped data directory before a normal upgrade.
See [ADR 0024](../../decisions/0024-loredock-engineer-corrections.md).
