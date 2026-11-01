# Task 050 — One-command isolated synthetic demo

Status: scoped before implementation, 2026-11-01.

Provide a ready-to-explore twenty-repository LoreDock example without corporate sources,
Codex configuration or manually entering every repository path. Reuse the existing small
heterogeneous synthetic corpus; this is a user-facing demo, not a new benchmark or semantic
acceptance run. Keep the normal application and existing data directories separate.

## Contract

- Add `pnpm loredock:demo` for the source-build distribution. Build the required application,
  create a fresh owned temporary fixture and its own data directory, register exactly the
  twenty generated repositories, index once and analyze code once. Then start the normal
  compiled local daemon with that prepared data. No automatic retry, refresh or model call.
- Accept no source/data-path arguments. Override inherited `LOREDOCK_DATA_DIR`, answer mode
  and development mode for the owned daemon. Do not discover corporate repositories, read
  account settings, fetch remotes or run source code. The default sample stays small:
  79 eligible files, 21 code candidates and sixty known exclusions.
- Check that loopback port 4244 is available before fixture creation. An occupied port or
  daemon-start race fails clearly and never terminates another process. Close the preparer's
  ownership/store/services before starting the daemon. Signals stop only the owned work
  and child process; interrupted preparation never launches the daemon.
- Retain the generated repositories/data on exit, including user notes and interrupted
  attempts. Print their locations, the URL, that model calls are disabled, example searches
  and an accurately quoted restart command. Never remove a manually explored demo silently.
  Each fresh demo command creates a new isolated project; reopening is an explicit advanced
  command using its printed directory. The user may remove unused generated roots later.
- Show progress during preparation. Require a published index and code inventory before
  announcing readiness. Partial syntax coverage is allowed with explicit counts; failure
  or interrupted stages remain visible and do not trigger retries. Preserve existing UI,
  API/session protections, parser/query limits and production startup semantics.

## Verification and delivery

Test preparation over the owned small fixture, exact registered roots/counts, published
facts/original search, zero answer attempts, cleanup of service ownership for handoff,
failure/interruption without automatic retry, retained files, environment isolation and
occupied-port handling. Run strict checks, full tests/builds and a real launcher/browser
smoke proving a prepared twenty-source UI, short Java lookup/originals, model-free health,
normal shutdown and reopening retained data. Use only owned processes/data and port 4244.

Document the single command first in the synthetic-demo guide, with examples and retention/
restart behavior. Retain the verification report and limitations. Review/create the PR,
merge after both exact-head CI events pass, and move to hands-on review of the resulting
synthetic experience. Independent semantic acceptance and the Workbench bridge remain gated.
