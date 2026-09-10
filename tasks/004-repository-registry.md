# Task 004 — Repository registry

## Goal

Allow a Workspace to register an existing local Git repository or clone one into Workbench-managed storage.

## Scope

- validate repository with system Git
- register existing local path
- clone through system `git`
- persist name, path, remote, default branch/base ref
- repository list/detail UI
- normalized process errors

## Acceptance criteria

- existing repository can be registered
- remote repository can be cloned using the user's normal system Git authentication
- application never asks for or stores Git passwords/private keys
- invalid/non-Git paths produce useful errors

## Review additions

- Add workspace ownership foreign keys and explicit workspace-deletion behavior
  when introducing repositories. Do not let Task 003's settings deletion leave
  dangling repository records or remove a user's checkout; managed clone cleanup
  must follow the recorded operation/recovery contract.
- Spawn Git with an argument array and no shell; validate option-like inputs,
  canonical paths and allowed clone transports (local, SSH, HTTPS). Disable
  unattended interactive credential prompting and bound command execution time.
- Record canonical repository root and common git-dir so linked checkouts do
  not bypass repository-operation locking. Default branch detection may fail:
  require an explicit valid base ref instead of assuming main/master.
- Remote-less local repos are valid; empty repos may register but cannot prepare
  a task worktree until a commit exists. Report shallow history as incomplete.
- Treat hooks/filters and repository config as executable local configuration;
  support trusted local repos in v0.1, suppress hooks for app-created operations
  where possible, and do not present clone/worktree as an untrusted-code sandbox.
- Use staged managed clone paths and recoverable failure cleanup; never clean
  up a user-supplied existing checkout. Redact credentials embedded in remote URLs.
- Test spaces/unicode paths, invalid refs, remote-less/empty repositories and
  failed clone using local fixture remotes without network credentials.
