# ADR 0011 — Codex runtime execution and preview delivery

## Status

Accepted for Task 008 implementation, 2026-09-10. Verification is recorded in
[development status](../development-status.md).

The connection directory selection and migration rules were tightened during
review by [ADR 0012](0012-explicit-codex-configuration-home.md).

## Decision

Implement the provider-neutral `AIRuntime` async event interface, `CodexCliRuntime`
and an injectable deterministic `FakeRuntime`. The daemon owns one invocation,
records a StageRun/input snapshot first and rejects a second active AI run.
The adapter yields verified CLI metadata before spawning the model process;
the daemon durably records that metadata before consuming further events.

Task 008 delivers a preliminary structured preview (`summary`, `findings`,
`unresolvedQuestions`). It does not publish InvestigationResult/RootCauseResult
versions or advance the task beyond CONTEXT_READY. Task 009 supplies that workflow,
evidence schema, locator validation and atomic report-pair publication. The runtime
request accepts an output schema and deterministic validator for that integration.

All selected repository roots are canonical detached worktrees with pinned revisions.
Verify ownership and cleanliness before and after execution; hold common Git-dir
locks throughout to prevent application synchronization/cleanup races. Imported
text is hashed and decoded through its verified descriptor. Supply only selected
UTF-8 ranges via stdin. Artifact IDs, hashes and ranges remain in the immutable
snapshot; metadata explicitly records inline delivery. This narrows the original
file-root proposal: no additional artifact directory is exposed merely to deliver
a range, and excluded artifacts never enter the application-supplied prompt.
The CLI sandbox still is not an exclusive filesystem read allowlist.

Reuse existing CLI authentication and provider configuration. Never read or copy
authentication/session files. Support only CLI versions with recorded evidence
(0.153.4 from Task 000, 0.154.0 from Task 008). Named profiles require readable,
regular `<name>.config.toml` files, then profile-aware CLI parsing. Missing profiles
fail before exec without fallback. CLI feature diagnostics confirm explicit tool
restrictions; profile-aware MCP listing must report no enabled servers. Diagnostic
configuration output is discarded because it can contain credentials.

Reject `.codex` project/ancestor directories other than the selected user CLI home.
They can affect provider selection, so checking MCP alone would be insufficient.
Record a hash of safe configuration file metadata and compare before/after
preflight and before exec. This detects ordinary edits; it neither certifies account
identity nor freezes trusted external configuration against concurrent mutation.

Spawn argument arrays without a shell, use read-only sandbox and approval policy
never, disable the Task 000 external tools/notifications, and send the prompt through
stdin. Never broaden permissions, resume a CLI session or retry automatically.
The default wall timeout is 20 minutes, locally configurable up to 24 hours.
Own a POSIX process group and track Linux descendants by PID plus kernel start
time, including separate sessions. Cancellation sends TERM and escalates to KILL
after one second; normal completion also terminates remaining owned descendants.
This is process supervision for trusted local tools, not containment of hostile
processes intentionally escaping supervision. Abrupt daemon death cannot run
cleanup code: startup marks unfinished runs interrupted without signaling stale
PIDs or starting another paid invocation.

Normalize UTF-8/chunked JSONL and whitelist event metadata. Unknown event kinds
remain visible by type; raw tool payloads are not persisted. Recoverable error
events do not override a later completed turn. Success requires exit zero,
turn.completed, no turn.failed, a complete JSON final message and schema validation.
Cancellation/timeout take precedence over exit zero. A single event frame above
2 MiB plus 64 KiB fails explicitly; final structured text is capped at 2 MiB.
Diagnostics/events are capped at 10 MiB with a truncation marker. Stderr retains
at most 32 KiB and records truncation; common credential/URL patterns are redacted.
This is not a complete raw transcript or an exact outbound payload audit.

Schema 7 adds append-only sequenced events and per-run metadata/output. A short
SQLite transaction publishes the validated preview with the succeeded transition;
failure or cancellation cannot expose partial output. Old runs remain immutable.
SSE uses session-protected reads, monotonic IDs and bounded batches with Last-Event-ID
replay. Browser disconnection leaves the daemon run active. Connections expire
within 31 seconds to bound slow readers and recheck session authorization on reconnect.

## Consequences

Real CLI smoke is opt-in and uses only synthetic repositories/artifacts and the
previously selected connection/model. CI uses process fixtures and FakeRuntime,
without credentials or model requests. Linux is the only verified runtime platform.
Task 009 can consume this lifecycle without embedding provider process logic into
workflow rules. Full report history/intervention UI remains in later tasks.
