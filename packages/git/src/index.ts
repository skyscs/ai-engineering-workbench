import { spawn } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { devNull } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DomainError, type GitFailure, type RepositoryMetadata } from '@aew/core';

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

  async exclusive<T>(commonGitDir: string, run: () => Promise<T>): Promise<T> {
    if (this.locks.has(commonGitDir)) throw new DomainError('CONFLICT', 'Another Git operation is using this repository.');
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

  async inspect(source: string, requestedRef: string | null): Promise<RepositoryMetadata> {
    const directory = await canonicalDirectory(source);
    const localPath = await canonicalDirectory((await this.run(['rev-parse', '--show-toplevel'], directory)).stdout.trim());
    const commonGitDir = await canonicalDirectory((await this.run(['rev-parse', '--path-format=absolute', '--git-common-dir'], localPath)).stdout.trim());
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
      if (!baseRef) invalid('No default branch could be detected. Enter an explicit base ref.');
      resolvedCommitSha = await this.optional(['rev-parse', '--verify', '--quiet', '--end-of-options', `${baseRef}^{commit}`], localPath, 1);
      if (!resolvedCommitSha) invalid('The base ref must resolve to an existing commit.');
    }
    const shallow = (await this.run(['rev-parse', '--is-shallow-repository'], localPath)).stdout.trim() === 'true';
    return { localPath, commonGitDir, remoteUrl: remote ? redact(remote) : null,
      defaultBranch: defaultBranch ?? headBranch, baseRef, resolvedCommitSha, shallow };
  }

  async clone(source: string, target: string, cwd: string): Promise<void> {
    const inherited = this.options.env ?? process.env;
    const configured = inherited.GIT_SSH_COMMAND ?? await this.optional(['config', '--get', 'core.sshCommand'], cwd, 1);
    const executable = inherited.GIT_SSH;
    const ssh = configured ?? (executable ? "'" + executable.replaceAll("'", "'\\''") + "'" : 'ssh');
    // No checkout, submodules, templates, shared objects or hardlinks to the source.
    await this.run(['-c', `core.sshCommand=${ssh} -oBatchMode=yes -oStrictHostKeyChecking=yes`,
      '-c', 'core.fsync=all', '-c', 'core.fsyncMethod=fsync', 'clone', '--no-checkout', '--no-local', '--template=', '--', source, target], cwd, this.options.timeoutMs ?? 120000);
  }
}
