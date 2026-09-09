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

Status: in progress, checkpointed at the user's request as the usage limit approached.

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

The missing-profile probe failed its acceptance condition: the CLI accepted an
intentionally nonexistent profile and completed a run. Explicit profile preflight
is required before the adapter can rely on connection selection. Unsupported-option
live testing, credential-safe missing-auth testing and final effective-tool checks
remain pending. Failure classification has deterministic tests, including synthetic
auth errors; these do not count as live missing-auth verification.

Checkpoint validation: `pnpm check` passed, including strict typechecking, seven
HTTP tests, five runtime outcome tests and the production build. No new AI call
was made after the outcome-classifier refactor.

See [runtime feasibility handoff](runtime-feasibility.md) for commands, captured
evidence and the exact next step. Task 000 must not be marked verified yet.

## Git handoff

- Initial artifacts: `main`, commit `d51b051`.
- Task 001: `task/001-bootstrap`, f7359a9, merged through PR #1 as aa56532.
- Task 000: `task/000-runtime-feasibility`; merged origin/main into this branch
  without rewriting its published checkpoint history.
- Task 000 has not been merged. Task 002 has not started.

## Tasks 002–011

Status: not started. Execute in the order recorded in DEVELOPMENT_PLAN.md.
