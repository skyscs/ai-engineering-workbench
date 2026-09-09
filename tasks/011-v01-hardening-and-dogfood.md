# Task 011 — v0.1 hardening and dogfood

## Goal

Prepare the first usable release and validate it on realistic, non-proprietary engineering defects.

## Scope

- error-state cleanup
- task/run cancellation/retry behaviour
- restart/resume behaviour
- data integrity checks
- basic export of an investigation report to Markdown
- packaging/run documentation for Linux first, with no architecture that blocks macOS/Windows
- three realistic investigation fixtures/examples using non-proprietary repositories or synthetic history

## Acceptance criteria

- three investigations complete end-to-end
- at least one case exercises a human challenge and revised result
- restarting the app does not lose state
- failures do not corrupt task/worktree metadata
- README contains a v0.1 demo flow

## Review additions

- Verify recovery/cancellation already introduced in earlier tasks; Task 011 is
  a regression/release gate, not the first implementation of data integrity.
- Restart preserves completed state and marks interrupted runs failed; an explicit
  retry creates a new run. Do not require automatic CLI session resume in v0.1.
- Extend early synthetic fixtures into three cases: one-repo regression, two-repo
  interaction, and a challenge/constraint correction. Record known history and
  expected evidence, runtime version/requested profile, and manual quality review.
- Export chosen report versions with provenance, evidence locators and limitations;
  avoid machine-specific absolute paths/secrets. Mark unavailable sources honestly.
- Verify clean installation, production static/API routing and localhost request
  protection, storage/worktree partial failure and redacted errors. Document data
  location and backup of both SQLite and files with daemon stopped.
- CI runs deterministic fixtures only; real AI validation uses an explicitly
  selected local connection. Linux is verified first, other OS support is unclaimed
  until tested on those systems.
