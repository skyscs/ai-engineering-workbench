import { spawn } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { devNull } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DomainError, type GitFailure, type RepositoryMetadata } from '@aew/core';
export { WorktreeGit, worktreePlan, type WorktreePlan } from './worktrees.js';

export function redact(value: string): string {
  return value.replace(/(https?:\/\/)[^\s/]*@/gi, '$1[redacted]@')
    .replace(/(ssh:\/\/[^\s/:@]+):[^\s/@]*@/gi, '$1:[redacted]@')
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi, '$1')
    .replace(/((?:password|token|authorization)\s*[:=]\s*)[^\r\n]+/gi, '$1[redacted]');
}
export class GitError extends Error {
  constructor(public readonly failure: GitFailure) { super(failure.message); this.name = 'GitError'; }
}
function invalid(message: string): never { throw new DomainError('INVALID_INPUT', message); }

/** Only local paths, HTTPS and OpenSSH transports are accepted, including after URL rewriting. */
export async function cloneSource(value: string): Promise<string> {
  if (!value || value.startsWith('-') || /[\u0000-\u001f\u007f]/.test(value)) {
    invalid('Use an absolute local path, SSH URL or HTTPS URL.');
  }
  if (path.isAbsolute(value)) return canonicalDirectory(value);
  if (value.startsWith('file://')) {
    try { const url = new URL(value); if (url.search || url.hash) invalid('Local file URLs cannot contain a query or fragment.'); return await canonicalDirectory(fileURLToPath(url)); }
    catch (error) { if (error instanceof DomainError || error instanceof GitError) throw error; invalid('Use a local file URL without a remote host.'); }
  }
  if (/^(?:https|ssh):\/\//.test(value)) {
    let url: URL;
    try { url = new URL(value); } catch { invalid('Invalid repository URL.'); }
    if (!url.hostname || !url.pathname || url.pathname === '/' || url.password || url.search || url.hash ||
      (url.protocol === 'https:' && url.username)) invalid('Use a repository URL without embedded credentials, query or fragment; configure system Git authentication instead.');
    return value;
  }
  if (!value.includes('://') && /^(?:[A-Za-z0-9._-]+@)?[A-Za-z0-9][A-Za-z0-9.-]*:[^\s:]+$/.test(value)) return value;
  invalid('Allowed clone sources are absolute local paths, file URLs, SSH and HTTPS.');
}
async function canonicalDirectory(value: string): Promise<string> {
  if (!path.isAbsolute(value)) invalid('Use an absolute path on the daemon host.');
  try {
    const root = await realpath(value);
    if (!(await stat(root)).isDirectory()) invalid('The repository path must be a directory.');
    return root;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new GitError({ code: 'REPOSITORY_PATH_UNAVAILABLE', message: 'Cannot read the repository directory. Check its path and permissions.', exitCode: null, signal: null, stderr: '' });
  }
}

export interface GitOptions { executable?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number }
export class GitClient {
  private readonly controllers = new Set<AbortController>();
  private readonly locks = new Set<string>();
  private stopping = false;
  constructor(private readonly options: GitOptions = {}) {}

  stop(): void { this.stopping = true; for (const controller of this.controllers) controller.abort(); }

  assertAvailable(commonGitDir: string): void {
    if (this.locks.has(commonGitDir)) throw new DomainError('CONFLICT', 'Another Git operation is using this repository.');
  }

  async exclusive<T>(commonGitDir: string, run: () => Promise<T>): Promise<T> {
    this.assertAvailable(commonGitDir);
    this.locks.add(commonGitDir);
    try { return await run(); } finally { this.locks.delete(commonGitDir); }
  }

