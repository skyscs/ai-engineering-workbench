# ADR 0007 — Repository registration and clone recovery

## Status

Implemented in Task 004. Linux with Git 2.53.0 and Node 22.23.2 is the locally
verified runtime; Windows process-tree termination and filesystem durability are
not certified by this iteration.

## Registration and identity

Register an existing working checkout by inspecting it through system Git. Resolve
the canonical top-level path and common git-dir, including linked worktrees and
symlink aliases. Reject a duplicate canonical checkout path in one workspace.
Different linked checkouts may be registered, but their shared common git-dir is
the lock identity for future mutations. The Git adapter provides an exclusive
operation guard; Task 005 must use that identity for fetch.

Registration reads metadata without updating HEAD, index or working files. It
records the sanitized origin URL, full default/base ref, resolved commit and
shallow-history flag. Prefer `refs/remotes/origin/HEAD`, then the current symbolic
branch. Detached HEAD without a detected default requires an explicit ref. An
empty repository can register with no selected commit; it cannot prepare a task
until a commit exists. Existing bare repositories are outside the checkout
registration contract; a local bare repository can still be a clone source.

These values describe the registration snapshot. Task 005 must revalidate the
canonical identity and refresh relevant metadata after fetch. A saved path is
not proof that a directory still exists or still identifies the same repository.

## Process and authentication boundary

The application spawns system Git with argument arrays and no shell. Trusted Git
configuration may itself invoke configured SSH commands and credential helpers.
Reuse the SSH agent, OpenSSH configuration and system Git credential helpers.
Preserve `GIT_SSH_COMMAND`, configured `core.sshCommand`, or `GIT_SSH` selection for
clone, adding OpenSSH BatchMode and strict host-key checks. Custom SSH commands
must accept OpenSSH options; other SSH implementations are not certified.
There are no UI credential fields. Unknown host keys, unavailable credentials and
configuration errors fail instead of opening an interactive prompt.

Accept absolute local paths, local file URLs, SSH URLs/scp-style addresses and
HTTPS URLs. Reject submitted credential-bearing HTTPS URLs, passwords, queries,
fragments and other transports. `GIT_ALLOW_PROTOCOL=file:ssh:https` also constrains
URL rewrites performed by Git. Origin metadata and normalized errors redact URL
credentials/query strings and common token/password/authorization diagnostics.
The application does not read credential files or persist environment dumps.

Remove inherited Git repository selectors, tracing, injected configuration and
alternate-object overrides. Disable optional locks, lazy object fetching,
filesystem monitors, hooks and automatic maintenance for these operations.
The adapter bounds metadata commands to 15 seconds and clone to 120 seconds,
with captured stdout/stderr limited to 262144/32768 characters. Failures preserve
exit code, signal and redacted stderr; timeout/cancellation take precedence over
the process exit code. On Linux, shutdown/deadlines signal the owned process group
and escalate to SIGKILL. Repositories and system configuration remain trusted
local inputs; these controls are not a sandbox for hostile helpers or hooks.

Git documents [clone behavior](https://git-scm.com/docs/git-clone),
[canonical repository discovery](https://git-scm.com/docs/git-rev-parse),
[environment controls](https://git-scm.com/docs/git) and
[fsync configuration](https://git-scm.com/docs/git-config#Documentation/git-config.txt-corefsync).

## Clone state and recovery

Use the repository ID as the identity of its initial clone operation. Schema
version 3 stores `cloning`, `ready` or `failed`, normalized error and retained-file
status. Task/StageRun tables are not introduced before Task 006. Only one clone
runs per daemon; another start returns a conflict. A nonfailed managed clone
source cannot be duplicated within the same workspace. Registration is scoped
by canonical local path instead.

1. Persist the `cloning` record with generated destination before creating files.
2. Create `repositories/<id>/staging` inside a newly owned container directory.
3. Clone without checkout, templates, submodules, local hardlinks or alternate
   object sharing. Git fsyncs objects, references and metadata.
4. Validate the requested base ref, rename staging to `checkout`, inspect the
   final canonical paths, and sync config and containing directories on Linux.
5. Publish metadata and `ready` in one database update.

The API returns 202 and the repository record before clone completes. The browser
polls persisted state; closing the page does not cancel work. The daemon stops
active Git jobs and records their outcomes before closing storage on graceful
shutdown. Failed clones are never retried automatically.

On a normal failure, remove only the generated container whose inode, device and
canonical path still match the current operation. Record a cleanup failure as
retained files. Never remove an existing user checkout or an unknown path.
If the daemon dies abruptly, Git children might outlive it. On startup mark
unfinished clones `CLONE_INTERRUPTED`, retain their recorded paths, and do not
resume, finalize or remove them automatically. Manual inspection must establish
that no old process uses those paths before cleanup. Retry starts a new clone
with a new ID. This conservative recovery also covers a crash after rename but
before the database update; a complete directory alone is not a published clone.

SQLite and filesystem publication are separate steps. Fsync reduces power-loss
exposure but does not replace revalidation before later operations or provide an
atomic transaction across Git files and SQLite.

## Deletion and future integration

Repository records have a restrictive workspace foreign key and immutable
ownership. Workspace deletion returns 409 whenever any repository record exists,
including a failed clone. Repository removal is not exposed in this iteration;
future cleanup must account for task pins and managed files before deleting
metadata. The UI must not imply that deleting a workspace deletes a user checkout.

Task 005 adds explicit synchronization; registration/clone do not implement fetch
of an existing repository. Task 007 creates working files in detached task
worktrees from the registered object database.
