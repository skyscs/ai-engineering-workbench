# Codex runtime, configuration and recovery

The current UI uses Codex CLI for [versioned investigations and evidence](investigation.md).
A legacy preliminary-preview endpoint remains available for earlier integrations;
it is distinct from the full investigation workflow. Runtime restrictions,
connection selection, cancellation and recovery apply to both.

For a field-by-field walkthrough, see the [user guide](user-guide.md#configure-your-workspace).

## Use

1. Configure the workspace's existing Codex connection, explicitly save its
   configuration directory and optionally add model profiles.
2. Create a task, import artifacts and save the exact text ranges to include.
3. Prepare every selected repository worktree.
4. In **Historical investigation**, choose a model profile or explicitly use CLI defaults,
   then choose **Run investigation**.
5. Review progress, diagnostics, findings and unresolved questions. **Cancel run**
   stops the owned invocation. After failure/cancellation, **Run investigation** creates
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

Existing authentication stays in Codex. Every connection must explicitly save
`configHome`, an existing absolute configuration directory. All diagnostic and model
subprocesses receive that path as `CODEX_HOME`; the daemon's inherited value and
the CLI's usual default are never used as fallbacks. For example, a personal setup
may use `/home/developer/.codex-plus` with the ordinary `codex` executable. The
executable's name alone does not select or identify an account.

A named selector requires a readable, regular `<configHome>/<name>.config.toml`
file. A missing or redirected directory, or a missing, linked or malformed profile,
fails before model invocation. The runtime UI displays the saved directory and
records it in new run snapshots and verified launch metadata. Existing settings
upgrade with no selected directory; binding rules are in the
[settings guide](workspace-settings.md).

The adapter rejects nonempty inherited `OPENAI_API_KEY`, `CODEX_API_KEY`,
`OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_ORGANIZATION` and `OPENAI_PROJECT_ID`.
Remove these from the daemon environment and configure the intended connection
through Codex. This conservative check prevents known ambient overrides; it does
not certify account identity or audit every custom provider variable or wrapper.
Trusted executables and external configuration still determine authentication.
Workbench never reads authentication files or claims verified account identity.

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

For current full reports, use `POST /investigations` and the
[investigation API](investigation.md#protected-api). The run detail/cancel/events
endpoints below serve both workflows.

All routes require the [local session](local-api.md). POST additionally requires
Origin, CSRF and `application/json`. Paths are below `/api/workspaces/:workspaceId/tasks/:taskId`.

| Method and path | Behavior |
| --- | --- |
| `POST /runtime-runs` | Legacy preliminary preview: `{ "modelProfileId": null }` or an owned profile ID; returns 202 with the persisted StageRun. |
| `GET /runtime-runs/:runId` | Run, verified launch metadata, validated investigation pair or legacy preview (or null), and truncation state. |
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
synthetic artifacts and a fresh browser profile. It exercises full investigation
reports, error, cancel, retry, persisted replay, restart and narrow layout. It also verifies that
an unset directory blocks the run, one-time binding enables it, and the saved
directory is displayed, frozen and retained in run snapshots.

After building, local CLI diagnostics and the opt-in real acceptance scenario are:

```bash
node scripts/runtime-adapter-negative.mjs
AEW_CODEX_HOME=/absolute/selected/config node scripts/runtime-adapter-smoke.mjs --preflight
AEW_CODEX_HOME=/absolute/selected/config AEW_REAL_RUNTIME=1 node scripts/runtime-adapter-smoke.mjs
```

The real smoke requires an explicitly selected configuration directory, uses its
base configuration with `gpt-5.6-terra` and `medium`, and may consume that account's
allowance. `AEW_CODEX_EXECUTABLE` can select
an executable explicitly. It creates a fresh two-repository timeout regression,
imports the incident log, prepares worktrees and invokes RuntimeService. Sources
and Git state must remain unchanged. Temporary output stays in the printed fixture
root; review it before sharing. See [recorded evidence](fixtures/runtime-adapter/)
and [ADR 0011](decisions/0011-codex-runtime-execution.md).

Reference: [official non-interactive mode documentation](https://learn.chatgpt.com/docs/non-interactive-mode).
Installed CLI help and recorded probes establish the exact supported behavior.
