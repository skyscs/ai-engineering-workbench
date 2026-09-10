# Development status

## Task 001 — Bootstrap local shell

Status: accepted through the user's merge of PR #1 into main (aa56532).
The P2 navigation finding remains open; see [open issues](open-issues.md).

Implemented: pinned Node/pnpm baseline, dependency lockfile, recursive workspace
build, test/CI commands, local session and CSRF protection, exact Host/Origin
checks, JSON API fallback, strict Vite port, graceful daemon shutdown.

Verification completed so far:

- Node 22.23.2 and pnpm 10.15.0 installation; official Node archive SHA-256 checked.
- Strict typecheck across all eight packages/apps, seven passing HTTP behavior
  tests, and complete production build.
- Real production HTTP health response and headless Chrome rendering
  `Local daemon connected.` with session bootstrap.
- Second daemon exits with status 1 and an actionable occupied-port error.
- Clean source copy: frozen-lockfile installation from the package store,
  full typecheck, all seven tests and production build passed.
- Headless Chrome loaded the development UI through Vite proxy and rendered
  `Local daemon connected.` with the protected session endpoint.
- SIGTERM closed the production daemon with exit status 0.

GitHub Actions run 34364370559 passed for f7359a9. The shell's system Node 18
was not changed; verification used an isolated Node 22.23.2 toolchain. Developers
must select the pinned Node version before running project commands.

## Task 000 — Runtime feasibility

Status: accepted through the user's merge of PR #2 into main (6b9a967).

The user selected the current Codex CLI configuration, `gpt-5.6-terra`, with
reasoning effort `medium`. Do not ask for this selection again on resumption.

Confirmed: CLI 0.153.4, synthetic fixture generation, read access to both repositories
and the artifact, and denied writes (EROFS) in all three fixture directories.
The initial invocation failed at the account usage limit. After resumption, a real
investigation completed and correctly identified the cross-repository timeout-unit
regression with evidence from both repositories and the log.

Explicit cancellation and timeout probes passed with unchanged fixtures and no
remaining owned process group. Both returned CLI exit code 0, so the requested
stop reason must take precedence over the process code. Recoverable connection
error events were also observed before a successful turn.

The raw CLI accepted a nonexistent profile. The spike now checks profile-file
existence/readability and CLI parsing before exec; missing profiles cannot fall
back to the default connection. A local canary confirmed named file loading.
Unsupported-option returned the expected error. Isolated `codex login status`
confirmed missing-login detection without accessing user credentials or calling
a model; expired-token failures during exec remain synthetic test coverage.

The selected configuration has no enabled MCP servers, and the restricted feature
flags were confirmed through CLI diagnostics. Enabled MCP configurations are
rejected before exec. External notification commands are disabled per invocation.
A fresh real investigation passed after these launch changes, with unchanged
sources/Git state and no remaining owned process group.

Validation: `pnpm check` passed, including strict typechecking, seven HTTP tests,
seven runtime tests and the production build. Opt-in local negative probes passed.

See [runtime compatibility and evidence](runtime-feasibility.md) for commands,
supported restrictions and Task 008 obligations.

## Task 002 — Local storage foundation

Status: accepted through the user's merge of PR #3 into main (d8d4bf2).

Implemented: platform data-root resolution with `AEW_DATA_DIR`, private managed
directories, built-in SQLite, foreign keys, WAL, bounded busy timeout, transactional
versioned migrations with checksums and newer-schema refusal. A separate SQLite
ownership lock rejects another daemon and releases on process death.

The daemon initializes storage before listening, releases it on bind failure and
shutdown, and exposes session-protected `GET /api/storage` without local paths.
ADR 0005 records the driver choice and future file-operation recovery contract.
Node 22.23.2 remains pinned; the minimum version is now 22.13 for `node:sqlite`.

Validation: strict typecheck and production build passed; 11 SQLite/path/
process tests, 8 HTTP tests and 7 runtime tests passed. Production-to-development
restart smoke preserved migration history; same-root startup was rejected and an
occupied-port failure released storage ownership. Graceful SIGTERM exited 0.
Clean source installation from the frozen lockfile and local package store passed
the complete `pnpm check` (26 tests). Headless Chrome with a fresh profile rendered
`Local daemon connected.`. No test used the normal application data directory.

