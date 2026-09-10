# ADR 0008 — Explicit repository synchronization

## Status and decision

Implemented in Task 005. Linux is the verified runtime target.

Expose **Fetch updates** for ready repositories. POST persists an attempt and
returns 202; existing repository reads expose its state. No queue, automatic fetch,
pull, force fallback or automatic retry is introduced. Closing the browser leaves
the job running. An independent clone may run concurrently.

The canonical common git-dir is the lock identity in both the Git adapter and a
partial unique database index for running attempts. Aliases, linked checkouts and
other workspaces cannot bypass it. Rediscover and compare the registered canonical
checkout/common git-dir before mutation. Refuse moved or redirected paths. These
checks establish path identity, not tamper-proof provenance for a repository
replaced in place. External tools must not concurrently rewrite configuration or
paths during synchronization; repositories and system configuration remain trusted.

## Fetch policy

Validate every remote before fetching any. Initially support at most 32 remotes
with simple names and exactly one refspec:
`[+]refs/heads/*:refs/remotes/<name>/*`. The optional plus is the configured
remote-tracking update policy; Workbench does not add a force retry. Reject custom
subsets, negative/multiple refspecs, tag/local-branch/task-pin destinations and
another remote's namespace. Reject mirrored/skipped remotes and unsupported
symbolic refs or checkout HEADs outside local branches. Only a usual remote HEAD
symbolic ref into its own namespace is supported. Revalidate immediately before
mutation; never repair configuration automatically.

```text
git fetch --all --prune --no-prune-tags --no-tags --no-recurse-submodules
  --no-write-fetch-head --no-auto-maintenance --jobs=1
```

Override fetch/remote prune-tags and tag options per invocation and disable commit
graph writing. Reuse Task 004's protocol restrictions, SSH/credential handling,
hook/fsmonitor/maintenance suppression, bounded diagnostics and process-group
termination. Fetch has a 120-second deadline; individual preflight/metadata commands
retain the 15-second limit. Only remote branch namespaces update/prune. Local tags
are neither imported nor pruned. Existing FETCH_HEAD, working files, index, HEAD,
local branches and task pins are preserved by Workbench operations. See Git's
[fetch documentation](https://git-scm.com/docs/git-fetch) for refspec/prune behavior.

## State and failure semantics

Schema version 4 adds `syncStatus`, `lastSyncAttemptAt`, `lastSyncCompletedAt`,
`lastFetchedAt` and `syncError`. States are `idle`, `running`, `succeeded`, `failed`
and `no_remote`. A new attempt clears its error/completion but preserves the last
successful fetch timestamp. Publish refreshed metadata and terminal state in one
database update. No remotes refreshes local metadata without inventing a successful
fetch timestamp, including discovering the first local commit in an empty repo.

Preserve a selected base ref that no longer resolves after pruning; store a null
commit rather than silently selecting another branch. Other registrations of the
same common git-dir retain their own snapshots until explicitly refreshed.

Errors retain a stable command description, phase (`preflight`, `fetch`, `metadata`),
exit code, signal and redacted stderr. A metadata failure after successful Git can
still record that fetch's timestamp. Multi-remote fetch is not atomic: earlier
remotes may update before a later failure. Do not roll back refs or claim success.

Graceful shutdown stops Git and records its result before storage closes. Restart
marks running attempts failed with `SYNC_INTERRUPTED`, preserving the last known
success. Refs may already have changed and old Git children may survive a hard
crash. The user must ensure those processes have stopped before explicit retry;
there is no automatic resume or destructive recovery.

## Validation

Local fixtures cover dirty checkout/index/HEAD/FETCH_HEAD, local tags and task pins,
upstream changes and pruning, dangerous refspecs and symbolic refs, linked-checkout
locking, partial remote failures, no-remote refresh, API protection, shutdown,
restart and schema upgrade. Browser acceptance covers successful fetch, a later
failure, preserved success time and persistence through daemon restart.
