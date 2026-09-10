# Codex runtime preview

Task 008 adds **AI runtime preview** to prepared tasks. It performs a preliminary
read-only investigation and stores its structured output. Evidence validation and
versioned root-cause reports are planned for Task 009; a preview is not a verified
root-cause report.

## Use

1. Configure the workspace's existing Codex connection and optional model profiles.
2. Create a task, import artifacts and save the exact text ranges to include.
3. Prepare every selected repository worktree.
4. In **AI runtime preview**, choose a model profile or explicitly use CLI defaults,
   then choose **Run preview**.
5. Review progress, diagnostics, findings and unresolved questions. **Cancel run**
   stops the owned invocation. After failure/cancellation, **Run preview** creates
   a new StageRun; it never rewrites the earlier attempt.

Only one AI run may be active per daemon. Context changes and worktree cleanup are
blocked while the task runs. Application Git synchronization sharing the same Git
directory is also blocked. Closing/reloading the browser does not cancel the run.
Reconnect or reopen the task to replay persisted events and retrieve the result.
The UI shows the latest 100 events; earlier retained events remain available via SSE.
A daemon restart marks unfinished runs failed with `INTERRUPTED`; retry is explicit.

The supplied prompt includes the task, pinned repository roots and selected UTF-8
artifact ranges. It does not supply excluded files, PDF/video content or images.
The CLI can transmit data to its configured provider; Workbench does not inspect
its exact outbound payload. The read-only sandbox prevents writes but is not an
exclusive read allowlist. Use trusted local repositories and CLI configuration.

## Supported configuration

Linux, Node 22.23.2 and Codex CLI 0.153.4/0.154.0 are the verified baseline. Other
CLI versions fail closed until compatibility evidence is added. The executable is
the configured path or `codex` from the daemon's PATH. Models remain opaque IDs;
Workbench does not hardcode a public model list or choose another provider.

Existing authentication stays in Codex. A named selector requires a readable,
regular `$CODEX_HOME/<name>.config.toml` file, with the CLI home defaulting to
`~/.codex`. Missing, linked or malformed profiles fail before a model invocation.
No fallback to the default connection is attempted. A verified launch does not
certify corporate account identity; connection settings continue to show that
identity has not been verified.

The adapter disables apps, plugins, hooks, browser/computer/image tools, multi-agent
execution, web search and external notifications. Enabled configured MCP servers
are rejected. Project/ancestor `.codex` directories are unsupported because they
can override connection routing; use a prepared repository without that layer.
Do not change CLI configuration while a run is active. Safe file metadata is
fingerprinted, but Workbench does not freeze or copy external configuration.

Default wall timeout: 20 minutes. Set `AEW_RUNTIME_TIMEOUT_MS` when starting the
daemon to a positive integer no greater than 86400000. Cancellation and timeout
stop the owned process group and tracked Linux descendants, escalating after one
second. Force-killing the daemon can prevent cleanup; inspect remaining processes
before retrying after a machine/process failure. Recovery never kills an old PID
that might now belong to another process.

Diagnostics/events are limited to 10 MiB per run, with an explicit truncation
marker. Stderr is limited to 32 KiB with a truncation notice. Tool payloads are
omitted; common credential and URL patterns are redacted. A single oversized JSONL
frame fails explicitly. Final JSON is capped at 2 MiB and must pass validation.
A successful exit alone is insufficient to publish output.

## Protected API

All routes require the local session. POST additionally requires Origin, CSRF and
`application/json`. Paths are below `/api/workspaces/:workspaceId/tasks/:taskId`.

| Method and path | Behavior |
| --- | --- |
| `POST /runtime-runs` | `{ "modelProfileId": null }` or an owned profile ID; returns 202 with the persisted StageRun. |
| `GET /runtime-runs/:runId` | Run, verified launch metadata, validated preview or null, and truncation state. |
| `POST /runtime-runs/:runId/cancel` | Empty object; idempotently requests cancellation. Poll/replay for terminal state. |
| `GET /runtime-runs/:runId/events` | SSE `runtime` events with sequence IDs, then `complete` with terminal status. |

SSE accepts `Last-Event-ID` or `?after=<sequence>`; the header takes precedence.
Reads return up to 128 retained events per batch. Long connections close within
31 seconds; EventSource reconnects automatically. Unknown event types are displayed
as metadata, not executed. Browser disconnect is independent of run cancellation.
A terminal complete notification can be reconstructed from the persisted StageRun
and does not consume another sequence ID.

## Verification

Ordinary checks make no AI requests:

```bash
pnpm install --frozen-lockfile
pnpm check
AEW_SMOKE_RUNTIME=1 node scripts/workspace-smoke.mjs
```

The browser scenario requires Chrome and a free port 4242. It uses a synthetic
executable through the production adapter, an isolated CLI home/data directory,
synthetic artifacts and a fresh browser profile. It exercises preview, error,
cancel, retry, persisted replay, restart and narrow layout.

After building, local CLI diagnostics and the opt-in real acceptance scenario are:

```bash
node scripts/runtime-adapter-negative.mjs
node scripts/runtime-adapter-smoke.mjs --preflight
AEW_REAL_RUNTIME=1 node scripts/runtime-adapter-smoke.mjs
```

The real smoke uses the user's selected default connection, `gpt-5.6-terra` and
`medium`, and may consume that account's allowance. `AEW_CODEX_EXECUTABLE` can select
an executable explicitly. It creates a fresh two-repository timeout regression,
imports the incident log, prepares worktrees and invokes RuntimeService. Sources
and Git state must remain unchanged. Temporary output stays in the printed fixture
root; review it before sharing. See [recorded evidence](fixtures/runtime-adapter/)
and [ADR 0011](decisions/0011-codex-runtime-execution.md).

Reference: [official non-interactive mode documentation](https://learn.chatgpt.com/docs/non-interactive-mode).
Installed CLI help and recorded probes establish the exact supported behavior.
