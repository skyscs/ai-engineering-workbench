export const worktreeSchema = `
  ALTER TABLE tasks ADD COLUMN context_ready INTEGER NOT NULL DEFAULT 0 CHECK(context_ready IN (0, 1));
  CREATE TABLE task_worktrees (
    task_id TEXT NOT NULL, repository_id TEXT NOT NULL,
    worktree_path TEXT NOT NULL UNIQUE, source_path TEXT NOT NULL, common_git_dir TEXT NOT NULL,
    managed_pin_ref TEXT NOT NULL, pinned_sha TEXT,
    status TEXT NOT NULL CHECK(status IN ('preparing', 'ready', 'failed', 'removing', 'removed')),
    operation_id TEXT NOT NULL, operation_kind TEXT NOT NULL CHECK(operation_kind IN ('prepare', 'remove')),
    error_json TEXT, updated_at TEXT NOT NULL,
    PRIMARY KEY(task_id, repository_id),
    FOREIGN KEY(task_id, repository_id) REFERENCES task_repositories(task_id, repository_id) ON DELETE RESTRICT
  ) STRICT;
  CREATE TRIGGER worktree_identity_immutable BEFORE UPDATE OF task_id, repository_id, worktree_path, source_path, common_git_dir, managed_pin_ref ON task_worktrees
    BEGIN SELECT RAISE(ABORT, 'worktree_identity_immutable'); END;
  CREATE TRIGGER worktree_pin_immutable BEFORE UPDATE OF pinned_sha ON task_worktrees
    WHEN OLD.pinned_sha IS NOT NULL AND NEW.pinned_sha IS NOT OLD.pinned_sha
    BEGIN SELECT RAISE(ABORT, 'worktree_pin_immutable'); END;
`;
