import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, realpath, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { DomainError, parseRepositoryInput, type GitFailure, type Repository, type SyncFailure } from '@aew/core';
import { cloneSource, GitClient, GitError } from '@aew/git';
import type { Storage } from '@aew/storage';

export class RepositoryService {
  private readonly jobs = new Set<Promise<void>>();
  private stopping = false;
  private cloneActive = false;
  constructor(private readonly storage: Storage, private readonly git = new GitClient()) {}

  list(workspaceId: string) { return this.storage.repositories.list(workspaceId); }
  get(workspaceId: string, id: string) { return this.storage.repositories.get(workspaceId, id); }

  async register(workspaceId: string, value: unknown): Promise<Repository> {
    const input = parseRepositoryInput(value);
    this.storage.settings.getWorkspace(workspaceId);
    if (this.stopping) throw new DomainError('CONFLICT', 'The daemon is shutting down.');
    const metadata = await this.git.inspect(input.source, input.baseRef);
    return this.storage.repositories.register(workspaceId, input.name, metadata);
  }

  async startClone(workspaceId: string, value: unknown): Promise<Repository> {
    const input = parseRepositoryInput(value);
    this.storage.settings.getWorkspace(workspaceId);
    const source = await cloneSource(input.source);
    if (this.stopping || this.cloneActive) throw new DomainError('CONFLICT', 'Another clone is active or the daemon is shutting down. Wait before starting another clone.');
    const id = randomUUID();
    const container = path.join(this.storage.paths.repositories, id);
    const destination = path.join(container, 'checkout');
    const record = this.storage.repositories.beginClone(workspaceId, id, input.name, source, destination, input.baseRef);
    this.cloneActive = true;
    const job = this.clone(record, source, container).catch(() => {
      // Do not dump process output or credentials if persisting a failure also fails.
      console.error('Clone finalization failed; the recorded operation will be reconciled on restart.');
    });
    this.jobs.add(job);
    void job.finally(() => { this.jobs.delete(job); this.cloneActive = false; });
    return record;
  }

  startSync(workspaceId: string, id: string): Repository {
    if (this.stopping) throw new DomainError('CONFLICT', 'The daemon is shutting down.');
    this.git.assertAvailable(this.get(workspaceId, id).commonGitDir ?? '');
    const record = this.storage.repositories.beginSync(workspaceId, id);
    const job = this.git.exclusive(record.commonGitDir!, () => this.sync(record)).catch(() => {
      console.error('Synchronization finalization failed; the recorded operation will be reconciled on restart.');
    });
    this.jobs.add(job);
    void job.finally(() => this.jobs.delete(job));
    return record;
  }

  private async sync(record: Repository): Promise<void> {
    let phase: SyncFailure['phase'] = 'preflight';
    let fetchedAt: string | undefined;
    try {
      const expected = { localPath: record.localPath, commonGitDir: record.commonGitDir! };
      const remotes = await this.git.prepareFetch(expected);
      if (remotes.length) {
        phase = 'fetch';
        await this.git.fetchAll(expected, remotes);
        fetchedAt = new Date().toISOString();
      }
      phase = 'metadata';
      const metadata = await this.git.inspect(record.localPath, record.baseRef, true);
      this.storage.repositories.finishSync(record.workspaceId, record.id, { status: remotes.length ? 'succeeded' : 'no_remote',
        metadata, ...(fetchedAt ? { fetchedAt } : {}) });
    } catch (error) {
      const failure: SyncFailure = { ...(error instanceof GitError ? error.failure : {
        code: error instanceof DomainError ? error.code : 'SYNC_STORAGE_FAILED',
        message: error instanceof DomainError ? error.message : 'Cannot save synchronization metadata. Check local storage.',
        exitCode: null, signal: null, stderr: '' }), phase, command: 'git fetch --all --prune' };
      this.storage.repositories.finishSync(record.workspaceId, record.id, { status: 'failed', error: failure, ...(fetchedAt ? { fetchedAt } : {}) });
    }
  }

  private async clone(record: Repository, source: string, container: string): Promise<void> {
    const stage = path.join(container, 'staging');
    let ownedInode: { ino: number; dev: number } | null = null;
    try {
      if (await realpath(this.storage.paths.repositories) !== this.storage.paths.repositories) throw new Error('Redirected managed root.');
      await mkdir(container, { mode: 0o700 });
      ownedInode = await lstat(container);
      await this.git.clone(source, stage, container);
      // Validate the requested ref before publishing or renaming the clone.
      await this.git.inspect(stage, record.baseRef);
      await rename(stage, record.localPath);
      const metadata = await this.git.inspect(record.localPath, record.baseRef);
      // Git hardens objects/refs; also persist its config and the directory rename on Linux.
      for (const file of [path.join(record.localPath, '.git/config'), path.join(record.localPath, '.git'),
        record.localPath, container, this.storage.paths.repositories]) {
        const handle = await open(file, 'r');
        try { await handle.sync(); } finally { await handle.close(); }
      }
      this.storage.repositories.completeClone(record.workspaceId, record.id, metadata);
    } catch (error) {
      let retainedFiles = true;
      if (ownedInode) {
        try {
          const current = await lstat(container);
          if (current.isDirectory() && current.ino === ownedInode.ino && current.dev === ownedInode.dev && await realpath(container) === container) {
            await rm(container, { recursive: true });
            retainedFiles = false;
          }
        } catch { /* Preserve the operation record when cleanup cannot be confirmed. */ }
      }
      const failure: GitFailure = error instanceof GitError ? error.failure : {
        code: error instanceof DomainError ? error.code : 'CLONE_STORAGE_FAILED',
        message: error instanceof DomainError ? error.message : 'Cannot finalize the managed clone. Check free space and data-directory permissions.',
        exitCode: null, signal: null, stderr: ''
      };
      this.storage.repositories.failClone(record.workspaceId, record.id, failure, retainedFiles);
    }
  }

  async close(): Promise<void> {
    this.stopping = true;
    this.git.stop();
    await Promise.all(this.jobs);
  }
}
