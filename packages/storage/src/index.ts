import { accessSync, closeSync, constants, lstatSync, mkdirSync, openSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { StorageError } from './errors.js';
import { migrate } from './migrations.js';
import { resolveDataRoot, storagePaths } from './paths.js';
import { createSettingsRepository, type SettingsRepository } from './settings.js';
import { createRepositoryStore, interruptRepositoryOperations, type RepositoryStore } from './repositories.js';

export { StorageError, resolveDataRoot };
export type { SettingsRepository };
export type { RepositoryStore };
export interface StorageStatus {
  status: 'ready';
  schemaVersion: number;
  sqliteVersion: string;
  foreignKeys: boolean;
  journalMode: string;
}
export interface Storage {
  readonly settings: SettingsRepository;
  readonly repositories: RepositoryStore;
  readonly paths: ReturnType<typeof storagePaths>;
  status(): StorageStatus;
  close(): void;
}

function directory(file: string): void {
  mkdirSync(file, { recursive: true, mode: 0o700 });
  if (!lstatSync(file).isDirectory()) throw new StorageError('INVALID_STORAGE_PATH', 'A managed directory must be a real directory.');
  accessSync(file, constants.R_OK | constants.W_OK | constants.X_OK);
}

function databaseFile(file: string): void {
  try { closeSync(openSync(file, 'wx', 0o600)); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  // SQLite opens its own handles: reject existing redirected files and sidecars.
  for (const candidate of [file, `${file}-wal`, `${file}-shm`, `${file}-journal`]) {
    try {
      const stat = lstatSync(candidate);
      if (!stat.isFile() || stat.nlink !== 1) {
        throw new StorageError('INVALID_STORAGE_PATH', 'Database files must be regular files without links.');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

/** Acquire ownership before opening or migrating the application database. */
export function openStorage(options: { dataRoot?: string } = {}): Storage {
  const requested = options.dataRoot ?? resolveDataRoot();
  if (!path.isAbsolute(requested)) throw new StorageError('INVALID_DATA_DIR', 'The data directory must be absolute.');
  let owner: DatabaseSync | undefined;
  let db: DatabaseSync | undefined;
  try {
    mkdirSync(requested, { recursive: true, mode: 0o700 });
    const paths = storagePaths(realpathSync(requested));
    directory(paths.root);
    databaseFile(paths.owner);
    owner = new DatabaseSync(paths.owner);
    try {
      // A dedicated rollback-mode database holds the OS lock for this lifetime.
      // Never unlink this file: the lock must keep the same inode across owners.
      owner.exec('PRAGMA busy_timeout = 0; PRAGMA journal_mode = DELETE; BEGIN EXCLUSIVE;');
    } catch (error) {
      const sqliteCode = (error as { errcode?: number }).errcode;
      if (sqliteCode !== undefined && [5, 6].includes(sqliteCode & 255)) {
        throw new StorageError('DATA_DIR_IN_USE', 'Another Workbench process owns this data directory.', { cause: error });
      }
      throw error;
    }
    for (const dir of [paths.repositories, paths.tasks, paths.worktrees, paths.logs]) directory(dir);
    databaseFile(paths.database);
    db = new DatabaseSync(paths.database);
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 1000; PRAGMA synchronous = FULL;');
    const schemaVersion = migrate(db);
    interruptRepositoryOperations(db);
    const journalMode = db.prepare('PRAGMA journal_mode = WAL').get()!.journal_mode;
    if (journalMode !== 'wal') throw new StorageError('UNSUPPORTED_STORAGE', 'The data directory must support SQLite WAL mode.');
    const connection = db;
    const ownership = owner;
    let closed = false;
    const ensureOpen = () => {
      if (closed) throw new StorageError('STORAGE_CLOSED', 'The storage connection is closed.');
    };
    return {
      paths,
      settings: createSettingsRepository(connection, ensureOpen),
      repositories: createRepositoryStore(connection, ensureOpen),
      status() {
        if (closed) throw new StorageError('STORAGE_CLOSED', 'The storage connection is closed.');
        return { status: 'ready', schemaVersion,
          sqliteVersion: String(connection.prepare('SELECT sqlite_version() AS version').get()!.version),
          foreignKeys: connection.prepare('PRAGMA foreign_keys').get()!.foreign_keys === 1,
          journalMode: String(connection.prepare('PRAGMA journal_mode').get()!.journal_mode) };
      },
      close() {
        if (closed) return;
        connection.close();
        ownership.close();
        closed = true;
      }
    };
  } catch (error) {
    try { db?.close(); } finally { owner?.close(); }
    if (error instanceof StorageError) throw error;
    throw new StorageError('STORAGE_INIT_FAILED', 'Cannot initialize local storage. Check the data directory and filesystem permissions.', { cause: error });
  }
}
