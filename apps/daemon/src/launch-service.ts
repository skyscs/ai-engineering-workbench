import { mkdtemp, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { DomainError, activeLaunchStates, type AIConnection, type DraftInput, type Repository } from '@aew/core';
import { preflight, RuntimeError, type AIRunRequest } from '@aew/ai';
import { GitError } from '@aew/git';
import type { Storage } from '@aew/storage';
import type { RepositoryService } from './repository-service.js';
import type { WorktreeService } from './worktree-service.js';
import type { RuntimeService } from './runtime-service.js';

export async function checkSetup(connection: AIConnection, signal: AbortSignal) {
  const directory = await mkdtemp(path.join(tmpdir(), 'aew-setup-check-'));
  try {
    const root = await realpath(directory);
    return await preflight({ connection, workingDirectory: root, readRoots: [root], accessMode: 'read', signal } as AIRunRequest, process.env);
  } finally { await rm(directory, { recursive: true, force: true }); }
}
export class LaunchService {
  private active: { id: string; abort: AbortController; job: Promise<void> } | null = null;
  private stopping = false;
  constructor(readonly storage: Storage, private readonly repositories: RepositoryService, private readonly worktrees: WorktreeService,
    private readonly runtime: RuntimeService, private readonly check: (connection: AIConnection, signal: AbortSignal) => Promise<unknown> = checkSetup) {}
  start(draftId: string, requestId: string, revision: number) {
    if (this.stopping) throw new DomainError('CONFLICT', 'The application is shutting down.');
    const claim = this.storage.drafts.claim(draftId, requestId, revision);
    if (!claim.created) return claim.operation;
    const abort = new AbortController();
    const job = Promise.resolve().then(() => this.execute(draftId, requestId, abort.signal)).catch(() => {
      console.error('Launch finalization failed; restart will preserve the interrupted operation.');
    }).finally(() => { if (this.active?.id === requestId) this.active = null; });
    this.active = { id: requestId, abort, job };
    return claim.operation;
  }
  async wait(id: string) { if (this.active?.id === id) await this.active.job; }
  private async execute(draftId: string, id: string, signal: AbortSignal) {
    const { drafts, tasks, settings } = this.storage;
    const guard = () => { if (signal.aborted || drafts.operation(id).cancelRequested || this.stopping) throw new Error('cancelled'); };
    let draft = drafts.get(draftId);
    const input = draft.input, w = input.workspaceId!;
    try {
      const connection = settings.getWorkspace(w).connection;
      if (input.modelProfileId) settings.getModelProfile(w, input.modelProfileId);
      guard(); await this.check(connection, signal); guard();
      if (JSON.stringify(settings.getWorkspace(w).connection) !== JSON.stringify(connection)) throw new DomainError('CONFLICT', 'The selected setup changed during validation. Review it and retry.');
      let taskId = draft.taskId;
      if (!taskId) {
        drafts.advance(id, 'repositories', 'Resolving selected repositories');
        const repositoryIds = await this.resolveRepositories(input, guard); guard();
        if (JSON.stringify(settings.getWorkspace(w).connection) !== JSON.stringify(connection)) throw new DomainError('CONFLICT', 'The setup changed during repository preparation. Review it and retry.');
        const title = input.description.trim().split('\n')[0]!.replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 120);
        // Stable IDs make a recovered materialization discoverable without a duplicate task.
        const task = tasks.create(w, { title, description: input.description, repositoryIds }, draft.id);
        drafts.bindTask(draft.id, task.id); taskId = task.id; draft = drafts.get(draftId);
      }
      drafts.advance(id, 'preparing', 'Saving supporting text and preparing isolated code');
      const selections: { artifactId: string; start: number; end: number }[] = [];
      for (const file of draft.preserveContext ? [] : draft.files) {
        guard(); const bytes = drafts.fileBytes(draftId, file.id);
        const artifact = await tasks.artifacts.import(w, taskId, { id: file.id, name: file.name, mimeType: 'text/plain', size: bytes.length },
          new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes); controller.close(); } }));
        if (file.included) selections.push({ artifactId: artifact.id, start: 0, end: artifact.byteSize });
      }
      const select = () => {
        if (draft.preserveContext) return;
        const before = tasks.artifacts.context(w, taskId).entries.filter(entry => entry.range).map(entry => ({ artifactId: entry.id, ...entry.range! }));
        const key = (entries: typeof selections) => JSON.stringify([...entries].sort((a, b) => a.artifactId.localeCompare(b.artifactId)));
        if (key(before) !== key(selections)) tasks.artifacts.selectContext(w, taskId, selections);
      };
      guard(); select();
      drafts.preserveTaskContext(draftId); draft = drafts.get(draftId);
      if (tasks.worktrees.list(w, taskId).some(record => record.status !== 'ready')) {
        const preparation = this.worktrees.start(w, taskId);
        await this.worktrees.wait(preparation.id); guard();
        const result = tasks.getRun(w, taskId, preparation.id);
        if (result.status !== 'succeeded') throw new DomainError('CONFLICT', result.error?.message ?? 'Code preparation failed. Review the project and retry.');
      }
      guard();
      // Subsequent attempts preserve explicit context edits made through advanced controls.
      const run = this.runtime.startInvestigation(w, taskId, { modelProfileId: input.modelProfileId });
      drafts.advance(id, 'investigating', 'Investigating committed source and history', run.id);
      await this.runtime.wait(run.id);
      const result = tasks.getRun(w, taskId, run.id);
      if (result.status === 'succeeded') drafts.advance(id, 'succeeded', 'Investigation report ready');
      else if (result.status === 'cancelled') drafts.advance(id, 'cancelled', 'Investigation cancelled. Your inputs and earlier reports are preserved.');
      else drafts.advance(id, 'failed', result.error?.message ?? 'Analysis did not complete. Review details before retrying.', undefined, result.error ?? undefined);
    } catch (error) {
      if (signal.aborted || drafts.operation(id).cancelRequested || this.stopping) drafts.advance(id, 'cancelled', 'Investigation cancelled. No further model invocation will start.');
      else {
        const failure = error instanceof RuntimeError || error instanceof GitError ? error.failure : {
          code: error instanceof DomainError ? error.code : 'PREPARATION_FAILED',
          message: error instanceof DomainError ? error.message : 'Preparation could not finish. Check the source path and local storage, then retry.',
          exitCode: null, signal: null, stderr: ''
        };
        drafts.advance(id, 'failed', failure.message, undefined, failure);
      }
    }
  }
  private async resolveRepositories(input: DraftInput, guard: () => void) {
    const w = input.workspaceId!, ids = [...input.repositoryIds];
    for (const id of ids) { guard(); await this.repositories.refresh(w, id); }
    if (input.source) {
      const local = path.isAbsolute(input.source);
      const source = local ? await realpath(input.source) : input.source;
      const existing = local ? this.repositories.list(w).find(repo => repo.status !== 'failed' && repo.localPath === source) : await this.repositories.findClone(w, source);
      let repo: Repository | null | undefined = existing;
      if (!repo) {
        guard(); const name = source.replace(/\/$/, '').split(/[/:]/).at(-1)!.replace(/\.git$/, '').slice(0, 120) || 'Project';
        repo = local ? await this.repositories.register(w, { name, source, baseRef: 'HEAD' }) : await this.repositories.startClone(w, { name, source, baseRef: null });
      }
      while (repo.status === 'cloning') { await new Promise(resolve => setTimeout(resolve, 150)); repo = this.repositories.get(w, repo.id); }
      guard();
      if (repo.status !== 'ready') throw new DomainError('CONFLICT', repo.error?.message ?? 'Repository cloning failed.');
      if (!local && existing) {
        repo = this.repositories.startSync(w, repo.id);
        while (repo.syncStatus === 'running') { await new Promise(resolve => setTimeout(resolve, 150)); repo = this.repositories.get(w, repo.id); }
        guard();
        if (repo.syncStatus === 'failed') throw new DomainError('CONFLICT', repo.syncError?.message ?? 'Repository synchronization failed.');
      }
      if (local) await this.repositories.refresh(w, repo.id, 'HEAD');
      if (!ids.includes(repo.id)) ids.push(repo.id);
    }
    return ids;
  }
  cancel(id: string) {
    const op = this.storage.drafts.cancel(id);
    if (this.active?.id === id) this.active.abort.abort();
    const draft = this.storage.drafts.get(op.draftId);
    if (op.runId && draft.taskId && draft.input.workspaceId && activeLaunchStates.includes(op.state)) this.runtime.cancel(draft.input.workspaceId, draft.taskId, op.runId);
    return op;
  }
  async close() { this.stopping = true; if (this.active) this.cancel(this.active.id); await this.active?.job; }
}
