import { DomainError, type GitWorktreeFailure, type StageRun, type TaskWorktree } from '@aew/core';
import { GitClient, GitError, WorktreeGit, worktreePlan } from '@aew/git';
import type { Storage } from '@aew/storage';

function failure(error: unknown, phase: GitWorktreeFailure['phase']): GitWorktreeFailure {
  return { ...(error instanceof GitError ? error.failure : {
    code: error instanceof DomainError ? error.code : 'WORKTREE_STORAGE_FAILED',
    message: error instanceof DomainError ? error.message : 'Cannot complete the worktree operation. Check storage and retry after recovery.',
    exitCode: null, signal: null, stderr: '' }), phase };
}
export class WorktreeService {
  private readonly jobs = new Set<Promise<void>>();
  private readonly lifecycle: WorktreeGit;
  private stopping = false;
  constructor(private readonly storage: Storage, private readonly git: GitClient) { this.lifecycle = new WorktreeGit(git, storage.paths.worktrees); }

  setBaseRef(workspaceId: string, taskId: string, repositoryId: string, value: unknown) {
    return this.storage.tasks.worktrees.setBaseRef(workspaceId, taskId, repositoryId, value);
  }
  start(workspaceId: string, taskId: string, cleanupRepositoryId?: string): StageRun {
    if (this.stopping) throw new DomainError('CONFLICT', 'The daemon is shutting down.');
    const records = cleanupRepositoryId ? [this.storage.tasks.worktrees.get(workspaceId, taskId, cleanupRepositoryId)] : this.storage.tasks.worktrees.list(workspaceId, taskId);
    for (const record of records) this.git.assertAvailable(record.commonGitDir ?? this.storage.repositories.get(workspaceId, record.repositoryId).commonGitDir!);
    const run = this.storage.tasks.createRun(workspaceId, taskId, { stage: 'context_preparation', modelProfileId: null,
      promptVersion: cleanupRepositoryId ? 'worktree-cleanup-v1' : 'worktree-preparation-v1', schemaVersion: 'worktree-v1' });
    this.storage.tasks.transitionRun(workspaceId, taskId, run.id, 'running');
    const job = this.execute(run, records, cleanupRepositoryId ? 'remove' : 'prepare').catch(() => {
      console.error('Worktree finalization failed; recorded state will be reconciled on restart.');
    });
    this.jobs.add(job); void job.finally(() => this.jobs.delete(job));
    return this.storage.tasks.getRun(workspaceId, taskId, run.id);
  }
  private async execute(run: StageRun, records: TaskWorktree[], kind: 'prepare' | 'remove') {
    const workspaceId = run.inputSnapshot.task.workspaceId;
    try {
      for (const previous of records) {
        const record = this.storage.tasks.worktrees.begin(workspaceId, run.taskId, previous.repositoryId, kind, run.id);
        let phase: GitWorktreeFailure['phase'] = 'preflight';
        try {
          await this.git.exclusive(record.commonGitDir!, async () => {
            await this.lifecycle.source(record);
            if (kind === 'remove') {
              phase = 'remove'; const plan = worktreePlan(record);
              if (!(await this.lifecycle.absent(plan))) await this.lifecycle.remove(plan);
              else await this.lifecycle.pin(plan, false);
              this.storage.tasks.worktrees.finish(record, 'removed');
              return;
            }
            let pinned = record;
            if (!record.resolvedCommitSha) {
              const metadata = await this.git.inspect(record.sourcePath!, record.baseRef);
              if (!metadata.resolvedCommitSha) throw new DomainError('INVALID_INPUT', 'The selected base ref has no commit. Choose a valid ref or add a commit before retrying.');
              pinned = this.storage.tasks.worktrees.pin(record, metadata.resolvedCommitSha, metadata.baseRef);
            }
            const plan = worktreePlan(pinned);
            phase = 'pin'; await this.lifecycle.pin(plan, true);
            phase = 'create';
            if (await this.lifecycle.absent(plan)) await this.lifecycle.create(plan);
            phase = 'verify'; await this.lifecycle.durable(plan);
            this.storage.tasks.worktrees.finish(pinned, 'ready');
          });
        } catch (error) {
          const normalized = failure(error, phase);
          this.storage.tasks.worktrees.finish(record, 'failed', normalized);
          throw new GitError(normalized);
        }
      }
      this.storage.tasks.transitionRun(workspaceId, run.taskId, run.id, 'succeeded');
    } catch (error) {
      this.storage.tasks.transitionRun(workspaceId, run.taskId, run.id, 'failed', failure(error, 'verify'));
    }
  }
  /** Read-only Git reconciliation. Never automatically create, remove or prune on restart. */
  recover() {
    const job = this.reconcile(); this.jobs.add(job);
    void job.finally(() => this.jobs.delete(job)).catch(() => {});
    return job;
  }
  private async reconcile() {
    for (const record of this.storage.tasks.worktrees.recorded()) {
      if (this.stopping) break;
      if (record.status === 'removed') continue;
      try {
        await this.git.exclusive(record.commonGitDir!, async () => {
          const plan = worktreePlan(record);
          if (record.operationKind === 'remove' && await this.lifecycle.absent(plan)) {
            await this.lifecycle.pin(plan, false); this.storage.tasks.worktrees.finish(record, 'removed');
          } else {
            await this.lifecycle.verify(plan);
            if (record.status !== 'ready') this.storage.tasks.worktrees.finish(record, 'ready');
          }
        });
      } catch (error) { this.storage.tasks.worktrees.finish(record, 'failed', failure(error, 'recovery')); }
    }
  }
  async close() { this.stopping = true; this.git.stop(); await Promise.all(this.jobs); }
}
