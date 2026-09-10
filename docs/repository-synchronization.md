# Repository synchronization

Expand a ready repository and choose **Fetch updates**. Workbench downloads remote
branch history and prunes remote-tracking refs removed upstream. It preserves
local branches, working files, index, HEAD, existing FETCH_HEAD, tags and task pins.
It does not pull, merge, check out files or import new tags.

Details show synchronization state, last attempt/completion and last successful
fetch separately. A failed attempt does not erase an earlier success. With no
remote, **No remote — local metadata refreshed** reports local inspection; newly
added commits are discovered without claiming a network fetch occurred.

Only an explicit action starts synchronization. Closing the page leaves the job
running; reopening or refreshing shows persisted state. Concurrent syncs against
the same Git object database are rejected, including through linked checkouts or
other workspaces. There is no hidden queue or automatic retry.

Each remote must use the standard mapping
`[+]refs/heads/*:refs/remotes/<name>/*`. Custom refspecs, mirror/skip settings and
unsupported symbolic refs fail before fetch. Configure other workflows outside
Workbench rather than relying on automatic repair or force fallback. Authentication
requirements match [repository cloning](repository-registry.md).

Failures show phase, command, exit code, signal and redacted stderr. Earlier remotes
may have updated before a later one failed; inspect the outcome before retrying.
After a daemon crash, ensure surviving Git/helper processes have stopped first.
Workbench does not roll back refs or resume interrupted attempts automatically.

The selected base ref is retained. If it no longer resolves, the UI shows no
available commit instead of silently choosing another branch. Metadata is a
snapshot for this registration; other entries sharing the same Git database need
their own explicit refresh.

## API

```text
POST /api/workspaces/:workspaceId/repositories/:repositoryId/sync
Content-Type: application/json

{}
```

The endpoint requires the local session, exact Origin and CSRF token. It accepts
only an empty JSON object, without paths, remotes, refspecs or Git arguments.
It returns 202 with a `running` repository record. Poll existing repository GET/list
endpoints for completion. Missing/foreign IDs return 404, invalid bodies return
400 and busy/non-ready repositories return 409. A lost response may follow an
accepted start; refresh before resubmitting.

| Field | Meaning |
| --- | --- |
| `syncStatus` | `idle`, `running`, `succeeded`, `failed`, `no_remote` |
| `lastSyncAttemptAt` | Latest accepted attempt's start, or null |
| `lastSyncCompletedAt` | That attempt's end, or null while running |
| `lastFetchedAt` | Last known successful Git fetch, or null |
| `syncError` | Normalized error with command and phase, or null |

If Git succeeds but metadata refresh fails, the attempt is `failed` while its fetch
timestamp is retained when storage remains writable. After interruption, a missing
success timestamp does not prove that no refs changed.

## Verification

After building, with Node 22.23.2, Git and Chrome on Linux and port 4242 free:

```bash
AEW_SMOKE_SYNC=1 node scripts/workspace-smoke.mjs
```

The isolated browser scenario includes no-remote refresh, upstream advance/prune,
a later fetch failure, preserved last-success time and daemon restart. It uses
temporary local remotes and a fresh Chrome profile with `--no-sandbox`, without
external Git or AI requests. Screenshots and JSON remain in the reported fixture
directory. See [ADR 0008](decisions/0008-explicit-repository-synchronization.md) and
[browser evidence](fixtures/synchronization/browser-result.json).
