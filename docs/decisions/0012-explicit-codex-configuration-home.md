# ADR 0012 — Explicit Codex configuration directory

## Status

Accepted during Task 008 review, 2026-09-10.

## Context

An executable named `codex` can use a personal configuration directory while a
shell wrapper selects another directory for interactive use. Storing only the
executable and profile leaves workspace routing dependent on the daemon's inherited
`CODEX_HOME`; a restart from another shell can silently change that selection.

Codex documents [configuration under CODEX_HOME](https://learn.chatgpt.com/docs/config-file/config-advanced)
and [CODEX_API_KEY as an execution authentication override](https://learn.chatgpt.com/docs/non-interactive-mode).
The Workbench must explicitly select configuration without reading credentials.

## Decision

Add nullable `configHome` to the owned AI connection. Saving a value requires an
existing readable directory and stores its canonical absolute path. Do not expand
shell expressions, create directories, discover a default, or read authentication
files. Null represents incomplete settings and blocks AI execution before a new
StageRun is created. This allows repository/context preparation before AI setup.

Pass the saved directory as `CODEX_HOME` to every diagnostic and model subprocess.
Reject missing or redirected directories before spawning. Preserve the existing
profile checks and configuration metadata fingerprint. Reject nonempty inherited
`OPENAI_API_KEY`, `CODEX_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_ORG_ID`,
`OPENAI_ORGANIZATION` and `OPENAI_PROJECT_ID` instead of silently choosing whether
those overrides or the saved directory should win. Never log their values.

The first task freezes the directory together with the existing executable/profile
boundary. Schema 8 adds the nullable column and an update trigger without changing
earlier migrations. Existing connections remain unbound. An unset directory can
be bound once in a locked workspace only when that connection has no investigation
run of any status and no active StageRun of any stage. Storage checks and the SQL
trigger enforce the exception. Completed deterministic preparation may precede
binding; existing snapshots retain their original contents. A workspace with prior
AI history and an unknown directory must use a new workspace for further AI work.

Show the saved directory and profile before launch. New run input snapshots and
verified launch metadata record the directory. Older snapshots display that it was
not recorded. Require `AEW_CODEX_HOME` for the opt-in real smoke script too.

## Consequences and limits

Personal and corporate setups use the same generic connection fields. No special
`codex-plus` mode, credential copying, account discovery or new provider is needed.
Automated tests use separate synthetic inherited/selected homes and verify every
spawn, missing-home rejection, migration, boundary locking and browser persistence.
This review change makes no additional model requests; earlier real CLI evidence
remains evidence for the original Task 008 launch behavior.

A directory is a configuration selector, not verified account identity. Executable
wrappers, external configuration, custom provider variables and credential stores
remain trusted. The known-override check is conservative rather than a complete
environment allowlist. Existing metadata checks cannot prevent all concurrent
external mutation or certify the provider receiving data.
