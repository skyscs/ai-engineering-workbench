# ADR 0009 — Task inputs, artifact imports and minimal stage runs

## Status

Implemented in Task 006, 2026-09-10. Linux is the verified runtime target.

## Decision

Create a task with a title, multiline description and 1–32 distinct ready
repositories from its workspace. Insert the task and repository associations in
the same transaction as `lockWorkspaceBoundary`. Composite foreign keys preserve
workspace ownership. The lock remains after any later task removal. No task
editing or deletion endpoint is introduced in this iteration.

Task repository rows initially record the selected base ref and observed commit.
These are registration metadata, not prepared worktrees or durable Git pins.
Task 007 must revalidate sources, resolve and pin commits and record preparation
state before investigation. Task 006 keeps task status at `CREATED`.

### Artifact durability

The browser sends each file as a raw request body with URI-encoded filename,
declared byte size and MIME type. This avoids buffering a multipart request.
Declared size reserves task quota; actual bytes are counted and hashed while
streaming. Both shorter and longer bodies fail. Imports in a multi-file form are
independent; successfully imported files survive a later file failure.

An `artifact_imports` record persists operation ID, kind, generated destination,
metadata, reserved size and `uploading` state before file creation. One pending
import per task prevents quota races and blocks context edits/run creation.
Original filenames, including path-like names, are display metadata only.

Write `tasks/<task-id>/artifacts/<operation-id>.upload` with exclusive creation,
bounded writes and SHA-256 over exact bytes. Set the completed file read-only,
flush it and its directory, then persist `prepared` with the hash. Rename on the
same filesystem, synchronize the directory and publish immutable artifact
metadata, import `ready` state and context revision in a short transaction.
Database transactions do not span streaming, file verification or Git work.

On restart, incomplete recorded uploads lose only their regular staging file and
become failed. Prepared files, whether staged or renamed, must match recorded
size/hash before publication. Uncertain or redirected paths remain pending with
`RECOVERY_REQUIRED`, retaining quota and blocking another import until repaired.
Unknown files are never automatically removed. A failure after preparation asks
for restart/recovery instead of encouraging a duplicate import. No automatic
network retry is involved. Shutdown cancels upload readers and waits for jobs
before closing storage; direct storage consumers must do the same.

Download resolves workspace/task/artifact IDs, verifies real parent directories
and an unlinked regular file and streams an already opened handle. No second path
lookup occurs. Responses use attachment disposition, octet-stream and nosniff.
This assumes trusted local storage, as in ADR 0005; it does not promise protection
from a concurrent hostile process running as the same user.

### Explicit text context

All artifacts start excluded. Text extensions (`.txt`, `.md`, `.markdown`, `.log`)
are candidates; selection checks UTF-8 and rejects NUL bytes. The UI shows each
included/excluded file and one explicit byte range per selected file, using
`[start, end)` offsets. Ranges must end on complete UTF-8 characters. Total context
includes the UTF-8 description bytes. Exceeding the configured limit fails without
truncation; an excerpt is a range reference and never rewrites the original.
Selected files are hash-verified before saving context and before a run snapshot.

PNG/JPEG remain excluded until Task 008 verifies image support and adds the input
mechanism. PDFs, videos and other extensions remain downloadable and explicitly
not analyzed in v0.1. Upload MIME types are untrusted metadata, never rendering or
analysis authority. The preview describes intended supplied context, not an audit
of a future CLI's exact outbound payload.

### StageRun foundation

Internal storage creates a queued `context_preparation` or `investigation` run
with an immutable snapshot before execution. The snapshot includes task description,
context revision, selected repositories/base refs/observed SHAs, all artifact
IDs/hashes and inclusion ranges, connection settings, full requested model profile,
and prompt/schema versions. Constraints are an explicit empty array until Task 010;
no constraint input is silently accepted. Task 007/008 must add prepared read roots,
pin evidence and verified runtime metadata before production execution.

Foreign keys and a connection check preserve run ownership. Referenced model
profiles cannot be deleted; edits are allowed and cannot alter historical snapshots.
There is one active run per task and one active investigation per daemon database.
Active runs block artifact imports/context changes. Terminal transitions are
transactional and immutable; the first terminal outcome wins. Failed runs carry a
bounded normalized error. Startup marks queued/running records failed with
`INTERRUPTED`; retry creates a new record.

There is deliberately no public start/cancel endpoint or execution button in Task
006. Tasks 008/009 will connect runtime ownership, cancellation and validated result
publication to this foundation. A storage record alone does not verify runtime
compatibility or claim that an investigation occurred.

## Validation

Storage/HTTP tests cover boundary rollback, cross-workspace references, preserved
profile snapshots, terminal immutability, quota failures, disconnects, injected
ENOSPC, process death during upload, finalization recovery, hash mismatch and link
escapes. Browser acceptance creates a two-repository task, imports log/PDF files,
selects text, removes the sources, downloads preserved bytes and restarts the daemon.
