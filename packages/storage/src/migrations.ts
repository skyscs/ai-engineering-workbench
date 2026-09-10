import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { StorageError } from './errors.js';
import { taskSchema } from './task-schema.js';
import { worktreeSchema } from './worktree-schema.js';

export interface Migration { version: number; name: string; sql: string }
export const applicationId = 0x41455731;
export const migrations: readonly Migration[] = [{ version: 1, name: 'storage_foundation', sql: `
  CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL
  ) STRICT;
` }, { version: 2, name: 'workspace_settings', sql: `
  CREATE TABLE ai_connections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
    runtime_type TEXT NOT NULL CHECK(runtime_type = 'codex-cli'),
    executable_path TEXT,
    config_profile TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
    ai_connection_id TEXT NOT NULL UNIQUE REFERENCES ai_connections(id) ON DELETE RESTRICT,
    boundary_locked INTEGER NOT NULL DEFAULT 0 CHECK(boundary_locked IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE model_profiles (
    id TEXT PRIMARY KEY,
    ai_connection_id TEXT NOT NULL REFERENCES ai_connections(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
    model_identifier TEXT,
    reasoning_effort TEXT CHECK(reasoning_effort IN ('low', 'medium', 'high', 'xhigh')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX model_profiles_connection ON model_profiles(ai_connection_id);
  CREATE TRIGGER workspace_binding_immutable BEFORE UPDATE OF ai_connection_id ON workspaces
    WHEN NEW.ai_connection_id != OLD.ai_connection_id
    BEGIN SELECT RAISE(ABORT, 'workspace_binding_immutable'); END;
  CREATE TRIGGER workspace_boundary_no_unlock BEFORE UPDATE OF boundary_locked ON workspaces
    WHEN OLD.boundary_locked = 1 AND NEW.boundary_locked = 0
    BEGIN SELECT RAISE(ABORT, 'workspace_boundary_locked'); END;
  CREATE TRIGGER connection_boundary_frozen BEFORE UPDATE OF executable_path, config_profile ON ai_connections
    WHEN (NEW.executable_path IS NOT OLD.executable_path OR NEW.config_profile IS NOT OLD.config_profile)
      AND EXISTS (SELECT 1 FROM workspaces WHERE ai_connection_id = OLD.id AND boundary_locked = 1)
    BEGIN SELECT RAISE(ABORT, 'workspace_boundary_locked'); END;
  CREATE TRIGGER locked_workspace_no_delete BEFORE DELETE ON workspaces
    WHEN OLD.boundary_locked = 1
    BEGIN SELECT RAISE(ABORT, 'workspace_boundary_locked'); END;
  CREATE TRIGGER model_profile_connection_immutable BEFORE UPDATE OF ai_connection_id ON model_profiles
    WHEN NEW.ai_connection_id != OLD.ai_connection_id
    BEGIN SELECT RAISE(ABORT, 'profile_connection_immutable'); END;
` }, { version: 3, name: 'repository_registry', sql: `
  CREATE TABLE repositories (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
    source TEXT NOT NULL,
    local_path TEXT NOT NULL,
    common_git_dir TEXT,
    remote_url TEXT,
    default_branch TEXT,
    base_ref TEXT,
    resolved_commit_sha TEXT,
    shallow INTEGER NOT NULL DEFAULT 0 CHECK(shallow IN (0, 1)),
    managed_clone INTEGER NOT NULL CHECK(managed_clone IN (0, 1)),
    status TEXT NOT NULL CHECK(status IN ('cloning', 'ready', 'failed')),
    error_json TEXT,
    retained_files INTEGER NOT NULL DEFAULT 0 CHECK(retained_files IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK(status != 'ready' OR common_git_dir IS NOT NULL),
    UNIQUE(workspace_id, local_path)
  ) STRICT;
  CREATE UNIQUE INDEX repository_clone_source ON repositories(workspace_id, source)
    WHERE managed_clone = 1 AND status != 'failed';
  CREATE TRIGGER repository_workspace_immutable BEFORE UPDATE OF workspace_id ON repositories
    WHEN NEW.workspace_id != OLD.workspace_id
    BEGIN SELECT RAISE(ABORT, 'repository_workspace_immutable'); END;
` }, { version: 4, name: 'repository_synchronization', sql: `
  ALTER TABLE repositories ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'idle'
    CHECK(sync_status IN ('idle', 'running', 'succeeded', 'failed', 'no_remote'));
  ALTER TABLE repositories ADD COLUMN last_sync_attempt_at TEXT;
  ALTER TABLE repositories ADD COLUMN last_sync_completed_at TEXT;
  ALTER TABLE repositories ADD COLUMN last_fetched_at TEXT;
  ALTER TABLE repositories ADD COLUMN sync_error_json TEXT;
  CREATE UNIQUE INDEX one_sync_per_common_git_dir ON repositories(common_git_dir)
    WHERE sync_status = 'running';
` }, { version: 5, name: 'tasks_artifacts_and_runs', sql: taskSchema }, { version: 6, name: 'isolated_task_worktrees', sql: worktreeSchema }];

const checksum = (migration: Migration) => createHash('sha256').update(migration.sql).digest('hex');

/** All pending DDL, migration records and version markers commit together. */
export function migrate(db: DatabaseSync, plan: readonly Migration[] = migrations): number {
  if (!plan.length || plan.some((entry, index) => entry.version !== index + 1)) {
    throw new StorageError('INVALID_MIGRATIONS', 'Migration versions must be contiguous from one.');
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    const version = Number(db.prepare('PRAGMA user_version').get()!.user_version);
    const id = Number(db.prepare('PRAGMA application_id').get()!.application_id);
    if (version > plan.length) throw new StorageError('SCHEMA_TOO_NEW', 'The database requires a newer Workbench version.');
    if (version === 0) {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all();
      if (id !== 0 || tables.length) throw new StorageError('UNKNOWN_DATABASE', 'Refusing to initialize an unrecognized database.');
    } else {
      if (id !== applicationId) throw new StorageError('UNKNOWN_DATABASE', 'The database does not belong to Workbench.');
      const applied = db.prepare('SELECT version, name, checksum FROM schema_migrations ORDER BY version').all();
      if (applied.length !== version || applied.some((row, index) => {
        const expected = plan[index]!;
        return row.version !== expected.version || row.name !== expected.name || row.checksum !== checksum(expected);
      })) throw new StorageError('MIGRATION_MISMATCH', 'Stored migration history differs from this application.');
    }
    for (const migration of plan.slice(version)) {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)')
        .run(migration.version, migration.name, checksum(migration), new Date().toISOString());
      db.exec(`PRAGMA user_version = ${migration.version}`);
    }
    db.exec(`PRAGMA application_id = ${applicationId}`);
    db.exec('COMMIT');
    return plan.length;
  } catch (error) {
    let cause = error;
    try { db.exec('ROLLBACK'); } catch (rollbackError) {
      // SQLite can already have rolled back (for example RAISE(ROLLBACK)). Keep
      // the original failure even if explicit rollback is no longer possible.
      cause = new AggregateError([error, rollbackError], 'Migration and explicit rollback failed.');
    }
    if (error instanceof StorageError && cause === error) throw error;
    throw new StorageError(error instanceof StorageError ? error.code : 'MIGRATION_FAILED',
      'Database migration failed. Close and reopen storage before retrying.', { cause });
  }
}
