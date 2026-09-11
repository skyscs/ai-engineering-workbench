# Task 009 acceptance evidence

Recorded on Linux with Node 22.23.2 and Codex CLI 0.154.0, 2026-09-11.

- `browser-result.json`: clean production build, isolated Chrome profile and a
  synthetic CLI. Covers v1/v2, evidence navigation, failures/cancellation, unsafe
  Markdown and incomplete fences, configuration binding, replay and restart.
  No model requests.
- `real-result.json`: one synthetic two-repository investigation through an
  explicitly selected personal configuration directory, gpt-5.6-terra, medium.
  The result correctly identifies a seconds/milliseconds contract regression.
  All five locators were revalidated and opened; source/Git snapshots were unchanged.

The real record retains the generated explanation and synthetic source excerpts.
Local configuration paths, safe configuration fingerprints, raw diagnostics and
credentials are omitted. Directory selection does not certify account identity.
The smoke fixture is recreated by `scripts/runtime-adapter-smoke.mjs` with
`AEW_INVESTIGATION=1`; opt-in instructions are in `docs/investigation.md`.
