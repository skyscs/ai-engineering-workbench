# Tasks and local artifacts

Select a workspace, register repositories, then choose **Tasks → New task**.
Enter a title and description and select at least one ready repository. Creating
the first task permanently locks the workspace's AI connection launch settings.
Task creation does not automatically prepare worktrees or run AI. Use
**Task worktrees → Prepare worktrees** as described in the
[worktree guide](task-worktrees.md).

Open a task and use **Import local artifacts** to select files in the browser.
Each file is copied into managed local storage with a generated ID and SHA-256.
Duplicate names are independent artifacts. Removing or moving a source file does
not remove its imported copy. Imports are immutable; **Download original** returns
the stored bytes. Keep the complete application data directory in backups.

The **Text context preview** lists every artifact. All files start excluded. Select
UTF-8 text, Markdown or logs explicitly and save the selection. For large files,
choose a smaller byte range before saving. Start is inclusive; end is exclusive.
Both offsets must fall at UTF-8 character boundaries. Download the original to
inspect it; original bytes are preserved when selecting an excerpt. The displayed
draft total includes the description. Saving does not invoke AI.

PNG/JPEG are stored but excluded while runtime image support is unverified.
PDFs, videos and other formats are downloadable and marked not analyzed in v0.1.
Neither a filename nor a MIME type proves that file content was understood.

For a walkthrough with expected results, see [import and select context](user-guide.md#import-and-select-context).

## Limits and recovery

Local daemon environment variables accept positive integer byte counts:

| Variable | Default | Meaning |
| --- | ---: | --- |
| `AEW_MAX_ARTIFACT_BYTES` | 104857600 | Maximum bytes per file (100 MiB) |
| `AEW_MAX_TASK_ARTIFACT_BYTES` | 1073741824 | Imported and reserved bytes per task (1 GiB) |
| `AEW_MAX_CONTEXT_BYTES` | 1048576 | Description plus selected text (1 MiB); hard ceiling 16 MiB |

Restart to change limits. Lower limits do not delete existing files or rewrite
historical runs; future uploads and selections must meet the new limits.

Uploads are streamed and checked against both declared and actual size. One
pending import is allowed per task. An interrupted or disk-full upload cannot
publish a partial artifact; retry by importing the source again once failure is
recorded. Multi-file imports retain earlier successes if a later file fails.

If finalization fails after a complete file is staged, restart the daemon to
verify and finish the recorded import. **Incomplete imports** shows failures and
pending recovery. `RECOVERY_REQUIRED` retains uncertain files and quota: stop the
daemon and repair/restore the data directory before restarting. Do not remove
unknown files or alter database rows to force completion. Recovery only touches
paths belonging to recorded operations. See [ADR 0009](decisions/0009-task-artifact-and-run-storage.md).

## API

All routes below require the local browser session. POST/PUT additionally require
the exact local Origin and `X-AEW-CSRF`. IDs are scoped to the requested workspace
and task. JSON failures use the established 400/404/409 error responses.

| Method | Route under `/api/workspaces/:workspaceId` | Input/result |
| --- | --- | --- |
| GET | `/tasks` | `{ tasks }` |
| POST | `/tasks` | `{ title, description, repositoryIds }` → Task, 201 |
| GET | `/tasks/:taskId` | Task, artifacts, context manifest, limits, incomplete imports |
| POST | `/tasks/:taskId/artifacts` | Raw bytes → Artifact, 201 |
| PUT | `/tasks/:taskId/context` | `[{ artifactId, start, end }]` → saved context manifest |
| GET | `/tasks/:taskId/artifacts/:artifactId/download` | Attachment bytes |

Task titles allow 120 characters; descriptions allow 65536 characters including
line breaks, within the text context budget. Select 1–32 distinct ready repositories
from the same workspace. Task JSON bodies are capped at 512 KiB; context selection
JSON at 256 KiB. Task edit/delete remains deferred. Use the [investigation API](investigation.md#protected-api) for full reports;
the [legacy preview API](codex-runtime.md#protected-api) remains available separately.
Deterministic worktree operations expose StageRuns through the worktree API.

Upload headers: `X-AEW-Filename` is `encodeURIComponent(originalFilename)`,
`X-AEW-File-Size` is the exact decimal byte count, and `Content-Type` is the file's
MIME type (use `application/octet-stream` if unknown). Send raw bytes, not multipart
form data. Downloads always use `application/octet-stream` with attachment
disposition and nosniff, regardless of the original MIME type.

TaskRepository base refs and commit SHAs begin as initial metadata; preparation
resolves and pins worktrees. AI runtime integration remains future work.
A referenced model profile cannot be deleted; its current settings
may be edited while immutable run snapshots preserve historical inputs.

## Browser acceptance

After building, with Node 22.23.2, Chrome and a free port 4242:

```bash
AEW_SMOKE_TASKS=1 node scripts/workspace-smoke.mjs
```

The script uses temporary Git repositories, data and a Chrome profile. It creates
a task with two repositories, uploads a log and PDF, saves explicit text context,
removes the source files and downloads preserved bytes. Production-to-development
restart verifies persistence, and a 390px viewport checks horizontal overflow.
The fixture directory retains screenshots and a JSON result for inspection.
