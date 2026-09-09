# Task 008 — Codex CLI runtime adapter

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

- Consume Task 000 compatibility notes and Task 006 StageRun persistence. Reject
  unsupported CLI/configurations; never silently retry with broader permissions.
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
