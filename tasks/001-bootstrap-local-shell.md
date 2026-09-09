# Task 001 — Bootstrap local shell

## Goal

Create the repository skeleton and a minimal local application that starts a daemon and serves a web UI on localhost.

## Scope

- pnpm workspace
- package layout from `ARCHITECTURE.md`
- React + Vite web app
- Node + Hono daemon
- strict TypeScript configuration
- development scripts to run daemon and web
- production-oriented path where the daemon can serve built web assets
- health endpoint

## Minimal UI

Display:

```text
AI Engineering Workbench

Local daemon connected.
```

## Acceptance criteria

- `pnpm install` succeeds
- `pnpm dev` starts the local development environment
- web UI can call daemon health endpoint
- typecheck passes
- no cloud services or external DBs are introduced
- README gets exact local run commands

## Review additions — required before closing Task 001

- Align Node engines/docs with Node 22.12+ for Vite 7; pin a tested Node patch
  and pnpm 10.15.0, generate and commit the dependency lockfile.
- Establish test/check commands and clean-install validation. When adding internal
  imports, declare workspace dependencies/exports and build dependencies first.
- Add API JSON 404 before SPA fallback; verify with production assets present.
- Before privileged endpoints exist, restrict Host to configured loopback host/port
  and Origin to the exact local UI origins. Use an HttpOnly SameSite=Strict local
  session cookie and a per-session CSRF token in a custom header on mutations;
  no wildcard CORS, no token in URL/logs. Dev proxy must preserve this contract.
- Test rejected Host/Origin and missing CSRF alongside a legitimate local request;
  serve only loopback and make occupied-port/startup errors actionable.
- Exit cleanly on SIGINT/SIGTERM and keep browser launch optional in smoke checks.

## Exclusions

- SQLite schema
- workspaces
- Git integration
- Codex integration
