# ADR 0005 — Local storage driver, migrations and ownership

## Status

Implemented in Task 002, 2026-09-10. Linux is the verified runtime target.

## Decision

Use `node:sqlite` inside `packages/storage`, behind the exported `Storage` lifecycle
and status interface. The daemon does not receive a database handle or execute SQL.
Future storage repositories belong in that package; core remains infrastructure-free.
The pinned Node 22.23.2 includes SQLite 3.51.3. No native npm driver is needed.

The module remains experimental. Its basic API became available without a flag
in Node 22.13, so the minimum runtime increases from 22.12 to 22.13; the tested
patch remains 22.23.2. Only basic synchronous APIs are used. This suits short local
metadata transactions; long queries must move off the daemon event loop if later
workloads require them. See the [Node documentation](https://nodejs.org/download/release/v22.23.2/docs/api/sqlite.html).

Resolve an absolute data root using OS conventions, with an explicit `AEW_DATA_DIR`
override. Relative overrides fail instead of depending on the startup directory.
Relative XDG/LOCALAPPDATA values fall back to the home convention. Canonicalize the
root before ownership. Create managed directories with mode 0700 and database files
with mode 0600 where POSIX modes apply. Existing permissions are not changed.
Reject redirected managed directories, database symlinks/hardlinks and sidecars.
The data root/configuration are trusted local inputs; this is not protection against
a concurrent hostile process running as the same user.

Hold `BEGIN EXCLUSIVE` on a dedicated rollback-mode `.owner.db` connection for the
storage lifetime. Fail immediately on contention. The application database has its
own connection and transactions, so ownership does not hold a long transaction on
application data. OS locks release on close or process death; there is no PID-file
timeout or stale-file deletion. Never unlink/replace the ownership file while a
daemon is running. Use a local filesystem with reliable SQLite locks, not a shared
network volume. SQLite describes its [locking mechanism here](https://www.sqlite.org/lockingv3.html).

Open the application database only after acquiring ownership. Enable foreign keys,
a 1000ms busy timeout, WAL and FULL synchronous mode. Migration work is atomic in
one `BEGIN IMMEDIATE` transaction: DDL, history records and `user_version` commit
together. Version 1 creates only `schema_migrations`, with name, SQL checksum and
timestamp. Check the application ID and complete migration history on startup;
refuse an unknown database, newer schema or changed migration. Add new migrations
instead of editing applied SQL. On failure close storage and report the error;
automatic rollback must not hide the original SQLite failure.

## Daemon lifecycle

Storage must initialize before the HTTP listener starts. Initialization failure
exits with an actionable error code. Bind failure, SIGINT and SIGTERM close storage
and release ownership; the existing bounded shutdown deadline remains in force.
`GET /api/storage` is session-protected and reports status without paths. The public
health response is not expanded with local database details.

## Filesystem operation recovery for later tasks

Task 002 creates repositories, tasks, worktrees and logs directories. It does not
create workspace/task/artifact tables or a generic operation framework.

When Tasks 006/007 introduce file operations, each operation must first persist its
ID, kind, expected destination and state. Write into an operation-owned staging
path on the destination filesystem, stream size/hash checks, flush completed data,
then atomically rename and finalize database metadata. Do not hold a database
transaction across streaming or Git subprocess work. Durable rename may also need
directory synchronization on the supported platform.

On restart, reconcile only recorded operations and their owned paths. A completed
file with pending metadata can be finalized after verification; an incomplete
staging file can be retried/cleaned by its owning operation. Unknown files are not
deleted automatically. Git worktrees require Git-aware reconciliation against
their operation records. SQLite commit and filesystem rename are separate steps;
neither is represented as a transaction covering both resources.

## Validation

Tests cover all three path conventions, repeat initialization, rollback including
initial schema creation and SQLite automatic rollback, schema/history rejection,
permissions, ownership contention, SIGKILL recovery and death during a migration.
The daemon smoke checks real HTTP status, same-root rejection, occupied-port cleanup,
SIGTERM and production-to-development restart. Tests use temporary roots only.
