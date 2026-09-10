import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { DomainError, type GitFailure, type Repository, type RepositoryMetadata } from '@aew/core';

export interface RepositoryStore {
  list(workspaceId: string): Repository[];
  get(workspaceId: string, id: string): Repository;
  register(workspaceId: string, name: string, metadata: RepositoryMetadata): Repository;
  beginClone(workspaceId: string, id: string, name: string, source: string, localPath: string, baseRef: string | null): Repository;
  completeClone(workspaceId: string, id: string, metadata: RepositoryMetadata): Repository;
  failClone(workspaceId: string, id: string, error: GitFailure, retainedFiles: boolean): void;
}
const columns = `id, workspace_id AS workspaceId, name, local_path AS localPath,
  common_git_dir AS commonGitDir, remote_url AS remoteUrl, default_branch AS defaultBranch,
  base_ref AS baseRef, resolved_commit_sha AS resolvedCommitSha, shallow, managed_clone AS managedClone,
  status, error_json AS errorJson, retained_files AS retainedFiles, created_at AS createdAt, updated_at AS updatedAt`;
function decode(row: Record<string, unknown>): Repository {
  const { errorJson, ...value } = row;
  return { ...value, managedClone: row.managedClone === 1, shallow: row.shallow === 1,
    retainedFiles: row.retainedFiles === 1, error: errorJson ? JSON.parse(String(errorJson)) as GitFailure : null } as Repository;
}

export function createRepositoryStore(db: DatabaseSync, ensureOpen: () => void): RepositoryStore {
  function workspace(id: string) {
    ensureOpen();
    if (!db.prepare('SELECT id FROM workspaces WHERE id = ?').get(id)) throw new DomainError('NOT_FOUND', 'Workspace not found.');
  }
  function get(workspaceId: string, id: string): Repository {
    workspace(workspaceId);
    const row = db.prepare(`SELECT ${columns} FROM repositories WHERE workspace_id = ? AND id = ?`).get(workspaceId, id);
    if (!row) throw new DomainError('NOT_FOUND', 'Repository not found in this workspace.');
    return decode(row);
  }
  function insert(run: () => void): void {
    try { run(); } catch (error) {
      if ((error as { errcode?: number }).errcode === 2067) throw new DomainError('CONFLICT', 'This repository path or clone source is already registered in the workspace.');
      throw error;
    }
  }
  return {
    list(workspaceId) {
      workspace(workspaceId);
      return db.prepare(`SELECT ${columns} FROM repositories WHERE workspace_id = ? ORDER BY created_at, id`).all(workspaceId).map(decode);
    },
    get,
    register(workspaceId, name, info) {
      workspace(workspaceId);
      const id = randomUUID(), now = new Date().toISOString();
      insert(() => { db.prepare(`INSERT INTO repositories (id, workspace_id, name, source, local_path, common_git_dir,
        remote_url, default_branch, base_ref, resolved_commit_sha, shallow, managed_clone, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'ready', ?, ?)`).run(id, workspaceId, name, info.localPath, info.localPath,
        info.commonGitDir, info.remoteUrl, info.defaultBranch, info.baseRef, info.resolvedCommitSha, Number(info.shallow), now, now); });
      return get(workspaceId, id);
    },
    beginClone(workspaceId, id, name, source, localPath, baseRef) {
      workspace(workspaceId);
      const now = new Date().toISOString();
      insert(() => { db.prepare(`INSERT INTO repositories (id, workspace_id, name, source, local_path, remote_url, base_ref,
        managed_clone, status, retained_files, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'cloning', 1, ?, ?)`)
        .run(id, workspaceId, name, source, localPath, source, baseRef, now, now); });
      return get(workspaceId, id);
    },
    completeClone(workspaceId, id, info) {
      const previous = get(workspaceId, id);
      if (previous.status !== 'cloning' || previous.localPath !== info.localPath) throw new DomainError('CONFLICT', 'The clone cannot be finalized in its current state.');
      db.prepare(`UPDATE repositories SET common_git_dir = ?, remote_url = ?, default_branch = ?, base_ref = ?,
        resolved_commit_sha = ?, shallow = ?, status = 'ready', retained_files = 0, updated_at = ? WHERE workspace_id = ? AND id = ?`)
        .run(info.commonGitDir, info.remoteUrl, info.defaultBranch, info.baseRef, info.resolvedCommitSha, Number(info.shallow), new Date().toISOString(), workspaceId, id);
      return get(workspaceId, id);
    },
    failClone(workspaceId, id, error, retainedFiles) {
      get(workspaceId, id);
      db.prepare(`UPDATE repositories SET status = 'failed', error_json = ?, retained_files = ?, updated_at = ?
        WHERE workspace_id = ? AND id = ? AND status = 'cloning'`)
        .run(JSON.stringify(error), Number(retainedFiles), new Date().toISOString(), workspaceId, id);
    }
  };
}

/** A previous process may still own Git children after a hard crash; never remove its files on startup. */
export function interruptClones(db: DatabaseSync): void {
  const failure: GitFailure = { code: 'CLONE_INTERRUPTED', message: 'The daemon stopped before this clone was finalized. Files were retained for inspection; retry explicitly with a new clone.',
    exitCode: null, signal: null, stderr: '' };
  db.prepare(`UPDATE repositories SET status = 'failed', error_json = ?, retained_files = 1, updated_at = ? WHERE status = 'cloning'`)
    .run(JSON.stringify(failure), new Date().toISOString());
}
