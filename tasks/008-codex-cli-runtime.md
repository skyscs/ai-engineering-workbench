# Task 008 — Codex CLI runtime adapter

Status: verified on Linux, 2026-09-10; awaiting user acceptance/merge. See
[development status](../docs/development-status.md) and [the runtime guide](../docs/codex-runtime.md).

## Goal

Execute a non-interactive Codex run through the user's existing CLI configuration and stream normalized events to the daemon/UI.

## Scope

- `AIRuntime` interface
- `CodexCliRuntime`
- Codex executable detection/version reporting
- model/profile selection passed through without hardcoding public model names
- read-only investigation working directory
- stdout/stderr/event normalization
- cancellation of the owned process tree, with a bounded termination timeout

## Acceptance criteria

- application can run a simple investigation prompt in a task worktree
- existing Codex configuration/authentication is reused
- Workbench does not read/store Codex session/OAuth secrets
- model profile used by a StageRun is recorded
- process failure is preserved as a failed StageRun

## Security note

Do not claim exact provider-payload auditing from the CLI runtime.

## Review additions

- Save an explicit canonical configuration directory per connection and pass it as
  `CODEX_HOME` for all diagnostics and model execution. Reject unbound/redirected
  homes and known ambient authentication overrides without fallback. Migrate old
  settings as unbound; allow one-time binding only without AI history or active
  StageRuns. Preserve snapshots and show the directory before launch. See ADR 0012.
- Consume Task 000 compatibility notes and Task 006 StageRun persistence. Reject
  unsupported CLI/configurations; never silently retry with broader permissions.
- Preflight explicitly selected profiles before spawning: CLI 0.153.4 accepted a
  nonexistent profile during Task 000. Do not treat passing --profile or receiving
  exit code 0 as proof of the selected connection. See AEW-002 in docs/open-issues.md.
- CLI 0.153.4 uses separate <name>.config.toml files, not legacy profiles tables.
  Reuse the Task 000 negative fixtures for absent/invalid profiles, missing login,
  unsupported flags and configured MCP rejection. The spike supports only a fixed
  verified version; add another version only with explicit compatibility evidence.
- Carry forward the documented tool restrictions and disable external notification
  commands. `features list` does not accept --profile in the verified CLI; do not
  describe its base-config output as full inspection of a named profile. Validate
  selected config through supported diagnostics and fail closed on enabled MCP.
- Use explicit read-only policy, no privilege escalation, JSONL and schema output
  when supported by the verified CLI. Spawn without shell; send instructions via
  stdin. Keep arbitrary extraRuntimeArgs out of the public model-profile interface.
- Request includes canonical read roots for every selected worktree/artifact;
  one cwd alone is insufficient. Ensure workspace settings do not silently change
  provider or enable unrestricted external tools through inherited project config.
- Normalize chunked JSONL, unknown event types, bounded stderr/output, nonzero exit,
  timeout and cancellation. Schema validation is still required after exit code 0.
- Add a deterministic FakeRuntime for workflow tests. Test process framing, failure
  and cancellation through fixtures; keep a separate opt-in real CLI smoke test.
- Serve persisted events via SSE with monotonic IDs and bounded replay. Closing
  the browser does not stop a run; explicit cancellation does. Default wall timeout
  is 20 minutes (locally configurable); diagnostics/events are bounded to 10 MiB/run
  with explicit truncation, final structured result to 2 MiB with explicit failure.
- Only one active run per task and one AI process per daemon in v0.1. Prevent
  duplicate starts, stop owned children on shutdown, and mark unfinished runs
  failed/interrupted on restart rather than automatically spending another run.
