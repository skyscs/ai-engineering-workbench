import { lstat, mkdir, open, realpath, readdir } from 'node:fs/promises';
import path from 'node:path';
import { DomainError, type TaskWorktree } from '@aew/core';
import { GitClient, GitError } from './index.js';

export interface WorktreePlan {
  sourcePath: string; commonGitDir: string; worktreePath: string; managedPinRef: string; resolvedCommitSha: string;
}
const conflict = (message: string): never => { throw new DomainError('CONFLICT', message); };
async function present(file: string) {
  try { return await lstat(file); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
async function sync(file: string) { const handle = await open(file, 'r'); try { await handle.sync(); } finally { await handle.close(); } }
async function realDirectory(file: string) {
  if (!(await lstat(file)).isDirectory() || await realpath(file) !== file) conflict('A worktree storage directory was redirected. Restore the recorded path.');
}
export function worktreePlan(record: TaskWorktree): WorktreePlan {
  if (!record.sourcePath || !record.commonGitDir || !record.worktreePath || !record.managedPinRef || !record.resolvedCommitSha) conflict('This worktree has no recorded revision.');
  return { sourcePath: record.sourcePath!, commonGitDir: record.commonGitDir!, worktreePath: record.worktreePath!, managedPinRef: record.managedPinRef!, resolvedCommitSha: record.resolvedCommitSha! };
}

/** Git-aware lifecycle operations; callers serialize them by common git-dir. */
export class WorktreeGit {
  constructor(private readonly git: GitClient, private readonly root: string) {}

  async source(record: Pick<TaskWorktree, 'sourcePath' | 'commonGitDir'>) {
    if (!record.sourcePath || !record.commonGitDir) conflict('Missing repository identity.');
    const identity = await this.git.identity(record.sourcePath!);
    if (identity.localPath !== record.sourcePath || identity.commonGitDir !== record.commonGitDir) conflict('The source repository identity changed. Restore its recorded canonical path.');
  }
  async destination(destination: string, createParent = false) {
    await realDirectory(this.root);
    const relative = path.relative(this.root, destination).split(path.sep);
    if (relative.length !== 2 || relative.some((id) => !/^[a-f0-9-]{36}$/.test(id))) conflict('The worktree destination is outside its managed task directory.');
    const parent = path.dirname(destination);
    if (!(await present(parent)) && createParent) { await mkdir(parent, { mode: 0o700 }); await sync(this.root); }
    if (await present(parent)) await realDirectory(parent);
    const target = await present(destination);
    if (target) await realDirectory(destination);
    return !!target;
  }
  async registrations(source: string) {
    const output = (await this.git.run(['worktree', 'list', '--porcelain', '-z'], source)).stdout;
    return output.split('\0\0').filter(Boolean).map((entry) => {
      const fields = entry.split('\0');
      return { path: fields.find((f) => f.startsWith('worktree '))?.slice(9), head: fields.find((f) => f.startsWith('HEAD '))?.slice(5),
        detached: fields.includes('detached'), locked: fields.some((f) => f === 'locked' || f.startsWith('locked ')),
        prunable: fields.some((f) => f === 'prunable' || f.startsWith('prunable ')) };
    });
  }
  private async optional(args: string[], source: string) {
    try { return (await this.git.run(args, source)).stdout.trim(); }
    catch (error) { if (error instanceof GitError && error.failure.exitCode === 1 && error.failure.code === 'GIT_FAILED' && !error.failure.stderr) return null; throw error; }
  }
  async pin(plan: WorktreePlan, create: boolean) {
    await this.source(plan);
    const expectedPin = `refs/aew/tasks/${path.relative(this.root, plan.worktreePath).split(path.sep).join('/')}`;
    if (plan.managedPinRef !== expectedPin) conflict('The revision pin does not belong to this worktree destination.');
    if (!/^refs\/aew\/tasks\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(plan.managedPinRef) || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(plan.resolvedCommitSha)) conflict('Invalid managed revision pin.');
    if (await this.optional(['symbolic-ref', '--quiet', plan.managedPinRef], plan.sourcePath)) conflict('A managed pin must not be a symbolic ref.');
    const existing = await this.optional(['rev-parse', '--verify', '--quiet', '--end-of-options', plan.managedPinRef], plan.sourcePath);
    if (existing === plan.resolvedCommitSha) return;
    if (existing || !create) conflict('The managed revision pin is missing or has changed. Restore the original pin before retrying.');
    await this.git.run(['-c', 'core.fsync=all', '-c', 'core.fsyncMethod=fsync', 'update-ref', '--no-deref', plan.managedPinRef, plan.resolvedCommitSha, '0'.repeat(plan.resolvedCommitSha.length)], plan.sourcePath);
  }
  async absent(plan: WorktreePlan) {
    await this.source(plan);
    const exists = await this.destination(plan.worktreePath);
    const registered = (await this.registrations(plan.sourcePath)).some((entry) => entry.path === plan.worktreePath);
    return !exists && !registered;
  }
  async verify(plan: WorktreePlan) {
    await this.source(plan);
    if (!(await this.destination(plan.worktreePath))) conflict('The recorded worktree directory is missing.');
    const entry = (await this.registrations(plan.sourcePath)).find((entry) => entry.path === plan.worktreePath);
    if (!entry || !entry.detached || entry.head !== plan.resolvedCommitSha || entry.locked || entry.prunable) conflict('Worktree registration, detached revision or lock state does not match the recorded operation.');
    const marker = await lstat(path.join(plan.worktreePath, '.git'));
    if (!marker.isFile() || marker.nlink !== 1) conflict('The owned worktree must have a regular Git marker file.');
    const identity = await this.git.identity(plan.worktreePath);
    if (identity.localPath !== plan.worktreePath || identity.commonGitDir !== plan.commonGitDir) conflict('The worktree belongs to a different repository.');
    const admin = (await this.git.run(['rev-parse', '--absolute-git-dir'], plan.worktreePath)).stdout.trim();
    if (path.dirname(admin) !== path.join(plan.commonGitDir, 'worktrees') || await realpath(admin) !== admin) conflict('Unexpected worktree administrative directory.');
    for (const lock of ['index.lock', 'HEAD.lock', 'locked']) if (await present(path.join(admin, lock))) conflict('Git still has a worktree lock. Wait for the owning process or repair the interrupted operation.');
    await this.pin(plan, false);
    // Include ignored files and hidden index flags: Git remove alone can discard ignored content.
    const flags = (await this.git.run(['ls-files', '-v', '-z'], plan.worktreePath)).stdout.split('\0').filter(Boolean);
    if (flags.some((line) => /^[a-zS]/.test(line))) conflict('The worktree index has hidden or sparse entries. Restore a normal clean index before cleanup.');
    const status = (await this.git.run(['-c', 'core.filemode=true', 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignored=matching', '--ignore-submodules=none'], plan.worktreePath)).stdout;
    if (status) conflict('The worktree contains modified, untracked or ignored files. Preserve or remove those changes explicitly before retrying.');
    return admin;
  }
  async create(plan: WorktreePlan) {
    await this.source(plan);
    if (!(await this.absent(plan))) conflict('The destination or Git registration already exists. Verify the recorded worktree instead of overwriting it.');
    const filters = await this.optional(['config', '--get-regexp', '^filter\..*\.(smudge|process)$'], plan.sourcePath);
    if (filters) conflict('Configured checkout filters are not supported for task worktree preparation. Use a repository configuration without smudge/process filters.');
    await this.destination(plan.worktreePath, true);
    await this.git.run(['-c', 'core.fsync=all', '-c', 'core.fsyncMethod=fsync', '-c', 'core.sparseCheckout=false',
      '-c', 'submodule.recurse=false', 'worktree', 'add', '--detach', '--', plan.worktreePath, plan.resolvedCommitSha], plan.sourcePath, 120000);
  }
  async durable(plan: WorktreePlan) {
    const admin = await this.verify(plan);
    const visit = async (directory: string): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) await visit(file);
        else if (entry.isFile()) await sync(file);
        // Tracked symlinks are valid Git content; never follow their targets.
      }
      await sync(directory);
    };
    await visit(plan.worktreePath); await visit(admin); await sync(path.dirname(admin)); await sync(path.dirname(plan.worktreePath));
  }
  async remove(plan: WorktreePlan) {
    await this.verify(plan);
    await this.git.run(['worktree', 'remove', '--', plan.worktreePath], plan.sourcePath, 120000);
    if (!(await this.absent(plan))) conflict('Git did not completely remove the recorded worktree.');
    await sync(path.dirname(plan.worktreePath));
    const registry = path.join(plan.commonGitDir, 'worktrees');
    await sync(await present(registry) ? registry : plan.commonGitDir);
    await this.pin(plan, false);
  }
}
