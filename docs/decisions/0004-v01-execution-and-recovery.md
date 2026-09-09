# ADR 0004 — v0.1 execution, recovery and delivery boundaries

## Status

Accepted for implementation planning, 2026-09-09. No capabilities described here
are implemented merely by adding this ADR. See DEVELOPMENT_PLAN.md and task criteria.

## Decision

Preserve the local daemon/SQLite/filesystem/system Git/Codex CLI architecture.
Add an early runtime feasibility check and implement safety/recovery alongside
each stateful feature instead of introducing these guarantees in Task 011.

StageRun persistence moves from 009 to 006. One run produces one validated pair
of InvestigationResult and RootCauseResult. Publish the pair and supersede the
previous pair in one SQLite transaction. On any failure keep the old pair active.
Result content is immutable; active/superseded and freshness are lifecycle metadata.

Inputs are immutable snapshots of description, selected repo SHAs, artifact IDs
and hashes, active constraints, connection/profile selection, prompt/schema versions
and applicable prior result/intervention. Snapshotting supports traceability, not
guaranteed identical model output. External profile configuration may change;
store a safe fingerprint if available, never copy credentials/config secrets.

Each task has at most one active run; v0.1 daemon executes at most one AI run.
Reject additional starts with busy. Inputs affecting an active run cannot change
mid-run: user cancels first or edits after completion. A changed input marks
dependent results stale immediately; stale is distinct from superseded.

Use a fresh CLI invocation per run. Restart marks interrupted runs failed with
an interruption reason; no automatic paid retry/session resume. A retry is a new
run. Cancellation is idempotent, stops owned children, and competes atomically
with result publication so only one terminal outcome wins.

The daemon enforces loopback-only Host/Origin rules and same-origin browser
session/CSRF protection before privileged routes are introduced. Attachments and
generated Markdown are untrusted content; never execute embedded HTML/scripts.
No arbitrary-path read endpoint. Credentials and authenticated URLs are redacted
from user-facing errors and stored diagnostics.

Investigations explicitly request read-only sandbox with no unattended privilege
escalation. Worktrees alone do not isolate credentials or filesystem reads.
Connection selection does not certify provider identity or exact outbound payloads.
An incompatible profile fails visibly; no fallback to another connection or an
unrestricted mode. Runtime feasibility must include the configured tools, not just
the shell sandbox; use a documented restricted profile where required.

For multiple repositories use a manifest of canonical read roots with pinned
revisions. Do not misuse writable-directory flags as read access declarations.
The tested CLI version/configuration determines the adapter mechanism; the manifest
remains provider-neutral. A selected base ref resolves to a commit before creating
a detached worktree; preserve a managed pin ref until results depending on it are
explicitly removed. Only clean, owned worktrees without active runs can be removed.

Keep database transactions short. File imports use operation state, temporary
files, streaming hash/size checks, same-filesystem atomic rename and DB finalization.
Recovery reconciles only app-owned operations and paths. Worktree creation/cleanup
similarly uses durable operation records and verifies Git's actual worktree state.
Do not promise a cross-filesystem/SQLite atomic transaction or silently delete
unrecognized files during recovery.

ASK, ADD_CONTEXT and OVERRIDE are reserved domain types in v0.1; the UI only
offers implemented CHALLENGE and CONSTRAINT. Unsupported operations return an
explicit unsupported error. Adding context through task/artifact editing remains
possible between runs, marks results stale, and requires an explicit new run.

## Consequences

The first end-to-end product remains small; universal DAG execution, distributed
queues, automatic model selection and generic policy engines stay deferred.
Tests use a deterministic runtime double; real CLI validation stays a separate
local acceptance step. Linux is the first tested runtime target.
