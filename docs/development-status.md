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

CI has been defined but has not run on GitHub yet. The shell's system Node 18
was not changed; verification used an isolated Node 22.23.2 toolchain. Developers
must select the pinned Node version before running project commands.

## Task 000 — Runtime feasibility

Status: not started. Requires the user's choice of existing CLI connection/profile
before the real synthetic investigation. No AI invocation has been made.

## Tasks 002–011

Status: not started. Execute in the order recorded in DEVELOPMENT_PLAN.md.
