# Task 005 — Repository synchronization

Status: accepted through the user's merge of PR #6 into main (be6cc72). See
[synchronization guide](../docs/repository-synchronization.md),
[ADR 0008](../docs/decisions/0008-explicit-repository-synchronization.md) and
[development status](../docs/development-status.md).

## Goal

Safely refresh remote repository state without mutating the developer's working branch.

## Scope

- `git fetch --all --prune`
- last fetched timestamp/result
- UI action and status
- tests around command construction/error handling

## Acceptance criteria

- sync never runs `git pull`
- existing user working tree changes are untouched
- failures expose command context, exit code, and stderr safely

## Review additions

- Revalidate the saved canonical checkout/common git-dir identity before mutation;
  a path can move or be replaced after registration. Use Task 004's common git-dir
  operation guard and refresh base-ref/commit/shallow metadata after successful
  fetch. A no-remote refresh must still discover local commits added after empty
  repository registration. Reject cloning/failed records as sync targets.
- Serialize Git mutations by common git-dir. Check configured fetch refspecs;
  reject unsupported refspecs that can update local branches instead of assuming
  every custom configuration makes fetch harmless. No force or pull fallback.
- Sync is explicit, not an implicit part of every AI retry. No remote yields a
  clear no-remote status. Track last attempt separately from last successful fetch.
- Integration test dirty tracked/untracked files, staged content and HEAD before
  and after fetch, using a local bare remote with changed upstream history.
- Existing task revision pins do not move when remote refs are refreshed/pruned.
