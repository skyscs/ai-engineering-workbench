# Task 013 — Primary investigation workflow

Status: implemented and locally verified, 2026-09-28. The owner accepted the prototype and requested that the new
experience become the primary application, with subsequent improvements based on
real use. This task replaces the prototype gate with production integration.

## Scope and acceptance

- Make the new composer/navigation the default UI; preserve existing projects,
  tasks, evidence, report versions and advanced settings.
- Persist editable drafts and bounded UTF-8 text attachments before task creation.
- One explicit action validates the saved connection, registers/clones source,
  imports included text, prepares isolated worktrees and starts real investigation.
- The daemon owns a durable, idempotent launch operation. Duplicate submissions,
  refresh and lost responses must not duplicate paid invocations. Restart never
  automatically resumes a model call. Cancellation during preparation prevents AI.
- Use current committed HEAD for new investigations of local sources. Existing tasks
  retain pins; no checkout edits or local-source fetch. Reused managed remote URLs fetch before pinning.
- Preserve explicit connection selection. Confirm candidates once, never guess
  account identity or silently fall back. Settings remain recoverable on failure.
- Include text on attachment; reject unsupported/oversized text visibly, without
  silent truncation. Legacy artifact management remains accessible.
- Real progress/cancel, conclusion, evidence, revisions and export replace every
  sample behavior. Keep the standalone prototype only as a development artifact.
- Add meaningful storage/service/browser tests, migration/restart coverage and
  usage documentation. Start the built application for manual use without making
  an unsolicited model invocation.

See ADR 0017 for the bounded draft and launch lifecycle. This integrates the
previously reviewed prototype and configuration fix branches; previous PRs may
remain open until the integrated change is reviewed.

## Verification

`pnpm check` passed 141 tests, strict typechecks and production builds. The primary
browser scenario passed durable draft/files, explicit setup, setup failure/retry,
automatic preparation/context, evidence, revision/export, cancellation, restart
without a model invocation, copied inputs and 390px layout. It made three synthetic
CLI invocations and zero real model requests. See the primary workflow fixtures.

The local API reference, user guide, README, Linux guide and ADR 0017 describe the
implemented behavior and the retained advanced workflow.

The advanced browser regression passed with nine synthetic attempts. Manual data
was backed up before schema 10 → 11 migration; original historical rows and SQLite
integrity were verified before leaving the production daemon running for manual use.
