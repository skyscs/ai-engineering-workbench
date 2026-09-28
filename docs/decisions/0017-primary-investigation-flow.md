# ADR 0017 — Durable drafts and one-action investigations

Status: accepted, 2026-09-28.

The primary UI presents Projects and Investigations. Projects remain workspaces;
existing domain IDs, reports and connection boundaries remain intact. Advanced
management remains available, while ordinary users fill a repository/problem
composer and select their setup once.

Schema 11 adds drafts, bounded draft text files and launch operations. Small UTF-8
attachments are temporarily stored as SQLite blobs so an upload is atomic before
there is a task or locked connection. Their combined size plus description cannot
exceed the smallest configured context/file/task budget (with a 1 MiB draft cap); normal published task
artifacts retain the existing filesystem storage and hashing. Unsupported formats
use the advanced artifact workflow rather than being silently supplied to AI.

Draft writes use optimistic revision checks. Launch claims are synchronous and
keyed by a client UUID; only one launch operation is active per daemon/database.
A retry with the same UUID returns the original operation. A deliberate retry
uses a new UUID. An active draft cannot change, and a materialized task freezes
its original input. New code or another connection requires a new draft.

The daemon validates configuration using bounded diagnostics in an empty temporary
working directory, without a model call. It then resolves repositories, creates
the task with a stable ID, imports draft files with stable IDs, selects context,
prepares worktrees and invokes the existing RuntimeService. Real runtime preflight
still checks the actual worktrees. No routing/authentication defaults are inferred.

Launch phases, normalized failures and model run references are persisted.
Preparation runs remain available through the existing task history. Cancellation
aborts diagnostics or the runtime; an in-flight Git preparation is allowed to settle
before the operation releases ownership, and must never lead to a model invocation.
Shutdown cancels launches alongside existing services. On startup, incomplete
launches become interrupted failures; no model operation is resumed automatically.
Previously created tasks, artifacts and successful reports remain discoverable.

Draft creation does not lock a workspace. Task creation still does, after selected
configuration passes local checks. A directory proves selection, not account
identity or model access. The UI reports the scope of checks without claiming more.

This is a single bounded workflow built on existing services, not a new general
workflow framework. Line-range editing, OCR and native directory pickers are not
part of this iteration. Draft discard deletes only draft staging data and is refused
for active launches or materialized tasks. No historical migration is rewritten.

A local source path resolves current HEAD through read-only Git inspection before
new task creation. Selected registered repositories resolve their saved ref.
Reusing a managed remote URL explicitly through the composer fetches that source
before pinning a new task; existing tasks and checkouts retain their pins.

Draft attachments initialize task context once. A persisted materialization flag
prevents retries from overwriting later explicit context edits in Advanced settings;
adopted legacy tasks preserve those selections from the start.
