# Development status

## Task 001 — Bootstrap local shell

Status: verified. User acceptance is not yet recorded.

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

CI has been defined; its remote result has not been inspected. The shell's system Node 18
was not changed; verification used an isolated Node 22.23.2 toolchain. Developers
must select the pinned Node version before running project commands.

## Task 000 — Runtime feasibility

Status: in progress, paused at the user's request after an account usage-limit failure.

The user selected the current Codex CLI configuration, `gpt-5.6-terra`, with
reasoning effort `medium`. Do not ask for this selection again on resumption.

Confirmed: CLI 0.153.4, fixture generation, read access to both repositories and
the artifact, and denied writes (EROFS) in all three fixture directories. The
real invocation emitted JSONL and completed one read-only shell command before
ending with `turn.failed` and exit code 1 because the account usage limit was reached.
Fixture snapshots remained unchanged; no owned process group remained alive.

The interim agent message is not a successful investigation result. Final structured
output, explicit cancellation, timeout, missing auth/profile and full tool-boundary
compatibility checks remain unverified. No additional AI run was made after the pause.

See [runtime feasibility handoff](runtime-feasibility.md) for commands, captured
evidence and the exact next step. Task 000 must not be marked verified yet.

## Git handoff

- Initial artifacts: `main`, commit `d51b051`.
- Verified Task 001: `task/001-bootstrap`, commit `f7359a9`, pushed to origin.
- Task 000 checkpoint: `task/000-runtime-feasibility`, based on Task 001.
- Branches have not been merged into main; no pull request has been created.

## Tasks 002–011

Status: not started. Execute in the order recorded in DEVELOPMENT_PLAN.md.
