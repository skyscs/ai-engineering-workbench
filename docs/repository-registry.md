# Repository registry

Select a workspace and use **Repositories → Add a repository**.

- **Existing local checkout:** enter a display name and absolute path on the
  daemon host. A subdirectory or symlink resolves to the checkout root. Registering
  the checkout does not modify its working files, index, branch or configuration.
- **Clone into Workbench:** enter a display name and SSH/HTTPS URL or absolute
  local source path. Git downloads history into application-managed storage.
  This clone has no checked-out files; [task preparation](task-worktrees.md) creates the worktrees used for investigation.

Leave **Base ref** blank to prefer origin HEAD or the current symbolic branch.
If neither resolves to an existing commit, provide an explicit branch, tag or
commit. Empty repositories can register without a selected commit. Shallow
repositories are marked as incomplete history. These conditions are shown in
repository details and do not promise investigation readiness.

Expand an entry to inspect its local path, origin, chosen ref, resolved commit
and status. **Refresh repositories** reloads persisted state. After a daemon
restart, use the workspace sidebar's **Refresh** to reconnect the browser session.
Closing the browser does not cancel an active clone. A second clone is rejected
while another runs; the initial limit is 120 seconds per clone command.

Use trusted repositories and Git configuration. Configure credentials in system
Git/SSH before cloning; Workbench does not ask for passwords or private keys.
SSH uses existing agent/configuration and OpenSSH-compatible command overrides
with noninteractive options and strict host-key checks. Set up unknown host keys
outside the application. HTTPS uses existing credential helpers without terminal
prompting. Do not put tokens/passwords in URLs; credential-bearing HTTPS URLs,
queries and fragments are rejected. There is no automatic authentication fallback.

## Failure and recovery

A failed clone remains visible with its error code, exit status, signal and
redacted Git stderr. Correct the source, ref or system Git configuration, then
submit a new clone explicitly. No background retry or resume occurs.

Ordinary failures clean only the operation's generated container. When cleanup
cannot be confirmed, details say that files may remain. An abrupt daemon crash
marks unfinished clones as interrupted and retains their files. The recorded
checkout path identifies the container `repositories/<id>`; staging, if present,
is its sibling directory named `staging`.

For manual recovery, stop Workbench and ensure old Git/helper processes no longer
use that specific operation directory. Inspect or back up it before removing any
files. Limit cleanup to the recorded failed operation's generated container;
never remove a registered existing checkout or unrelated storage paths. If process
ownership is uncertain, leave the files in place. A retry uses a new container.
Failed records remain as history even after manual file cleanup.

Workspace deletion is blocked while repository records exist. Repository removal
and successful-clone cleanup are not exposed yet. Use the explicit
[Fetch updates](repository-synchronization.md) action to refresh supported remote
branch mappings and local metadata.

For a complete walkthrough, see [register repositories](user-guide.md#register-repositories).

## API

All endpoints use the local API session. POST requires the exact local Origin,
CSRF token and JSON body, limited to 16 KiB. Client-supplied IDs, workspace ownership,
environment overrides and Git arguments are rejected.

| Method | Route | Result |
| --- | --- | --- |
| GET | `/api/workspaces/:workspaceId/repositories` | `{ repositories: Repository[] }` |
| GET | `/api/workspaces/:workspaceId/repositories/:repositoryId` | Owned repository and persisted clone status |
| POST | `/api/workspaces/:workspaceId/repositories` | Register existing checkout, 201 |
| POST | `/api/workspaces/:workspaceId/repositories/clone` | Persist and start managed clone, 202 |

Both POST routes accept:

```json
{
  "name": "Payments service",
  "source": "/absolute/path/to/checkout",
  "baseRef": null
}
```

For cloning, `source` can also be `git@example.com:team/repo.git` or
`https://example.com/team/repo.git`. Missing/foreign entities return 404, invalid
input returns 400, duplicate/busy operations and protected workspace deletion
return 409. Synchronous Git failures return 422 with
`{ error: { code, message, exitCode, signal, stderr } }`. Background clone failures
use the same error structure in the repository record. A lost POST response is
not proof that no operation started: refresh the list before resubmitting.

`ready` means initial registration or clone validation completed. It does not mean
the repository has remained unchanged or contains sufficient investigation history.
`commonGitDir` records the canonical identity for Git-operation locking.

## Verification

Automated tests use temporary local fixtures, with no network credentials or AI
requests. Git tests cover Unicode/spaces, dirty state, linked worktrees, empty and
shallow repositories, detached HEAD, invalid refs, transport rewriting, configured
SSH invocation, missing Git, redaction and process-group timeout. Storage/API tests
cover workspace ownership, duplicates, restart, cleanup, shutdown and migration
from schema version 2.

With a production build, Node 22.23.2, Git and Google Chrome installed on Linux,
and port 4242 free:

```bash
AEW_SMOKE_REPOSITORIES=1 node scripts/workspace-smoke.mjs
```

This extends the workspace browser scenario with registration, successful/failed
clone, dirty-checkout preservation, restart persistence and blocked workspace
deletion. It uses isolated data and a fresh Chrome profile with `--no-sandbox`.
The fixture directory retains desktop/mobile screenshots and JSON evidence.
See the [recorded result](fixtures/repositories/browser-result.json) and
[ADR 0007](decisions/0007-repository-registry-and-clone-recovery.md).

A separate opt-in [SSH acceptance result](fixtures/repositories/remote-clone-result.json)
records cloning this development repository through `RepositoryService` into a
temporary data root. `GitClient` inherited the session's `GIT_SSH_COMMAND` selection
(`ssh -F /dev/null`), with noninteractive options added by the adapter. Existing
credentials were used by SSH; no user configuration was modified. Real HTTPS
authentication remains unverified.
