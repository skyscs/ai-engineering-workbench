# Task 006 — Task creation and local artifacts

Status: accepted through the user's merge of PR #7 into main (bf3cef4). See the
[task guide](../docs/tasks-and-artifacts.md),
[ADR 0009](../docs/decisions/0009-task-artifact-and-run-storage.md) and
[development status](../docs/development-status.md).

## Goal

Create engineering Tasks and import local artifacts into immutable task storage.

## Scope

- Task persistence/API/UI
- title + description
- select repositories manually
- import local files through browser upload to local daemon
- store artifact metadata and SHA-256
- copy original into task artifact directory

## Acceptance criteria

- user can create a task
- user can associate one or more registered repositories
- imported artifact survives source-file removal/move
- duplicate filename collisions are handled safely
- original imported bytes are never modified by processing

## Review additions

- Lock the workspace boundary in the same storage transaction as first-task
  creation using Task 003's internal guard. Test rollback of both task and lock;
  once committed, the lock must remain even if tasks are later removed.
- Preserve task/run ownership and references when settings are deleted. Snapshot
  profile values for each run so later edits cannot change historical inputs;
  define explicit behavior for deleting a referenced profile.
- Add the minimal StageRun entity/storage now (before Task 008 needs it): lifecycle,
  task/connection/profile references, immutable input snapshot, normalized error
  and timestamps. Task 009 will add result types and investigation transitions.
- Require repositories to belong to the task workspace. Snapshot description,
  repo selection, artifact IDs/hashes and constraints when a run is started.
- Stream uploads to generated paths; original names are display metadata only.
  Default maximum is 100 MiB/file and 1 GiB/task, configurable locally. Enforce
  limits while streaming, hash exact bytes, and finalize with the storage recovery
  pattern. Test traversal, duplicates, interrupted upload and disk-full rollback.
- Text/Markdown/logs are readable context. PNG/JPEG images are supplied only when
  runtime capability is verified. PDFs/videos/other files are stored/downloadable
  but marked not analyzed in v0.1; do not quietly claim their content was read.
- Default text context limit is 1 MiB total; show explicit included/excluded files
  and ranges before a run. Larger material requires user selection/excerpt; no
  silent truncation. Preserve originals when creating derived excerpts.
- Attachment download resolves IDs under the task's canonical storage root,
  rejects symlink/path escapes, and uses attachment disposition and nosniff.

## Exclusions

- OCR/video analysis
- repository auto-detection