  run(args: string[], cwd: string, timeoutMs = this.options.timeoutMs ?? 15000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const controller = new AbortController();
    if (this.stopping) controller.abort();
    this.controllers.add(controller);
    const env = { ...(this.options.env ?? process.env) };
    // Do not inherit repository selectors, tracing, injected config or alternate object stores.
    for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
    // Honor an explicit system-config opt-out, including isolated test fixtures.
    // Arbitrary config paths, injected entries and repository selectors stay cleared.
    if ((this.options.env ?? process.env).GIT_CONFIG_NOSYSTEM === '1') env.GIT_CONFIG_NOSYSTEM = '1';
    Object.assign(env, { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never', GIT_ASKPASS: devNull,
      SSH_ASKPASS_REQUIRE: 'never', GIT_ALLOW_PROTOCOL: 'file:ssh:https', GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', LC_ALL: 'C' });
    return new Promise((resolve, reject) => {
      const child = spawn(this.options.executable ?? 'git', ['-c', `core.hooksPath=${devNull}`,
        '-c', 'core.fsmonitor=false', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args],
      { cwd, env, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '', reason: string | null = null, killTimer: ReturnType<typeof setTimeout> | undefined;
      let spawnError: NodeJS.ErrnoException | null = null;
      const kill = (signal: NodeJS.Signals) => {
        if (!child.pid) return;
        try { if (process.platform === 'win32') child.kill(signal); else process.kill(-child.pid, signal); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') spawnError = error as NodeJS.ErrnoException; }
      };
      const terminate = (code: string) => {
        if (reason) return;
        reason = code; kill('SIGTERM');
        killTimer = setTimeout(() => kill('SIGKILL'), 500);
      };
      const abort = () => terminate('GIT_CANCELLED');
      controller.signal.addEventListener('abort', abort, { once: true });
      if (controller.signal.aborted) abort();
      const timer = setTimeout(() => terminate('GIT_TIMEOUT'), timeoutMs);
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => { stdout += chunk; if (stdout.length > 262144) { stdout = stdout.slice(0, 262144); terminate('GIT_OUTPUT_LIMIT'); } });
      child.stderr.on('data', (chunk: string) => { stderr += chunk; if (stderr.length > 32768) { stderr = stderr.slice(0, 32768); terminate('GIT_OUTPUT_LIMIT'); } });
      child.on('error', (error) => { spawnError = error; });
      child.on('close', (exitCode, signal) => {
        clearTimeout(timer); if (killTimer) { kill('SIGKILL'); clearTimeout(killTimer); }
        controller.signal.removeEventListener('abort', abort); this.controllers.delete(controller);
        const code = reason ?? (spawnError ? 'GIT_UNAVAILABLE' : exitCode !== 0 ? 'GIT_FAILED' : null);
        if (code) reject(new GitError({ code, message: code === 'GIT_UNAVAILABLE' ? 'Cannot start system Git. Check installation and permissions.' :
          code === 'GIT_TIMEOUT' ? 'Git exceeded its execution deadline. Check connectivity and retry explicitly.' :
          code === 'GIT_CANCELLED' ? 'Git was stopped during daemon shutdown.' :
          code === 'GIT_OUTPUT_LIMIT' ? 'Git output exceeded the diagnostic limit.' : 'Git failed. Check the repository, ref and system Git authentication.',
          exitCode, signal, stderr: redact(stderr) }));
        else resolve({ stdout, stderr: redact(stderr), exitCode: exitCode! });
      });
    });
  }

  private async optional(args: string[], cwd: string, absentCode: number): Promise<string | null> {
    try { return (await this.run(args, cwd)).stdout.trim() || null; }
    catch (error) { if (error instanceof GitError && error.failure.code === 'GIT_FAILED' && error.failure.exitCode === absentCode && !error.failure.stderr) return null; throw error; }
  }

  async identity(source: string): Promise<{ localPath: string; commonGitDir: string }> {
    const directory = await canonicalDirectory(source);
    const localPath = await canonicalDirectory((await this.run(['rev-parse', '--show-toplevel'], directory)).stdout.trim());
    const commonGitDir = await canonicalDirectory((await this.run(['rev-parse', '--path-format=absolute', '--git-common-dir'], localPath)).stdout.trim());
    return { localPath, commonGitDir };
  }

  async inspect(source: string, requestedRef: string | null, allowMissingRef = false): Promise<RepositoryMetadata> {
    const { localPath, commonGitDir } = await this.identity(source);
    const remote = await this.optional(['config', '--get', 'remote.origin.url'], localPath, 1);
    const defaultBranch = await this.optional(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD'], localPath, 1);
    const headBranch = await this.optional(['symbolic-ref', '--quiet', 'HEAD'], localPath, 1);
    let baseRef = requestedRef ?? defaultBranch ?? headBranch;
    if (baseRef && (/^[^-\s][^\s\u0000-\u001f\u007f]*$/.test(baseRef) === false || baseRef.length > 256)) invalid('Use a branch, tag, full ref or commit SHA without whitespace or option prefixes.');
    const refs = (await this.run(['for-each-ref', '--count=1', '--format=%(refname)'], localPath)).stdout.trim();
    const head = await this.optional(['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'], localPath, 1);
    const empty = !refs && !head;
    let resolvedCommitSha: string | null = null;
    if (empty && requestedRef === null) baseRef = null;
    else {
      if (!baseRef && !allowMissingRef) invalid('No default branch could be detected. Enter an explicit base ref.');
      if (baseRef) resolvedCommitSha = await this.optional(['rev-parse', '--verify', '--quiet', '--end-of-options', `${baseRef}^{commit}`], localPath, 1);
      if (!resolvedCommitSha && !allowMissingRef) invalid('The base ref must resolve to an existing commit.');
    }
    const shallow = (await this.run(['rev-parse', '--is-shallow-repository'], localPath)).stdout.trim() === 'true';
    return { localPath, commonGitDir, remoteUrl: remote ? redact(remote) : null,
      defaultBranch: defaultBranch ?? headBranch, baseRef, resolvedCommitSha, shallow };
  }

  private async sshCommand(cwd: string): Promise<string> {
    const inherited = this.options.env ?? process.env;
    const configured = inherited.GIT_SSH_COMMAND ?? await this.optional(['config', '--get', 'core.sshCommand'], cwd, 1);
    const executable = inherited.GIT_SSH;
    const ssh = configured ?? (executable ? "'" + executable.replaceAll("'", "'\\''") + "'" : 'ssh');
    return `${ssh} -oBatchMode=yes -oStrictHostKeyChecking=yes`;
  }

  async clone(source: string, target: string, cwd: string): Promise<void> {
    // No checkout, submodules, templates, shared objects or hardlinks to the source.
    await this.run(['-c', `core.sshCommand=${await this.sshCommand(cwd)}`,
      '-c', 'core.fsync=all', '-c', 'core.fsyncMethod=fsync', 'clone', '--no-checkout', '--no-local', '--template=', '--', source, target], cwd, this.options.timeoutMs ?? 120000);
  }

  async prepareFetch(expected: { localPath: string; commonGitDir: string }): Promise<string[]> {
    const actual = await this.identity(expected.localPath);
    if (actual.localPath !== expected.localPath || actual.commonGitDir !== expected.commonGitDir) {
      throw new DomainError('CONFLICT', 'The repository canonical path or common git-dir changed. Register the intended checkout again.');
    }
    const cwd = actual.localPath;
    const remotes = (await this.run(['remote'], cwd)).stdout.trim().split('\n').filter(Boolean);
    if (remotes.length > 32) invalid('At most 32 configured remotes are supported for synchronization.');
    if (!remotes.length) return remotes;
    const worktrees = (await this.run(['worktree', 'list', '--porcelain', '-z'], cwd)).stdout.split('\0');
    if (worktrees.some((field) => field.startsWith('branch ') && !field.startsWith('branch refs/heads/'))) {
      invalid('A checkout HEAD points outside local branches. Restore a normal local branch or detached HEAD before synchronization.');
    }
    const symbolicRefs = (await this.run(['for-each-ref', '--format=%(refname) %(symref)'], cwd)).stdout.trim().split('\n');
    for (const ref of symbolicRefs) {
      const [source, target] = ref.trim().split(' ');
      if (target && !remotes.some((name) => source === `refs/remotes/${name}/HEAD` && target.startsWith(`refs/remotes/${name}/`) && target !== source)) {
        invalid('Unsupported symbolic ref. Synchronization must not indirectly change local branches, tags or task pins.');
      }
    }
    for (const name of remotes) {
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) invalid('Synchronization requires simple remote names containing letters, digits, dots, underscores or hyphens.');
      await this.run(['check-ref-format', `refs/remotes/${name}/probe`], cwd);
      const values = await this.optional(['config', '--null', '--get-all', `remote.${name}.fetch`], cwd, 1);
      const specs = values?.split('\0').filter(Boolean) ?? [];
      if (specs.length !== 1 || ![ `+refs/heads/*:refs/remotes/${name}/*`, `refs/heads/*:refs/remotes/${name}/*` ].includes(specs[0]!)) {
        invalid('Unsupported fetch refspec. Each remote must map refs/heads/* only to its own refs/remotes/<name>/* namespace.');
      }
      for (const field of ['mirror', 'skipFetchAll', 'skipDefaultUpdate']) {
        const value = await this.optional(['config', '--type=bool', '--get', `remote.${name}.${field}`], cwd, 1);
        if (value === 'true') invalid('Mirrored or skipped remotes are not supported by workspace synchronization.');
      }
    }
    return remotes;
  }

  async fetchAll(expected: { localPath: string; commonGitDir: string }, remotes: string[]): Promise<void> {
    // Recheck the complete plan immediately before mutation; never repair repository configuration.
    const current = await this.prepareFetch(expected);
    if (JSON.stringify(current) !== JSON.stringify(remotes)) throw new DomainError('CONFLICT', 'Remote configuration changed during synchronization. Retry explicitly.');
    const overrides = remotes.flatMap((name) => ['-c', `remote.${name}.pruneTags=false`, '-c', `remote.${name}.tagOpt=--no-tags`]);
    await this.run(['-c', `core.sshCommand=${await this.sshCommand(expected.localPath)}`,
      '-c', 'fetch.pruneTags=false', '-c', 'fetch.writeCommitGraph=false', ...overrides,
      'fetch', '--all', '--prune', '--no-prune-tags', '--no-tags', '--no-recurse-submodules',
      '--no-write-fetch-head', '--no-auto-maintenance', '--jobs=1'], expected.localPath, this.options.timeoutMs ?? 120000);
  }
}
