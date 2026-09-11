# v0.1 release acceptance evidence

Verified on Linux, Node 22.23.2, Codex CLI 0.154.0, 2026-09-11.

- `real-results.json` records three real cases, four successful model invocations,
  known histories, provenance, locator counts and review against the expected defects.
- `single-report-v1.md` explains the premature rounding regression.
- `interaction-report-v1.md` explains the producer/consumer unit mismatch.
- `revision-report-v1.md` separates a code defect from unproven incident causality.
- `revision-report-v2.md` resolves the incident with the added log, constraint and challenge.
- `browser-result.json` records the clean production browser flow, including chosen
  version downloads, error/cancel/retry, restart and a 390px viewport.

The real cases used an explicitly bound personal configuration directory with
`gpt-5.6-terra` and `medium`. Directory selection is not an account identity claim.
All repositories, artifacts and histories were generated synthetic data. Published
locators were reopened; source hashes/Git state remained unchanged. SQLite integrity
and foreign-key checks passed and restart preserved reports. The first case's
integrity check was recorded separately after its runner completed.

Reports are the actual downloaded-format exports at their recorded times; v1 in
the revision case was exported before v2 existed, so its lifecycle says active.
The later version records the exact prior report and intervention IDs. All 25
published evidence locators were available when checked. Report content was reviewed
against the rubric by the implementation agent; user acceptance remains the PR review
and merge, and these small cases do not measure general model accuracy.

Local databases, configuration paths/fingerprints, raw CLI diagnostics and full run
snapshots are omitted. The browser result represents nine synthetic runtime attempts
and zero real model requests. Reproduce using the [release guide](../../release-acceptance.md).
