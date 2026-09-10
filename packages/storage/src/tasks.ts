import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { DomainError, parseTask, type ArtifactLimits, type RunFailure, type StageRun, type Task } from '@aew/core';
import type { SettingsRepository } from './settings.js';
import { createArtifactStore } from './artifacts.js';

export function transaction<T>(db: DatabaseSync, run: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try { const value = run(); db.exec('COMMIT'); return value; }
  catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
}
export type TaskStore = ReturnType<typeof createTaskStore>;
export function createTaskStore(db: DatabaseSync, ensureOpen: () => void, settings: SettingsRepository, root: string, limits: ArtifactLimits) {
  function get(workspaceId: string, id: string): Task {
    ensureOpen(); settings.getWorkspace(workspaceId);
    const row = db.prepare(`SELECT id, workspace_id AS workspaceId, title, description, status,
      context_revision AS contextRevision, created_at AS createdAt, updated_at AS updatedAt
      FROM tasks WHERE id = ? AND workspace_id = ?`).get(id, workspaceId);
    if (!row) throw new DomainError('NOT_FOUND', 'Task not found in this workspace.');
    const repositoryIds = db.prepare('SELECT repository_id FROM task_repositories WHERE task_id = ? ORDER BY repository_id').all(id).map((r) => String(r.repository_id));
    return { ...row, repositoryIds } as unknown as Task;
  }
  function editable(workspaceId: string, id: string) {
    get(workspaceId, id);
    if (db.prepare("SELECT id FROM stage_runs WHERE task_id = ? AND status IN ('queued', 'running')").get(id)) {
      throw new DomainError('CONFLICT', 'Wait for the active stage run to finish or cancel it before editing context.');
    }
    if (db.prepare("SELECT id FROM artifact_imports WHERE task_id = ? AND state IN ('uploading', 'prepared')").get(id)) {
      throw new DomainError('CONFLICT', 'An artifact import is pending. Finish it or restart the daemon to recover it.');
    }
  }
  function bump(id: string) {
    db.prepare('UPDATE tasks SET context_revision = context_revision + 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  }
  const artifacts = createArtifactStore(db, root, limits, { get, editable, bump });
  function run(workspaceId: string, taskId: string, id: string): StageRun {
    get(workspaceId, taskId);
    const row = db.prepare(`SELECT id, task_id AS taskId, ai_connection_id AS aiConnectionId,
      model_profile_id AS modelProfileId, stage, status, input_snapshot, error_json,
      created_at AS createdAt, started_at AS startedAt, completed_at AS completedAt FROM stage_runs WHERE id = ? AND task_id = ?`).get(id, taskId);
    if (!row) throw new DomainError('NOT_FOUND', 'Stage run not found in this task.');
    const { input_snapshot, error_json, ...fields } = row;
    return { ...fields, inputSnapshot: JSON.parse(String(input_snapshot)), error: error_json ? JSON.parse(String(error_json)) : null } as StageRun;
  }
  return {
    artifacts,
    get,
    list(workspaceId: string) {
      settings.getWorkspace(workspaceId);
      return db.prepare('SELECT id FROM tasks WHERE workspace_id = ? ORDER BY created_at, id').all(workspaceId).map((r) => get(workspaceId, String(r.id)));
    },
    create(workspaceId: string, value: unknown): Task {
      const input = parseTask(value);
      if (Buffer.byteLength(input.description) > limits.contextBytes) throw new DomainError('INVALID_INPUT', 'The description exceeds the text context limit.');
      return transaction(db, () => {
        settings.lockWorkspaceBoundary(workspaceId);
        const id = randomUUID(), now = new Date().toISOString();
        db.prepare('INSERT INTO tasks (id, workspace_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(id, workspaceId, input.title, input.description, now, now);
        for (const repositoryId of input.repositoryIds) {
          const repository = db.prepare("SELECT base_ref, resolved_commit_sha FROM repositories WHERE id = ? AND workspace_id = ? AND status = 'ready'").get(repositoryId, workspaceId);
          if (!repository) throw new DomainError('INVALID_INPUT', 'Select ready repositories belonging to this workspace.');
          db.prepare('INSERT INTO task_repositories (task_id, workspace_id, repository_id, base_ref, resolved_commit_sha) VALUES (?, ?, ?, ?, ?)')
            .run(id, workspaceId, repositoryId, repository.base_ref!, repository.resolved_commit_sha!);
        }
        return get(workspaceId, id);
      });
    },
    detail(workspaceId: string, id: string) {
      return { task: get(workspaceId, id), artifacts: artifacts.list(workspaceId, id), context: artifacts.context(workspaceId, id), limits,
        imports: db.prepare("SELECT id, original_filename AS originalFilename, state, error_code AS errorCode FROM artifact_imports WHERE task_id = ? AND state != 'ready' ORDER BY created_at, id").all(id) };
    },
    getRun: run,
    createRun(workspaceId: string, taskId: string, input: { stage: StageRun['stage']; modelProfileId: string | null; promptVersion: string; schemaVersion: string }): StageRun {
      editable(workspaceId, taskId);
      const context = artifacts.context(workspaceId, taskId);
      // File verification finishes before the short metadata transaction.
      artifacts.verifyContext(workspaceId, taskId, context);
      return transaction(db, () => {
        editable(workspaceId, taskId);
        if (!['context_preparation', 'investigation'].includes(input.stage) || [input.promptVersion, input.schemaVersion].some((v) => !/^[A-Za-z0-9._-]{1,128}$/.test(v))) {
          throw new DomainError('INVALID_INPUT', 'Choose a supported stage and explicit prompt/schema versions.');
        }
        if (input.stage === 'investigation' && db.prepare("SELECT id FROM stage_runs WHERE stage = 'investigation' AND status IN ('queued', 'running')").get()) {
          throw new DomainError('CONFLICT', 'Another investigation is active.');
        }
        const task = get(workspaceId, taskId), owner = settings.getWorkspace(workspaceId);
        const profile = input.modelProfileId === null ? null : settings.getModelProfile(workspaceId, input.modelProfileId);
        const snapshot = { task, connection: owner.connection, profile, context, constraints: [],
          repositories: db.prepare('SELECT repository_id AS id, base_ref AS baseRef, resolved_commit_sha AS resolvedCommitSha FROM task_repositories WHERE task_id = ? ORDER BY repository_id').all(taskId),
          promptVersion: input.promptVersion, schemaVersion: input.schemaVersion };
        const id = randomUUID(), now = new Date().toISOString();
        db.prepare(`INSERT INTO stage_runs (id, task_id, ai_connection_id, model_profile_id, stage, status, input_snapshot, created_at)
          VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)`).run(id, taskId, owner.connection.id, input.modelProfileId, input.stage, JSON.stringify(snapshot), now);
        return run(workspaceId, taskId, id);
      });
    },
    transitionRun(workspaceId: string, taskId: string, id: string, status: Exclude<StageRun['status'], 'queued'>, error: RunFailure | null = null): StageRun {
      return transaction(db, () => {
        const previous = run(workspaceId, taskId, id);
        if (['succeeded', 'failed', 'cancelled'].includes(previous.status)) return previous;
        if (!['running', 'succeeded', 'failed', 'cancelled'].includes(status) ||
          (status === 'running' && previous.status !== 'queued') || (status === 'succeeded' && previous.status !== 'running') ||
          (status === 'failed' && (!error || !/^[A-Z0-9_]{1,128}$/.test(error.code) || !error.message || error.message.length > 2048 ||
            typeof error.stderr !== 'string' || error.stderr.length > 32768 ||
            (error.exitCode !== null && !Number.isSafeInteger(error.exitCode)) ||
            (error.signal !== null && !/^SIG[A-Z0-9]{1,32}$/.test(error.signal)))) || (status !== 'failed' && error !== null)) {
          throw new DomainError('INVALID_INPUT', 'Invalid stage run transition or failure.');
        }
        const now = new Date().toISOString();
        db.prepare('UPDATE stage_runs SET status = ?, started_at = ?, completed_at = ?, error_json = ? WHERE id = ?')
          .run(status, status === 'running' ? now : previous.startedAt, status === 'running' ? null : now, error ? JSON.stringify(error) : null, id);
        return run(workspaceId, taskId, id);
      });
    }
  };
}
export function interruptStageRuns(db: DatabaseSync) {
  db.prepare("UPDATE stage_runs SET status = 'failed', completed_at = ?, error_json = ? WHERE status IN ('queued', 'running')")
    .run(new Date().toISOString(), JSON.stringify({ code: 'INTERRUPTED', message: 'The daemon stopped before this run completed. Start a new run to retry.', exitCode: null, signal: null, stderr: '' }));
}
