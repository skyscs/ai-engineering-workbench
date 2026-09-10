import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { DomainError, type GitWorktreeFailure, type TaskWorktree } from '@aew/core';
import { transaction } from './tasks.js';

export function createWorktreeStore(db: DatabaseSync, root: string, task: (workspaceId: string, taskId: string) => unknown,
  editable: (workspaceId: string, taskId: string) => void) {
  function list(workspaceId: string, taskId: string): TaskWorktree[] {
    task(workspaceId, taskId);
    return db.prepare(`SELECT tr.task_id AS taskId, tr.repository_id AS repositoryId, tr.workspace_id AS workspaceId,
      r.name AS repositoryName, tr.base_ref AS baseRef, wt.pinned_sha AS resolvedCommitSha, wt.worktree_path AS worktreePath,
      wt.managed_pin_ref AS managedPinRef, wt.source_path AS sourcePath, wt.common_git_dir AS commonGitDir,
      coalesce(wt.status, 'pending') AS status, wt.operation_id AS operationId, wt.operation_kind AS operationKind,
      wt.error_json, wt.updated_at AS updatedAt
      FROM task_repositories tr JOIN repositories r ON r.id = tr.repository_id LEFT JOIN task_worktrees wt ON wt.task_id = tr.task_id AND wt.repository_id = tr.repository_id
      WHERE tr.task_id = ? ORDER BY tr.repository_id`).all(taskId).map(({ error_json, ...row }) => ({ ...row,
        error: error_json ? JSON.parse(String(error_json)) : null }) as TaskWorktree);
  }
  function get(workspaceId: string, taskId: string, repositoryId: string) {
    const row = list(workspaceId, taskId).find((r) => r.repositoryId === repositoryId);
    if (!row) throw new DomainError('NOT_FOUND', 'Repository not selected by this task.');
    return row;
  }
  function refresh(taskId: string) {
    const missing = db.prepare(`SELECT tr.repository_id FROM task_repositories tr LEFT JOIN task_worktrees wt
      ON wt.task_id = tr.task_id AND wt.repository_id = tr.repository_id WHERE tr.task_id = ? AND (wt.status IS NULL OR wt.status != 'ready') LIMIT 1`).get(taskId);
    db.prepare('UPDATE tasks SET context_ready = ?, updated_at = ? WHERE id = ?').run(missing ? 0 : 1, new Date().toISOString(), taskId);
  }
  return {
    list, get,
    setBaseRef(workspaceId: string, taskId: string, repositoryId: string, value: unknown) {
      editable(workspaceId, taskId);
      const previous = get(workspaceId, taskId, repositoryId);
      if (previous.operationId && (previous.resolvedCommitSha || previous.status !== 'failed')) throw new DomainError('CONFLICT', 'Base refs are fixed once a revision is recorded. Create another task for a different revision.');
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => key !== 'baseRef')) throw new DomainError('INVALID_INPUT', 'Provide only baseRef.');
      const ref = (value as { baseRef?: unknown }).baseRef;
      if (typeof ref !== 'string' || ref.length > 256 || !/^[^-\s][^\s\u0000-\u001f\u007f]*$/.test(ref)) throw new DomainError('INVALID_INPUT', 'Provide a branch, tag, full ref or commit SHA.');
      transaction(db, () => {
        db.prepare('UPDATE task_repositories SET base_ref = ?, resolved_commit_sha = NULL WHERE task_id = ? AND repository_id = ?').run(ref, taskId, repositoryId);
        db.prepare('UPDATE tasks SET context_revision = context_revision + 1, context_ready = 0, updated_at = ? WHERE id = ?').run(new Date().toISOString(), taskId);
      });
      return get(workspaceId, taskId, repositoryId);
    },
    begin(workspaceId: string, taskId: string, repositoryId: string, kind: 'prepare' | 'remove', runId: string) {
      task(workspaceId, taskId);
      if (!db.prepare("SELECT id FROM stage_runs WHERE id = ? AND task_id = ? AND stage = 'context_preparation' AND status = 'running'").get(runId, taskId)) {
        throw new DomainError('CONFLICT', 'A running context preparation stage must own this worktree operation.');
      }
      const previous = get(workspaceId, taskId, repositoryId);
      const now = new Date().toISOString();
      return transaction(db, () => {
        if (['preparing', 'removing'].includes(previous.status)) throw new DomainError('CONFLICT', 'This worktree already has an active operation.');
        if (previous.operationId) {
          db.prepare('UPDATE task_worktrees SET status = ?, operation_id = ?, operation_kind = ?, error_json = NULL, updated_at = ? WHERE task_id = ? AND repository_id = ?')
            .run(kind === 'prepare' ? 'preparing' : 'removing', randomUUID(), kind, now, taskId, repositoryId);
        } else {
          if (kind === 'remove') throw new DomainError('CONFLICT', 'No owned worktree exists for cleanup.');
          const repo = db.prepare("SELECT local_path, common_git_dir FROM repositories WHERE id = ? AND status = 'ready'").get(repositoryId);
          if (!repo) throw new DomainError('CONFLICT', 'The repository is not ready.');
          db.prepare(`INSERT INTO task_worktrees (task_id, repository_id, worktree_path, source_path, common_git_dir, managed_pin_ref, status, operation_id, operation_kind, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'preparing', ?, 'prepare', ?)`).run(taskId, repositoryId, path.join(root, taskId, repositoryId), repo.local_path!, repo.common_git_dir!,
              `refs/aew/tasks/${taskId}/${repositoryId}`, randomUUID(), now);
        }
        refresh(taskId); return get(workspaceId, taskId, repositoryId);
      });
    },
    pin(record: TaskWorktree, sha: string, detectedBaseRef: string | null = null) {
      if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sha)) throw new DomainError('INVALID_INPUT', 'Expected a full commit SHA.');
      transaction(db, () => {
        const changed = db.prepare('UPDATE task_worktrees SET pinned_sha = ? WHERE task_id = ? AND repository_id = ? AND operation_id = ?').run(sha, record.taskId, record.repositoryId, record.operationId);
        if (changed.changes !== 1) throw new DomainError('CONFLICT', 'The worktree operation is no longer current.');
        db.prepare('UPDATE task_repositories SET resolved_commit_sha = ?, base_ref = coalesce(base_ref, ?) WHERE task_id = ? AND repository_id = ?').run(sha, detectedBaseRef, record.taskId, record.repositoryId);
      });
      return get(record.workspaceId, record.taskId, record.repositoryId);
    },
    finish(record: TaskWorktree, status: 'ready' | 'removed' | 'failed', error: GitWorktreeFailure | null = null) {
      transaction(db, () => {
        const changed = db.prepare('UPDATE task_worktrees SET status = ?, error_json = ?, updated_at = ? WHERE task_id = ? AND repository_id = ? AND operation_id = ?')
          .run(status, error ? JSON.stringify(error) : null, new Date().toISOString(), record.taskId, record.repositoryId, record.operationId);
        if (changed.changes !== 1) throw new DomainError('CONFLICT', 'The worktree operation is no longer current.');
        refresh(record.taskId);
      });
    },
    recorded(): TaskWorktree[] {
      return db.prepare('SELECT DISTINCT tr.workspace_id, tr.task_id FROM task_repositories tr JOIN task_worktrees wt ON wt.task_id = tr.task_id').all()
        .flatMap((r) => list(String(r.workspace_id), String(r.task_id))).filter((r) => r.operationId !== null);
    }
  };
}
