# Task 003 — Workspaces and AI connection metadata

Status: accepted through the user's merge of PR #4 into main (8134f14). See
[development status](../docs/development-status.md),
[settings guide](../docs/workspace-settings.md) and
[ADR 0006](../docs/decisions/0006-workspace-connection-ownership.md).

## Goal

Introduce Workspace, AIConnection, and ModelProfile domain/storage/API concepts without executing AI yet.

## Scope

- domain types and invariants
- SQLite persistence
- CRUD APIs needed by UI
- simple workspace list/create UI
- create a `codex-cli` AI connection metadata record
- optional Codex executable/config profile fields, but no secrets

## Acceptance criteria

- user can create a Workspace
- Workspace is bound to one AI Connection
- ModelProfiles belong to that connection
- persisted data survives restart

## Review additions

- Validate workspace/connection/profile ownership on the server, including updates.
  Freeze connection launch settings and workspace binding once tasks exist;
  a changed data boundary uses a new connection/workspace in v0.1.
- Model profiles accept opaque model ID and supported effort settings, not arbitrary
  command-line arguments or environment overrides. Do not silently pick another
  connection/model after a failure.
- Distinguish configured connection metadata from a verified working connection;
  CRUD alone proves neither authentication nor corporate provider identity.
- Test cross-workspace/profile rejection and restart persistence.

## Exclusions

- Codex subprocess execution
- authentication parsing
