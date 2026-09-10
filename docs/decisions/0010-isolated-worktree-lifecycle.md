# ADR 0010 — Isolated task worktrees and retained revision pins

## Status

Implemented in Task 007, 2026-09-10. Linux is the verified runtime target.

## Decision

Prepare one detached worktree per task/repository pair under
`worktrees/<task-id>/<repository-id>`. Persist source and common Git directory,
destination, operation ID/kind and lifecycle state before Git mutations. Resolve
the selected base ref once, persist its full commit SHA and create a direct
`refs/aew/tasks/<task-id>/<repository-id>` pin with an expected-empty update.
Existing matching pins are reused; conflicting or symbolic refs are rejected.
The pin and destination must identify the same task/repository pair.

Use Git's detached worktree creation so tasks can share a branch base without
sharing checkout state. Cleanup uses Git's worktree removal, never a force flag,
recursive application deletion or global prune. These operations follow the
[Git worktree interface](https://git-scm.com/docs/git-worktree). Pin creation uses
the compare-and-update behavior documented by
[git-update-ref](https://git-scm.com/docs/git-update-ref).

Base refs can be edited before a revision is recorded, including after a failed
resolution. Once recorded, the SHA is immutable. Retry and recreation after cleanup
use that SHA even if the branch advances. A new revision requires a new task in
this iteration. Pins survive cleanup and remain available to later evidence;
external repository deletion or corruption cannot be prevented by the Workbench.

### Execution and storage

Preparation and cleanup are deterministic `context_preparation` StageRuns. They
record input snapshots before execution and expose persisted status through the
protected API. No AI process is started. One active run per task blocks competing
preparation, cleanup and artifact/context edits. Every repository operation checks
the owning running preparation stage. Stale operation IDs cannot update metadata.

The daemon shares a single GitClient between synchronization and worktree services.
Its common Git directory lock serializes mutations across linked checkouts and
workspace registrations. Multi-repository preparation processes members in stable
ID order. It stops on the first failure and retains completed members; retry verifies
and reuses them. Unfinished members never make the task ready.

Schema version 6 adds owned worktree records and a persisted `context_ready` flag.
Task reads expose `CONTEXT_READY` only when all selected members have ready records;
otherwise they expose `CREATED`. The original Task 006 `status` column remains a
workflow baseline, avoiding a rebuild of referenced tables merely to add this
preparation state. Task 009 must integrate these fields with workflow transitions.
Investigation run creation requires every member ready and snapshots actual
worktree paths, pins and resolved SHAs. The runtime must revalidate access before
execution; persisted readiness alone cannot establish current filesystem state.

### Verification and cleanup

Revalidate canonical source/common directory identities and the managed root and
parent paths. A cleanup target must have a matching Git registration, detached
HEAD at the recorded SHA, a regular Git marker and the expected administrative
directory. Refuse initializing/locked/prunable registrations and Git lock files.
Verify the retained pin and reject modified, untracked or ignored content, as well
as assume-unchanged/skip-worktree index entries. Refuse unknown directories and
redirected paths; never repair or overwrite them automatically.

Git object/ref writes request fsync. Before publication, synchronize regular
worktree files and administrative files/directories on Linux. Tracked symlinks
are valid content; durability traversal never follows their targets. Cleanup
synchronizes directory changes and retains the pin. SQLite and Git/filesystem
changes remain separate operations with explicit reconciliation.

Checkout does not include the source checkout's dirty changes. Automatic submodule
initialization, fetching and custom smudge/process filters are unsupported here.
Filter configuration is rejected before checkout; preparation never silently runs
a configured filter or downloads missing content. Existing Git hooks/fsmonitor and
automatic maintenance remain disabled by the adapter. Worktrees isolate checkout
contents, not process permissions or credentials.

### Restart and shutdown

Before listening, reconcile recorded operations against Git registration, path,
HEAD, pin and cleanliness. A verified completed worktree can become ready after
publication failure. An absent directory and absent registration can finish a
recorded removal. Missing, dirty, initializing or uncertain state becomes failed
with diagnostics; startup never creates, removes, unlocks or prunes worktrees.
Unknown paths remain untouched. Retry is explicit and rechecks state.

Historical StageRuns remain failed/interrupted even if a completed member is
recognized during recovery. Graceful shutdown stops owned Git process groups and
waits for both execution and startup reconciliation before closing SQLite.
After an abrupt daemon death, an old Git process or lock may remain: finish or
inspect that operation before retrying, without force cleanup. Application locks
do not coordinate unrelated external Git clients or another data root.

## Validation

Tests cover shared branch bases, dirty source preservation, retained pins after
cleanup and GC, unsafe cleanup targets, symbolic pin conflicts, checkout filters,
partial multi-repository failure, stale operation IDs, version 5 migration,
publication/removal recovery and shutdown during execution/reconciliation.
Browser acceptance exercises ref correction, preparation, dirty cleanup refusal,
clean cleanup, recreation at the pin and production-to-development restart.
