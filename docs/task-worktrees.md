# Isolated task worktrees

Open a task and use **Task worktrees** to review each selected repository's base
ref. Save any changes before choosing **Prepare worktrees**. A branch, tag, full
ref or commit SHA must resolve locally; this action does not fetch updates.

Preparation checks out committed content into separate detached worktrees. Dirty
changes in your normal checkout are excluded, and that checkout's files, index,
HEAD and configuration remain unchanged. Multiple tasks can use the same branch
base. The UI shows each worktree's status, path, commit and retained pin.

Before its first investigation, the task becomes **Context ready** when every
selected repository is prepared.
Preparation is deterministic Git work; it does not run an AI investigation.
Continue with [running an investigation](user-guide.md#run-and-review-an-investigation).

## Refs and retries

Edit the base ref before a revision is recorded. A failed resolution can be
corrected and retried. Once a commit is recorded, preparation keeps that revision;
later branch updates do not move it. Create another task to select a newer commit.
For an initially empty repository, add a commit or select an existing local ref
before retrying.

If one repository fails, completed members remain available. **Prepare worktrees**
checks and reuses those members, then continues preparation. Failures show phase,
normalized error and Git diagnostics where available. Browser reconnection reads
the persisted run; it does not restart it.

Configured smudge/process checkout filters and automatic submodule initialization
are unsupported. No network fetch is performed during preparation. Configure a
repository without those filters for this version; do not expect LFS content or
submodule contents to appear automatically. Shallow history remains shallow.

## Cleanup and recovery

Choose **Clean up worktree** and confirm to remove a clean, owned worktree through
Git. Cleanup refuses modified, untracked or ignored files, hidden index entries,
attached branches, redirected paths, mismatched registrations and active runs.
Preserve your changes before retrying. The main repository, task artifacts,
historical runs and revision pin remain intact.

Cleanup removes worktree readiness. A task without a published report returns
to **Created**; an existing report still determines its completed workflow state.
Preparing again recreates the worktree at the same recorded commit. The retained pin protects local history
from ordinary pruning, but cannot protect a user-managed repository from external
deletion or corruption. Keep repositories and the complete Workbench data directory
in backups.

On startup, the daemon verifies recorded worktrees before serving the UI. Completed
Git work with pending metadata can be recognized; incomplete or uncertain state
is reported as failed. Startup does not delete unknown files, unlock worktrees or
prune Git registrations. After an abrupt stop, inspect any remaining Git process
or initializing lock before retrying. Restore moved repositories to their recorded
canonical paths or restore backups if necessary. There is no force-repair button.

See [ADR 0010](decisions/0010-isolated-worktree-lifecycle.md) for ownership,
durability and recovery details. Worktrees are not security sandboxes.

## API

Routes under `/api/workspaces/:workspaceId/tasks/:taskId` require the browser
session. Mutations additionally require the exact local Origin and `X-AEW-CSRF`.

| Method | Route | Request and response |
| --- | --- | --- |
| PUT | `/worktrees/:repositoryId/base-ref` | `{ "baseRef": "refs/heads/main" }` → worktree selection |
| POST | `/worktrees/prepare` | `{}` → StageRun, 202 |
| POST | `/worktrees/:repositoryId/cleanup` | `{}` → StageRun, 202 |
| GET | `/runs/:runId` | Persisted StageRun |
| GET | `/` | Task detail including worktrees and latest run |

HTTP 202 acknowledges a persisted operation; inspect the returned run ID or refresh
task detail for completion. Busy or conflicting requests return 409, unknown or
foreign IDs return 404, and invalid input returns 400. There is no arbitrary-path
cleanup API. A run uses the existing Task 006 context snapshot validation; restore
missing selected artifacts if that preflight rejects an operation.

## Browser acceptance

After building, with Node 22.23.2, Chrome and a free port 4242:

```bash
AEW_SMOKE_WORKTREES=1 node scripts/workspace-smoke.mjs
```

The temporary fixture includes two repositories and imported artifacts. It tests
ref failure/correction, preparation, dirty cleanup refusal, safe cleanup, pin
retention, recreation, restart persistence and a 390px viewport. Screenshots and
JSON outcomes remain in the printed temporary directory. No AI invocation or
normal application data is used.
