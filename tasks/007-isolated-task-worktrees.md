# Task 007 — Isolated task worktrees

## Goal

Create an isolated Git worktree for each repository selected by a Task.

## Scope

- choose/store base ref
- create worktree under Workbench worktree directory
- persist worktree path and source revision
- safe cleanup operation
- task UI shows worktree readiness

## Acceptance criteria

- task worktree does not modify the user's normal checkout
- parallel tasks for the same repository can coexist where Git permits
- failures are recoverable and clearly reported
- cleanup does not delete the main repository

## Review additions

- Resolve base ref to a commit and create detached worktrees, allowing multiple
  tasks at the same revision. Record requested ref and resolved SHA; dirty changes
  in the user's checkout are not included and this is visible before preparation.
- Keep an app-owned pin ref for evidence history even after task worktree cleanup.
  Retain it while reports depend on it; do not promise survival after external
  deletion/corruption of a user-managed repository.
- Persist operation state before touching Git; reconcile DB with worktree list
  after partial failure/restart. Mark context ready only when all selected repos
  have prepared worktrees. A retry reuses verified completed members.
- Cleanup requires canonical owned path, matching Git registration, no active run
  and a clean worktree. Refuse unknown/dirty targets; no force deletion or generic
  recursive delete. Test symlinks, shared branch bases and partial multi-repo failure.
