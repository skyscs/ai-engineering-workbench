# ADR 0006 — Workspace connection ownership and metadata

## Status

Implemented in Task 003, 2026-09-10. Task creation and runtime verification remain
future work in Tasks 006 and 008 respectively.

## Decision

Create each workspace together with its own `codex-cli` connection in one SQLite
transaction. A connection cannot be shared or reassigned between workspaces in
v0.1. This resolves the earlier domain model's optional ownership/reuse wording:
the workspace's unique `aiConnectionId` defines ownership without a second,
potentially inconsistent reverse reference. Model profiles belong to that
connection and cannot move between connections.

Scope every profile read, update and delete through the requested workspace's
connection. Reject client-supplied IDs, ownership fields and arbitrary runtime
settings. Domain validation lives in `core`; host-specific absolute-path checks,
transactions and SQL live in `storage`; shared transport types describe responses.

Connection launch settings may change before tasks exist. A persisted, monotonic
`boundaryLocked` flag then prevents executable/configuration changes and workspace
deletion. Workspace and connection display names remain editable. SQL triggers
also enforce immutable bindings and the lock. There is no public lock or unlock
endpoint. Task 006 must call the internal `lockWorkspaceBoundary` operation in the
same storage transaction as first-task creation, with rollback covering both.
Task 003 tests that guard directly; it does not implement task creation.

Deleting an unlocked workspace atomically removes its connection and profiles.
Task 004 must add repository ownership constraints and explicit deletion behavior
before introducing dependent records or managed files. Task 006 must likewise
preserve task/run references and immutable snapshots when profiles change or are
deleted. These later entities are not pre-created in this migration.

## Configuration semantics

Only safe metadata is accepted:

- Names are nonempty text, limited to 120 characters.
- `executablePath` is null for `codex` on PATH, or an absolute path on the daemon
  host, limited to 4096 characters. Saving does not inspect or execute it.
- `configProfile` is null for the current CLI configuration, or a named profile
  of 1–128 letters, digits, underscores or hyphens. An empty named value is invalid.
- `modelIdentifier` is null for the CLI default, or an opaque identifier of at
  most 256 characters. Control characters and leading hyphens are rejected.
- `reasoningEffort` is null for the CLI default, or one of the application's
  initial choices: `low`, `medium`, `high`, `xhigh`. These choices do not assert
  support by every model or provider.

Optional fields omitted from a create or PUT request become null; PUT replaces
the editable settings. There are no arbitrary arguments, environment overrides,
credential fields, automatic retries or fallback connections/models.

Every connection is reported as `not_verified`. Saving metadata establishes no
authentication, provider identity or model capability. A frozen selector also
cannot freeze external CLI configuration or credentials: Task 008 must validate
the effective launch configuration and prevent fallback, as required by the
runtime feasibility findings. No Codex subprocess runs in Task 003.

## Verification

Storage/API tests cover ownership, locked boundaries, restart persistence,
transaction rollback and upgrade from schema version 1 without rewriting its
migration record. Real-browser checks cover creation, edits, daemon restart,
mobile layout and cancellation/confirmation of workspace deletion. All fixtures
use temporary data directories and synthetic metadata.