The P2 navigation issue AEW-001 remains tracked separately; no change to its
behavior is included in Task 002.

## Task 003 — Workspaces and AI connection metadata

Status: accepted through the user's merge of PR #4 into main (8134f14).

Implemented: domain validation, schema version 2, workspace/owned-connection and
model-profile persistence, protected CRUD API and browser forms. Connection/profile
ownership cannot be reassigned. A persisted boundary lock prevents launch-setting
changes and workspace deletion; Task 006 must integrate it atomically with
first-task creation. ADR 0006 resolves one connection per workspace and documents
the later repository/task deletion requirements.

The UI distinguishes configured metadata from a verified runtime. No Codex
subprocesses, credential reads or model invocations are introduced. Model IDs stay
opaque; optional settings explicitly select CLI defaults.

Validation: a clean source copy installed from the frozen lockfile and local
package store passed the complete `pnpm check`: strict typecheck, 18 storage tests,
11 HTTP tests, 7 runtime tests and the production build. Tests include rollback of
the connection after an injected workspace-insertion failure and upgrade from
schema version 1 with its migration record preserved. Real Chrome checks passed for creation,
connection/profile edits, rename, persistence through production-to-development
daemon restart, a 390px viewport and workspace deletion confirmation/cancellation.
The [browser result](fixtures/workspaces/browser-result.json) contains synthetic
fixture outcomes only. No test used the normal application data directory.

## Task 004 — Repository registry

Status: verified on Linux, 2026-09-10; awaiting user acceptance/merge.

Implemented: system Git adapter, schema version 3, protected registration/clone
APIs, repository list/detail forms, persisted clone lifecycle and restart recovery.
Canonical checkout/common git-dir identities are recorded; ownership and duplicate
checks protect workspace boundaries. Workspace deletion is blocked while repository
records exist. ADR 0007 documents process/authentication limits and managed cleanup.

Existing checkouts are inspected without modifying HEAD, index, working files or
configuration. Managed clones use staged directories without checkout, templates
or shared objects. Failures preserve redacted stderr/status. Graceful shutdown
stops owned Git processes; abrupt restart retains recorded paths for inspection.
No fetch or task-worktree behavior is introduced.

Validation: a clean source copy installed from the frozen lockfile and local
package store passed strict typecheck, all 50 tests (7 Git, 20 storage, 16 HTTP,
7 runtime) and the production build. Git 2.53.0 / Node 22.23.2 were used locally.
The transport/SSH regression confirms protocol restrictions after URL rewriting
and invocation of a configured SSH command with noninteractive options.
Chrome on the clean build passed registration, successful and failed clone,
dirty-state preservation, restart persistence, mobile layout and blocked workspace
deletion. No test used normal application data or an AI invocation.
The [browser result](fixtures/repositories/browser-result.json) uses synthetic data.

A separate [real SSH clone](fixtures/repositories/remote-clone-result.json) of
`git@github.com:skyscs/ai-engineering-workbench.git` through the new service reached
`ready` at merged main 8134f14 in an isolated data root. It used the session's
existing `ssh -F /dev/null` override; no SSH configuration or credentials were
changed. HTTPS authentication was not exercised against a real remote.

Next task: 005 — explicit repository synchronization. AEW-001 remains open and
unchanged. Repository removal and non-Linux process/durability support remain
outside the verified Task 004 scope.

## Git handoff

- Initial artifacts: `main`, commit `d51b051`.
- Task 001: `task/001-bootstrap`, f7359a9, merged through PR #1 as aa56532.
- Task 000: `task/000-runtime-feasibility`, e37635d, merged through PR #2 as 6b9a967.
- Task 002: `task/002-local-storage`, c8ca418, merged through PR #3 as d8d4bf2.
- Task 003: `task/003-workspaces`, 4d07a77, merged through PR #4 as 8134f14.
- Task 004: `task/004-repository-registry`, based on merged main (8134f14).

## Tasks 005–011

Status: not started. Execute in the order recorded in DEVELOPMENT_PLAN.md.
