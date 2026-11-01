# Task 050 — One-command isolated synthetic demo

Status: implemented and locally verified, 2026-11-01. Scope was committed in `8d8594b`.

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

## Outcome

`pnpm loredock:demo` builds and prepares exactly twenty generated sources in a new owned
temporary root, then starts the normal compiled daemon against its separate data. One
index publishes 79 files and one analysis retains 21 code candidates; six affected files
and seven syntax-gap messages remain explicit. The launcher forces model/development mode
off, checks the port before creating sources, releases preparer ownership before handoff
and reports readiness only after its own daemon listens. Ctrl+C stops owned work and
retains sources/data with a safely quoted reopening command.

Strict types, all 399 tests and production builds pass. Five integration and two launcher
tests cover exact preparation, source roots, ownership release, original lookup, retained
data, incomplete stages, cancellation including before the store opens, isolated environment,
literal shell quoting and occupied-port behavior. The actual package command also passes
browser acceptance: ready UI without path input, short Java lookup/keyboard originals,
model mode off despite inherited settings, unchanged external data, occupied-port rejection,
graceful shutdown, retained manual file, reopening the same index/inventory and interrupted
preparation without a daemon or retry. The 390px layout has no horizontal overflow.

See [verification](../docs/fixtures/loredock-synthetic-demo/README.md),
[ADR 0044](../docs/decisions/0044-loredock-isolated-synthetic-demo.md) and the
[manual demo route](../docs/loredock/USER_GUIDE.md#try-the-synthetic-system).
No corporate sources, real model, new benchmark, app schema or UI/API change.
Next: hands-on feedback on this ready synthetic experience before choosing broader
question-context work. Independent semantic acceptance remains open.
